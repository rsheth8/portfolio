"use client";

import dynamic from "next/dynamic";

const WarpGridCanvas = dynamic(
  () => import("./WarpGridCanvas").then((m) => m.WarpGridCanvas),
  { ssr: false, loading: () => null },
);

export function WarpGridSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <WarpGridCanvas />
    </div>
  );
}
