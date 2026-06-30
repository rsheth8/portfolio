export type ParsedMusicLink =
  | { service: "spotify"; uri: string; webUrl: string; type: "track" | "playlist" | "album" }
  | { service: "apple"; webUrl: string; type: "song" | "album" | "playlist" };

const SPOTIFY_RE =
  /(?:open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)|spotify:(track|playlist|album):([a-zA-Z0-9]+))/;

const APPLE_RE =
  /music\.apple\.com\/[a-z]{2}\/(song|album|playlist)\/[^/]+\/(\d+)/;

export function parseMusicUrl(input: string): ParsedMusicLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const spotify = trimmed.match(SPOTIFY_RE);
  if (spotify) {
    const type = (spotify[1] ?? spotify[3]) as "track" | "playlist" | "album";
    const id = spotify[2] ?? spotify[4];
    return {
      service: "spotify",
      type,
      uri: `spotify:${type}:${id}`,
      webUrl: `https://open.spotify.com/${type}/${id}`,
    };
  }

  const apple = trimmed.match(APPLE_RE);
  if (apple) {
    const type = apple[1] as "song" | "album" | "playlist";
    return { service: "apple", type, webUrl: trimmed.split("?")[0] };
  }

  if (trimmed.includes("music.apple.com")) {
    return { service: "apple", type: "song", webUrl: trimmed.split("?")[0] };
  }

  return null;
}

export function openInNativeApp(link: ParsedMusicLink): void {
  if (link.service === "spotify") {
    window.open(link.webUrl, "_blank", "noopener,noreferrer");
    return;
  }
  // Universal link opens Apple Music app on iOS when installed.
  window.open(link.webUrl, "_blank", "noopener,noreferrer");
}
