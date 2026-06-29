# Rahil Sheth — Portfolio

**Live site:** [portfolio-rsheth8s-projects.vercel.app](https://portfolio-rsheth8s-projects.vercel.app/)

An audio-reactive “synesthesia” portfolio. Seven scroll sections, each with its
own WebGL visualization, all reading from one shared audio analyser — pick a
source (file / mic / URL) and the visuals react. Plus an **Ask AI** assistant
grounded in the project data, with tools for live GitHub repo stats.

Built with **Next.js 15** (App Router), **React Three Fiber** / **three.js**,
**Framer Motion**, **Lenis** smooth scroll, **Tailwind**, the **Anthropic SDK**,
and **Model Context Protocol** (`@modelcontextprotocol/sdk`) for shared tool
definitions and a Cursor-facing MCP server.

## Features

- **Scroll-driven sections** — hero, intro, three project tracks (ML, data
  engineering, software), skills EQ, and outro — each with its own WebGL scene.
- **Audio-reactive visuals** — one shared Web Audio analyser drives every scene;
  upload a file, use the mic, or paste a SoundCloud URL.
- **Role nav** — sticky jump links so recruiters can land on the track that
  matches their req.
- **Ask AI** — bottom-left chat widget; visitors can ask about projects, stack,
  or GitHub stats (e.g. “How many stars does MyDrive have?”).
- **Single source of truth** — all copy and project data in `data/site.ts`; the
  page and the assistant stay in sync.

## Ask AI (website)

The chat widget calls `/api/chat`, which uses the **Anthropic API** with native
**tool calling**. When a question needs fresh data, the server runs tools
in-process (portfolio lookup, GitHub REST) — **no separate MCP process required**
for the live site.

| Variable            | Required | Notes |
| ------------------- | -------- | ----- |
| `ANTHROPIC_API_KEY` | Yes      | From [console.anthropic.com](https://console.anthropic.com). Without it, Ask AI returns a friendly 503; the rest of the site works fine. |
| `GITHUB_TOKEN`      | No       | GitHub personal access token for higher API rate limits when the assistant calls `fetch_github_repo`. Public repos work without it (lower limits). |

## Getting started

```bash
git clone <repo-url>
cd portfolio
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY (and optional GITHUB_TOKEN)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command             | Does |
| ------------------- | ---- |
| `npm run dev`       | Dev server |
| `npm run build`     | Production build |
| `npm run start`     | Serve the production build |
| `npm run lint`      | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run mcp`       | Portfolio MCP server (stdio) — for **Cursor / MCP clients**, not the website |

## Editing content

All copy and project data lives in **`data/site.ts`** — profile (name, tagline,
links), project cards (blurb, tech, repo/demo URLs), skill groups, and the
context the AI assistant uses. Edit that one file; the page and the bot stay in
sync.

> Project blurbs are summarized from each repo’s README. Replace with final
> copy, confirm tech stacks, and fix placeholder URLs as needed. Drop
> `resume.pdf` in `public/` and set `profile.resume = "/resume.pdf"` to enable
> the resume link.

## Project layout

```
app/
  page.tsx              # seven sections, assembled from data/site.ts
  layout.tsx            # metadata (OG / Twitter cards)
  icon.tsx              # generated favicon
  opengraph-image.tsx   # generated social preview card
  robots.ts, sitemap.ts
  api/chat/route.ts     # Ask AI — Anthropic + portfolio tools
components/
  scenes/               # WebGL visualizations
  audio/                # audio source picker + analyser-driven backdrops
  ai/AskAI.tsx          # chat widget
  ProjectCard.tsx
data/site.ts            # ← all content
lib/
  audio/                # shared Web Audio engine + analyser hook
  mcp/                  # shared tool definitions (chat + MCP server)
mcp/index.ts            # stdio MCP server entry (Cursor)
.cursor/mcp.json        # Cursor MCP config → npm run mcp
```

## MCP (Model Context Protocol)

The same tool handlers in `lib/mcp/` power **two entry points**:

| Entry point | Who uses it | Needs `npm run mcp`? |
| ----------- | ----------- | -------------------- |
| `/api/chat` | Visitors on the live site | No |
| `npm run mcp` | Cursor, Claude Desktop, other MCP clients | Yes (Cursor spawns it automatically) |

### Tools

| Tool | What it does |
| ---- | ------------ |
| `get_profile` | Name, tagline, contact links |
| `list_projects` | All projects; optional filter by role track |
| `get_project` | Full detail for one project by name |
| `list_skills` | Skill groups from the Frequency section |
| `fetch_github_repo` | Live GitHub stars, language, last push, etc. |

**In Cursor:** `.cursor/mcp.json` runs `npm run mcp`. Reload MCP servers in
Cursor settings after pulling.

**GitHub on the site:** the assistant calls the GitHub REST API directly inside
the tool handler — not via a GitHub MCP server. That keeps the Vercel deployment
simple and fast.

## Deploying (Vercel)

Production: [portfolio-rsheth8s-projects.vercel.app](https://portfolio-rsheth8s-projects.vercel.app/)

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Add environment variables under **Project → Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY` (required for Ask AI)
   - `GITHUB_TOKEN` (optional)
3. Deploy — Next.js preset, no extra config.

If you add a custom domain later, update `SITE_URL` in `app/layout.tsx` and the
URLs in `app/sitemap.ts` and `app/robots.ts`.
