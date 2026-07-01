/**
 * Generative demo beats — synthesized live from oscillators + noise, so there's
 * no audio file, no licensing, and zero payload. Each style is tuned to drive
 * the audio-reactive visuals hard across every analyser band, and to give the
 * drop detector something to fire on.
 *
 * A style builder gets the AudioContext, a mix bus (already routed to the shared
 * analyser), and a reusable white-noise buffer, and returns its tempo plus a
 * `scheduleStep(step, t)` the engine's lookahead scheduler calls. Every voice is
 * one-shot and self-cleaning (stops + disconnects on end), so teardown is just
 * "disconnect the mix bus" — no persistent nodes to track.
 */

export type DemoStyle = "edm" | "synthwave";

export interface DemoStyleInfo {
  name: string;
}

export const DEMO_STYLES: Record<DemoStyle, DemoStyleInfo> = {
  edm: { name: "Festival Drop" },
  synthwave: { name: "Synthwave" },
};

export const DEFAULT_DEMO_STYLE: DemoStyle = "edm";

export interface DemoBuild {
  tempo: number;
  scheduleStep: (step: number, t: number) => void;
}

export function buildDemo(
  style: DemoStyle,
  ctx: AudioContext,
  mix: GainNode,
  noise: AudioBuffer,
): DemoBuild {
  return style === "synthwave"
    ? buildSynthwave(ctx, mix, noise)
    : buildEDM(ctx, mix, noise);
}

/* ------------------------------------------------------------------ */
/*  Shared voice helpers                                               */
/* ------------------------------------------------------------------ */

/** Punchy sine kick with a pitch drop. */
function kick(ctx: AudioContext, mix: GainNode, t: number, amp = 0.9) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  g.connect(mix);
  o.start(t);
  o.stop(t + 0.32);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

