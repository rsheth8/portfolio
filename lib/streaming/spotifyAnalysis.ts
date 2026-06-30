import { getStoredToken } from "./spotifyPlayer";

/** Spotify Audio Analysis — beat/segment timing for visual sync. */
export interface SpotifyAnalysis {
  beats: { start: number; duration: number; confidence: number }[];
  sections: { start: number; duration: number; loudness: number; tempo: number }[];
  segments: {
    start: number;
    duration: number;
    loudness_start: number;
    loudness_max: number;
    loudness_max_time: number;
    loudness_end: number;
    pitches: number[];
    timbre: number[];
  }[];
  track: { tempo: number; duration: number };
}

export interface SpotifyFeatures {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  loudness: number;
}

export interface SpotifyBandInput {
  analysis: SpotifyAnalysis | null;
  features: SpotifyFeatures | null;
  positionSec: number;
  paused: boolean;
}

export interface SpotifyBandOutput {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  energy: number;
}

const analysisCache = new Map<string, SpotifyAnalysis>();
const featuresCache = new Map<string, SpotifyFeatures>();

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new Error("Connect Spotify first.");

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });

  if (res.status === 401) throw new Error("Spotify session expired — reconnect.");
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error: ${err}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch and cache audio analysis for a track. */
export async function fetchTrackAnalysis(
  trackId: string,
): Promise<SpotifyAnalysis | null> {
  const cached = analysisCache.get(trackId);
  if (cached) return cached;

  try {
    const data = await spotifyFetch<SpotifyAnalysis>(
      `/audio-analysis/${trackId}`,
    );
    analysisCache.set(trackId, data);
    return data;
  } catch {
    return null;
  }
}

/** Fetch and cache audio features for a track. */
export async function fetchTrackFeatures(
  trackId: string,
): Promise<SpotifyFeatures | null> {
  const cached = featuresCache.get(trackId);
  if (cached) return cached;

  try {
    const data = await spotifyFetch<SpotifyFeatures>(
      `/audio-features/${trackId}`,
    );
    featuresCache.set(trackId, data);
    return data;
  } catch {
    return null;
  }
}

/** Load both analysis + features in parallel for a track change. */
export async function loadTrackAudioData(trackId: string): Promise<{
  analysis: SpotifyAnalysis | null;
  features: SpotifyFeatures | null;
}> {
  const [analysis, features] = await Promise.all([
    fetchTrackAnalysis(trackId),
    fetchTrackFeatures(trackId),
  ]);
  return { analysis, features };
}

function findAtTime<T extends { start: number; duration: number }>(
  items: T[],
  tSec: number,
): T | null {
  if (!items.length) return null;
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const item = items[mid];
    if (tSec < item.start) {
      hi = mid - 1;
    } else if (tSec >= item.start + item.duration) {
      lo = mid + 1;
    } else {
      return item;
    }
  }
  return null;
}

function findBeatIndex(
  beats: SpotifyAnalysis["beats"],
  tSec: number,
): number {
  let lo = 0;
  let hi = beats.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid].start <= tSec) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function loudnessAt(
  seg: SpotifyAnalysis["segments"][number],
  tSec: number,
): number {
  const rel = tSec - seg.start;
  if (rel <= seg.loudness_max_time) {
    const p = seg.loudness_max_time > 0 ? rel / seg.loudness_max_time : 1;
    return seg.loudness_start + (seg.loudness_max - seg.loudness_start) * p;
  }
  const tail = seg.duration - seg.loudness_max_time;
  const p = tail > 0 ? (rel - seg.loudness_max_time) / tail : 1;
  return seg.loudness_max + (seg.loudness_end - seg.loudness_max) * p;
}

function normalizeDb(db: number): number {
  return Math.max(0, Math.min(1, (db + 60) / 55));
}

function beatEnvelope(
  beats: SpotifyAnalysis["beats"],
  tSec: number,
): number {
  const idx = findBeatIndex(beats, tSec);
  if (idx < 0) return 0;

  let envelope = 0;
  // Check recent beats — bass pulse decays over ~2 beat durations.
  for (let i = idx; i >= Math.max(0, idx - 3); i--) {
    const beat = beats[i];
    const elapsed = tSec - beat.start;
    if (elapsed < 0 || elapsed > beat.duration * 2.8) continue;
    const decay = Math.exp(-elapsed / (beat.duration * 0.32));
    envelope = Math.max(envelope, decay * beat.confidence);
  }
  return envelope;
}

function pitchesToBands(pitches: number[]): Omit<SpotifyBandOutput, "energy"> {
  const p = pitches.length >= 12 ? pitches : new Array(12).fill(0);
  const sum = (a: number, b: number) => a + b;
  const avg = (start: number, end: number) =>
    p.slice(start, end).reduce(sum, 0) / (end - start);

  return {
    bass: avg(0, 3),
    lowMid: avg(3, 6),
    mid: avg(6, 9),
    highMid: avg(9, 11),
    high: (p[10] + p[11]) / 2,
  };
}

