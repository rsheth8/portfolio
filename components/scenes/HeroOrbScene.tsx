"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";
import { getPalette } from "@/lib/theme/palette";

/**
 * Hero scene — single luminous orb pulsing to the bass, surrounded by a
 * thin waveform threading horizontally. The pulse is audio; the camera
 * pull-back is scroll.
 *
 * Materials:
 *   - Orb: emissive shader, scale and intensity driven by bass + energy
 *   - Wave: line primitive built from the time-domain audio buffer,
 *     refreshed each frame
 */
export function HeroOrbScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("hero");

  const orbRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const lerpScale = useRef(1);
  const lerpGlow = useRef(0);

  // Orb material — custom shader with two-stop emissive gradient driven
  // by a single uniform uPulse. Bass spikes push uPulse high; it lerps
  // back down. Color shifts from gold (resting) to bass-magenta (peak).
  const orbMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        // Peak colors — driven by the live album palette each frame.
        uCorePeak: { value: new THREE.Color(1.0, 0.22, 0.48) },
        uRimPeak: { value: new THREE.Color(1.0, 0.62, 0.78) },
      },
      transparent: false,
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uPulse;
        uniform vec3 uCorePeak;
        uniform vec3 uRimPeak;
        varying vec3 vNormalW;
        varying vec3 vViewDir;

        void main() {
          // Fresnel rim — hot at the edge.
          float facing = max(dot(vNormalW, vViewDir), 0.0);
          float rim = pow(1.0 - facing, 2.8);

          // Resting palette: deep gold core, warm cream rim.
          vec3 coreCool = vec3(0.85, 0.62, 0.18);  // gold
          vec3 rimCool  = vec3(1.00, 0.88, 0.55);  // cream

          // Peak palette: tinted to the playing track (album theme).
          vec3 corePeak = uCorePeak;
          vec3 rimPeak  = uRimPeak;

          vec3 core = mix(coreCool, corePeak, uPulse);
          vec3 rim_ = mix(rimCool, rimPeak, uPulse);

          vec3 col = mix(core, rim_, rim) * (0.7 + uPulse * 1.4);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  // Halo — second sphere with backside fresnel, additive blending,
  // bigger glow on peaks.
  const haloMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPulse: { value: 0 },
        uHot: { value: new THREE.Color(1.0, 0.22, 0.48) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        void main() {
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uPulse;
        uniform vec3 uHot;
        varying vec3 vNormalW;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormalW, vec3(0.0, 0.0, 1.0))), 3.2);
          vec3 cool = vec3(0.85, 0.62, 0.18);
          vec3 hot  = uHot;
          vec3 col = mix(cool, hot, uPulse);
          gl_FragColor = vec4(col * rim * (0.8 + uPulse * 2.5), rim * (0.45 + uPulse * 0.55));
        }
      `,
    });
  }, []);

  useFrame((state) => {
    const t = sectionProgress.current;
    const b = bands.current;
    orbMaterial.uniforms.uTime.value = state.clock.elapsedTime;

    // Pulse target — bass is the dominant driver, with energy for sustain.
    const targetScale = 1 + b.bass * 0.55 + b.energy * 0.10;
    const targetGlow = b.bass * 0.85 + b.energy * 0.20;

    // Fast lerp so beats feel snappy. Decay is naturally slower because
    // the source value decays naturally.
    lerpScale.current += (targetScale - lerpScale.current) * 0.30;
    lerpGlow.current += (targetGlow - lerpGlow.current) * 0.25;

    if (orbRef.current) {
      orbRef.current.scale.setScalar(lerpScale.current);
    }
    if (haloRef.current) {
      const haloScale = 1.18 + b.bass * 0.6;
      haloRef.current.scale.setScalar(haloScale);
    }

    orbMaterial.uniforms.uPulse.value = lerpGlow.current;
    haloMaterial.uniforms.uPulse.value = lerpGlow.current;

    // Tint the orb's peak/halo to the live album palette. Direct channel
    // assignment (0-1 from 0-255) keeps the raw values the shader expects.
    const pal = getPalette().getCurrent();
    const corePeak = orbMaterial.uniforms.uCorePeak.value as THREE.Color;
    corePeak.r = pal.bass[0] / 255;
    corePeak.g = pal.bass[1] / 255;
    corePeak.b = pal.bass[2] / 255;
    const rimPeak = orbMaterial.uniforms.uRimPeak.value as THREE.Color;
    rimPeak.r = pal.accent[0] / 255;
    rimPeak.g = pal.accent[1] / 255;
    rimPeak.b = pal.accent[2] / 255;
    const hot = haloMaterial.uniforms.uHot.value as THREE.Color;
    hot.r = pal.bass[0] / 255;
    hot.g = pal.bass[1] / 255;
    hot.b = pal.bass[2] / 255;

    // Scroll-driven camera dolly: gentle pull-back across the section.
    const distance = THREE.MathUtils.lerp(3.5, 5.0, t);
    const height = THREE.MathUtils.lerp(0.0, 0.5, t);

    const cam = state.camera;
    cam.position.x += (0 - cam.position.x) * 0.05;
    cam.position.y += (height - cam.position.y) * 0.05;
    cam.position.z += (distance - cam.position.z) * 0.05;
    cameraTarget.current.set(0, 0, 0);
    cam.lookAt(cameraTarget.current);
  });

  return (
    <>
      {/* Halo — backside fresnel sphere, additive, much bigger on peaks */}
      <mesh ref={haloRef} material={haloMaterial}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>

      {/* Core orb */}
      <mesh ref={orbRef} material={orbMaterial}>
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>

      {/* Waveform line — separate component because it rebuilds geometry */}
      <Waveform />
    </>
  );
}

/**
 * Time-domain waveform rendered as a single line stretched horizontally
 * across the scene under the orb. Updates every frame from the analyser.
 */
function Waveform() {
  const bands = useAudioAnalyser();
  const SAMPLES = 256;
  const lineRef = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(SAMPLES * 3);
    for (let i = 0; i < SAMPLES; i++) {
      positions[i * 3] = (i / (SAMPLES - 1)) * 6 - 3;
      positions[i * 3 + 1] = -1.7;
      positions[i * 3 + 2] = 0;
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#8aa8c8", // ice blue — Drake "Views" nod
        transparent: true,
        opacity: 0.55,
      }),
    [],
  );

  useFrame(() => {
    const time = bands.current.time;
    if (!time.length || !lineRef.current) return;
    const ice = getPalette().getCurrent().ice;
    material.color.setRGB(ice[0] / 255, ice[1] / 255, ice[2] / 255);
    const positions = geometry.attributes.position.array as Float32Array;
    const stride = Math.max(1, Math.floor(time.length / SAMPLES));
    for (let i = 0; i < SAMPLES; i++) {
      // time[i] is 0-255, center at 128 means silence. Map to [-1, 1].
      const v = (time[i * stride] - 128) / 128;
      positions[i * 3 + 1] = -1.7 + v * 0.6;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={new THREE.Line(geometry, material)} ref={lineRef} />;
}
