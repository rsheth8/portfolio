import { getStoredToken } from "./spotifyPlayer";

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
}

export interface SpotifyPlaylist {
  id: string;
  uri: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new Error("Connect Spotify first.");

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 401) {
    throw new Error("Spotify session expired — reconnect.");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error: ${err}`);
  }
  return res.json() as Promise<T>;
}

export async function searchSpotifyTracks(
  query: string,
  limit = 12,
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    type: "track",
    limit: String(limit),
  });
  const data = await spotifyFetch<{
    tracks: { items: SpotifyTrack[] };
  }>(`/search?${params}`);
  return data.tracks.items ?? [];
}

export async function getUserPlaylists(limit = 25): Promise<SpotifyPlaylist[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await spotifyFetch<{
    items: SpotifyPlaylist[];
  }>(`/me/playlists?${params}`);
  return data.items ?? [];
}

export async function getSavedTracks(limit = 15): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await spotifyFetch<{
    items: { track: SpotifyTrack }[];
  }>(`/me/tracks?${params}`);
  return (data.items ?? []).map((i) => i.track).filter(Boolean);
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function trackArtwork(track: SpotifyTrack): string | undefined {
  return track.album.images[track.album.images.length - 1]?.url;
}

export function playlistArtwork(playlist: SpotifyPlaylist): string | undefined {
  return playlist.images[0]?.url;
}
