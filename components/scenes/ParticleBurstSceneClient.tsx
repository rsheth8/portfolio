"use client";

import dynamic from "next/dynamic";

const ParticleBurstCanvas = dynamic(
  () => import("./ParticleBurstCanvas").then((m) => m.ParticleBurstCanvas),
  { ssr: false, loading: () => null },
);

export function ParticleBurstSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <ParticleBurstCanvas />
    </div>
  );
}
