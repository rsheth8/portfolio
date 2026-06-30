"use client";

/**
 * Cheap, synchronous device-capability heuristic so the WebGL scenes render at a
 * quality the device can actually sustain — the key to consistent, smooth
 * loading across phones, tablets, and desktops.
 *
 * We deliberately avoid a GPU benchmark (async, and itself a hitch); the signals
 * below (memory, cores, pointer/screen) are good enough to separate "budget
 * phone" from "desktop" and pick a safe DPR + antialias setting.
 */

export interface QualityProfile {
  /** Upper bound for the renderer's device-pixel-ratio. */
  dprCap: number;
  /** MSAA on the default framebuffer — off on weak GPUs (big fill-rate save). */
  antialias: boolean;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export function getQualityProfile(): QualityProfile {
  if (typeof window === "undefined") {
    return { dprCap: 1.5, antialias: true };
  }

  const nav = navigator as NavigatorWithMemory;
  const mem = nav.deviceMemory ?? 8; // Chrome-only; assume capable elsewhere
  const cores = nav.hardwareConcurrency ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 640px)").matches;

  // Budget / small touch devices: minimum cost.
  if (mem <= 4 || cores <= 4 || (coarse && narrow)) {
    return { dprCap: 1, antialias: false };
  }

  // Tablets / larger touch devices: middle ground.
  if (coarse) {
    return { dprCap: 1.25, antialias: true };
  }

  // Desktop: allow crisp rendering but cap so 3x/4x displays don't melt.
  return { dprCap: Math.min(window.devicePixelRatio || 1.5, 1.75), antialias: true };
}
