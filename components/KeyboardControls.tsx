"use client";

import { useEffect } from "react";
import { getAudioEngine } from "@/lib/audio/AudioEngine";
import { togglePlayback } from "@/lib/audio/togglePlayback";

const SECTION_IDS = [
  "hero",
  "about",
  "skills",
  "ml-projects",
  "infra-projects",
  "consumer-projects",
  "contact",
];

type LenisLike = {
  scrollTo: (target: string | HTMLElement, opts?: { offset?: number }) => void;
};

/**
 * Power-user keyboard shortcuts (no visible UI):
 *   Space            play / pause the current track
 *   → / J            jump to next section
 *   ← / K            jump to previous section
 *
 * We intentionally use ← / → (not ↑ / ↓) for section nav so normal vertical
 * scrolling with the arrow keys keeps working. Ignored while typing in a field.
 */
export function KeyboardControls() {
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.tagName === "INPUT" ||
        n.tagName === "TEXTAREA" ||
        n.isContentEditable
      );
    };

    const currentIndex = () => {
      let best = 0;
      let bestDist = Infinity;
      SECTION_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };

    const goIndex = (i: number) => {
      const clamped = Math.max(0, Math.min(SECTION_IDS.length - 1, i));
      const el = document.getElementById(SECTION_IDS[clamped]);
      if (!el) return;
      const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
      if (lenis) lenis.scrollTo(el, { offset: 0 });
      else el.scrollIntoView({ behavior: "smooth" });
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " " || e.code === "Space") {
        // Only hijack Space when something is loaded — otherwise leave the
        // browser's default space-to-scroll alone.
        if (getAudioEngine().getState().kind !== "none") {
          e.preventDefault();
          void togglePlayback();
        }
      } else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        goIndex(currentIndex() + 1);
      } else if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        goIndex(currentIndex() - 1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
