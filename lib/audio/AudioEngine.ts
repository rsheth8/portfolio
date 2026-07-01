/**
 * AudioEngine — singleton that owns the entire Web Audio graph for the site.
 *
 * Graph:
 *   sourceNode (file | mic | SoundCloud) → gainNode → analyserNode → destination
 *
 * The analyser is shared by every visualization on the page (via the
 * useAudioAnalyser hook). Source can be hot-swapped without rebuilding
 * the graph — only the sourceNode is disconnected/reconnected.
 *
 * Browser quirks handled here:
 *  - AudioContext requires a user gesture before .resume() works
 *  - HTMLAudioElement source needs `crossOrigin = 'anonymous'` for FFT data
 *  - MediaStreamSource (mic) needs explicit getUserMedia() permission
 */

import { DEMO_TRACK_NAME } from "./demoConfig";

export type SourceKind = "none" | "file" | "mic" | "url" | "demo" | "spotify";

export interface AudioState {
  kind: SourceKind;
  trackName: string;
  isPlaying: boolean;
  volume: number;
}

type Listener = (state: AudioState) => void;

class AudioEngineSingleton {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private currentSourceNode: AudioNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentMicStream: MediaStream | null = null;
  private externalPlayback = false;

  // Generative demo track — persistent mix bus + lookahead scheduler timer,
  // plus a reusable white-noise buffer for percussion. Lets the visuals come
  // alive on first visit with zero assets and no copyright risk (synthesized).
  private demoNodes: AudioNode[] = [];
  private demoOscillators: OscillatorNode[] = [];
  private demoTimer: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private iosUnlocked = false;

  private freqData: Uint8Array = new Uint8Array(0);
  private timeData: Uint8Array = new Uint8Array(0);

  private state: AudioState = {
    kind: "none",
    trackName: "",
    isPlaying: false,
    volume: 0.8,
  };
  private listeners = new Set<Listener>();

  /** Ensure the AudioContext exists and is running. Must be called from
   * inside a user gesture handler (click) on first use. */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx =
        (window.AudioContext as typeof AudioContext) ||
        ((window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext);
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024; // 512 frequency bins
      this.analyser.smoothingTimeConstant = 0.78;
      // Explicit ArrayBuffer backing so the DOM types accept these in
      // getByteFrequencyData / getByteTimeDomainData (which require
      // Uint8Array<ArrayBuffer>, not the broader ArrayBufferLike).
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.state.volume;
      this.gain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // iOS suspends the context on interruptions (calls, route changes, the
      // app backgrounding). Auto-resume so audio comes back without a re-tap.
      this.ctx.addEventListener("statechange", () => {
        const s = this.ctx?.state as string | undefined;
        if (s === "interrupted" || s === "suspended") {
          this.ctx?.resume().catch(() => {});
        }
      });
    }

    // iOS Safari keeps Web Audio silent until a sound node is started inside a
    // user gesture — play a one-sample silent buffer to unlock it. Must run
    // synchronously (before the resume await) so it's still within the gesture.
    this.unlockIOS();

