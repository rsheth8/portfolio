"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getAudioEngine, type AudioState } from "./AudioEngine";
import { getSpotifyVisualSync } from "@/lib/streaming/spotifyVisualSync";

/**
 * Live audio bands. Updated in-place every rAF tick. Consumers read these
 * from inside useFrame — no React re-render per frame.
 *
 * All values are normalized to [0, 1] from the 0-255 byte FFT.
 *
 * Band ranges chosen to match perceptual ranges in modern hip-hop / pop
 * production (which is what most visitors will throw at the site):
 *   bass     20  -  120 Hz   (sub + kick fundamentals)
 *   lowMid  120  -  500 Hz   (snare body, bass guitar overtones)
 *   mid     500  - 2000 Hz   (vocal body, lead instruments)
 *   highMid 2000 - 6000 Hz   (vocal presence, hi-hats)
 *   high    6000 - 16000 Hz  (cymbals, air, sparkle)
 */
export interface AudioBands {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  /** Combined RMS-style energy across all bands, [0, 1]. */
  energy: number;
  /** Raw FFT bins, length = analyser.frequencyBinCount (512). */
  freq: Uint8Array;
  /** Raw time-domain waveform, same length. */
  time: Uint8Array;
}

const EMPTY_BUFFER = new Uint8Array(512);

/** Returns a mutable ref whose `.current` always points at the latest bands. */
export function useAudioAnalyser(): React.RefObject<AudioBands> {
  const ref = useRef<AudioBands>({
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    high: 0,
    energy: 0,
    freq: EMPTY_BUFFER,
    time: EMPTY_BUFFER,
  });

  useEffect(() => {
    const engine = getAudioEngine();
    let raf = 0;
    const tick = () => {
      const { freq, time } = engine.pullFrame();
      let bands = computeBands(freq);

      // Spotify SDK audio doesn't route through our analyser — derive bands
      // from Spotify's Audio Analysis API synced to live playback position.
      if (engine.isExternalPlayback()) {
        const frame = getSpotifyVisualSync().getFrame();
        bands = frame.bands;
        ref.current = {
          ...bands,
          freq: frame.freq,
          time: frame.time,
        };
        raf = requestAnimationFrame(tick);
        return;
      }

      ref.current = {
        ...bands,
        freq,
        time,
      };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

/** Convert raw 0-255 FFT bins to normalized band averages. The bin index
 * maps to frequency as: freq = binIndex * (sampleRate / fftSize).
 * For a 48 kHz sample rate and fftSize=1024, each bin = 46.875 Hz. */
function computeBands(freq: Uint8Array): Omit<AudioBands, "freq" | "time"> {
  // Approximate bin ranges for the perceptual bands defined above.
  // Assumes 48 kHz sample rate / 1024 fft → 46.875 Hz per bin.
  const ranges: [number, number][] = [
    [0, 3],     // bass        ≈ 0 - 141 Hz
    [3, 11],    // lowMid      ≈ 141 - 516 Hz
    [11, 43],   // mid         ≈ 516 - 2016 Hz
    [43, 128],  // highMid     ≈ 2016 - 6000 Hz
    [128, 342], // high        ≈ 6000 - 16031 Hz
  ];
  const out = [0, 0, 0, 0, 0];
  for (let band = 0; band < 5; band++) {
    const [lo, hi] = ranges[band];
    let sum = 0;
    const len = Math.min(hi, freq.length) - lo;
    if (len <= 0) continue;
    for (let i = lo; i < Math.min(hi, freq.length); i++) {
      sum += freq[i];
    }
    out[band] = sum / len / 255; // normalize to [0, 1]
  }
  const energy = (out[0] + out[1] + out[2] + out[3] + out[4]) / 5;
  return {
    bass: out[0],
    lowMid: out[1],
    mid: out[2],
    highMid: out[3],
    high: out[4],
    energy,
  };
}

/** Cached server snapshot — must be a stable reference for useSyncExternalStore. */
const SERVER_AUDIO_STATE: AudioState = {
  kind: "none",
  trackName: "",
  isPlaying: false,
  volume: 0.8,
};

/** Read-only audio state hook for the picker UI (gets React re-renders). */
export function useAudioState(): AudioState {
  const engine = getAudioEngine();
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
    () => SERVER_AUDIO_STATE,
  );
}
