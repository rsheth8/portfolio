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
  // plus a reusable white-noise buffer for hats. Lets the visuals come alive
  // on first visit with zero assets and no copyright risk (it's synthesized).
  private demoNodes: AudioNode[] = [];
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
   * Play a synthesized chill beat — downtempo groove, no file or licensing.
   * Routed through the shared analyser so every scene lights up across bands.
   */
  async playDemo(): Promise<void> {
    const ctx = await this.ensureContext();
    this.teardownSource();

    const mix = ctx.createGain();
    mix.gain.value = 0.88;
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

    const tempo = 78;
    const sixteenth = 60 / tempo / 4;
    const stepsPerBar = 16;
    // Dm9 · Bbmaj7 · Fmaj7 · Cmaj7 — warm, open voicings
    const prog: { root: number; chord: number[] }[] = [
      { root: 73.42, chord: [0, 3, 7, 10] },
      { root: 58.27, chord: [0, 4, 7, 11] },
      { root: 87.31, chord: [0, 4, 7, 11] },
      { root: 65.41, chord: [0, 4, 7, 11] },
    ];
    const semi = (f: number, n: number) => f * Math.pow(2, n / 12);

    const softKick = (t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g);
      g.connect(mix);
      o.start(t);
      o.stop(t + 0.38);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    };

    const rim = (t: number) => {
      const src = ctx.createBufferSource();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      bp.type = "bandpass";
      bp.frequency.value = 2800;
      bp.Q.value = 1.2;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(bp);
      bp.connect(g);
      g.connect(mix);
      src.start(t);
      src.stop(t + 0.05);
      src.onended = () => {
        src.disconnect();
        bp.disconnect();
        g.disconnect();
      };
    };

    const subBass = (t: number, root: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = root;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.38, t + 0.06);
      g.gain.setValueAtTime(0.32, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(mix);
      o.start(t);
      o.stop(t + dur + 0.05);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    };

    const rhodes = (t: number, root: number, chord: number[], dur: number) => {
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      lp.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.12);
      g.gain.setValueAtTime(0.09, t + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lp.connect(g);
      g.connect(mix);
      const oscs = chord.map((n, i) => {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = semi(root * 2, n);
        o.detune.value = (i - 1.5) * 5;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
        return o;
      });
      oscs[oscs.length - 1].onended = () => {
        oscs.forEach((o) => o.disconnect());
        lp.disconnect();
        g.disconnect();
      };
    };

    const shaker = (t: number, amp: number) => {
      const src = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      hp.type = "highpass";
      hp.frequency.value = 5000;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(hp);
      hp.connect(g);
      g.connect(mix);
      src.start(t);
      src.stop(t + 0.04);
      src.onended = () => {
        src.disconnect();
        hp.disconnect();
        g.disconnect();
      };
    };

    const beat = sixteenth * 4;
    const scheduleStep = (step: number, t: number) => {
      const bar = Math.floor(step / stepsPerBar) % prog.length;
      const inBar = step % stepsPerBar;
      const { root, chord } = prog[bar];

      // Laid-back boom-bap: kick on 1 & 9, rim on 5 & 13
      if (inBar === 0 || inBar === 8) softKick(t);
      if (inBar === 4 || inBar === 12) rim(t);

      if (inBar === 0) {
        subBass(t, root, beat * 3.5);
        rhodes(t, root, chord, beat * 4);
      }

      // Sparse shaker — offbeats and ghosts
      if (inBar % 2 === 1) shaker(t, inBar === 7 || inBar === 15 ? 0.05 : 0.03);
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

    this.setState({ kind: "demo", trackName: "Chill beat", isPlaying: true });
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
