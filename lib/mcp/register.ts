import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  executePortfolioTool,
  portfolioSummaryResource,
  portfolioTools,
} from "./tools";

/** Register portfolio tools + resources on an MCP server instance. */
export function registerPortfolioMcp(server: McpServer): void {
  for (const tool of portfolioTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodSchema,
      },
      async (args: Record<string, unknown>) => ({
        content: [
          {
            type: "text" as const,
            text: await executePortfolioTool(tool.name, args),
          },
        ],
      }),
    );
  }

  server.registerResource(
    "portfolio-summary",
    "portfolio://summary",
    {
      title: "Portfolio summary",
      description: "High-level overview of Rahil Sheth's portfolio content.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "portfolio://summary",
          mimeType: "text/plain",
          text: portfolioSummaryResource(),
        },
      ],
    }),
  );
}

// Re-export zod for tests / extensions
export { z };
