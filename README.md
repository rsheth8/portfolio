# Rahil Sheth — Portfolio

An audio-reactive "synesthesia" portfolio. Seven scroll sections, each with its
own WebGL visualization, all reading from one shared audio analyser — pick a
source (file / mic / URL) and the visuals react. Plus an AI assistant grounded
in the project data so visitors can just ask about the work.

Built with **Next.js 15** (App Router), **React Three Fiber** / **three.js**,
**Framer Motion**, **Lenis** smooth scroll, **Tailwind**, and the
**Anthropic SDK**.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your key (see below)
npm run dev                  # http://localhost:3000
```

### Environment

| Variable            | Required for        | Notes                                                   |
| ------------------- | ------------------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | The "Ask AI" widget | Get one at console.anthropic.com. The rest of the site runs without it — the chat endpoint returns a friendly 503 when it's unset. |

## Scripts

| Command             | Does                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Dev server                    |
| `npm run build`     | Production build              |
| `npm run start`     | Serve the production build    |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | `tsc --noEmit`                |

## Editing content

All copy and project data lives in **`data/site.ts`** — the profile (name,
tagline, links), the project cards (blurb, tech, repo/demo URLs), and the
context the AI assistant is grounded in all come from there. Edit that one file;
the page and the bot stay in sync.

> The project blurbs are starter drafts inferred from the project names —
> replace them with the real descriptions, confirm the tech stacks, and fix any
> placeholder repo URLs (marked `// TODO: verify`). Add your LinkedIn URL and a
> `resume.pdf` (drop it in `public/` and set `profile.resume = "/resume.pdf"`)
> to light up those two contact links — they're hidden until set.

## Project layout

```
app/
  page.tsx              # the seven sections, assembled from data/site.ts
  layout.tsx            # metadata (OG / Twitter cards)
  icon.tsx              # generated favicon
  opengraph-image.tsx   # generated social preview card
  robots.ts, sitemap.ts
  api/chat/route.ts     # streaming AI endpoint (Anthropic SDK)
components/
  scenes/               # the WebGL visualizations
  audio/                # audio source picker + analyser-driven backdrops
  ai/AskAI.tsx          # the chat widget
  ProjectCard.tsx
data/site.ts            # ← all content
lib/audio/              # the shared Web Audio engine + analyser hook
```

## Deploying (Vercel)

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Add `ANTHROPIC_API_KEY` under **Project → Settings → Environment Variables**.
3. Deploy. The framework preset (Next.js) needs no extra config.

Update the production URL in `app/robots.ts`, `app/sitemap.ts`, and
`app/layout.tsx` (`SITE_URL`) if you use a domain other than `rahilsheth.com`.
