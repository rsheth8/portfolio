"use client";

import { useEffect } from "react";
import { getAudioEvents } from "@/lib/audio/audioEvents";

/**
 * Mobile haptics on the drop — a short buzz when a big energy surge lands, so
 * the bass is felt as well as seen. Drops only (never per-beat) to stay subtle
 * and battery-friendly; no-op on devices without the Vibration API.
 */
export function BeatHaptics() {
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }
    const off = getAudioEvents().onDrop((e) => {
      if (document.visibilityState !== "visible") return;
      navigator.vibrate(Math.round(12 + e.intensity * 18));
    });
    return off;
  }, []);

  return null;
}
