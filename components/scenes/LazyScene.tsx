"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

/**
 * Wraps a WebGL scene with two safeguards:
 *
 *  1. Lazy mount — the heavy R3F Canvas only mounts when its section nears the
 *     viewport (and unmounts again once well past it), so offscreen scenes don't
 *     burn GPU/CPU. With seven full-screen canvases that keeps scroll smooth,
 *     especially on mobile.
 *  2. Reduced motion — if the visitor prefers reduced motion we never mount the
 *     animated canvas at all; we show a calm static `poster` gradient instead.
 *
 * Render it in place of the raw scene:
 *   <LazyScene poster="from-bass/20"><HeroOrbSceneClient /></LazyScene>
 */
export function LazyScene({
  children,
  poster,
}: {
  children: ReactNode;
  /** Tailwind gradient stop (e.g. "from-bass/25") for the static fallback. */
  poster: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (reduced) return; // poster only — no observer needed
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      // Pre-mount half a viewport early so the context is created before the
      // scene scrolls in (its fade-in hides the init), but keep the simultaneous
      // mounted count low to avoid hitting per-tab WebGL context limits.
      { rootMargin: "50% 0px 50% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  if (reduced) {
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-br ${poster} via-ink to-ink`}
        aria-hidden
      />
    );
  }

  // The poster always renders as the base layer; the canvas (which fades in on
  // its first frame) sits on top. So there's never a black gap — before mount,
  // during init, or if the GL context is lost — the poster shows through.
  return (
    <div ref={ref} className="absolute inset-0">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${poster} via-ink to-ink`}
        aria-hidden
      />
      {near && children}
    </div>
  );
}
