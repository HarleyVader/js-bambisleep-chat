"use strict";

/**
 * BambiSleep Chat MCP Server
 *
 * Exposes read-only BambiSleep Chat data (triggers, chat history, TTS voices,
 * Patreon tier stats, service health) as MCP tools over the Streamable HTTP
 * transport, so AI agents (Claude Desktop, VS Code, etc.) can query a running
 * BambiSleep Chat instance without needing direct DB/filesystem access.
 *
 * Also serves a small web UI (public/) for manually invoking tools and for
 * chatting with an Ollama-backed agent that decides which tools to call.
 *
 * This server never mutates chat/trigger/Patreon state - it only proxies GET
 * requests to the main app's existing REST API (server.js).
 */

const path = require("path");
const express = require("express");
const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const PORT = parseInt(process.env.MCP_PORT, 10) || 7000;
const API_BASE_URL = process.env.BAMBI_API_BASE_URL || "http://localhost:6969";
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://204.12.253.35:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.6-35b-a3b";
const AGENT_MAX_TURNS = 5;

/** Fetches a JSON endpoint from the BambiSleep Chat REST API. */
async function callBambiApi(path) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body && body.error) || response.statusText;
    throw new Error(
      `BambiSleep Chat API returned ${response.status} for ${path}: ${message}`,
    );
  }

  return body;
}

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err) {
  return {
    content: [{ type: "text", text: `Error: ${err.message}` }],
    isError: true,
  };
}

/**
 * Single source of truth for every tool: `zodShape` feeds the MCP SDK's
 * `registerTool`, `jsonSchema` feeds the REST `/tools` listing (for the web
 * UI's auto-generated forms) and the Ollama function-calling `tools` param,
 * and `handler` is the actual implementation shared by all three surfaces.
 */
const TOOLS = [
  {
    name: "list_triggers",
    title: "List BambiSleep triggers",
    description:
      "Lists official BambiSleep trigger words/phrases from workers/triggers.json, optionally filtered by category (e.g. Primary, Mental, Physical, Behavioral).",
    zodShape: {
      category: z
        .string()
        .optional()
        .describe("Filter to a specific trigger category"),
    },
    jsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter to a specific trigger category",
        },
      },
    },
    handler: ({ category } = {}) =>
      category
        ? callBambiApi(
            `/api/triggers/category/${encodeURIComponent(category)}`,
          )
        : callBambiApi("/api/triggers/json"),
  },
  {
    name: "get_trigger_details",
    title: "Get trigger details",
    description:
      "Gets full details (description, effect, category, safety level) for one named trigger.",
    zodShape: {
      name: z.string().describe("Exact trigger name, e.g. 'BAMBI SLEEP'"),
    },
    jsonSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Exact trigger name, e.g. 'BAMBI SLEEP'",
        },
      },
      required: ["name"],
    },
    handler: ({ name }) =>
      callBambiApi(`/api/triggers/details/${encodeURIComponent(name)}`),
  },
  {
    name: "get_chat_history",
    title: "Get chat history",
    description:
      "Reads recent chat messages from the running BambiSleep Chat server (AI chat, legacy chat, or both combined).",
    zodShape: {
      type: z
        .enum(["aigf", "legacy", "all"])
        .default("all")
        .describe("Which history to read"),
      limit: z
        .number()
        .int()
        .positive()
        .max(500)
        .default(20)
        .describe("Max number of messages to return"),
    },
    jsonSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["aigf", "legacy", "all"],
          default: "all",
          description: "Which history to read",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          default: 20,
          description: "Max number of messages to return",
        },
      },
    },
    handler: ({ type = "all", limit = 20 } = {}) => {
      const path =
        type === "aigf"
          ? `/api/aigf/history?limit=${limit}`
          : type === "legacy"
            ? `/api/history?limit=${limit}`
            : `/api/chat/all?limit=${limit}`;
      return callBambiApi(path);
    },
  },
  {
    name: "get_chat_stats",
    title: "Get chat statistics",
    description:
      "Gets message counts and per-type limits for the chat history store.",
    zodShape: {},
    jsonSchema: { type: "object", properties: {} },
    handler: () => callBambiApi("/api/chat/stats"),
  },
  {
    name: "list_tts_voices",
    title: "List TTS voices",
    description: "Lists available Kokoro TTS voices and voice-mix combinations.",
    zodShape: {},
    jsonSchema: { type: "object", properties: {} },
    handler: () => callBambiApi("/api/tts/voices"),
  },
  {
    name: "get_patreon_tier_stats",
    title: "Get Patreon tier statistics",
    description:
      "Gets aggregate Patreon patron/tier statistics. Contains no individual patron identities.",
    zodShape: {},
    jsonSchema: { type: "object", properties: {} },
    handler: () => callBambiApi("/api/patreon/stats"),
  },
  {
    name: "get_service_status",
    title: "Get service status",
    description:
      "Gets availability/health of the backend AI (Ollama/LM Studio) and TTS (Kokoro) services.",
    zodShape: {},
    jsonSchema: { type: "object", properties: {} },
    handler: () => callBambiApi("/api/services/status"),
  },
];

