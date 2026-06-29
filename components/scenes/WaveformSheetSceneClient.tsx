"use client";

import dynamic from "next/dynamic";

const WaveformSheetCanvas = dynamic(
  () => import("./WaveformSheetCanvas").then((m) => m.WaveformSheetCanvas),
  { ssr: false, loading: () => null },
);

export function WaveformSheetSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <WaveformSheetCanvas />
    </div>
  );
}
