import Anthropic from "@anthropic-ai/sdk";
import { profile, projectGroups } from "@/data/site";

export const runtime = "nodejs";

// One assistant grounded in the portfolio data. The system prompt is built from
// the same data/site.ts the page renders, so the bot can never drift from
// what's actually on the page.
function buildSystemPrompt(): string {
  // Group projects under their hiring-role heading so the bot can answer
  // role-oriented questions ("any backend / ML experience?") accurately.
  const projectLines = projectGroups
    .map(
      (g) =>
        `${g.role}:\n` +
        g.projects
          .map(
            (p) =>
              `  - ${p.name} (${p.tech.join(", ")}): ${p.blurb}${
                p.repo ? ` [code: ${p.repo}]` : ""
              }`,
          )
          .join("\n"),
    )
    .join("\n\n");

  return `You are the assistant on ${profile.name}'s portfolio site. Visitors — recruiters, engineers, the curious — ask you about ${profile.name}'s work.

About ${profile.name}: ${profile.tagline}
Contact: ${profile.email}${profile.github ? `, GitHub ${profile.github}` : ""}

Projects, grouped by the kind of role they fit:
${projectLines}

Rules:
- Answer ONLY from the information above. If you don't know something (a metric, a date, a detail not listed), say so plainly and point them to ${profile.email}. Never invent facts, numbers, or claims about ${profile.name}.
- Be concise and conversational — two or three sentences for most questions. This is a chat widget, not an essay.
- You can recommend which projects fit an interest the visitor mentions.
- Speak about ${profile.name} in the third person.`;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 20; // cap conversation length to bound cost/abuse

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The assistant isn't configured — ANTHROPIC_API_KEY is unset." },
      { status: 503 },
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body?.messages;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  // Sanitize: keep only well-formed turns, trim to the most recent MAX_TURNS.
  const clean = messages
    .filter(
      (m): m is ChatMessage =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
    return Response.json(
      { error: "Last message must be from the user." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llm = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: buildSystemPrompt(),
          messages: clean,
        });
        llm.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        await llm.finalMessage();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "The assistant hit an error.";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