/** Filtered-noise burst — hats, snares, risers, crashes. */
function noiseHit(
  ctx: AudioContext,
  mix: GainNode,
  noise: AudioBuffer,
  t: number,
  opts: {
    type: BiquadFilterType;
    freq: number;
    q?: number;
    amp: number;
    decay: number;
  },
) {
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noise;
  f.type = opts.type;
  f.frequency.value = opts.freq;
  if (opts.q) f.Q.value = opts.q;
  g.gain.setValueAtTime(opts.amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  src.connect(f);
  f.connect(g);
  g.connect(mix);
  src.start(t);
  src.stop(t + opts.decay + 0.02);
  src.onended = () => {
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

/** Sine sub-bass note. */
function sub(
  ctx: AudioContext,
  mix: GainNode,
  t: number,
  freq: number,
  dur: number,
  amp = 0.5,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
  g.gain.setValueAtTime(amp, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(mix);
  o.start(t);
  o.stop(t + dur + 0.03);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

/** Detuned-saw "supersaw" chord with a filter sweep — the EDM/synthwave core. */
function supersaw(
  ctx: AudioContext,
  mix: GainNode,
  t: number,
  freqs: number[],
  dur: number,
  amp: number,
  cutoffPeak = 4500,
) {
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(cutoffPeak, t + 0.04);
  lp.frequency.exponentialRampToValueAtTime(1200, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  g.connect(mix);
  const oscs: OscillatorNode[] = [];
  for (const f of freqs) {
    for (const d of [-9, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
      oscs.push(o);
    }
  }
  oscs[oscs.length - 1].onended = () => {
    oscs.forEach((o) => o.disconnect());
    lp.disconnect();
    g.disconnect();
  };
}

/** Short plucky single-osc note (arps, leads). */
function pluck(
  ctx: AudioContext,
  mix: GainNode,
  t: number,
  freq: number,
  amp: number,
  decay = 0.16,
  type: OscillatorType = "sawtooth",
) {
  const o = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  lp.type = "lowpass";
  lp.frequency.value = Math.min(8000, freq * 6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(lp);
  lp.connect(g);
  g.connect(mix);
  o.start(t);
  o.stop(t + decay + 0.02);
  o.onended = () => {
    o.disconnect();
    lp.disconnect();
    g.disconnect();
  };
}

/* ------------------------------------------------------------------ */
/*  Chord tables (A-minor loop: Am · F · C · G)                       */
/* ------------------------------------------------------------------ */

interface Chord {
  root: number; // sub-bass root
  notes: number[]; // mid-register chord tones
}

const AM_LOOP: Chord[] = [
  { root: 55.0, notes: [220.0, 261.63, 329.63] }, // Am
  { root: 43.65, notes: [174.61, 220.0, 261.63] }, // F
  { root: 65.41, notes: [261.63, 329.63, 392.0] }, // C
  { root: 49.0, notes: [196.0, 246.94, 293.66] }, // G
];

/* ------------------------------------------------------------------ */
/*  EDM — festival drop with build/breakdown/drop dynamics            */
/* ------------------------------------------------------------------ */

function buildEDM(
  ctx: AudioContext,
  mix: GainNode,
  noise: AudioBuffer,
): DemoBuild {
  const tempo = 128;
  const sixteenth = 60 / tempo / 4;
  const beat = sixteenth * 4;

  const openHat = (t: number, amp: number) =>
    noiseHit(ctx, mix, noise, t, { type: "highpass", freq: 8000, amp, decay: 0.12 });
  const closedHat = (t: number, amp: number) =>
    noiseHit(ctx, mix, noise, t, { type: "highpass", freq: 9000, amp, decay: 0.03 });
  const snare = (t: number, amp: number) => {
    noiseHit(ctx, mix, noise, t, { type: "bandpass", freq: 1800, q: 0.8, amp, decay: 0.14 });
  };
  const crash = (t: number) =>
    noiseHit(ctx, mix, noise, t, { type: "highpass", freq: 5000, amp: 0.22, decay: 1.4 });
  const riser = (t: number, dur: number) => {
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    hp.type = "highpass";
    hp.frequency.setValueAtTime(300, t);
    hp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.02, t);
    g.gain.linearRampToValueAtTime(0.2, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(mix);
    src.start(t);
    src.stop(t + dur + 0.1);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      g.disconnect();
    };
  };

  const chordFor = (bar: number) => AM_LOOP[Math.floor(bar / 2) % AM_LOOP.length];

  return {
    tempo,
    scheduleStep: (step, t) => {
      const bar = Math.floor(step / 16);
      const inBar = step % 16;
      const phase = bar % 8; // 8-bar cycle: drop(0-3) · break(4-5) · build(6-7)
      const ch = chordFor(bar);

      const isDrop = phase <= 3;
      const isBreak = phase === 4 || phase === 5;
      const isBuild = phase === 6 || phase === 7;

      if (phase === 0 && inBar === 0) crash(t);

      if (isDrop) {
        if (inBar % 4 === 0) {
          kick(ctx, mix, t, 0.95);
          sub(ctx, mix, t, ch.root, beat * 0.9, 0.5);
          supersaw(ctx, mix, t, ch.notes, beat * 0.95, 0.14);
        }
        if (inBar % 4 === 2) openHat(t, 0.1);
        if (inBar % 2 === 1) closedHat(t, 0.06);
        // top-note lead sparkle for the high bands
        if (inBar === 6 || inBar === 14) pluck(ctx, mix, t, ch.notes[2] * 2, 0.1, 0.14);
      } else if (isBreak) {
        if (inBar === 0) supersaw(ctx, mix, t, ch.notes, beat * 4, 0.06, 2600);
        if (inBar % 4 === 2) closedHat(t, 0.04);
        if (inBar % 4 === 0) pluck(ctx, mix, t, ch.notes[1] * 2, 0.07, 0.2, "triangle");
      } else if (isBuild) {
        if (phase === 6) {
          if (inBar === 0) riser(t, beat * 8); // 2-bar riser into the drop
          if (inBar % 4 === 0) kick(ctx, mix, t, 0.6);
          if (inBar % 2 === 0) snare(t, 0.1);
        } else {
          // peak: accelerating snare roll, no kick (tension)
          snare(t, 0.08 + (inBar / 16) * 0.14);
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Synthwave — driving retro arps, bass, and pad                     */
/* ------------------------------------------------------------------ */

function buildSynthwave(
  ctx: AudioContext,
  mix: GainNode,
  noise: AudioBuffer,
): DemoBuild {
  const tempo = 104;
  const sixteenth = 60 / tempo / 4;
  const beat = sixteenth * 4;

  const closedHat = (t: number, amp: number) =>
    noiseHit(ctx, mix, noise, t, { type: "highpass", freq: 8500, amp, decay: 0.03 });
  const openHat = (t: number, amp: number) =>
    noiseHit(ctx, mix, noise, t, { type: "highpass", freq: 7500, amp, decay: 0.1 });
  const snare = (t: number, amp: number) =>
    noiseHit(ctx, mix, noise, t, { type: "bandpass", freq: 1500, q: 0.7, amp, decay: 0.18 });

  const bass = (t: number, freq: number) => {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.value = freq;
    lp.type = "lowpass";
    lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sixteenth * 0.95);
    o.connect(lp);
    lp.connect(g);
    g.connect(mix);
    o.start(t);
    o.stop(t + sixteenth + 0.02);
    o.onended = () => {
      o.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  };

  const chordFor = (bar: number) => AM_LOOP[bar % AM_LOOP.length];

  return {
    tempo,
    scheduleStep: (step, t) => {
      const bar = Math.floor(step / 16);
      const inBar = step % 16;
      const ch = chordFor(bar);

      // Gated four-ish kick + backbeat snare.
      if (inBar === 0 || inBar === 8) kick(ctx, mix, t, 0.85);
      if (inBar === 4 || inBar === 12) snare(t, 0.18);

      // Steady hats.
      if (inBar % 2 === 1) closedHat(t, 0.05);
      if (inBar === 7 || inBar === 15) openHat(t, 0.06);

      // Driving 16th bassline, alternating root / octave.
      bass(t, ch.root * (inBar % 2 === 0 ? 1 : 2));

      // Bright 16th arpeggio through the chord tones (octave up).
      pluck(ctx, mix, t, ch.notes[inBar % ch.notes.length] * 2, 0.09, 0.13, "sawtooth");

      // Lush sustained pad once per bar.
      if (inBar === 0) supersaw(ctx, mix, t, ch.notes, beat * 4, 0.07, 2800);
    },
  };
}
