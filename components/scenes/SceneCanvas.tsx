"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, type ReactNode } from "react";
import * as THREE from "three";
import { EffectComposer, Vignette } from "@react-three/postprocessing";

/**
 * Shared Canvas wrapper. ACES tone mapping on the GPU + Vignette only —
 * Bloom and temporal post-fx glitched on the user's machine during scroll,
 * so we fake glow by pushing shader emissive values past 1.0.
 */
export function SceneCanvas({
  children,
  cameraPosition = [0, 0, 5],
  fov = 45,
  vignetteDarkness = 0.65,
}: {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
  vignetteDarkness?: number;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov, near: 0.01, far: 500, position: cameraPosition }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
    >
      <Suspense fallback={null}>
        {children}
        <EffectComposer multisampling={2}>
          <Vignette eskil={false} offset={0.3} darkness={vignetteDarkness} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
