"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a ref whose `.current` is the user's scroll progress through a
 * given DOM section: 0 when the section's top hits the viewport bottom,
 * 1 when the section's bottom hits the viewport top.
 *
 * Ref-not-state on purpose — we read this from inside R3F's useFrame
 * loop, which we don't want triggering React renders on every scroll.
 *
 * Listens to both native scroll and Lenis's scroll event so it works in
 * both reduced-motion (no Lenis) and normal modes.
 */
export function useSectionProgress(sectionId: string) {
  const progress = useRef(0);

  useEffect(() => {
    const update = () => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      progress.current = Math.max(0, Math.min(1, traveled / total));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sectionId]);

  return progress;
}
