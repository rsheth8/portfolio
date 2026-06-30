"use client";

import { useEffect, useRef } from "react";
import { getPalette, rgbChannels, rgbCss } from "@/lib/theme/palette";

/**
 * Drives the live palette: one rAF lerps the accent colors toward their target
 * and writes them to the document's CSS variables (so all Tailwind accents
 * re-tint) and to a subtle full-page color "wash" that tints the WebGL scenes
 * too — without touching any shader. Together they make the whole site ease
 * into the colors of whatever's playing.
 */
export function ThemeController() {
  const washRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const palette = getPalette();
    const root = document.documentElement;
    let raf = 0;

    const write = () => {
      palette.step(0.05);
      const c = palette.getCurrent();
      root.style.setProperty("--bass", rgbChannels(c.bass));
      root.style.setProperty("--mid", rgbChannels(c.mid));
      root.style.setProperty("--high", rgbChannels(c.high));
      root.style.setProperty("--accent", rgbChannels(c.accent));
      root.style.setProperty("--ice", rgbChannels(c.ice));

      if (washRef.current) {
        washRef.current.style.background = [
          `radial-gradient(60% 50% at 15% 20%, ${rgbCss(c.accent)} 0%, transparent 70%)`,
          `radial-gradient(55% 45% at 85% 25%, ${rgbCss(c.mid)} 0%, transparent 70%)`,
          `radial-gradient(60% 55% at 70% 85%, ${rgbCss(c.bass)} 0%, transparent 70%)`,
        ].join(", ");
      }
      raf = requestAnimationFrame(write);
    };
    raf = requestAnimationFrame(write);
    return () => cancelAnimationFrame(raf);
  }, []);

  // soft-light at low opacity tints the dark scenes while leaving the
  // high-contrast (drop-shadowed) text readable.
  return (
    <div
      ref={washRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] opacity-[0.13] mix-blend-soft-light"
    />
  );
}
