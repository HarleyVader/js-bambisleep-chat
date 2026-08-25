"use strict";

/**
 * Standalone BambiSleep Chat MCP server - for pointing at a remote/separately
 * hosted BambiSleep Chat instance, or as a separate MCP endpoint for AI
 * agents (Claude Desktop, VS Code, etc.).
 *
 * When running the BambiSleep Chat app locally, the same agent router and
 * web UI are already mounted in-process by the main server.js (see /mcp,
 * /tools, /agent/chat, /agent-ui) - no separate port needed. Use this
 * standalone server only when you want the MCP agent reachable independently
 * of the main app's port/process.
 */

const path = require("path");
const express = require("express");
const { createAgentRouter } = require("./agent-router");

const PORT = parseInt(process.env.MCP_PORT, 10) || 7000;
const API_BASE_URL = process.env.BAMBI_API_BASE_URL || "http://localhost:6969";
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://204.12.253.35:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.6-35b-a3b";

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", apiBaseUrl: API_BASE_URL });
});

app.use(
  createAgentRouter({
    apiBaseUrl: API_BASE_URL,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ollamaModel: OLLAMA_MODEL,
  }),
);

app.listen(PORT, () => {
  console.log(
    `🔌 BambiSleep Chat MCP server listening on http://localhost:${PORT}/mcp`,
  );
  console.log(`   Proxying BambiSleep Chat API at ${API_BASE_URL}`);
  console.log(`   Agent chat: POST http://localhost:${PORT}/agent/chat (Ollama @ ${OLLAMA_BASE_URL})`);
  console.log(`   Web UI: http://localhost:${PORT}/`);
});

