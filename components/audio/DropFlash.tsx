"use client";

import { useEffect, useRef } from "react";
import { getAudioEvents } from "@/lib/audio/audioEvents";
import { getPalette, rgbCss } from "@/lib/theme/palette";

/**
 * Full-screen bloom that fires on detected "drops" — a big energy surge after
 * a build. The flash is tinted with the live accent color (so it matches a
 * themed track) and decays fast. Skipped under prefers-reduced-motion to avoid
 * flashing for photosensitive visitors.
 */
export function DropFlash() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const events = getAudioEvents();
    let raf = 0;
    let level = 0;

    const decay = () => {
      level *= 0.86;
      if (ref.current) ref.current.style.opacity = String(level);
      if (level > 0.01) {
        raf = requestAnimationFrame(decay);
      } else {
        raf = 0;
        if (ref.current) ref.current.style.opacity = "0";
      }
    };

    const off = events.onDrop((e) => {
      level = Math.min(0.55, 0.32 + e.intensity * 0.3);
      const c = getPalette().getCurrent().accent;
      if (ref.current) {
        ref.current.style.background = `radial-gradient(circle at 50% 45%, ${rgbCss(
          c,
        )} 0%, transparent 62%)`;
      }
      if (!raf) raf = requestAnimationFrame(decay);
    });

    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-[3] mix-blend-screen"
    />
  );
}
