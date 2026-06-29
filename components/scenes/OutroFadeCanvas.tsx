"use client";

import { SceneCanvas } from "./SceneCanvas";
import { OutroFadeScene } from "./OutroFadeScene";

export function OutroFadeCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0, 2.8]} fov={50}>
      <OutroFadeScene />
    </SceneCanvas>
  );
}
