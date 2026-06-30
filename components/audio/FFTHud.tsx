"use client";

import { useEffect, useRef } from "react";
import {
  useAudioAnalyser,
  useAudioState,
  type AudioBands,
} from "@/lib/audio/useAudioAnalyser";

const BARS: { band: keyof AudioBands; color: string }[] = [
  { band: "bass", color: "bg-bass" },
  { band: "lowMid", color: "bg-accent" },
  { band: "mid", color: "bg-mid" },
  { band: "highMid", color: "bg-high" },
  { band: "high", color: "bg-ice" },
];

/**
 * Tiny live spectrum readout in the top-right — five bars, one per band, driven
 * straight off the analyser. It's the at-a-glance proof that the visuals are
 * genuinely reacting to the audio. Hidden when nothing is playing.
 */
export function FFTHud() {
  const bands = useAudioAnalyser();
  const state = useAudioState();
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const b = bands.current;
      for (let i = 0; i < BARS.length; i++) {
        const el = barRefs.current[i];
        if (el) {
          const v = (b[BARS[i].band] as number) ?? 0;
          el.style.height = `${Math.max(10, Math.min(100, v * 100))}%`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bands]);

  if (state.kind === "none") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex h-5 items-end gap-[2px] rounded bg-graphite/60 px-1.5 py-1 backdrop-blur-sm sm:right-4 sm:top-4"
    >
      {BARS.map((bar, i) => (
        <span
          key={bar.band}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className={`w-[3px] rounded-full ${bar.color}`}
          style={{ height: "10%" }}
        />
      ))}
    </div>
  );
}
