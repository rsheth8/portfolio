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

export type SourceKind = "none" | "file" | "mic" | "url" | "default";

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
  private currentMicStream: MediaStream | null = null;

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
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
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
    if (this.currentMicStream) {
      this.currentMicStream.getTracks().forEach((t) => t.stop());
      this.currentMicStream = null;
    }
  }

  /** Play a local file (from a File picker). */
  async playFile(file: File): Promise<void> {
    const ctx = await this.ensureContext();
    this.teardownSource();
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = true;
    el.volume = 1.0; // gain node handles real volume
    this.currentAudioElement = el;
    const node = ctx.createMediaElementSource(el);
    node.connect(this.gain!);
    this.currentSourceNode = node;
    await el.play();
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
    this.currentAudioElement = el;
    const node = ctx.createMediaElementSource(el);
    node.connect(this.gain!);
    this.currentSourceNode = node;
    await el.play();
    this.setState({
      kind: "url",
      trackName: name ?? url.split("/").pop() ?? "URL stream",
      isPlaying: true,
    });
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
    if (this.currentAudioElement) this.currentAudioElement.pause();
    this.setState({ isPlaying: false });
  }

  async resume() {
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
