"use client";

import { SceneCanvas } from "./SceneCanvas";
import { RadialSpectrumScene } from "./RadialSpectrumScene";

export function RadialSpectrumCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0.8, 2.6]} fov={55} vignetteDarkness={0.35}>
      <RadialSpectrumScene />
    </SceneCanvas>
  );
}
