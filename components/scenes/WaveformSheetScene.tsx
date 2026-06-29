"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";

/**
 * Waveform sheet — a stack of horizontal waveform lines receding into the
 * background. Each line samples the time-domain audio buffer; the most
 * recent line is bright cyan up front, older lines age back into the
 * darkness, getting dimmer and bluer as they go.
 *
 * The effect reads like a tape deck rolling — the waveform "scrolls"
 * back into space, with the current moment always at the front.
 */
export function WaveformSheetScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("about");

  const LINE_COUNT = 18;
  const SAMPLES = 192;

  // Pre-allocated history of waveform snapshots. Index 0 is the newest.
  const history = useMemo(
    () =>
      Array.from({ length: LINE_COUNT }, () => new Float32Array(SAMPLES)),
    [],
  );

  const linesRef = useRef<THREE.Group>(null);
  const lineMeshes = useMemo(() => {
    return Array.from({ length: LINE_COUNT }, (_, i) => {
      const positions = new Float32Array(SAMPLES * 3);
      for (let s = 0; s < SAMPLES; s++) {
        positions[s * 3] = (s / (SAMPLES - 1)) * 8 - 4;
        positions[s * 3 + 1] = 0;
        positions[s * 3 + 2] = -i * 0.42; // recede into depth
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const ageT = i / (LINE_COUNT - 1); // 0 = newest, 1 = oldest
      const color = new THREE.Color().setHSL(
        0.55 - ageT * 0.05,           // cyan → slightly bluer
        0.75,
        0.55 * (1 - ageT * 0.7),       // fade to dark
      );
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 1 - ageT * 0.7,
      });
      return { geometry: g, material: mat };
    });
  }, []);

  const tickCounter = useRef(0);
  const cameraTarget = useRef(new THREE.Vector3());

  useFrame((state) => {
    const t = sectionProgress.current;
    const time = bands.current.time;

    // Push a fresh snapshot every other frame so motion is visible but
    // doesn't flood the GPU with attribute updates.
    tickCounter.current++;
    if (tickCounter.current % 2 === 0 && time.length > 0) {
      // Shift history: drop oldest, prepend newest.
      for (let i = LINE_COUNT - 1; i > 0; i--) {
        history[i].set(history[i - 1]);
      }
      const stride = Math.max(1, Math.floor(time.length / SAMPLES));
      for (let s = 0; s < SAMPLES; s++) {
        history[0][s] = (time[s * stride] - 128) / 128;
      }

      // Push fresh geometry to each line.
      for (let i = 0; i < LINE_COUNT; i++) {
        const positions = lineMeshes[i].geometry.attributes.position
          .array as Float32Array;
        const snap = history[i];
        for (let s = 0; s < SAMPLES; s++) {
          positions[s * 3 + 1] = snap[s] * 0.7;
        }
        lineMeshes[i].geometry.attributes.position.needsUpdate = true;
      }
    }

    // Scroll-driven camera dolly: tilt down + pull back across the section.
    const distance = THREE.MathUtils.lerp(3.0, 5.5, t);
    const height = THREE.MathUtils.lerp(0.3, 1.5, t);

    const cam = state.camera;
    cam.position.x += (0 - cam.position.x) * 0.05;
    cam.position.y += (height - cam.position.y) * 0.05;
    cam.position.z += (distance - cam.position.z) * 0.05;
    cameraTarget.current.set(0, 0, -3);
    cam.lookAt(cameraTarget.current);
  });

  return (
    <group ref={linesRef}>
      {lineMeshes.map(({ geometry, material }, i) => (
        <primitive
          key={i}
          object={new THREE.Line(geometry, material)}
        />
      ))}
    </group>
  );
}