/**
 * Builds a fresh McpServer with all tools registered. Called once per HTTP
 * request (stateless mode) per the MCP SDK's recommended Streamable HTTP
 * pattern for simple, session-less deployments.
 */
function buildServer() {
  const server = new McpServer({
    name: "bambisleep-chat-mcp",
    version: "0.1.0",
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.zodShape,
      },
      async (args) => {
        try {
          return textResult(await tool.handler(args));
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  return server;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no sessions, so GET (server-to-client stream) and
// DELETE (session termination) are not applicable.
app.get("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed - stateless MCP server" });
});
app.delete("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed - stateless MCP server" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", apiBaseUrl: API_BASE_URL });
});

// Plain REST convenience endpoints (no MCP/JSON-RPC framing) so the web UI
// can list/invoke tools with simple fetch() calls.
app.get("/tools", (req, res) => {
  res.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.jsonSchema,
    })),
  });
});

app.post("/tools/:name/call", async (req, res) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return res.status(404).json({ error: `Unknown tool: ${req.params.name}` });
  }
  try {
    const result = await tool.handler(req.body || {});
    res.json({ result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

function toolsAsOllamaFunctions() {
  return TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.jsonSchema },
  }));
}

/** Calls Ollama's native chat API with the BambiSleep tool set attached. */
async function callOllamaChat(messages) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      tools: toolsAsOllamaFunctions(),
      stream: false,
      think: false, // disable Qwen3 extended thinking - avoids multi-minute latency (see workers/ollama.js)
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}): ${text}`);
  }

  return response.json();
}

// Agent chat endpoint: lets the Ollama model decide which BambiSleep tools to
// call (if any) before answering. `history` is prior {role, content} turns
// from the same conversation, supplied by the client for continuity.
app.post("/agent/chat", async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) is required" });
  }

  const messages = [
    {
      role: "system",
      content:
        "You are an assistant for the BambiSleep Chat app. Use the available tools when they can answer the user's question (triggers, chat history, TTS voices, Patreon tier stats, service status). Don't call tools that aren't relevant.",
    },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message },
  ];

  const toolCalls = [];

  try {
    for (let turn = 0; turn < AGENT_MAX_TURNS; turn++) {
      const data = await callOllamaChat(messages);
      const assistantMessage = data.message || {};
      messages.push(assistantMessage);

      const calls = assistantMessage.tool_calls;
      if (!calls || calls.length === 0) {
        return res.json({ reply: assistantMessage.content || "", toolCalls });
      }

      for (const call of calls) {
        const fnName = call.function && call.function.name;
        let args = call.function && call.function.arguments;
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }

        const tool = TOOLS.find((t) => t.name === fnName);
        let result;
        try {
          result = tool
            ? await tool.handler(args || {})
            : { error: `Unknown tool: ${fnName}` };
        } catch (err) {
          result = { error: err.message };
        }

        toolCalls.push({ name: fnName, arguments: args || {}, result });
        messages.push({
          role: "tool",
          name: fnName,
          content: JSON.stringify(result),
        });
      }
    }

    res.status(504).json({
      error: "Agent exceeded max tool-call turns without a final answer",
      toolCalls,
    });
  } catch (err) {
    res.status(502).json({ error: err.message, toolCalls });
  }
});

app.listen(PORT, () => {
  console.log(
    `🔌 BambiSleep Chat MCP server listening on http://localhost:${PORT}/mcp`,
  );
  console.log(`   Proxying BambiSleep Chat API at ${API_BASE_URL}`);
  console.log(`   Agent chat: POST http://localhost:${PORT}/agent/chat (Ollama @ ${OLLAMA_BASE_URL})`);
  console.log(`   Web UI: http://localhost:${PORT}/`);
});
