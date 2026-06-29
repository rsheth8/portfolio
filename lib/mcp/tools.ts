import { z } from "zod";
import {
  allProjects,
  profile,
  projectGroups,
  skillGroups,
  type Project,
} from "@/data/site";

export interface PortfolioTool {
  name: string;
  description: string;
  zodSchema: z.ZodRawShape;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<string>;
}

function findProject(name: string): Project | undefined {
  const q = name.trim().toLowerCase();
  return allProjects.find((p) => p.name.toLowerCase() === q);
}

function formatProject(p: Project, role?: string): string {
  const lines = [
    `Name: ${p.name}`,
    role ? `Role track: ${role}` : null,
    `Blurb: ${p.blurb}`,
    `Tech: ${p.tech.join(", ")}`,
    p.repo ? `Repo: ${p.repo}` : null,
    p.demo ? `Demo: ${p.demo}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

async function fetchGithubRepo(args: Record<string, unknown>): Promise<string> {
  let owner: string | undefined;
  let repo: string | undefined;

  if (typeof args.repo === "string" && args.repo.includes("/")) {
    [owner, repo] = args.repo.split("/", 2);
  } else if (typeof args.repo_url === "string") {
    const match = args.repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (match) {
      owner = match[1];
      repo = match[2]?.replace(/\.git$/, "");
    }
  }

  if (!owner || !repo) {
    return "Provide `repo` as owner/name (e.g. rsheth8/MyDrive) or `repo_url` as a GitHub URL.";
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-mcp",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return `GitHub API error (${res.status}) for ${owner}/${repo}.`;
  }

  const data = (await res.json()) as {
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    topics?: string[];
    pushed_at: string;
    open_issues_count: number;
    license?: { spdx_id: string } | null;
  };

  return [
    `Repository: ${data.full_name}`,
    data.description ? `Description: ${data.description}` : null,
    `URL: ${data.html_url}`,
    `Stars: ${data.stargazers_count} · Forks: ${data.forks_count} · Open issues: ${data.open_issues_count}`,
    data.language ? `Primary language: ${data.language}` : null,
    data.topics?.length ? `Topics: ${data.topics.join(", ")}` : null,
    data.license?.spdx_id ? `License: ${data.license.spdx_id}` : null,
    `Last push: ${data.pushed_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const portfolioTools: PortfolioTool[] = [
  {
    name: "get_profile",
    description:
      "Return Rahil Sheth's profile — tagline, email, GitHub, LinkedIn, resume link.",
    zodSchema: {},
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      [
        `Name: ${profile.name}`,
        `Tagline: ${profile.tagline}`,
        `Email: ${profile.email}`,
        `GitHub: ${profile.github}`,
        profile.linkedin ? `LinkedIn: ${profile.linkedin}` : null,
        profile.resume ? `Resume: ${profile.resume}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
  },
  {
    name: "list_projects",
    description:
      "List portfolio projects. Optionally filter by hiring role track (e.g. 'AI / Machine Learning', 'Data Engineering', 'Software Engineering').",
    zodSchema: {
      role: z
        .string()
        .optional()
        .describe("Optional role track filter — partial match is fine."),
    },
    inputSchema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "Optional role track filter — partial match is fine.",
        },
      },
    },
    handler: async (args) => {
      const roleFilter =
        typeof args.role === "string" ? args.role.trim().toLowerCase() : "";
      const groups = roleFilter
        ? projectGroups.filter((g) => g.role.toLowerCase().includes(roleFilter))
        : projectGroups;

      if (groups.length === 0) {
        return `No project groups match role filter "${args.role}".`;
      }

      return groups
        .map(
          (g) =>
            `${g.role} (${g.id}):\n` +
            g.projects
              .map((p) => `  - ${p.name}: ${p.blurb} [${p.tech.join(", ")}]`)
              .join("\n"),
        )
        .join("\n\n");
    },
  },
  {
    name: "get_project",
    description:
      "Get full details for one portfolio project by exact name (e.g. MyDrive, Hindsight).",
    zodSchema: {
      name: z.string().describe("Project name."),
    },
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name." },
      },
      required: ["name"],
    },
    handler: async (args) => {
      const name = typeof args.name === "string" ? args.name : "";
      const project = findProject(name);
      if (!project) {
        const names = allProjects.map((p) => p.name).join(", ");
        return `Unknown project "${name}". Known projects: ${names}`;
      }
      const group = projectGroups.find((g) =>
        g.projects.some((p) => p.name === project.name),
      );
      return formatProject(project, group?.role);
    },
  },
  {
    name: "list_skills",
    description: "List skill groups and technologies from the portfolio.",
    zodSchema: {},
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      skillGroups
        .map((g) => `${g.label}: ${g.skills.join(", ")}`)
        .join("\n"),
  },
  {
    name: "fetch_github_repo",
    description:
      "Fetch live GitHub metadata (stars, language, last push, description) for a public repo. Use for up-to-date stats beyond the static portfolio copy.",
    zodSchema: {
      repo: z
        .string()
        .optional()
        .describe("owner/repo, e.g. rsheth8/MyDrive"),
      repo_url: z
        .string()
        .optional()
        .describe("Full GitHub URL — alternative to repo."),
    },
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "owner/repo, e.g. rsheth8/MyDrive",
        },
        repo_url: {
          type: "string",
          description: "Full GitHub URL — alternative to repo.",
        },
      },
    },
    handler: fetchGithubRepo,
  },
];

const toolByName = new Map(portfolioTools.map((t) => [t.name, t]));

export function toAnthropicTools() {
  return portfolioTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export async function executePortfolioTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const tool = toolByName.get(name);
  if (!tool) return `Unknown tool: ${name}`;
  try {
    return await tool.handler(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed.";
    return `Tool error (${name}): ${msg}`;
  }
}

export function portfolioSummaryResource(): string {
  const projectCount = allProjects.length;
  return [
    `${profile.name} — ${profile.tagline}`,
    `Contact: ${profile.email}`,
    `${projectCount} projects across ${projectGroups.length} role tracks.`,
    projectGroups.map((g) => `${g.role}: ${g.projects.length} projects`).join(" · "),
  ].join("\n");
}
