"use client";

import { useEffect, useRef } from "react";
import { useAudioAnalyser, type AudioBands } from "@/lib/audio/useAudioAnalyser";
import { getPalette, rgbCss, type Palette } from "@/lib/theme/palette";

// Soft color "stage lights" — one per EQ channel, in the same palette as the
// meters — slowly orbiting behind the skills. Each glow breathes with its own
// frequency band, so the background and the EQ pulse to the same music instead
// of fighting each other. `pkey` ties the glow to a live palette channel so it
// re-tints with the playing track's cover art.
const GLOWS: {
  color: string;
  pkey: keyof Palette;
  band: keyof AudioBands;
  top: string;
  left: string;
  size: number;
}[] = [
  { color: "#ff3a7a", pkey: "bass", band: "bass", top: "30%", left: "22%", size: 460 },
  { color: "#b14dff", pkey: "accent", band: "mid", top: "62%", left: "38%", size: 400 },
  { color: "#00d6ff", pkey: "mid", band: "lowMid", top: "26%", left: "58%", size: 500 },
  { color: "#ffe66c", pkey: "high", band: "highMid", top: "66%", left: "72%", size: 360 },
  { color: "#8aa8c8", pkey: "ice", band: "high", top: "16%", left: "80%", size: 320 },
];

/**
 * Background for the "Frequency" section. Replaces the old radial-spectrum ring
 * (which competed with the skills EQ) with a calm, on-palette glow field that
 * orbits slowly and pulses to the audio — a backdrop, not a second chart.
 */
export function SkillsBackdrop() {
  const bands = useAudioAnalyser();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glows = Array.from(
      root.querySelectorAll<HTMLElement>("[data-glow]"),
    ).map((el, i) => ({
      el,
      band: el.dataset.band as keyof AudioBands,
      pkey: el.dataset.pkey as keyof Palette,
      i,
    }));

    const palette = getPalette();
    let raf = 0;
    const tick = (now: number) => {
      const pal = palette.getCurrent();
      for (const g of glows) {
        const amp = (bands.current[g.band] as number) ?? 0;
        const idle = (Math.sin(now / 1500 + g.i * 1.7) * 0.5 + 0.5) * 0.08;
        const scale = 1 + idle + amp * 0.45;
        g.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        g.el.style.opacity = String(Math.min(0.55, 0.22 + idle + amp * 0.4));
        // Re-tint to the live album palette.
        g.el.style.background = `radial-gradient(circle, ${rgbCss(
          pal[g.pkey],
        )} 0%, transparent 70%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bands]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {/* Slowly orbiting layer of color glows */}
      <div className="absolute inset-0 animate-[spin_80s_linear_infinite]">
        {GLOWS.map((g) => (
          <span
            key={g.color}
            data-glow
            data-band={g.band}
            data-pkey={g.pkey}
            className="absolute rounded-full blur-[60px] will-change-transform sm:blur-[80px]"
            style={{
              top: g.top,
              left: g.left,
              width: `min(${g.size}px, 70vmin)`,
              height: `min(${g.size}px, 70vmin)`,
              opacity: 0.22,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${g.color} 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>
      {/* Scrim — keeps the heading and meters readable over the glow. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-ink/70" />
    </div>
  );
}
