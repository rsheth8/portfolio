"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { projectGroups } from "@/data/site";

const accentActive = {
  bass: "border-bass/70 text-bass",
  mid: "border-mid/70 text-mid",
  high: "border-high/70 text-high",
} as const;

// Lenis is exposed on window by LenisProvider; type just the bit we use.
type LenisLike = {
  scrollTo: (target: string | HTMLElement, opts?: { offset?: number }) => void;
};

const NAV = projectGroups.map((g) => ({
  id: g.id,
  role: g.role,
  accent: g.accent,
}));

/**
 * Sticky recruiter nav. Three role pills (AI/ML · Software Engineering · Data
 * Engineering) fixed at the top — click to jump straight to that section, and
 * the pill for the section you're in lights up. Lets a recruiter land on the
 * work matching the role they're hiring for without scrolling the whole reel.
 */
export function RoleNav() {
  const [active, setActive] = useState<string | null>(null);

  // Scrollspy: light up whichever project section is crossing the viewport's
  // upper-middle band.
  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: 0 });
    else el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <nav
      aria-label="Jump to projects by role"
      className="pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2"
    >
      <ul
        data-lenis-prevent
        className="flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto overscroll-contain rounded-full border border-bone/15 bg-graphite/85 p-1 font-mono shadow-2xl backdrop-blur-md"
      >
        {NAV.map((n) => {
          const isActive = active === n.id;
          return (
            <li key={n.id} className="shrink-0">
              <button
                onClick={() => go(n.id)}
                aria-current={isActive ? "true" : undefined}
                className={clsx(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors",
                  isActive
                    ? accentActive[n.accent]
                    : "border-transparent text-bone/70 hover:text-cream",
                )}
              >
                {n.role}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
