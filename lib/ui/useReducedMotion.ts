"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the `prefers-reduced-motion` media query and stays live if the user
 * flips the OS setting mid-session. Returns `false` on the server and first
 * client render so SSR markup matches, then updates after mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
