"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProjectCard } from "@/components/ProjectCard";
import { projectGroups } from "@/data/site";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const groupById = Object.fromEntries(projectGroups.map((g) => [g.id, g]));

/**
 * A grid of project cards that reveal with a staggered GSAP rise as the section
 * scrolls into view. ScrollTrigger is already bridged to Lenis in
 * LenisProvider, so the reveal tracks the smooth-scroll position.
 *
 * Respects prefers-reduced-motion: when set, the cards render in their final
 * state with no animation.
 */
export function ProjectGrid({ id }: { id: keyof typeof groupById }) {
  const group = groupById[id];
  const ref = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return; // leave cards visible, skip animation

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]", root);
      gsap.set(cards, { opacity: 0, y: 28 });

      // Reveal the whole grid as a staggered batch the first time it enters.
      ScrollTrigger.batch(cards, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.12,
          }),
      });
    }, root);

    return () => ctx.revert();
  }, [id]);

  return (
    <ul ref={ref} className="grid gap-6 md:grid-cols-3">
      {group.projects.map((p) => (
        <ProjectCard
          key={p.name}
          project={p}
          accent={group.accent}
          role={group.role}
        />
      ))}
    </ul>
  );
}
