"use client";

import { SceneCanvas } from "./SceneCanvas";
import { WaveformSheetScene } from "./WaveformSheetScene";

export function WaveformSheetCanvas() {
  return (
    <SceneCanvas cameraPosition={[0, 0.3, 3]} fov={55}>
      <WaveformSheetScene />
    </SceneCanvas>
  );
}
