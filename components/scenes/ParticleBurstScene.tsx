"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioAnalyser } from "@/lib/audio/useAudioAnalyser";
import { useSectionProgress } from "@/lib/useSectionProgress";

/**
 * Particle burst — a cloud of GPU points orbits the center. On bass hits,
 * particles get pushed radially outward with a kick proportional to the
 * spike, then drift back toward the orbit. Color saturates on high
 * frequencies.
 *
 * Simulation runs on the CPU per-particle each frame (~600 particles,
 * cheap). Position attribute is uploaded to the GPU once per frame.
 */
export function ParticleBurstScene() {
  const bands = useAudioAnalyser();
  const sectionProgress = useSectionProgress("ml-projects");

  const COUNT = 600;

  // Per-particle state — base radius, angle, current radial offset, velocity.
  const particles = useMemo(() => {
    return Array.from({ length: COUNT }, () => ({
      r0: 0.8 + Math.random() * 0.6,
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1) - Math.PI / 2, // -PI/2..PI/2
      offset: 0,         // current radial displacement
      offsetVel: 0,      // radial velocity
      spinRate: 0.05 + Math.random() * 0.10,
    }));
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  const cameraTarget = useRef(new THREE.Vector3());

  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      positions[i * 3] = Math.cos(p.theta) * Math.cos(p.phi) * p.r0;
      positions[i * 3 + 1] = Math.sin(p.phi) * p.r0;
      positions[i * 3 + 2] = Math.sin(p.theta) * Math.cos(p.phi) * p.r0;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.35;
      colors[i * 3 + 2] = 0.55;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [particles]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  // Track a smoothed "kick" value — fires when bass spikes above its recent average.
  const prevBass = useRef(0);
  const lastKickTime = useRef(0);

  useFrame((state, dt) => {
    const t = sectionProgress.current;
    const b = bands.current;
    if (!pointsRef.current) return;

    // Kick detection: bass derivative > threshold AND we haven't kicked very recently.
    const now = state.clock.elapsedTime;
    const dBass = b.bass - prevBass.current;
    const kicked =
      dBass > 0.10 &&
      b.bass > 0.30 &&
      now - lastKickTime.current > 0.18;
    prevBass.current = b.bass;
    if (kicked) lastKickTime.current = now;

    // Color shift: hot magenta at rest, warmer toward cyan on high frequencies.
    const hueR = 1.0;
    const hueG = 0.35 + b.high * 0.55;
    const hueB = 0.55 + b.mid * 0.40;

    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      // Inject radial velocity on kick.
      if (kicked) {
        p.offsetVel += 0.6 + Math.random() * 1.0;
      }
      // Spring-damp radial offset back to zero.
      const restore = -p.offset * 6.0;
      p.offsetVel += restore * dt;
      p.offsetVel *= Math.pow(0.06, dt); // strong damping
      p.offset += p.offsetVel * dt;

      // Slow orbital drift.
      p.theta += p.spinRate * dt;

      const radius = p.r0 + p.offset;
      positions[i * 3] = Math.cos(p.theta) * Math.cos(p.phi) * radius;
      positions[i * 3 + 1] = Math.sin(p.phi) * radius;
      positions[i * 3 + 2] = Math.sin(p.theta) * Math.cos(p.phi) * radius;

      colors[i * 3] = hueR;
      colors[i * 3 + 1] = hueG;
      colors[i * 3 + 2] = hueB;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    // Camera: slow orbit + slight zoom.
    const angle = THREE.MathUtils.lerp(0, 0.6, t);
    const distance = THREE.MathUtils.lerp(2.6, 3.6, t);
    const cam = state.camera;
    cam.position.x += (Math.sin(angle) * distance - cam.position.x) * 0.05;
    cam.position.y += (0.4 - cam.position.y) * 0.05;
    cam.position.z += (Math.cos(angle) * distance - cam.position.z) * 0.05;
    cameraTarget.current.set(0, 0, 0);
    cam.lookAt(cameraTarget.current);
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
