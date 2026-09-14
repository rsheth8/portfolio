import { clsx } from "clsx";
import type { Project } from "@/data/site";

const accentClass = {
  bass: "border-bass/30 hover:border-bass/70 text-bass",
  mid: "border-mid/30 hover:border-mid/70 text-mid",
  high: "border-high/30 hover:border-high/70 text-high",
} as const;

export type Accent = keyof typeof accentClass;

/**
 * One project, rendered as a card over the 3D scene. Shows the project type, a
 * concrete proof point, the blurb, tech chips, and whichever links exist.
 * Links are omitted when their URL is empty so we never render a dead anchor.
 */
export function ProjectCard({
  project,
  accent,
}: {
  project: Project;
  accent: Accent;
}) {
  const { name, label, blurb, proof, tech, repo, demo } = project;
  return (
    <li
      data-card
      className={clsx(
        "group relative flex min-h-full flex-col overflow-hidden rounded-2xl border bg-ink/70 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-lg transition duration-300 hover:-translate-y-1 hover:bg-ink/85 focus-within:-translate-y-1 sm:p-7",
        accentClass[accent],
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-current opacity-60"
      />
      <div className="mb-4 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-[0.14em]">
        <span>{label}</span>
        {demo && (
          <span className="flex items-center gap-1.5 text-cream/70">
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            Live
          </span>
        )}
      </div>
      <h3 className="font-mono text-xl font-semibold text-cream sm:text-2xl">{name}</h3>
      <p className="mt-3 flex-1 text-[15px] leading-7 text-bone/85 sm:text-base">{blurb}</p>

      <p className="mt-5 border-l border-current/40 pl-3 font-mono text-xs leading-relaxed text-bone/75 sm:text-sm">
        {proof}
      </p>

      {tech.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tech.map((t) => (
            <li
              key={t}
              className="rounded-md border border-bone/15 bg-bone/[0.03] px-2 py-1 font-mono text-xs text-bone/60"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      {(repo || demo) && (
        <div className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
          {demo && (
            <a
              href={demo}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${name} live demo in a new tab`}
              className="rounded-full border border-current/35 bg-current/10 px-4 py-2.5 text-cream transition-colors hover:bg-current/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              View live ↗
            </a>
          )}
          {repo && (
            <a
              href={repo}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${name} source code on GitHub in a new tab`}
              className="rounded-full px-4 py-2.5 text-mute transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              GitHub ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}
