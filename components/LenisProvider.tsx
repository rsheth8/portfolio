"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // Skip smooth scroll entirely. Native scrolling and the reduced-motion
      // fallback in globals.css handle the rest.
      return;
    }

    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      // Lighter touch scroll on phones — 1.5 felt too fast on mobile Safari.
      touchMultiplier: isTouch ? 1.0 : 1.5,
    });
    lenisRef.current = lenis;

    // Drive Lenis directly. This avoids loading GSAP solely as a ticker.
    let rafId = 0;
    const frame = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(frame);
    };
    rafId = window.requestAnimationFrame(frame);

    // Expose for components that want to scrollTo (e.g. nav links, TARS handoffs).
    (window as Window & { __lenis?: Lenis }).__lenis = lenis;

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
      delete (window as Window & { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return <>{children}</>;
}
