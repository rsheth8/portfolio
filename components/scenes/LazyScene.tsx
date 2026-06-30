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
      // Pre-mount a viewport early and keep it alive a viewport past, so the
      // scene is ready before it scrolls in and there's no pop on the way out.
      { rootMargin: "100% 0px 100% 0px" },
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

  return (
    <div ref={ref} className="absolute inset-0">
      {near ? (
        children
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${poster} via-ink to-ink opacity-70`}
          aria-hidden
        />
      )}
    </div>
  );
}
