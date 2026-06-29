"use client";

import { SceneCanvas } from "./SceneCanvas";
import { ParticleBurstScene } from "./ParticleBurstScene";

export function ParticleBurstCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0.4, 2.6]} fov={55}>
      <ParticleBurstScene />
    </SceneCanvas>
  );
}
