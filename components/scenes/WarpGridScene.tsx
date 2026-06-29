"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";

/**
 * Warp grid — wireframe plane tilted back like a synthwave horizon. Each
 * vertex is displaced vertically by a noise field whose amplitude tracks
 * the midrange energy. Reads as a digital surface flexing under the music.
 *
 * Vertex shader does the heavy lifting; fragment is just a color gradient.
 */
export function WarpGridScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("infra-projects");

  const meshRef = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      wireframe: true,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uMid: { value: 0 },
        uLowMid: { value: 0 },
        uBass: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uMid;
        uniform float uLowMid;
        uniform float uBass;
        varying vec3 vPos;
        varying float vHeight;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1, 0)), f.x),
            mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 p = position;
          // Two-layer warp: slow large undulation + faster small chop. Drift
          // in +x so the grid feels like it's flowing toward the viewer.
          float slow = fbm(p.xy * 0.6 + vec2(uTime * 0.15, 0.0));
          float fast = fbm(p.xy * 2.2 + vec2(uTime * 0.4, uTime * 0.1));
          float amp = 0.20 + uMid * 1.4 + uBass * 0.6;
          float h = (slow - 0.5) * amp + (fast - 0.5) * amp * 0.4;
          p.z += h;
          vHeight = h;
          vPos = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        varying float vHeight;
        void main() {
          // Color shifts with height: cyan on troughs, magenta on crests.
          float t = clamp(vHeight * 0.8 + 0.5, 0.0, 1.0);
          vec3 cool = vec3(0.0, 0.84, 1.0);
          vec3 hot  = vec3(1.0, 0.22, 0.48);
          vec3 col = mix(cool, hot, t);

          // Fade toward the back of the grid (large -y in local space).
          float fade = smoothstep(-6.0, 4.0, vPos.y);
          gl_FragColor = vec4(col * (0.5 + 0.8 * fade), 0.85 * fade);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    const t = sectionProgress.current;
    const b = bands.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uMid.value = b.mid;
    material.uniforms.uLowMid.value = b.lowMid;
    material.uniforms.uBass.value = b.bass;

    // Camera: low and tilted forward, looking down the grid into the distance.
    const distance = THREE.MathUtils.lerp(4.5, 6.5, t);
    const height = THREE.MathUtils.lerp(0.7, 1.5, t);

    const cam = state.camera;
    cam.position.x += (0 - cam.position.x) * 0.05;
    cam.position.y += (height - cam.position.y) * 0.05;
    cam.position.z += (distance - cam.position.z) * 0.05;
    cameraTarget.current.set(0, 0, -4);
    cam.lookAt(cameraTarget.current);
  });

  return (
    <mesh
      ref={meshRef}
      material={material}
      rotation={[-Math.PI / 2.6, 0, 0]}
      position={[0, -0.5, -2]}
    >
      {/* High-res plane so vertex displacement looks smooth.
          12x18 units, 80x80 segments → 6480 vertices. */}
      <planeGeometry args={[12, 18, 80, 80]} />
    </mesh>
  );
}
