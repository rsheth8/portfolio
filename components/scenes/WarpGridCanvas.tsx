"use client";

import { SceneCanvas } from "./SceneCanvas";
import { WarpGridScene } from "./WarpGridScene";

export function WarpGridCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0.7, 4.5]} fov={60}>
      <WarpGridScene />
    </SceneCanvas>
  );
}
