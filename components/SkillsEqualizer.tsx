"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { skillGroups } from "@/data/site";
import { useAudioAnalyser, type AudioBands } from "@/lib/audio/useAudioAnalyser";

// Deterministic resting height for a meter, so the EQ has a static silhouette
// even in silence (no Math.random — keeps SSR and client in sync).
function restingLevel(groupIdx: number, skillIdx: number): number {
  return 0.4 + (((groupIdx * 37 + skillIdx * 17) % 32) / 32) * 0.35; // 0.40–0.75
}

/**
 * The "Frequency" section's content: a mixing-board EQ of the stack. Each skill
 * is a level meter colored by its category, and each category pulses to its own
 * slice of whatever audio is playing (bass → Languages, highs → Tools, etc.).
 * In silence the meters hold a gentle shimmering resting level.
 *
 * The live animation runs entirely off refs + one rAF loop — no React re-render
 * per frame — reading the shared analyser the 3D scenes use.
 */
export function SkillsEqualizer() {
  const bands = useAudioAnalyser();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const meters = Array.from(
      root.querySelectorAll<HTMLElement>("[data-meter]"),
    ).map((el) => ({
      el,
      band: el.dataset.band as keyof AudioBands,
      base: Number(el.dataset.base),
      phase: Number(el.dataset.phase),
    }));

    // Reduced motion: paint the resting silhouette once and stop.
    if (prefersReduced) {
      for (const m of meters) m.el.style.transform = `scaleX(${m.base})`;
      return;
    }

    let raf = 0;
    const tick = (now: number) => {
      for (const m of meters) {
        const amp = (bands.current[m.band] as number) ?? 0;
        const idle = (Math.sin(now / 600 + m.phase) * 0.5 + 0.5) * 0.08;
        const level = Math.min(1, Math.max(0.06, m.base * 0.55 + idle + amp * 1.25));
        m.el.style.transform = `scaleX(${level})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bands]);

  return (
    <div
      ref={rootRef}
      className="grid w-full grid-cols-2 gap-3 lg:grid-cols-3"
    >
      {skillGroups.map((group, gi) => (
        <motion.div
          key={group.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: gi * 0.08, ease: "easeOut" }}
          className="rounded-lg border p-3 backdrop-blur-md bg-ink/50"
          style={{ borderColor: `${group.color}33` }}
        >
          {/* Channel header */}
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: group.color,
                boxShadow: `0 0 8px ${group.color}`,
              }}
            />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: group.color }}
            >
              {group.label}
            </span>
          </div>

          {/* Meters */}
          <ul className="space-y-1.5">
            {group.skills.map((skill, si) => (
              <li key={skill} className="flex items-center gap-2">
                <span
                  title={skill}
                  className="w-[5.5rem] shrink-0 truncate font-mono text-[10px] text-bone/75"
                >
                  {skill}
                </span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bone/10">
                  <span
                    data-meter
                    data-band={group.band}
                    data-base={restingLevel(gi, si)}
                    data-phase={gi * 7 + si * 13}
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full will-change-transform"
                    style={{
                      transform: `scaleX(${restingLevel(gi, si)})`,
                      background: `linear-gradient(90deg, ${group.color}66, ${group.color})`,
                      boxShadow: `0 0 6px ${group.color}99`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