    const state = this.ctx.state as string;
    if (state === "suspended" || state === "interrupted") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /** One-time iOS Web Audio unlock — a silent buffer started in the gesture. */
  private unlockIOS() {
    if (this.iosUnlocked || !this.ctx) return;
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      this.iosUnlocked = true;
    } catch {
      // non-fatal — context may already be unlocked
    }
  }

  /** Pull the latest FFT frame into the shared buffer. Called every frame
   * by the useAudioAnalyser hook — no allocation here. */
  pullFrame(): { freq: Uint8Array; time: Uint8Array } {
    if (this.analyser) {
      // The DOM lib narrowed these to require Uint8Array<ArrayBuffer>;
      // our buffers always use ArrayBuffer-backed instances, so cast.
      this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
      this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);
    }
    return { freq: this.freqData, time: this.timeData };
  }

  /** Disconnect whatever source is currently routed in. */
  private teardownSource() {
    // Stop the generative demo: kill the scheduler so no new notes fire, then
    // disconnect the mix bus to silence any in-flight one-shot voices instantly.
    if (this.demoTimer !== null) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.demoOscillators.length) {
      this.demoOscillators.forEach((o) => {
        try {
          o.stop();
        } catch {
          // already stopped
        }
      });
      this.demoOscillators = [];
    }
    if (this.demoNodes.length) {
      this.demoNodes.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          // already disconnected
        }
      });
      this.demoNodes = [];
    }
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.disconnect();
      } catch {
        // already disconnected
      }
      this.currentSourceNode = null;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.src = "";
      this.currentAudioElement.load();
      this.currentAudioElement = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.externalPlayback = false;
    if (this.currentMicStream) {
      this.currentMicStream.getTracks().forEach((t) => t.stop());
      this.currentMicStream = null;
    }
  }

  /** Play a local file (from a File picker). */
  async playFile(file: File): Promise<void> {
    if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|flac|aac|ogg|webm)$/i.test(file.name)) {
      throw new Error(
        "That file doesn't look like audio. Try mp3, m4a, wav, or flac.",
      );
    }
    const ctx = await this.ensureContext();
    this.teardownSource();
    const url = URL.createObjectURL(file);
    this.currentObjectUrl = url;
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = true;
    el.volume = 1.0; // gain node handles real volume
    el.setAttribute("playsinline", ""); // iOS Safari — play without fullscreen
    this.currentAudioElement = el;
    const node = ctx.createMediaElementSource(el);
    node.connect(this.gain!);
    this.currentSourceNode = node;
    try {
      await el.play();
    } catch {
      throw new Error(
        "Playback blocked — tap Play again. On iOS, pick a file from Files or Downloads.",
      );
    }
    this.setState({
      kind: "file",
      trackName: file.name.replace(/\.[^.]+$/, ""),
      isPlaying: true,
    });
  }

  /** Play a URL (works for direct mp3 URLs and any CORS-friendly stream). */
  async playUrl(url: string, name?: string): Promise<void> {
    const ctx = await this.ensureContext();
    this.teardownSource();
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = true;
    el.volume = 1.0;
    el.setAttribute("playsinline", "");
    this.currentAudioElement = el;
    const node = ctx.createMediaElementSource(el);
    node.connect(this.gain!);
    this.currentSourceNode = node;
    try {
      await el.play();
    } catch {
      throw new Error("Stream blocked — tap Play or try another source.");
    }
    this.setState({
      kind: "url",
      trackName: name ?? url.split("/").pop() ?? "URL stream",
      isPlaying: true,
    });
  }

  /**
   * Spotify Web Playback SDK routes audio outside our graph — update UI state
   * so transport controls reflect what's playing. Visuals sync to Spotify's
   * Audio Analysis API via spotifyVisualSync when externalPlayback is set.
   */
  setExternalPlayback(
    kind: "spotify",
    trackName: string,
    isPlaying: boolean,
  ): void {
    this.externalPlayback = isPlaying;
    this.setState({ kind, trackName, isPlaying });
  }

  stopExternalPlayback(): void {
    if (this.state.kind === "spotify") {
      this.externalPlayback = false;
      this.setState({ kind: "none", trackName: "", isPlaying: false });
    }
  }

  isExternalPlayback(): boolean {
    return this.externalPlayback;
  }

  /**
   * Play a synthesized classic Bollywood groove — tabla, tanpura, sitar, strings.
   * Tuned so every analyser band (bass → high) drives the visuals at full scale.
   */
  async playDemo(): Promise<void> {
    const ctx = await this.ensureContext();
    this.teardownSource();

    const mix = ctx.createGain();
    mix.gain.value = 0.9;
    mix.connect(this.gain!);
    this.demoNodes.push(mix);

    if (!this.noiseBuffer) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const noise = this.noiseBuffer;

    const tempo = 96;
    const sixteenth = 60 / tempo / 4;
    const stepsPerBar = 16;
    // C major pentatonic + F — classic upbeat filmy phrase shapes
    const melody = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0];
    const roots = [130.81, 98.0, 110.0, 98.0]; // Sa / Pa drone roots per bar

    const dholKick = (t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.72, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g);
      g.connect(mix);
      o.start(t);
      o.stop(t + 0.45);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    };

    const tablaNa = (t: number, amp: number) => {
      const src = ctx.createBufferSource();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      bp.type = "bandpass";
      bp.frequency.value = 3200;
      bp.Q.value = 1.4;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(bp);
      bp.connect(g);
      g.connect(mix);
      src.start(t);
      src.stop(t + 0.06);
      src.onended = () => {
        src.disconnect();
        bp.disconnect();
        g.disconnect();
      };
    };

    const manjeera = (t: number, amp: number) => {
      const src = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      hp.type = "highpass";
      hp.frequency.value = 6200;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(hp);
      hp.connect(g);
      g.connect(mix);
      src.start(t);
      src.stop(t + 0.045);
      src.onended = () => {
        src.disconnect();
        hp.disconnect();
        g.disconnect();
      };
    };

    const sitarPluck = (t: number, freq: number, amp: number) => {
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      bp.connect(g);
      g.connect(mix);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.connect(bp);
      src.start(t);
      src.stop(t + 0.6);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(og);
      og.connect(mix);
      o.start(t);
      o.stop(t + 0.55);
      src.onended = () => {
        src.disconnect();
        bp.disconnect();
        g.disconnect();
        o.disconnect();
        og.disconnect();
      };
    };

    const stringPad = (t: number, root: number, dur: number, amp: number) => {
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      lp.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.08);
      g.gain.setValueAtTime(amp * 0.85, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lp.connect(g);
      g.connect(mix);
      const chord = [0, 4, 7];
      const oscs = chord.map((n) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = root * Math.pow(2, n / 12);
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
        return o;
      });
      oscs[oscs.length - 1].onended = () => {
        oscs.forEach((o) => o.disconnect());
        lp.disconnect();
        g.disconnect();
      };
    };

    const startTanpura = () => {
      for (const freq of [130.81, 196.0]) {
        const o = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.value = freq;
        lp.type = "lowpass";
        lp.frequency.value = 520;
        g.gain.value = freq === 130.81 ? 0.07 : 0.045;
        o.connect(lp);
        lp.connect(g);
        g.connect(mix);
        o.start();
        this.demoOscillators.push(o);
        this.demoNodes.push(lp, g);
      }
    };

    startTanpura();

    const beat = sixteenth * 4;
    const scheduleStep = (step: number, t: number) => {
      const bar = Math.floor(step / stepsPerBar);
      const inBar = step % stepsPerBar;
      const root = roots[bar % roots.length];
      // Alternate sparse / full bars so drop detection fires on surges.
      const fullEnsemble = bar % 2 === 0;

      // Filmi keherwa-style 4/4: dhol on 1 & 3, tabla on offbeats, manjeera 8ths.
      if (inBar === 0 || inBar === 8) dholKick(t);
      if (inBar === 4 || inBar === 12) tablaNa(t, fullEnsemble ? 0.28 : 0.18);
      if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) {
        tablaNa(t, 0.12);
      }
      if (inBar % 2 === 1) {
        manjeera(t, fullEnsemble ? 0.07 : 0.04);
      }

      if (inBar === 0) {
        stringPad(t, root, beat * 4, fullEnsemble ? 0.14 : 0.06);
      }

      if (inBar % 4 === 0) {
        const note = melody[(bar * 4 + inBar / 4) % melody.length];
        sitarPluck(t, note, fullEnsemble ? 0.22 : 0.1);
      }

      // Shehnai-like lead on bar downbeats — high-mid sparkle for the EQ top.
      if (fullEnsemble && inBar === 0) {
        sitarPluck(t, melody[(bar + 3) % melody.length] * 1.5, 0.14);
      }
    };

    let step = 0;
    let nextTime = ctx.currentTime + 0.1;
    const scheduler = () => {
      while (nextTime < ctx.currentTime + 0.2) {
        scheduleStep(step, nextTime);
        nextTime += sixteenth;
        step++;
      }
    };
    scheduler();
    this.demoTimer = window.setInterval(scheduler, 50);

    this.setState({ kind: "demo", trackName: DEMO_TRACK_NAME, isPlaying: true });
  }

  /** Capture the microphone and route it through the analyser only — NOT
   * to the destination, to avoid echo. We temporarily disconnect the
   * analyser from destination so mic input doesn't feed back. */
  async useMic(): Promise<void> {
    const ctx = await this.ensureContext();
    this.teardownSource();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.currentMicStream = stream;
    const node = ctx.createMediaStreamSource(stream);
    // For mic we bypass the gain node and route directly to analyser only,
    // skipping destination so the user doesn't hear themselves.
    node.connect(this.analyser!);
    this.currentSourceNode = node;
    this.setState({
      kind: "mic",
      trackName: "Live input",
      isPlaying: true,
    });
  }

  pause() {
    // The generative demo has no media element — silence it by stopping the
    // scheduler and disconnecting its mix bus. resume() regenerates the loop.
    if (this.state.kind === "demo") {
      if (this.demoTimer !== null) {
        clearInterval(this.demoTimer);
        this.demoTimer = null;
      }
      this.demoOscillators.forEach((o) => {
        try {
          o.stop();
        } catch {
          // already stopped
        }
      });
      this.demoOscillators = [];
      this.demoNodes.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          // already disconnected
        }
      });
      this.demoNodes = [];
      this.setState({ isPlaying: false });
      return;
    }
    // Mic has no media element — "pause" means stop feeding the analyser by
    // disconnecting the source node (the stream stays open so resume is instant
    // and doesn't re-prompt for permission).
    if (this.state.kind === "mic") {
      if (this.currentSourceNode) {
        try {
          this.currentSourceNode.disconnect();
        } catch {
          // already disconnected
        }
      }
      this.setState({ isPlaying: false });
      return;
    }
    if (this.currentAudioElement) this.currentAudioElement.pause();
    this.setState({ isPlaying: false });
  }

  async resume() {
    if (this.state.kind === "demo") {
      // Rebuild the generative beat (it's a loop, so there's no position to
      // restore). playDemo re-creates the scheduler and sets isPlaying.
      await this.playDemo();
      return;
    }
    if (this.state.kind === "mic") {
      if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
      if (this.currentSourceNode && this.analyser) {
        try {
          this.currentSourceNode.connect(this.analyser);
        } catch {
          // already connected
        }
      }
      this.setState({ isPlaying: true });
      return;
    }
    if (this.currentAudioElement) {
      await this.currentAudioElement.play();
      this.setState({ isPlaying: true });
    }
  }

  setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = clamped;
    this.setState({ volume: clamped });
  }

  stop() {
    this.teardownSource();
    this.setState({ kind: "none", trackName: "", isPlaying: false });
  }

  /** State + subscription for the React picker UI. Returns the live
   *  object reference — must stay stable between calls for useSyncExternalStore. */
  getState(): AudioState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }
}

let instance: AudioEngineSingleton | null = null;

/** Lazy singleton getter — only constructs on first access (browser-only). */
export function getAudioEngine(): AudioEngineSingleton {
  if (!instance) instance = new AudioEngineSingleton();
  return instance;
}
