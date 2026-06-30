"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import {
  searchSpotifyTracks,
  getUserPlaylists,
  getSavedTracks,
  formatDuration,
  trackArtwork,
  playlistArtwork,
  type SpotifyTrack,
  type SpotifyPlaylist,
} from "@/lib/streaming/spotifyApi";
import { playSpotifyUri } from "@/lib/streaming/spotifyPlayer";

interface SpotifyPickerProps {
  playerReady: boolean;
  onError: (msg: string | null) => void;
  onLoading: (loading: boolean) => void;
}

type PickerView = "search" | "playlists" | "liked";

/**
 * Browse and play from a connected visitor's Spotify — search, playlists,
 * and liked songs. Shown only after OAuth + Web Playback SDK connect.
 */
export function SpotifyPicker({ playerReady, onError, onLoading }: SpotifyPickerProps) {
  const [view, setView] = useState<PickerView>("search");
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [liked, setLiked] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(
    null,
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const playlistsLoaded = useRef(false);
  const likedLoaded = useRef(false);

  const playUri = useCallback(
    async (uri: string, id: string, label?: string) => {
      if (!playerReady) {
        onError("Spotify player is still starting — wait a moment and try again.");
        return;
      }
      onError(null);
      onLoading(true);
      setPlayingId(id);
      try {
        getAudioEngine().stop();
        await playSpotifyUri(uri);
        if (label) {
          getAudioEngine().setExternalPlayback("spotify", label, true);
        }
      } catch (err) {
        setPlayingId(null);
        onError(err instanceof Error ? err.message : "Playback failed.");
      } finally {
        onLoading(false);
      }
    },
    [playerReady, onError, onLoading],
  );

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setTracks([]);
        return;
      }
      setSearching(true);
      onError(null);
      try {
        const results = await searchSpotifyTracks(q);
        setTracks(results);
        if (!results.length) onError("No tracks found — try another search.");
      } catch (err) {
        onError(err instanceof Error ? err.message : "Search failed.");
        setTracks([]);
      } finally {
        setSearching(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    if (view !== "search") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, view, runSearch]);

  useEffect(() => {
    if (view !== "playlists" || playlistsLoaded.current) return;
    setLoadingPlaylists(true);
    getUserPlaylists()
      .then((items) => {
        setPlaylists(items);
        playlistsLoaded.current = true;
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : "Could not load playlists."),
      )
      .finally(() => setLoadingPlaylists(false));
  }, [view, onError]);

  useEffect(() => {
    if (view !== "liked" || likedLoaded.current) return;
    onLoading(true);
    getSavedTracks()
      .then((items) => {
        setLiked(items);
        likedLoaded.current = true;
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : "Could not load liked songs."),
      )
      .finally(() => onLoading(false));
  }, [view, onError, onLoading]);

  return (
    <div className="mb-4 rounded-lg border border-[#1DB954]/25 bg-[#1DB954]/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#1DB954]">
          ♫ Your Spotify
        </span>
        {playerReady ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1DB954]" />
        ) : (
          <span className="text-[10px] text-mute">starting…</span>
        )}
      </div>

      {!playerReady && (
        <p className="mb-3 text-[10px] leading-relaxed text-mute">
          Warming up the web player — a few seconds after connect.
        </p>
      )}

      {/* View tabs */}
      <div className="mb-3 flex gap-1 rounded-md border border-bone/10 bg-ink/50 p-0.5">
        {(
          [
            ["search", "Search"],
            ["playlists", "Playlists"],
            ["liked", "Liked"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`min-h-[36px] flex-1 rounded px-1 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
              view === id
                ? "bg-[#1DB954]/20 text-[#1DB954]"
                : "text-mute hover:text-bone"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "search" && (
        <>
          <div className="relative">
            <input
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any song or artist…"
              className="w-full min-h-[44px] rounded-lg border border-bone/15 bg-ink/70 px-3 py-2 text-base text-cream placeholder:text-mute focus:border-[#1DB954]/50 focus:outline-none sm:text-[11px]"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-mute">
                …
              </span>
            )}
          </div>
          {tracks.length > 0 && (
            <TrackList
              tracks={tracks}
              playingId={playingId}
              disabled={!playerReady}
              onPlay={(t) =>
                playUri(
                  t.uri,
                  t.id,
                  `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`,
                )
              }
            />
          )}
        </>
      )}

      {view === "playlists" && (
        <>
          {/* Custom playlist select */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlaylistOpen((o) => !o)}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-lg border border-bone/15 bg-ink/70 px-3 py-2 text-left transition-colors hover:border-[#1DB954]/40"
            >
              {selectedPlaylist ? (
                <>
                  <PlaylistThumb playlist={selectedPlaylist} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-cream">
                      {selectedPlaylist.name}
                    </div>
                    <div className="text-[10px] text-mute">
                      {selectedPlaylist.tracks.total} tracks
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-mute">
                  {loadingPlaylists ? "Loading playlists…" : "Choose a playlist"}
                </span>
              )}
              <span className="ml-auto text-mute">{playlistOpen ? "▴" : "▾"}</span>
            </button>

            {playlistOpen && playlists.length > 0 && (
              <ul
                data-lenis-prevent
                className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-bone/15 bg-graphite shadow-2xl"
              >
                {playlists.map((pl) => (
                  <li key={pl.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlaylist(pl);
                        setPlaylistOpen(false);
                      }}
                      className="flex w-full min-h-[44px] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#1DB954]/10"
                    >
                      <PlaylistThumb playlist={pl} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] text-cream">
                          {pl.name}
                        </div>
                        <div className="text-[10px] text-mute">
                          {pl.tracks.total} tracks
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedPlaylist && (
            <button
              type="button"
              onClick={() =>
                playUri(selectedPlaylist.uri, selectedPlaylist.id, selectedPlaylist.name)
              }
              disabled={!playerReady}
              className="mt-2 w-full min-h-[44px] rounded-lg border border-[#1DB954]/40 bg-[#1DB954]/15 py-2.5 text-[11px] uppercase tracking-wider text-[#1DB954] transition-colors hover:bg-[#1DB954]/25 disabled:opacity-40"
            >
              ▶ Play playlist
            </button>
          )}
        </>
      )}

      {view === "liked" && (
        <>
          {liked.length === 0 ? (
            <p className="py-4 text-center text-[10px] text-mute">
              Loading your liked songs…
            </p>
          ) : (
            <TrackList
              tracks={liked}
              playingId={playingId}
              disabled={!playerReady}
              onPlay={(t) =>
                playUri(
                  t.uri,
                  t.id,
                  `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`,
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function PlaylistThumb({ playlist }: { playlist: SpotifyPlaylist }) {
  const src = playlistArtwork(playlist);
  if (!src) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#1DB954]/20 text-[10px] text-[#1DB954]">
        ♫
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
  );
}

function TrackList({
  tracks,
  playingId,
  disabled,
  onPlay,
}: {
  tracks: SpotifyTrack[];
  playingId: string | null;
  disabled?: boolean;
  onPlay: (track: SpotifyTrack) => void;
}) {
  return (
    <ul
      data-lenis-prevent
      className="mt-2 max-h-52 space-y-1 overflow-y-auto overscroll-contain"
    >
      {tracks.map((track) => {
        const art = trackArtwork(track);
        const isPlaying = playingId === track.id;
        return (
          <li key={track.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPlay(track)}
              className={`flex w-full min-h-[44px] items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-40 ${
                isPlaying
                  ? "border-[#1DB954]/50 bg-[#1DB954]/10"
                  : "border-bone/10 bg-ink/30 hover:border-[#1DB954]/30 hover:bg-[#1DB954]/5"
              }`}
            >
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={art}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded bg-bone/10" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-cream">{track.name}</div>
                <div className="truncate text-[10px] text-mute">
                  {track.artists.map((a) => a.name).join(", ")}
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-mute">
                {formatDuration(track.duration_ms)}
              </span>
              <span
                className={`shrink-0 text-[10px] ${isPlaying ? "text-[#1DB954]" : "text-[#1DB954]/70"}`}
              >
                {isPlaying ? "♫" : "▶"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
