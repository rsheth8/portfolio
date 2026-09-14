import { ProjectCard } from "@/components/ProjectCard";
import { projectGroups } from "@/data/site";

const groupById = Object.fromEntries(projectGroups.map((g) => [g.id, g]));

/**
 * A server-rendered grid of project cards. Cards are deliberately visible in
 * the initial HTML: the work is core content, so it never waits for hydration,
 * an intersection observer, or an animation library before appearing.
 */
export function ProjectGrid({ id }: { id: keyof typeof groupById }) {
  const group = groupById[id];

  return (
    <ul
      className={`grid gap-4 sm:gap-5 md:grid-cols-2 ${
        group.projects.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
      }`}
    >
      {group.projects.map((p) => (
        <ProjectCard
          key={p.name}
          project={p}
          accent={group.accent}
        />
      ))}
    </ul>
  );
}
