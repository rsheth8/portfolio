/**
 * Tracks Spotify playback position and maps it to visual bands via the
 * Audio Analysis API. The Web Playback SDK doesn't expose raw audio, so
 * we sync to pre-computed beats, segments, and loudness instead.
 */

import {
  loadTrackAudioData,
  computeSpotifyBands,
  synthesizeFreqBins,
  synthesizeTimeDomain,
  type SpotifyAnalysis,
  type SpotifyFeatures,
  type SpotifyBandOutput,
} from "./spotifyAnalysis";

export interface SpotifyPlaybackSnapshot {
  trackId: string;
  trackName: string;
  positionMs: number;
  durationMs: number;
  timestampMs: number;
  paused: boolean;
}

class SpotifyVisualSyncSingleton {
  private trackId: string | null = null;
  private analysis: SpotifyAnalysis | null = null;
  private features: SpotifyFeatures | null = null;
  private positionMs = 0;
  private durationMs = 0;
  private timestampMs = 0;
  private paused = true;
  private loadingTrackId: string | null = null;

  /** Mark playback as starting before SDK state arrives (playlists, etc.). */
  markPlaying(): void {
    this.paused = false;
    this.timestampMs = Date.now();
    this.positionMs = 0;
  }

  /** Pre-load analysis when the user picks a track (before SDK state arrives). */
  prepareTrack(trackId: string): void {
    this.markPlaying();
    if (this.trackId !== trackId) {
      this.trackId = trackId;
      this.analysis = null;
      this.features = null;
      this.loadAnalysis(trackId);
    }
  }

  /** Called from the Web Playback SDK on every player_state_changed. */
  updatePlayback(state: SpotifyPlaybackSnapshot): void {
    const prevTrackId = this.trackId;
    this.trackId = state.trackId;
    this.positionMs = state.positionMs;
    this.durationMs = state.durationMs;
    this.timestampMs = state.timestampMs;
    this.paused = state.paused;

    if (state.trackId && state.trackId !== prevTrackId) {
      this.loadAnalysis(state.trackId);
    }
  }

  clear(): void {
    this.trackId = null;
    this.analysis = null;
    this.features = null;
    this.positionMs = 0;
    this.durationMs = 0;
    this.paused = true;
    this.loadingTrackId = null;
  }

  isActive(): boolean {
    return Boolean(this.trackId) && !this.paused;
  }

  /** Interpolate position between SDK state updates for smooth visuals. */
  getPositionSec(): number {
    if (this.paused) return this.positionMs / 1000;
    const elapsed = Date.now() - this.timestampMs;
    const pos = this.positionMs + elapsed;
    const max = this.durationMs > 0 ? this.durationMs : pos;
    return Math.min(pos, max) / 1000;
  }

  getBands(): SpotifyBandOutput {
    return computeSpotifyBands({
      analysis: this.analysis,
      features: this.features,
      positionSec: this.getPositionSec(),
      paused: this.paused,
    });
  }

  /** Full frame for useAudioAnalyser — bands + synthetic freq/time arrays. */
  getFrame(): {
    bands: SpotifyBandOutput;
    freq: Uint8Array;
    time: Uint8Array;
  } {
    const positionSec = this.getPositionSec();
    const bands = this.getBands();
    return {
      bands,
      freq: synthesizeFreqBins(bands, positionSec),
      time: synthesizeTimeDomain(bands, positionSec),
    };
  }

  private loadAnalysis(trackId: string): void {
    if (this.loadingTrackId === trackId) return;
    this.loadingTrackId = trackId;
    this.analysis = null;

    loadTrackAudioData(trackId)
      .then(({ analysis, features }) => {
        if (this.trackId !== trackId) return;
        this.analysis = analysis;
        this.features = features;
      })
      .catch(() => {
        // Analysis unavailable — tempo fallback still runs via features.
      })
      .finally(() => {
        if (this.loadingTrackId === trackId) {
          this.loadingTrackId = null;
        }
      });
  }
}

let instance: SpotifyVisualSyncSingleton | null = null;

export function getSpotifyVisualSync(): SpotifyVisualSyncSingleton {
  if (!instance) instance = new SpotifyVisualSyncSingleton();
  return instance;
}
