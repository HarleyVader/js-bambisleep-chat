"use strict";

const toolsListEl = document.getElementById("tools-list");
const chatLogEl = document.getElementById("chat-log");
const chatFormEl = document.getElementById("chat-form");
const chatInputEl = document.getElementById("chat-input");

/** conversation history sent back to /agent/chat for continuity */
const history = [];

function appendMessage(role, content, toolCalls) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role;
  wrapper.appendChild(roleEl);

  const contentEl = document.createElement("div");
  contentEl.className = "content";
  contentEl.textContent = content; // textContent only - never render as HTML
  wrapper.appendChild(contentEl);

  if (toolCalls && toolCalls.length > 0) {
    const traceEl = document.createElement("div");
    traceEl.className = "tool-trace";
    traceEl.textContent = `Used tools: ${toolCalls.map((c) => c.name).join(", ")}`;
    wrapper.appendChild(traceEl);
  }

  chatLogEl.appendChild(wrapper);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

async function sendChatMessage(message) {
  appendMessage("user", message);
  history.push({ role: "user", content: message });

  const sendBtn = chatFormEl.querySelector("button");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: history.slice(0, -1) }),
    });
    const data = await res.json();

    if (!res.ok) {
      appendMessage("assistant", `Error: ${data.error || res.statusText}`);
      return;
    }

    appendMessage("assistant", data.reply || "(no reply)", data.toolCalls);
    history.push({ role: "assistant", content: data.reply || "" });
  } catch (err) {
    appendMessage("assistant", `Error: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

chatFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInputEl.value.trim();
  if (!message) return;
  chatInputEl.value = "";
  sendChatMessage(message);
});

chatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatFormEl.requestSubmit();
  }
});

function buildFieldInput(propName, propSchema) {
  const label = document.createElement("label");
  label.textContent = `${propName}${propSchema.description ? ` — ${propSchema.description}` : ""}`;

  let input;
  if (Array.isArray(propSchema.enum)) {
    input = document.createElement("select");
    for (const value of propSchema.enum) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      input.appendChild(option);
    }
  } else {
    input = document.createElement("input");
    input.type = propSchema.type === "integer" ? "number" : "text";
  }

  input.name = propName;
  if (propSchema.default !== undefined) {
    input.value = propSchema.default;
  }

  label.appendChild(input);
  return label;
}

function coerceValue(value, propSchema) {
  if (value === "" || value === undefined) return undefined;
  if (propSchema.type === "integer") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return value;
}

async function callTool(tool, form, resultEl) {
  const args = {};
  const properties = tool.inputSchema.properties || {};
  for (const [propName, propSchema] of Object.entries(properties)) {
    const field = form.elements.namedItem(propName);
    if (!field) continue;
    const coerced = coerceValue(field.value, propSchema);
    if (coerced !== undefined) args[propName] = coerced;
  }

  resultEl.textContent = "Running...";
  try {
    const res = await fetch(`/tools/${encodeURIComponent(tool.name)}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    resultEl.textContent = JSON.stringify(res.ok ? data.result : data, null, 2);
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
}

function renderTool(tool) {
  const card = document.createElement("div");
  card.className = "tool-card";

  const title = document.createElement("h3");
  title.textContent = tool.title || tool.name;
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.textContent = tool.description || "";
  card.appendChild(desc);

  const form = document.createElement("form");
  const properties = tool.inputSchema.properties || {};
  for (const [propName, propSchema] of Object.entries(properties)) {
    form.appendChild(buildFieldInput(propName, propSchema));
  }

  const runBtn = document.createElement("button");
  runBtn.type = "submit";
  runBtn.textContent = "Run";
  form.appendChild(runBtn);

  const resultEl = document.createElement("pre");
  resultEl.className = "tool-result";
  resultEl.textContent = "";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    callTool(tool, form, resultEl);
  });

  card.appendChild(form);
  card.appendChild(resultEl);
  return card;
}

async function loadTools() {
  try {
    const res = await fetch("/tools");
    const data = await res.json();
    toolsListEl.innerHTML = "";
    for (const tool of data.tools) {
      toolsListEl.appendChild(renderTool(tool));
    }
  } catch (err) {
    toolsListEl.textContent = `Failed to load tools: ${err.message}`;
  }
}

loadTools();
