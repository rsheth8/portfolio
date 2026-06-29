import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { profile } from "@/data/site";
import {
  executePortfolioTool,
  toAnthropicTools,
} from "@/lib/mcp/tools";

export const runtime = "nodejs";

function buildSystemPrompt(): string {
  return `You are the assistant on ${profile.name}'s portfolio site. Visitors ask about ${profile.name}'s work.

You have tools to read portfolio data (profile, projects, skills) and to fetch live GitHub repo stats. Use them when a visitor asks for specifics, comparisons, or up-to-date GitHub numbers — don't guess.

Rules:
- Ground answers in tool results and the portfolio data they return. If something isn't available, say so and point them to ${profile.email}. Never invent facts, metrics, or dates.
- Be concise — two or three sentences for most questions.
- Recommend projects that match the visitor's interest when helpful.
- Speak about ${profile.name} in the third person.`;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 20;
const MAX_TOOL_ROUNDS = 5;

function toApiMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function extractToolUses(content: Anthropic.Messages.ContentBlock[]): ToolUseBlock[] {
  return content.filter(
    (b): b is ToolUseBlock => b.type === "tool_use",
  );
}

async function runToolRound(
  client: Anthropic,
  messages: MessageParam[],
): Promise<string> {
  const tools = toAnthropicTools();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      return extractText(response.content);
    }

    const toolUses = extractToolUses(response.content);
    messages.push({ role: "assistant", content: response.content });

    const toolResults: ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (use) => ({
        type: "tool_result" as const,
        tool_use_id: use.id,
        content: await executePortfolioTool(
          use.name,
          use.input as Record<string, unknown>,
        ),
      })),
    );

    messages.push({ role: "user", content: toolResults });
  }

  return "I hit the tool-use limit — try a simpler question or email Rahil directly.";
}

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
  const apiMessages = toApiMessages(clean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const text = await runToolRound(client, apiMessages);
        controller.enqueue(encoder.encode(text));
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
