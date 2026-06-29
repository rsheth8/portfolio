"use client";

import { useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import { useAudioState } from "@/lib/audio/useAudioAnalyser";

/**
 * Bottom-right corner audio control.
 *
 * Three source modes (file / mic / URL) plus play-pause-volume. Sits on
 * top of the canvas at z-50, intercepts pointer events. Expanded panel
 * opens on click; collapses back to a compact pill.
 */
export function AudioSourcePicker() {
  const state = useAudioState();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const engine = getAudioEngine();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await engine.playFile(file);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleMic() {
    setError(null);
    try {
      await engine.useMic();
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;
    try {
      await engine.playUrl(url.trim());
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function togglePlay() {
    if (state.isPlaying) engine.pause();
    else await engine.resume();
  }

  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-50">
      {/* Collapsed pill — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 rounded-full border border-bone/15 bg-graphite/85 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-cream backdrop-blur-md shadow-2xl hover:border-bass/40 transition-colors"
      >
        {/* Status indicator: pulsing dot when playing */}
        <span
          className={`h-2 w-2 rounded-full ${
            state.isPlaying
              ? "bg-bass shadow-[0_0_8px_var(--tw-shadow-color)] shadow-bass/80 animate-pulse"
              : "bg-mute"
          }`}
        />
        <span className="text-bone">
          {state.kind === "none"
            ? "Pick audio"
            : truncate(state.trackName, 18)}
        </span>
        <span className="text-mute">{expanded ? "—" : "+"}</span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="absolute bottom-full right-0 mb-3 w-80 rounded-2xl border border-bone/15 bg-graphite/95 p-5 font-mono text-xs text-cream backdrop-blur-xl shadow-2xl">
          <div className="mb-4 text-[10px] uppercase tracking-[0.25em] text-mute">
            Source
          </div>

          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-2 w-full rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5 text-left hover:border-mid/60 hover:bg-mid/5 transition-colors"
          >
            <div className="text-mid">▸ Upload file</div>
            <div className="mt-0.5 text-[10px] text-mute">
              Any mp3 / wav / flac
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFile}
            className="hidden"
          />

          {/* Mic */}
          <button
            onClick={handleMic}
            className="mb-2 w-full rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5 text-left hover:border-bass/60 hover:bg-bass/5 transition-colors"
          >
            <div className="text-bass">▸ Use microphone</div>
            <div className="mt-0.5 text-[10px] text-mute">
              Site listens to anything in the room
            </div>
          </button>

          {/* URL */}
          <form onSubmit={handleUrl} className="mb-4">
            <div className="rounded-lg border border-bone/15 bg-ink/60 px-3 py-2.5">
              <div className="mb-1 text-high">▸ Stream URL</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… (mp3, public stream)"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-cream placeholder:text-mute focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded border border-high/40 px-2 py-0.5 text-[10px] text-high hover:bg-high/10"
                >
                  Play
                </button>
              </div>
              <div className="mt-1 text-[10px] text-mute">
                Direct audio URL. SoundCloud / YouTube need extraction.
              </div>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded border border-bass/40 bg-bass/10 px-3 py-2 text-[10px] text-bass">
              {error}
            </div>
          )}

          {/* Transport controls — only shown when something is loaded */}
          {state.kind !== "none" && (
            <div className="space-y-3 border-t border-bone/10 pt-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={togglePlay}
                  disabled={state.kind === "mic"}
                  className="rounded-full border border-bone/20 px-4 py-1 text-[10px] uppercase tracking-wider text-cream hover:border-mid disabled:opacity-40"
                >
                  {state.isPlaying ? "❚❚ Pause" : "▶ Play"}
                </button>
                <button
                  onClick={() => engine.stop()}
                  className="text-[10px] uppercase tracking-wider text-mute hover:text-cream"
                >
                  Stop
                </button>
              </div>
              {state.kind !== "mic" && (
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
                    onChange={(e) => engine.setVolume(parseFloat(e.target.value))}
                    className="w-full accent-mid"
                  />
                </div>
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
    return "Permission denied. Allow mic / audio in your browser.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong starting audio.";
}
