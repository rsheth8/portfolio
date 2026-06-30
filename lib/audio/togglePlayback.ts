"use client";

import { getAudioEngine } from "./AudioEngine";
import {
  pauseSpotifyPlayback,
  resumeSpotifyPlayback,
} from "@/lib/streaming/spotifyPlayer";

/**
 * Single play/pause entry point for every source, so the transport button and
 * the spacebar shortcut behave identically. Spotify goes through the Web
 * Playback SDK (its state then flows back via player_state_changed); everything
 * else — file, URL, mic, generative demo — is handled by the AudioEngine.
 */
export async function togglePlayback(): Promise<void> {
  const engine = getAudioEngine();
  const state = engine.getState();
  if (state.kind === "none") return;

  if (state.kind === "spotify") {
    if (state.isPlaying) await pauseSpotifyPlayback();
    else await resumeSpotifyPlayback();
    return;
  }

  if (state.isPlaying) engine.pause();
  else await engine.resume();
}
