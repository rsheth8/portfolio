/** iTunes Search API — no auth, CORS-friendly, returns 30s preview MP3s. */

export interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackViewUrl: string;
}

export async function searchiTunes(
  query: string,
  limit = 8,
): Promise<iTunesTrack[]> {
  const params = new URLSearchParams({
    term: query.trim(),
    media: "music",
    entity: "song",
    limit: String(limit),
  });
  const res = await fetch(
    `https://itunes.apple.com/search?${params}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error("Music search failed — try again.");
  const data = (await res.json()) as { results?: iTunesTrack[] };
  return (data.results ?? []).filter((t) => Boolean(t.previewUrl));
}

/** Find a preview for a track title (used when user pastes a Spotify link). */
export async function findPreviewByTitle(
  title: string,
): Promise<iTunesTrack | null> {
  const clean = title
    .replace(/\s*[\|·–-]\s*spotify.*$/i, "")
    .replace(/\s+by\s+.+$/i, "")
    .trim();
  if (!clean) return null;
  const results = await searchiTunes(clean, 5);
  return results[0] ?? null;
}
