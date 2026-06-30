"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import { useAudioState } from "@/lib/audio/useAudioAnalyser";

const STORAGE_KEY = "sound-nudge-dismissed";

/**
 * First-visit hint anchored above the bottom-right audio control. The site's
 * whole gimmick is audio-reactive, but a visitor with no track handy might
 * never realize it — this points them at the control and offers a one-tap
 * sample. Shows once: it self-dismisses the moment any audio starts, on tap,
 * or after a timeout, and remembers via localStorage so it never nags again.
 */
export function SoundNudge() {
  const state = useAudioState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Let the hero settle before sliding in.
    const t = window.setTimeout(() => setShow(true), 1600);
    return () => window.clearTimeout(t);
  }, []);

  // Any audio starting means they found it — dismiss for good.
  useEffect(() => {
    if (state.kind !== "none") dismiss();
  }, [state.kind]);

  // Don't linger forever if ignored.
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(false), 14000);
    return () => window.clearTimeout(t);
  }, [show]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode / storage disabled — fine, it just shows again next load
    }
  }

  async function playSample() {
    try {
      await getAudioEngine().playDemo();
    } catch {
      // engine surfaces its own errors in the picker; nothing to do here
    }
    dismiss();
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          style={{ transformOrigin: "bottom right" }}
          className="pointer-events-auto fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right))] z-40 w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-accent/30 bg-graphite/95 p-4 font-mono text-xs text-cream shadow-2xl backdrop-blur-xl sm:bottom-20 sm:right-6"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-accent">
              ♪ This site reacts to sound
            </span>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 px-1 text-mute transition-colors hover:text-cream"
            >
              ✕
            </button>
          </div>
          <p className="mb-3 leading-relaxed text-bone/75">
            Play a sample and watch every scene move to it — or pick your own
            track from the control below.
          </p>
          <button
            onClick={playSample}
            className="w-full rounded-lg border border-accent/40 bg-accent/15 px-3 py-2.5 text-center uppercase tracking-wider text-accent transition-colors hover:bg-accent/25"
          >
            ▶ Play chill beat
          </button>
          {/* Pointer toward the audio pill below. */}
          <div className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-accent/30 bg-graphite/95" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
