"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";

/** Sections the tour visits, in order. */
const STEPS = [
  { id: "hero", label: "Intro" },
  { id: "about", label: "What I do" },
  { id: "skills", label: "The stack" },
  { id: "ml-projects", label: "AI / ML" },
  { id: "infra-projects", label: "Data Eng" },
  { id: "consumer-projects", label: "Software" },
  { id: "contact", label: "Contact" },
];
/**
 * Touch devices get a longer dwell and a gentler, slower scroll — the desktop
 * pace feels abrupt and jarring on a phone where each section fills the screen.
 */
function tourTimings() {
  const mobile =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  return mobile ? { dwell: 5200, scroll: 2.6 } : { dwell: 3200, scroll: 1.6 };
}

type LenisLike = {
  scrollTo: (
    target: string | HTMLElement,
    opts?: { offset?: number; duration?: number },
  ) => void;
};

/**
 * One-tap guided tour: starts the demo beat so the visuals react, then
 * auto-scrolls through every section on a timer — a ~22s showcase for visitors
 * who won't explore on their own. Tap again (or it finishes) to stop.
 */
export function GuidedTour() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const timer = useRef<number | null>(null);
  const stepRef = useRef(0);
  const timing = useRef(tourTimings());

  const clearTimer = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  function goTo(i: number) {
    const el = document.getElementById(STEPS[i].id);
    if (!el) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: timing.current.scroll });
    else el.scrollIntoView({ behavior: "smooth" });
  }

  function advance() {
    const next = stepRef.current + 1;
    if (next >= STEPS.length) {
      stop();
      return;
    }
    stepRef.current = next;
    setStep(next);
    goTo(next);
    timer.current = window.setTimeout(advance, timing.current.dwell);
  }

  async function start() {
    timing.current = tourTimings(); // re-read in case orientation changed
    setRunning(true);
    stepRef.current = 0;
    setStep(0);
    // The click is a user gesture, so this unlocks the AudioContext.
    try {
      await getAudioEngine().playDemo();
    } catch {
      // visuals still react to whatever else might be playing
    }
    goTo(0);
    timer.current = window.setTimeout(advance, timing.current.dwell);
  }

  function stop() {
    clearTimer();
    setRunning(false);
  }

  useEffect(() => () => clearTimer(), []);

  return (
    <div className="pointer-events-auto fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top)+4.75rem)] z-40 sm:left-4 sm:top-4">
      {running ? (
        <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-graphite/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cream shadow-2xl backdrop-blur-md">
          <span className="hidden text-accent sm:inline">Touring ·</span>
          <span className="text-bone">{STEPS[step].label}</span>
          <span className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 w-1.5 rounded-full ${
                  i <= step ? "bg-accent" : "bg-bone/25"
                }`}
              />
            ))}
          </span>
          <button
            onClick={stop}
            className="ml-1 text-mute transition-colors hover:text-cream"
            aria-label="Stop tour"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={start}
          className="flex min-h-[36px] items-center gap-2 rounded-full border border-bone/15 bg-graphite/85 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cream shadow-2xl backdrop-blur-md transition-colors hover:border-accent/50"
        >
          <span className="text-accent">▶</span>
          <span className="text-bone">30s tour</span>
        </button>
      )}
    </div>
  );
}