function timbreScale(timbre: number[]): {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
} {
  const t = timbre.length >= 12 ? timbre : new Array(12).fill(0);
  const norm = (v: number) => Math.max(0.15, Math.min(1.4, 0.5 + v / 120));
  return {
    bass: norm(-t[1] + t[2]),
    lowMid: norm(t[0] + t[3]),
    mid: norm(t[4] + t[5]),
    highMid: norm(t[6] + t[7]),
    high: norm(t[8] + t[9] + t[10]),
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Fallback pulse when analysis isn't available yet — uses track tempo. */
export function tempoFallbackBands(
  tempo: number,
  positionSec: number,
  features: SpotifyFeatures | null,
): SpotifyBandOutput {
  const bpm = tempo || features?.tempo || 120;
  const beatPhase = ((positionSec * bpm) / 60) % 1;
  const beat = Math.exp(-beatPhase * 6);
  const hatPhase = ((positionSec * bpm * 4) / 60) % 1;
  const hat = Math.exp(-hatPhase * 10) * 0.5;
  const energyBase = features?.energy ?? 0.5;

  return {
    bass: clamp(0.15 + beat * 0.7 * energyBase),
    lowMid: clamp(0.12 + beat * 0.45 * energyBase),
    mid: clamp(0.1 + beat * 0.3 + energyBase * 0.15),
    highMid: clamp(0.08 + hat * 0.35),
    high: clamp(0.06 + hat * 0.4),
    energy: clamp(0.15 + beat * 0.5 + energyBase * 0.25),
  };
}

/** Derive normalized visual bands from Spotify analysis at a playback position. */
export function computeSpotifyBands(input: SpotifyBandInput): SpotifyBandOutput {
  const { analysis, features, positionSec, paused } = input;

  if (paused) {
    return { bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, energy: 0 };
  }

  if (!analysis) {
    return tempoFallbackBands(0, positionSec, features);
  }

  const segment = findAtTime(analysis.segments, positionSec);
  const section = findAtTime(analysis.sections, positionSec);
  const beat = beatEnvelope(analysis.beats, positionSec);

  const segLoudness = segment ? loudnessAt(segment, positionSec) : -30;
  const secLoudness = section?.loudness ?? -30;
  const loudnessNorm = normalizeDb(
    segment ? segLoudness : (secLoudness ?? -30),
  );

  const pitchBands = segment
    ? pitchesToBands(segment.pitches)
    : { bass: 0.3, lowMid: 0.25, mid: 0.2, highMid: 0.15, high: 0.1 };
  const timbre = segment ? timbreScale(segment.timbre) : {
    bass: 1, lowMid: 1, mid: 1, highMid: 1, high: 1,
  };

  const featEnergy = features?.energy ?? 0.5;
  const featDance = features?.danceability ?? 0.5;

  const bass = clamp(
    pitchBands.bass * timbre.bass * loudnessNorm * 0.55 +
      beat * (0.35 + featDance * 0.35) +
      featEnergy * 0.08,
  );
  const lowMid = clamp(
    pitchBands.lowMid * timbre.lowMid * loudnessNorm * 0.65 + beat * 0.15,
  );
  const mid = clamp(
    pitchBands.mid * timbre.mid * loudnessNorm * 0.7 + featEnergy * 0.12,
  );
  const highMid = clamp(
    pitchBands.highMid * timbre.highMid * loudnessNorm * 0.75 + beat * 0.08,
  );
  const high = clamp(
    pitchBands.high * timbre.high * loudnessNorm * 0.8 + beat * 0.05,
  );
  const energy = clamp(
    loudnessNorm * 0.45 + beat * 0.35 + featEnergy * 0.2,
  );

  return { bass, lowMid, mid, highMid, high, energy };
}

/** Build synthetic FFT bins from band values for spectrum visualizers. */
export function synthesizeFreqBins(
  bands: SpotifyBandOutput,
  phase: number,
): Uint8Array {
  const freq = new Uint8Array(512);
  const ranges: [number, number][] = [
    [0, 3],
    [3, 11],
    [11, 43],
    [43, 128],
    [128, 342],
  ];
  const values = [bands.bass, bands.lowMid, bands.mid, bands.highMid, bands.high];

  for (let band = 0; band < 5; band++) {
    const [lo, hi] = ranges[band];
    const base = values[band] * 255;
    for (let i = lo; i < hi; i++) {
      const wobble = Math.sin(phase * 3 + i * 0.08) * base * 0.12;
      freq[i] = Math.min(255, Math.max(0, Math.floor(base + wobble)));
    }
  }
  return freq;
}

/** Build synthetic time-domain waveform from band values. */
export function synthesizeTimeDomain(
  bands: SpotifyBandOutput,
  positionSec: number,
): Uint8Array {
  const time = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    const t = positionSec * 8 + i * 0.025;
    const wave =
      Math.sin(t * Math.PI * 2 * 1.5) * bands.bass * 0.55 +
      Math.sin(t * Math.PI * 2 * 4) * bands.lowMid * 0.35 +
      Math.sin(t * Math.PI * 2 * 8) * bands.mid * 0.28 +
      Math.sin(t * Math.PI * 2 * 14) * bands.highMid * 0.22 +
      Math.sin(t * Math.PI * 2 * 22) * bands.high * 0.18;
    time[i] = Math.floor(128 + wave * 127);
  }
  return time;
}
