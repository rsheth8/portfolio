"use client";

import dynamic from "next/dynamic";

const RadialSpectrumCanvas = dynamic(
  () => import("./RadialSpectrumCanvas").then((m) => m.RadialSpectrumCanvas),
  { ssr: false, loading: () => null },
);

export function RadialSpectrumSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <RadialSpectrumCanvas />
    </div>
  );
}
