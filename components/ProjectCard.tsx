import { clsx } from "clsx";
import type { Project } from "@/data/site";

const accentClass = {
  bass: "border-bass/30 hover:border-bass/70 text-bass",
  mid: "border-mid/30 hover:border-mid/70 text-mid",
  high: "border-high/30 hover:border-high/70 text-high",
} as const;

export type Accent = keyof typeof accentClass;

/**
 * One project, rendered as a card over the 3D scene. Shows a role tag (so a
 * recruiter can match it to an open req), the blurb, a row of tech chips, and
 * whatever links exist (repo / demo). Links are omitted when their URL is empty
 * so we never render a dead `#` anchor.
 */
export function ProjectCard({
  project,
  accent,
  role,
}: {
  project: Project;
  accent: Accent;
  role?: string;
}) {
  const { name, blurb, tech, repo, demo } = project;
  return (
    <li
      data-card
      className={clsx(
        "group flex flex-col rounded-lg border p-4 backdrop-blur-sm bg-ink/50 transition-colors",
        accentClass[accent],
      )}
    >
      {role && (
        <span
          className={clsx(
            "mb-2 inline-block self-start rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            accentClass[accent],
          )}
        >
          {role}
        </span>
      )}
      <h3 className="font-mono text-sm font-semibold text-cream">{name}</h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-bone/80">{blurb}</p>

      {tech.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tech.map((t) => (
            <li
              key={t}
              className="rounded border border-bone/15 px-1.5 py-0.5 font-mono text-[10px] text-mute"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      {(repo || demo) && (
        <div className="mt-4 flex gap-4 font-mono text-[11px] uppercase tracking-wider">
          {repo && (
            <a
              href={repo}
              target="_blank"
              rel="noreferrer"
              className="text-mute transition-colors hover:text-cream"
            >
              Code ↗
            </a>
          )}
          {demo && (
            <a
              href={demo}
              target="_blank"
              rel="noreferrer"
              className="text-mute transition-colors hover:text-cream"
            >
              Demo ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}
