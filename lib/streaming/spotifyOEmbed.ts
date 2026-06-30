/** Spotify oEmbed — public, no auth. Returns track/playlist title + thumbnail. */

export interface SpotifyOEmbed {
  title: string;
  thumbnail_url: string;
  provider_name: string;
}

export async function fetchSpotifyOEmbed(
  spotifyUrl: string,
): Promise<SpotifyOEmbed | null> {
  try {
    const params = new URLSearchParams({ url: spotifyUrl });
    const res = await fetch(
      `https://open.spotify.com/oembed?${params}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as SpotifyOEmbed;
  } catch {
    return null;
  }
}
