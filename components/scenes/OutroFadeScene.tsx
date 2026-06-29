"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";

/**
 * Outro fade — single soft dot, low-amplitude pulse. Energy drives opacity
 * with a very slow decay so the dot lingers after the music stops, like a
 * tail-out on a final beat.
 */
export function OutroFadeScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("contact");

  const dotRef = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const opacity = useRef(0.0);
  const scale = useRef(1.0);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 q = vUv - 0.5;
          float d = length(q);
          // Soft gaussian falloff.
          float core = exp(-d * d * 16.0);
          float halo = exp(-d * d * 3.0) * 0.35;
          float a = (core + halo) * uOpacity;
          vec3 col = mix(vec3(0.85, 0.62, 0.18), vec3(1.0, 0.96, 0.85), core);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    const t = sectionProgress.current;
    const b = bands.current;

    // Slow attack on energy, very slow decay — gives the tail-out feel.
    const target = 0.15 + b.energy * 0.85;
    const rate = target > opacity.current ? 0.12 : 0.025;
    opacity.current += (target - opacity.current) * rate;

    const targetScale = 1.0 + b.bass * 0.4;
    scale.current += (targetScale - scale.current) * 0.10;

    if (dotRef.current) dotRef.current.scale.setScalar(scale.current);
    material.uniforms.uOpacity.value = opacity.current;

    // Camera barely moves — outro should feel still.
    const distance = THREE.MathUtils.lerp(2.8, 3.4, t);
    const cam = state.camera;
    cam.position.x += (0 - cam.position.x) * 0.04;
    cam.position.y += (0 - cam.position.y) * 0.04;
    cam.position.z += (distance - cam.position.z) * 0.04;
    cameraTarget.current.set(0, 0, 0);
    cam.lookAt(cameraTarget.current);
  });

  return (
    <mesh ref={dotRef} material={material}>
      <planeGeometry args={[2, 2, 1, 1]} />
    </mesh>
  );
}
