# BambiSleep Chat MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes read-only BambiSleep Chat
data to AI agents (Claude Desktop, VS Code Copilot Chat, etc.) as tools, plus a small
web UI for manually invoking those tools and chatting with an Ollama-backed agent that
calls them for you.

| Tool                      | Wraps REST endpoint                                  |
| ------------------------- | ----------------------------------------------------- |
| `list_triggers`           | `GET /api/triggers/json` or `/api/triggers/category/:c` |
| `get_trigger_details`     | `GET /api/triggers/details/:name`                     |
| `get_chat_history`        | `GET /api/history`, `/api/aigf/history`, `/api/chat/all` |
| `get_chat_stats`          | `GET /api/chat/stats`                                 |
| `list_tts_voices`         | `GET /api/tts/voices`                                 |
| `get_patreon_tier_stats`  | `GET /api/patreon/stats`                               |
| `get_service_status`      | `GET /api/services/status`                             |

It's a thin proxy: the main BambiSleep Chat server (`server.js`) must already be
running, since this server has no direct access to chat history or trigger state -
it only forwards to the existing HTTP API. No write/mutation endpoints (clearing
history, posting messages, etc.) are exposed, by design.

## Setup

```bash
cd mcp-server
npm install
npm start
```

Environment variables (optional):

- `MCP_PORT` - port this MCP server listens on (default `7000`)
- `BAMBI_API_BASE_URL` - base URL of the running BambiSleep Chat server (default `http://localhost:6969`)
- `OLLAMA_BASE_URL` - Ollama endpoint used by the agent chat (default `http://204.12.253.35:11434`, matching the main app's production Ollama host)
- `OLLAMA_MODEL` - model used by the agent chat (default `qwen3.6-35b-a3b`)

The server uses the Streamable HTTP transport (stateless mode - one request, one
session) and listens for MCP requests at `POST http://localhost:7000/mcp`.

## Web UI (agent interface)

Open `http://localhost:7000/` in a browser for:

- **Tools panel** - auto-generated forms (from each tool's JSON schema) to manually
  invoke any tool and see its raw JSON result. Calls `GET /tools` and
  `POST /tools/:name/call` (plain REST, not MCP/JSON-RPC framed - simpler for a browser).
- **Agent Chat panel** - a chat box backed by `POST /agent/chat`. Each message is sent
  to Ollama along with the tool definitions (as OpenAI-style function-calling tools);
  if the model requests a tool call, the server executes it and feeds the result back
  to the model until it produces a final answer (capped at 5 tool-calling turns). The
  UI shows which tools were used for each reply.

## Connecting an MCP client

Example VS Code `mcp.json` entry:

```json
{
  "servers": {
    "bambisleep-chat": {
      "type": "http",
      "url": "http://localhost:7000/mcp"
    }
  }
}
```

## Notes

- Requires Node.js 18+ (uses the global `fetch` API).
- This is a separate Node project (own `package.json`/`node_modules`) from the
  root BambiSleep Chat app, since it's an optional add-on tool, not part of the
  chat server's runtime.
- The agent chat endpoint sends conversation history back and forth with no
  server-side session storage - the browser tab holds the running history in memory
  and resends it with each message.


Example VS Code `mcp.json` entry:

```json
{
  "servers": {
    "bambisleep-chat": {
      "type": "http",
      "url": "http://localhost:7000/mcp"
    }
  }
}
```

## Notes

- Requires Node.js 18+ (uses the global `fetch` API).
- This is a separate Node project (own `package.json`/`node_modules`) from the
  root BambiSleep Chat app, since it's an optional add-on tool, not part of the
  chat server's runtime.
