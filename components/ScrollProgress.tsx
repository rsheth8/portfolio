"use client";

import { useEffect, useState } from "react";

/**
 * Thin top-edge progress bar — visual confirmation that Lenis is driving
 * scroll smoothly.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-40 h-[2px] w-full bg-transparent"
      aria-hidden
    >
      <div
        className="h-full bg-bass/70 shadow-[0_0_12px_rgba(255,58,122,0.6)] transition-[width] duration-100"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
