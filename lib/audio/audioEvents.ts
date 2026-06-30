"use client";

/**
 * Onset detector — turns the live analyser stream into discrete "beat" and
 * "drop" events that the rest of the site can react to (screen flash, camera
 * kick, haptics). One shared rAF loop runs only while something is subscribed.
 *
 * Detection works on loudness-normalized bands (see bandNormalizer) so the
 * thresholds hold regardless of how loud the source is mastered:
 *  - beat: a rising edge in the bass well above its recent average
 *  - drop: a large jump in overall energy above its slow-moving baseline,
 *          i.e. the track opening up after a build or a breakdown
 */

import { getAudioEngine } from "./AudioEngine";
import { computeBands } from "./useAudioAnalyser";
import { createMasterNormalizer, type BandLevels } from "./bandNormalizer";
import { getSpotifyVisualSync } from "@/lib/streaming/spotifyVisualSync";

export interface AudioEvent {
  /** Normalized bands at the moment of the event. */
  bands: BandLevels;
  /** Event strength in [0, 1] — how hard the hit was. */
  intensity: number;
}

type Listener = (e: AudioEvent) => void;

class AudioEventsSingleton {
  private beatListeners = new Set<Listener>();
  private dropListeners = new Set<Listener>();
  private raf = 0;
  private normalize = createMasterNormalizer();

  private bassEma = 0;
  private energyFast = 0;
  private energySlow = 0;
  private lastBeat = 0;
  private lastDrop = 0;

  onBeat(cb: Listener): () => void {
    this.beatListeners.add(cb);
    this.ensureLoop();
    return () => {
      this.beatListeners.delete(cb);
      this.maybeStop();
    };
  }

  onDrop(cb: Listener): () => void {
    this.dropListeners.add(cb);
    this.ensureLoop();
    return () => {
      this.dropListeners.delete(cb);
      this.maybeStop();
    };
  }

  private ensureLoop() {
    if (this.raf) return;
    const tick = (now: number) => {
      this.detect(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private maybeStop() {
    if (!this.beatListeners.size && !this.dropListeners.size && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private detect(now: number) {
    const engine = getAudioEngine();

    let bands: BandLevels;
    if (engine.isExternalPlayback()) {
      // Spotify bands are already loudness-normalized.
      bands = getSpotifyVisualSync().getBands();
    } else {
      const { freq } = engine.pullFrame();
      bands = this.normalize(computeBands(freq) as BandLevels);
    }

    const { bass, energy } = bands;

    // Beat — rising edge in bass above its recent average, with a refractory
    // window so a single kick doesn't fire twice.
    const bassRise = bass - this.bassEma;
    if (
      bassRise > 0.16 &&
      bass > 0.42 &&
      now - this.lastBeat > 110
    ) {
      this.lastBeat = now;
      const e: AudioEvent = { bands, intensity: Math.min(1, bass) };
      this.beatListeners.forEach((l) => l(e));
    }
    this.bassEma += (bass - this.bassEma) * 0.18;

    // Drop — energy surges well past its slow baseline after a relative lull.
    this.energyFast += (energy - this.energyFast) * 0.4;
    this.energySlow += (energy - this.energySlow) * 0.02;
    if (
      this.energyFast > 0.66 &&
      this.energyFast - this.energySlow > 0.26 &&
      now - this.lastDrop > 1300
    ) {
      this.lastDrop = now;
      const e: AudioEvent = { bands, intensity: Math.min(1, this.energyFast) };
      this.dropListeners.forEach((l) => l(e));
    }
  }
}

let instance: AudioEventsSingleton | null = null;

export function getAudioEvents(): AudioEventsSingleton {
  if (!instance) instance = new AudioEventsSingleton();
  return instance;
}
