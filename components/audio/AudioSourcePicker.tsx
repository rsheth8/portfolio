"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import { useAudioState } from "@/lib/audio/useAudioAnalyser";
import {
  notifyCornerPanelOpen,
  onCornerPanelOpen,
} from "@/lib/ui/cornerPanels";
import { MusicSearch } from "@/components/audio/MusicSearch";

/**
 * Bottom-right corner audio control.
 *
 * Source modes: demo, file upload, mic, streaming search, direct URL.
 * Sits on top of the canvas at z-50. Expanded panel is a bottom sheet on
 * mobile and a popover on desktop.
 */
export function AudioSourcePicker() {
  const state = useAudioState();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [signalWarning, setSignalWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const engine = getAudioEngine();

  useEffect(() => {
    return onCornerPanelOpen("audio", () => setExpanded(false));
  }, []);

  // A direct stream can play through the <audio> element while its FFT stays
  // all-zeros — that happens when the host doesn't allow cross-origin reads, so
  // the audio is audible but the visuals can't react. Detect that case (a few
  // seconds of pure silence on the analyser while "playing") and warn, instead
  // of leaving the visitor staring at a frozen scene. Only URLs are at risk;
  // uploads are same-origin blobs and the mic/demo always carry signal.
  useEffect(() => {
    setSignalWarning(false);
    if (state.kind !== "url" || !state.isPlaying) return;

    let raf = 0;
    let frames = 0;
    let silent = 0;
    const start = performance.now();
    const check = () => {
      const { freq } = engine.pullFrame();
      let max = 0;
      for (let i = 0; i < freq.length; i++) if (freq[i] > max) max = freq[i];
      frames++;
      if (max < 3) silent++;
      if (performance.now() - start > 2500) {
        if (frames > 0 && silent / frames > 0.95) setSignalWarning(true);
        return;
      }
      raf = requestAnimationFrame(check);
    };
    // Give the stream a moment to actually start before sampling.
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(check);
    }, 600);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [state.kind, state.isPlaying, engine]);

  function toggleExpanded() {
    setExpanded((wasExpanded) => {
      const next = !wasExpanded;
      if (next) notifyCornerPanelOpen("audio");
      return next;
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file.name);
    setLoading(true);
    try {
      await engine.playFile(file);
    } catch (err) {
      setError(formatError(err));
      setSelectedFile(null);
    } finally {
      setLoading(false);
      // Reset so the same file can be re-selected on iOS
      e.target.value = "";
    }
  }

  async function handleDemo() {
    setError(null);
    setLoading(true);
    try {
      await engine.playDemo();
      setSelectedFile(null);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMic() {
    setError(null);
    setLoading(true);
    try {
      await engine.useMic();
      setSelectedFile(null);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;
    setLoading(true);
    try {
      await engine.playUrl(url.trim());
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function togglePlay() {
    if (state.kind === "spotify") {
      // Spotify transport is handled by the SDK / native app
      return;
    }
    if (state.isPlaying) engine.pause();
    else await engine.resume();
  }

  return (
    <div className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 sm:bottom-6 sm:right-6">
      <button
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        className="flex min-h-[44px] max-w-[calc(100vw-7rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px))] items-center gap-2 rounded-full border border-bone/15 bg-graphite/85 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-cream shadow-2xl backdrop-blur-md transition-colors hover:border-bass/40 sm:max-w-none sm:gap-3"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            state.isPlaying
              ? "bg-bass shadow-[0_0_8px_var(--tw-shadow-color)] shadow-bass/80 animate-pulse"
              : "bg-mute"
          }`}
        />
        <span className="truncate text-bone">
          {loading
            ? "Loading…"
            : state.kind === "none"
              ? "Pick audio"
              : truncate(state.trackName, 18)}
        </span>
        <span className="text-mute">{expanded ? "—" : "+"}</span>
      </button>

      {expanded && (
        <div
          role="dialog"
          aria-label="Audio source picker"
          data-lenis-prevent
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] max-h-[min(36rem,calc(100dvh-7.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] overflow-y-auto overscroll-contain rounded-2xl border border-bone/15 bg-graphite/95 p-5 font-mono text-xs text-cream shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-3 sm:max-h-[min(32rem,calc(100dvh-8rem))] sm:w-80 sm:max-w-[calc(100vw-3rem)]"
        >
          <div className="mb-4 text-[10px] uppercase tracking-[0.25em] text-mute">
            Source
          </div>

          <button
            onClick={handleDemo}
            disabled={loading}
            className="mb-2 w-full min-h-[44px] rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-left transition-colors hover:border-accent/70 hover:bg-accent/15 disabled:opacity-50"
          >
            <div className="text-accent">▸ Play chill beat</div>
            <div className="mt-0.5 text-[10px] text-mute">
              Downtempo groove — instant, nothing to upload
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="mb-2 w-full min-h-[44px] rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5 text-left transition-colors hover:border-mid/60 hover:bg-mid/5 disabled:opacity-50"
          >
            <div className="text-mid">▸ Upload from device</div>
            <div className="mt-0.5 text-[10px] text-mute">
              {selectedFile
                ? `Selected: ${truncate(selectedFile, 28)}`
                : "mp3, m4a, wav, flac — from Files or Downloads"}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,audio/mpeg,audio/mp4,audio/wav,audio/flac,audio/x-m4a,.mp3,.m4a,.wav,.flac,.aac"
            onChange={handleFile}
            className="hidden"
          />

          <MusicSearch onError={setError} onLoading={setLoading} />

          <button
            onClick={handleMic}
            disabled={loading}
            className="mb-2 w-full min-h-[44px] rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5 text-left transition-colors hover:border-bass/60 hover:bg-bass/5 disabled:opacity-50"
          >
            <div className="text-bass">▸ Use microphone</div>
            <div className="mt-0.5 text-[10px] text-mute">
              Visuals only — no speaker output (avoids feedback)
            </div>
          </button>

          <form onSubmit={handleUrl} className="mb-4">
            <div className="rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5">
              <div className="mb-1 text-high">▸ Direct stream URL</div>
              <div className="flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… (mp3, public stream)"
                  className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base text-cream placeholder:text-mute focus:outline-none sm:min-h-0 sm:text-[11px]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded border border-high/40 px-2 py-0.5 text-[10px] text-high hover:bg-high/10 disabled:opacity-40"
                >
                  Play
                </button>
              </div>
              <div className="mt-1 text-[10px] text-mute">
                CORS-friendly mp3 links only
              </div>
            </div>
          </form>

          {error && (
            <div className="mb-3 rounded border border-bass/40 bg-bass/10 px-3 py-2 text-[10px] leading-relaxed text-bass">
              {error}
            </div>
          )}

          {signalWarning && (
            <div className="mb-3 rounded border border-high/40 bg-high/10 px-3 py-2 text-[10px] leading-relaxed text-high">
              Playing, but no signal is reaching the visuals — this stream
              blocks cross-origin analysis. Try Upload, the music search, or a
              CORS-friendly link.
            </div>
          )}

          {state.kind !== "none" && (
            <div className="space-y-3 border-t border-bone/10 pt-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={togglePlay}
                  disabled={
                    state.kind === "mic" ||
                    state.kind === "demo" ||
                    state.kind === "spotify"
                  }
                  className="min-h-[44px] rounded-full border border-bone/20 px-4 py-1 text-[10px] uppercase tracking-wider text-cream hover:border-mid disabled:opacity-40 sm:min-h-0"
                >
                  {state.isPlaying ? "❚❚ Pause" : "▶ Play"}
                </button>
                <button
                  onClick={() => {
                    engine.stop();
                    engine.stopExternalPlayback();
                    setSelectedFile(null);
                  }}
                  className="min-h-[44px] px-2 text-[10px] uppercase tracking-wider text-mute hover:text-cream sm:min-h-0"
                >
                  Stop
                </button>
              </div>
              {state.kind !== "mic" && state.kind !== "spotify" && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-mute">
                    Volume
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={state.volume}
                    onChange={(e) =>
                      engine.setVolume(parseFloat(e.target.value))
                    }
                    className="h-8 w-full accent-mid sm:h-auto"
                  />
                </div>
              )}
              {state.kind === "spotify" && (
                <p className="text-[10px] leading-relaxed text-mute">
                  Playing via Spotify — transport is controlled in the Spotify
                  app. Spotify encrypts its audio, so the visuals are
                  beat-matched from its track data (approximate). For exact
                  sync, play it out loud and switch to{" "}
                  <button
                    onClick={handleMic}
                    className="text-bass underline-offset-2 hover:underline"
                  >
                    Mic mode
                  </button>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatError(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "Permission denied — allow mic or audio in browser settings.";
  }
  if (err instanceof DOMException && err.name === "NotSupportedError") {
    return "This browser can't play that format. Try mp3 or m4a.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong starting audio.";
}
