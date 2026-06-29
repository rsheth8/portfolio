"use client";

import { SceneCanvas } from "./SceneCanvas";
import { HeroOrbScene } from "./HeroOrbScene";

export function HeroOrbCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0, 3.5]} fov={50}>
      <HeroOrbScene />
    </SceneCanvas>
  );
}
