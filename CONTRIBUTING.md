# Contributing to the portfolio site

## Prerequisites
- Node.js + npm

## Run
```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY for Ask AI only
npm run dev
```

The visuals work without any keys.

## Checks
```bash
npm run lint
npm run typecheck
```

Edit copy in `data/site.ts` only — the page and Ask AI both read it.

Optional: `npm run mcp` for the stdio MCP server.
