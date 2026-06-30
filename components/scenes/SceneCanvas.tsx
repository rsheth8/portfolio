"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { getQualityProfile } from "@/lib/ui/deviceTier";

/** Aspect ratio at/above which we use the scene's authored FOV (wide desktop). */
const DESKTOP_ASPECT = 1.6;

/**
 * Keeps the horizontal framing consistent across aspect ratios. Scenes are
 * authored for wide desktop; on a tall, narrow phone the same FOV crops the
 * animation at the sides. We widen the vertical FOV as the viewport narrows so
 * roughly the same content stays in frame — then commit it to the projection
 * matrix (the scenes only move camera.position, never the FOV, so this sticks).
 */
function ResponsiveCamera({ baseFov }: { baseFov: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    let fov = baseFov;
    if (aspect < DESKTOP_ASPECT) {
      const base = THREE.MathUtils.degToRad(baseFov);
      const widened = 2 * Math.atan(Math.tan(base / 2) * (DESKTOP_ASPECT / aspect));
      fov = Math.min(95, THREE.MathUtils.radToDeg(widened));
    }
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, size, baseFov]);

  return null;
}

/**
 * Shared Canvas wrapper for every WebGL scene. Built for consistent, smooth
 * loading across devices:
 *
 *  - Device-tier quality (DPR + antialias) so weak GPUs aren't overdrawn.
 *  - frameloop pauses when the scene isn't on screen — only the visible canvas
 *    renders, instead of all mounted ones burning the GPU at once.
 *  - The canvas fades in on its first frame over the poster underneath, so there
 *    is no black pop as it initializes.
 *  - WebGL context-loss is caught and fades the canvas out (the poster shows
 *    through) instead of leaving a dead black box — common on mobile Safari.
 *  - A CSS vignette replaces the old postprocessing pass: same look, one less
 *    render target + fullscreen pass per canvas, and identical across browsers.
 *
 * ACES tone mapping stays on the renderer, so scenes that push emissive past 1.0
 * still glow without any post-fx.
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [quality] = useState(getQualityProfile);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);

  // Render only while the section is on (or near) screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "15% 0px 15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        // Fade in once the first frame is drawn (or hide on context loss) — the
        // poster shows through meanwhile. Deliberately NOT tied to `visible`, so
        // an offscreen-paused canvas just freezes its last frame rather than
        // blanking; only context loss hides it.
        className={`transition-opacity duration-700 ${
          ready && !lost ? "opacity-100" : "opacity-0"
        }`}
        dpr={[1, quality.dprCap]}
        frameloop={visible ? "always" : "never"}
        camera={{ fov, near: 0.01, far: 500, position: cameraPosition }}
        gl={{
          antialias: quality.antialias,
          alpha: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          setReady(true);
          const canvas = gl.domElement;
          canvas.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault(); // lets the browser attempt a restore
              setLost(true);
            },
            false,
          );
          canvas.addEventListener("webglcontextrestored", () => setLost(false));
        }}
      >
        <ResponsiveCamera baseFov={fov} />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>

      {/* CSS vignette — replaces the postprocessing Vignette pass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignetteDarkness}) 100%)`,
        }}
      />
    </div>
  );
}
