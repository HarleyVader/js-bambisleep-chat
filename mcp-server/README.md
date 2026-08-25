# BambiSleep Chat MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes read-only BambiSleep Chat
data to AI agents (Claude Desktop, VS Code Copilot Chat, etc.) as tools, plus a small
web UI for manually invoking those tools and chatting with an Ollama-backed agent that
calls them for you.

**This now runs in-process with the main app by default** - start the BambiSleep Chat
server as usual (`npm start` from the repo root) and open `http://localhost:6969/agent-ui/`.
No separate port or process is required. The standalone server in this folder
(`mcp-server/server.js`) is only needed if you want the agent reachable independently
of the main app's port/process (e.g. pointed at a remote BambiSleep Chat instance).

| Tool                      | Wraps REST endpoint                                  |
| ------------------------- | ----------------------------------------------------- |
| `list_triggers`           | `GET /api/triggers/json` or `/api/triggers/category/:c` |
| `get_trigger_details`     | `GET /api/triggers/details/:name`                     |
| `get_chat_history`        | `GET /api/history`, `/api/aigf/history`, `/api/chat/all` |
| `get_chat_stats`          | `GET /api/chat/stats`                                 |
| `list_tts_voices`         | `GET /api/tts/voices`                                 |
| `get_patreon_tier_stats`  | `GET /api/patreon/stats`                               |
| `get_service_status`      | `GET /api/services/status`                             |

It's a thin proxy: it has no direct access to chat history or trigger state - it only
forwards to the BambiSleep Chat REST API (in-process when mounted by `server.js`, or
over HTTP to `BAMBI_API_BASE_URL` when run standalone). No write/mutation endpoints
(clearing history, posting messages, etc.) are exposed, by design.

## Default: in-process with the main app

```bash
npm start
```

Then open `http://localhost:6969/agent-ui/` for the web UI. The tool/agent-chat
endpoints (`/mcp`, `/tools`, `/agent/chat`) are mounted on the same port. Tools call
the running app's own REST API directly, and agent chat uses the app's configured
Ollama endpoint/model (`ENV.OLLAMA`).

## Standalone mode (optional)

Only needed to run the agent server independently of the main app's port/process
(e.g. against a remote BambiSleep Chat deployment):

```bash
cd mcp-server
npm install
npm start
```

Or, from the repo root, once `mcp-server`'s own dependencies are installed:

```bash
npm run start:mcp-standalone
```

Environment variables (optional):

- `MCP_PORT` - port this server listens on (default: same as `PORT`, or `6969`)
- `BAMBI_API_BASE_URL` - base URL of the running BambiSleep Chat server (default `http://localhost:6969`)
- `OLLAMA_BASE_URL` - Ollama endpoint used by the agent chat (default `http://204.12.253.35:11434`, matching the main app's production Ollama host)
- `OLLAMA_MODEL` - model used by the agent chat (default `qwen3.6-35b-a3b`)

The server uses the Streamable HTTP transport (stateless mode - one request, one
session) and listens for MCP requests at `POST http://localhost:6969/mcp` by default
(same port as the main app, since standalone mode is only for a separate/remote
instance - override with `MCP_PORT` if you need to run it alongside a local main app).

## Web UI (agent interface)

Open `http://localhost:6969/agent-ui/` (in-process, main app port) or the
standalone server's root URL (default `http://localhost:6969/`, or wherever
`MCP_PORT` points it) in a browser for:

- **Tools panel** - auto-generated forms (from each tool's JSON schema) to manually
  invoke any tool and see its raw JSON result. Calls `GET /tools` and
  `POST /tools/:name/call` (plain REST, not MCP/JSON-RPC framed - simpler for a browser).
- **Agent Chat panel** - a chat box backed by `POST /agent/chat`. Each message is sent
  to Ollama along with the tool definitions (as OpenAI-style function-calling tools);
  if the model requests a tool call, the server executes it and feeds the result back
  to the model until it produces a final answer (capped at 5 tool-calling turns). The
  UI shows which tools were used for each reply.

## Connecting an MCP client

Example VS Code `mcp.json` entry (in-process, no separate port):

```json
{
  "servers": {
    "bambisleep-chat": {
      "type": "http",
      "url": "http://localhost:6969/mcp"
    }
  }
}
```

## Notes

- Requires Node.js 18+ (uses the global `fetch` API).
- Tool definitions and route handlers live in `agent-router.js`, shared by both the
  in-process mount (`server.js` at the repo root) and this folder's standalone
  `server.js` - avoid duplicating tool schemas, extend `agent-router.js` instead.
- This is a separate Node project (own `package.json`/`node_modules`) from the
  root BambiSleep Chat app, since it's an optional add-on tool, not part of the
  chat server's runtime.
- The agent chat endpoint sends conversation history back and forth with no
  server-side session storage - the browser tab holds the running history in memory
  and resends it with each message.
