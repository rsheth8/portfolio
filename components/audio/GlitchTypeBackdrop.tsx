"use client";

import { useEffect, useRef } from "react";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";

/**
 * Audio-reactive type backdrop. Renders a column of giant typographic
 * tokens (project names, words) that shake / chromatic-glitch on bass
 * hits. Pure DOM — cheap, no R3F overhead.
 *
 * Uses imperative DOM writes from a rAF loop so audio reactivity doesn't
 * trigger React re-renders.
 */
export function GlitchTypeBackdrop({
  tokens,
}: {
  tokens: string[];
}) {
  const bands = useAudioAnalyser();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = bands.current;
      const bass = b.bass;
      const high = b.high;
      const energy = b.energy;

      for (let i = 0; i < itemRefs.current.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;

        // Per-token offset — bass shake intensity, with per-index phase
        // so all tokens don't move identically.
        const phase = i * 0.7;
        const shakeX = Math.sin(performance.now() * 0.03 + phase) * bass * 18;
        const shakeY = Math.cos(performance.now() * 0.035 + phase) * bass * 8;

        // High-frequency glitch — chromatic split via text-shadow.
        const splitR = -high * 6;
        const splitB = high * 6;

        el.style.transform = `translate3d(${shakeX}px, ${shakeY}px, 0)`;
        el.style.textShadow = `${splitR}px 0 #ff3a7a, ${splitB}px 0 #00d6ff`;
        // Opacity rides energy so quiet moments are subdued.
        el.style.opacity = String(0.18 + energy * 0.6);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bands]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden"
      aria-hidden
    >
      {tokens.map((token, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="font-display text-7xl font-black uppercase leading-none tracking-tighter text-cream/40 md:text-9xl"
          style={{ willChange: "transform, opacity, text-shadow" }}
        >
          {token}
        </div>
      ))}
    </div>
  );
}
