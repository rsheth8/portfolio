"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import {
  searchiTunes,
  findPreviewByTitle,
  type iTunesTrack,
} from "@/lib/streaming/itunes";
import {
  parseMusicUrl,
  openInNativeApp,
  type ParsedMusicLink,
} from "@/lib/streaming/parseMusicUrl";
import { fetchSpotifyOEmbed } from "@/lib/streaming/spotifyOEmbed";
import { SpotifyPicker } from "@/components/audio/SpotifyPicker";
import {
  isSpotifyConfigured,
  getSpotifyRedirectUri,
  getStoredToken,
  startSpotifyAuth,
  connectSpotifyPlayer,
  playSpotifyUri,
  disconnectSpotify,
} from "@/lib/streaming/spotifyPlayer";

type Tab = "search" | "link";

interface MusicSearchProps {
  onError: (msg: string | null) => void;
  onLoading: (loading: boolean) => void;
}

/**
 * Search Apple Music catalog (via iTunes API) for 30s previews that feed the
 * analyser, paste Spotify/Apple links, and optionally connect Spotify Premium
 * for full-track playback.
 */
export function MusicSearch({ onError, onLoading }: MusicSearchProps) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [results, setResults] = useState<iTunesTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [parsedLink, setParsedLink] = useState<ParsedMusicLink | null>(null);
  const [linkMeta, setLinkMeta] = useState<{
    title: string;
    thumb: string;
  } | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSpotifyConnected(Boolean(getStoredToken()));
  }, []);

  // After Spotify OAuth redirect, auto-connect the player.
  useEffect(() => {
    if (!getStoredToken() || !isSpotifyConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const teardown = await connectSpotifyPlayer({
          onStateChange: (playing, trackName) => {
            getAudioEngine().setExternalPlayback("spotify", trackName, playing);
          },
          onError: (msg) => onError(msg),
        });
        if (!cancelled) {
          teardownRef.current = teardown;
          setSpotifyConnected(true);
        }
      } catch (err) {
        if (!cancelled) onError(formatErr(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setSearching(true);
      onLoading(true);
      onError(null);
      try {
        const tracks = await searchiTunes(q);
        setResults(tracks);
        if (!tracks.length) onError("No previews found — try a different search.");
      } catch (err) {
        onError(formatErr(err));
        setResults([]);
      } finally {
        setSearching(false);
        onLoading(false);
      }
    },
    [onError, onLoading],
  );

  async function playPreview(track: iTunesTrack) {
    onError(null);
    onLoading(true);
    try {
      getAudioEngine().stopExternalPlayback();
      await getAudioEngine().playUrl(
        track.previewUrl,
        `${track.trackName} — ${track.artistName}`,
      );
    } catch (err) {
      onError(formatErr(err));
    } finally {
      onLoading(false);
    }
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onLoading(true);
    setParsedLink(null);
    setLinkMeta(null);

    const parsed = parseMusicUrl(linkInput);
    if (!parsed) {
      onError("Paste a Spotify or Apple Music link (track, album, or playlist).");
      onLoading(false);
      return;
    }
    setParsedLink(parsed);

    try {
      if (parsed.service === "spotify") {
        const oembed = await fetchSpotifyOEmbed(parsed.webUrl);
        if (oembed) {
          setLinkMeta({ title: oembed.title, thumb: oembed.thumbnail_url });
          const preview = await findPreviewByTitle(oembed.title);
          if (preview) {
            await getAudioEngine().playUrl(
              preview.previewUrl,
              `${preview.trackName} — ${preview.artistName}`,
            );
            onError(null);
          } else if (spotifyConnected) {
            getAudioEngine().stopExternalPlayback();
            await playSpotifyUri(parsed.uri);
          } else {
            onError(
              "Preview not found — connect Spotify for full playback, or open in the app.",
            );
          }
        } else if (spotifyConnected) {
          getAudioEngine().stopExternalPlayback();
          await playSpotifyUri(parsed.uri);
        } else {
          onError("Could not resolve link — connect Spotify or open in the app.");
        }
      } else {
        // Apple Music link — search iTunes by URL slug words as fallback
        const slug = parsed.webUrl.split("/").pop()?.replace(/-/g, " ") ?? "";
        const tracks = await searchiTunes(slug, 1);
        if (tracks[0]) {
          setLinkMeta({
            title: `${tracks[0].trackName} — ${tracks[0].artistName}`,
            thumb: tracks[0].artworkUrl100,
          });
          await getAudioEngine().playUrl(
            tracks[0].previewUrl,
            `${tracks[0].trackName} — ${tracks[0].artistName}`,
          );
        } else {
          onError("Could not find a preview — open in Apple Music to listen.");
        }
      }
    } catch (err) {
      onError(formatErr(err));
    } finally {
      onLoading(false);
    }
  }

  async function handleSpotifyConnect() {
    onError(null);
    try {
      if (spotifyConnected) {
        teardownRef.current?.();
        teardownRef.current = null;
        disconnectSpotify();
        getAudioEngine().stopExternalPlayback();
        setSpotifyConnected(false);
        return;
      }
      await startSpotifyAuth();
    } catch (err) {
      onError(formatErr(err));
    }
  }

  async function playLinkOnSpotify() {
    if (!parsedLink || parsedLink.service !== "spotify") return;
    onError(null);
    onLoading(true);
    try {
      getAudioEngine().stopExternalPlayback();
      await playSpotifyUri(parsedLink.uri);
    } catch (err) {
      onError(formatErr(err));
    } finally {
      onLoading(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex gap-1 rounded-lg border border-bone/10 bg-ink/40 p-1">
        {(["search", "link"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[36px] flex-1 rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
              tab === t
                ? "bg-bone/10 text-cream"
                : "text-mute hover:text-bone"
            }`}
          >
            {t === "search" ? "Search" : "Paste link"}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <div className="rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5">
            <div className="mb-1 text-mid">▸ Apple Music search</div>
            <div className="flex gap-2">
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Artist or song…"
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base text-cream placeholder:text-mute focus:outline-none sm:min-h-0 sm:text-[11px]"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="shrink-0 rounded border border-mid/40 px-2 py-0.5 text-[10px] text-mid hover:bg-mid/10 disabled:opacity-40"
              >
                {searching ? "…" : "Go"}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-mute">
              30s previews — visuals react in real time
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleLinkSubmit}>
          <div className="rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5">
            <div className="mb-1 text-high">▸ Spotify / Apple Music link</div>
            <div className="flex gap-2">
              <input
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="open.spotify.com/track/…"
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base text-cream placeholder:text-mute focus:outline-none sm:min-h-0 sm:text-[11px]"
              />
              <button
                type="submit"
                className="shrink-0 rounded border border-high/40 px-2 py-0.5 text-[10px] text-high hover:bg-high/10"
              >
                Play
              </button>
            </div>
            <div className="mt-1 text-[10px] text-mute">
              Tries a reactive preview, then full Spotify if connected
            </div>
          </div>
        </form>
      )}

      {/* Spotify browse — search, playlists, liked songs */}
      {spotifyConnected && (
        <SpotifyPicker onError={onError} onLoading={onLoading} />
      )}

      {/* Spotify connect — only when client ID is configured */}
      {isSpotifyConfigured() && (
        <div className="mt-2">
          <button
            type="button"
            onClick={handleSpotifyConnect}
            className="flex w-full min-h-[44px] items-center gap-2 rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/10 px-3 py-2.5 text-left transition-colors hover:border-[#1DB954]/60 hover:bg-[#1DB954]/15"
          >
            <span className="text-[#1DB954]">
              {spotifyConnected ? "●" : "○"}
            </span>
            <div>
              <div className="text-[#1DB954]">
                {spotifyConnected ? "Disconnect Spotify" : "Connect Spotify"}
              </div>
              <div className="mt-0.5 text-[10px] text-mute">
                Premium · full tracks on site
              </div>
            </div>
          </button>
          {!spotifyConnected && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-mute">
              If connect fails, add this exact URL in your{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-high underline"
              >
                Spotify app
              </a>
              {" → Settings → Redirect URIs:"}
              <span className="mt-0.5 block break-all font-mono text-bone/70">
                {getSpotifyRedirectUri()}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Link metadata + actions */}
      {linkMeta && parsedLink && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-bone/10 bg-ink/40 p-2">
          {linkMeta.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={linkMeta.thumb}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-cream">{linkMeta.title}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {parsedLink.service === "spotify" && spotifyConnected && (
                <button
                  type="button"
                  onClick={playLinkOnSpotify}
                  className="text-[10px] text-[#1DB954] hover:underline"
                >
                  Play full on Spotify
                </button>
              )}
              <button
                type="button"
                onClick={() => openInNativeApp(parsedLink)}
                className="text-[10px] text-mid hover:underline"
              >
                Open in {parsedLink.service === "spotify" ? "Spotify" : "Apple Music"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto overscroll-contain">
          {results.map((track) => (
            <li key={track.trackId}>
              <button
                type="button"
                onClick={() => playPreview(track)}
                className="flex w-full min-h-[44px] items-center gap-2 rounded-lg border border-bone/10 bg-ink/30 px-2 py-2 text-left transition-colors hover:border-mid/40 hover:bg-mid/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={track.artworkUrl100}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-cream">
                    {track.trackName}
                  </div>
                  <div className="truncate text-[10px] text-mute">
                    {track.artistName}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-mid">▶</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
