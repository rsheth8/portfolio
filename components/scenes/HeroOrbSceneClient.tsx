"use client";

import dynamic from "next/dynamic";

const HeroOrbCanvas = dynamic(
  () => import("./HeroOrbCanvas").then((m) => m.HeroOrbCanvas),
  { ssr: false, loading: () => null },
);

export function HeroOrbSceneClient() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <HeroOrbCanvas />
    </div>
  );
}
