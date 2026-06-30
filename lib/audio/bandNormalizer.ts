/**
 * Adaptive loudness normalizer (auto-gain) for the analyser bands.
 *
 * Why this exists: tracks arrive at wildly different mastering levels. A quiet
 * jazz upload might peak the FFT at 0.25 while a loud pop master sits near 0.95.
 * Without compensation, the same visuals look dead on one and pinned on the
 * other — i.e. they don't "react" consistently across different music.
 *
 * The fix is a single shared gain driven by a peak-follower over the loudest
 * band: it rises instantly to new peaks and decays slowly, so within a second
 * or two of any source the visuals use the full range. Crucially the gain is
 * ONE multiplier applied to every band, so the relative shape (bass vs. highs)
 * is preserved — we adapt to overall loudness without flattening the spectrum.
 *
 * A noise gate keeps near-silence from being amplified into phantom motion.
 */

export interface BandLevels {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  energy: number;
}

const KEYS: (keyof BandLevels)[] = [
  "bass",
  "lowMid",
  "mid",
  "highMid",
  "high",
  "energy",
];

// Smallest peak we'll divide by — caps max gain at 1/FLOOR (~8x) so quiet
// passages get lively but FFT noise can't explode.
const FLOOR = 0.12;
// Per-frame decay of the peak follower. ~0.95/sec at 60fps — gentle enough to
// avoid pumping when a track dips, fast enough to recover headroom after a drop.
const DECAY = 0.9992;
// Below this loudest-band level we treat the frame as silence and output zero,
// so idle/paused states stay calm instead of shimmering on noise.
const NOISE_GATE = 0.025;

export function createMasterNormalizer(): (raw: BandLevels) => BandLevels {
  let peak = FLOOR;

  return (raw: BandLevels): BandLevels => {
    const loudest = Math.max(
      raw.bass,
      raw.lowMid,
      raw.mid,
      raw.highMid,
      raw.high,
    );

    // Peak-hold: jump up to new maxima instantly, otherwise decay toward FLOOR.
    peak = Math.max(loudest, peak * DECAY, FLOOR);

    if (loudest < NOISE_GATE) {
      return { bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, energy: 0 };
    }

    const gain = 1 / peak;
    const out = {} as BandLevels;
    for (const k of KEYS) {
      out[k] = Math.min(1, raw[k] * gain);
    }
    return out;
  };
}
