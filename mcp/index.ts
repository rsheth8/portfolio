#!/usr/bin/env node
/**
 * Stdio MCP server — exposes portfolio data + live GitHub lookup to MCP clients
 * (Cursor, Claude Desktop, etc.). Run via `npm run mcp`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPortfolioMcp } from "../lib/mcp/register";

const server = new McpServer(
  { name: "portfolio", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } },
);

registerPortfolioMcp(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
