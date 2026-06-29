"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";

const BASS = new THREE.Color("#ff3a7a");
const MID = new THREE.Color("#00d6ff");
const HIGH = new THREE.Color("#ffe66c");

/**
 * Radial spectrum — frequency bars arranged in a circle around the camera.
 * Each bar's length tracks one FFT bin. Color shifts across the ring from
 * bass-magenta at the bottom through mid-cyan at the sides to high-yellow
 * at the top.
 *
 * Implemented with an InstancedMesh for cheap per-bar GPU updates.
 */
export function RadialSpectrumScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("skills");

  const BAR_COUNT = 128;
  const RADIUS = 1.55;
  const BAR_BASE_HEIGHT = 0.14;
  const BAR_WIDTH = 0.075;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const colorsReady = useRef(false);

  const angles = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => (i / BAR_COUNT) * Math.PI * 2);
  }, []);

  // Site palette ramp: bass (bottom) → mid (sides) → high (top).
  const baseColors = useMemo(() => {
    const out = new Float32Array(BAR_COUNT * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < BAR_COUNT; i++) {
      const a = angles[i];
      const v = (Math.sin(a) + 1) * 0.5;
      const sideness = 1 - Math.abs(Math.cos(a));
      tmp.copy(BASS).lerp(HIGH, v).lerp(MID, sideness * 0.65);
      // Push past 1.0 so bars read bright on the dark canvas.
      out[i * 3] = tmp.r * 2.2;
      out[i * 3 + 1] = tmp.g * 2.2;
      out[i * 3 + 2] = tmp.b * 2.2;
    }
    return out;
  }, [angles]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorTmp = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = sectionProgress.current;
    const freq = bands.current.freq;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!colorsReady.current) {
      for (let i = 0; i < BAR_COUNT; i++) {
        colorTmp.setRGB(
          baseColors[i * 3],
          baseColors[i * 3 + 1],
          baseColors[i * 3 + 2],
        );
        mesh.setColorAt(i, colorTmp);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorsReady.current = true;
    }

    const energy = bands.current.energy;

    for (let i = 0; i < BAR_COUNT; i++) {
      const a = angles[i];
      const t01 = i / BAR_COUNT;
      const binIdx = Math.floor(Math.pow(t01, 1.8) * (freq.length - 1));
      const amplitude = freq.length ? freq[binIdx] / 255 : 0;
      const barLen = BAR_BASE_HEIGHT + amplitude * 2.4 + energy * 0.18;

      dummy.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
      dummy.lookAt(0, 0, 0);
      dummy.scale.set(BAR_WIDTH, barLen, BAR_WIDTH);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const glow = 1 + amplitude * 1.8 + energy * 0.35;
      colorTmp.setRGB(
        baseColors[i * 3] * glow,
        baseColors[i * 3 + 1] * glow,
        baseColors[i * 3 + 2] * glow,
      );
      mesh.setColorAt(i, colorTmp);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.12;
    }

    const angle = THREE.MathUtils.lerp(-0.4, 0.4, t);
    const distance = THREE.MathUtils.lerp(2.6, 4.0, t);
    const height = THREE.MathUtils.lerp(0.8, 1.4, t);

    const cam = state.camera;
    cam.position.x += (Math.sin(angle) * distance - cam.position.x) * 0.06;
    cam.position.y += (height - cam.position.y) * 0.06;
    cam.position.z += (Math.cos(angle) * distance - cam.position.z) * 0.06;
    cameraTarget.current.set(0, 0, 0);
    cam.lookAt(cameraTarget.current);
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 2.5, 1]} intensity={2.2} color="#00d6ff" />
      <pointLight position={[0, -1, -2]} intensity={1.4} color="#ff3a7a" />

      <group ref={groupRef}>
        {/* EQ ring — always-visible reference so the spectrum reads on dark bg */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RADIUS, 0.022, 10, 128]} />
          <meshBasicMaterial color="#00d6ff" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RADIUS * 0.72, 0.012, 8, 96]} />
          <meshBasicMaterial color="#b14dff" transparent opacity={0.35} toneMapped={false} />
        </mesh>

        {/* Center glow — bass pulse anchor */}
        <mesh>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshBasicMaterial color="#ff3a7a" toneMapped={false} />
        </mesh>

        <instancedMesh ref={meshRef} args={[undefined, undefined, BAR_COUNT]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial vertexColors toneMapped={false} />
        </instancedMesh>
      </group>
    </>
  );
}
