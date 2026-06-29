"use client";

import dynamic from "next/dynamic";

const OutroFadeCanvas = dynamic(
  () => import("./OutroFadeCanvas").then((m) => m.OutroFadeCanvas),
  { ssr: false, loading: () => null },
);

export function OutroFadeSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <OutroFadeCanvas />
    </div>
  );
}
