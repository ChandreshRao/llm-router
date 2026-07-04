/**
 * Smoke test for a running LLM Router instance.
 *
 * Usage:
 *   $env:ROUTER_BASE_URL = "http://localhost:8787"
 *   npm run test:smoke:router
 */

import { pathToFileURL } from "node:url";
import { createSmokeRunner, readJson } from "./helpers.mjs";

const baseUrl = (process.env.ROUTER_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const apiKey = process.env.ROUTER_API_KEY;
const adminToken = process.env.ADMIN_TOKEN;
const testStream = process.env.STREAM === "1" || process.argv.includes("--stream");
const createClientKey = process.argv.includes("--create-client-key");

async function createClientKeyViaAdmin() {
  if (!adminToken) {
    throw new Error("ADMIN_TOKEN is required with --create-client-key");
  }

  const response = await fetch(`${baseUrl}/admin/client-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ name: `router-smoke-test-${Date.now()}` })
  });
  const body = await readJson(response);

  if (!response.ok || !body?.secret) {
    throw new Error(`admin client key creation failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body.secret;
}

async function testChatCompletion(key) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: "Reply with exactly: router ok" }]
    })
  });
  const body = await readJson(response);

  if (response.status === 401) {
    throw new Error("invalid client key");
  }

  if (response.status === 502) {
    if (!Array.isArray(body?.attempts)) {
      throw new Error(`expected attempts array on 502, got ${JSON.stringify(body)}`);
    }

    const hint =
      body?.error === "No enabled route entries with enabled provider keys"
        ? "add a provider key and configure the default route in the admin UI"
        : "all providers failed — check provider keys, route entries, and upstream model names";
    throw new Error(`${body?.error ?? "routing failed"} (${hint})`);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`missing assistant content: ${JSON.stringify(body)}`);
  }

  return content.trim();
}

async function testStreamingCompletion(key) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "default",
      stream: true,
      messages: [{ role: "user", content: "Say hello in one short sentence." }]
    })
  });

  if (!response.ok) {
    const body = await readJson(response);
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }

  if (!response.body) {
    throw new Error("missing response body for stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sawData = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (chunk.includes("data:")) {
      sawData = true;
    }
  }

  if (!sawData) {
    throw new Error("stream did not contain SSE data lines");
  }
}

export async function runRouterSmoke() {
  const { run, skip, finish } = createSmokeRunner("Router smoke");

  console.log(`Testing router at ${baseUrl}`);

  await run("GET /health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await readJson(response);

    if (!response.ok || body?.ok !== true) {
      throw new Error(`expected { ok: true }, got ${response.status} ${JSON.stringify(body)}`);
    }
  });

  await run("POST /v1/chat/completions rejects missing auth", async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "default",
        messages: [{ role: "user", content: "ping" }]
      })
    });
    const body = await readJson(response);

    if (response.status !== 401) {
      throw new Error(`expected 401, got ${response.status} ${JSON.stringify(body)}`);
    }
  });

  await run("POST /v1/chat/completions rejects invalid JSON", async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: "Bearer sk-router-invalid-test-key",
        "content-type": "application/json"
      },
      body: "{not-json"
    });
    const body = await readJson(response);

    if (response.status !== 401 && response.status !== 400) {
      throw new Error(`expected 400 or 401, got ${response.status} ${JSON.stringify(body)}`);
    }

    if (response.status === 400 && body?.error !== "Invalid JSON body") {
      throw new Error(`expected Invalid JSON body, got ${JSON.stringify(body)}`);
    }
  });

  let effectiveApiKey = apiKey;

  if (createClientKey) {
    await run("POST /admin/client-keys creates test client key", async () => {
      effectiveApiKey = await createClientKeyViaAdmin();
      return "created temporary client key";
    });
  }

  if (effectiveApiKey) {
    await run("POST /v1/chat/completions routes a request", async () => {
      const content = await testChatCompletion(effectiveApiKey);
      const preview = content.length > 80 ? `${content.slice(0, 77)}...` : content;
      return preview;
    });

    if (testStream) {
      await run("POST /v1/chat/completions streams a response", async () => {
        await testStreamingCompletion(effectiveApiKey);
        return "received SSE chunks";
      });
    }
  } else {
    skip(
      "POST /v1/chat/completions routes a request",
      "set ROUTER_API_KEY or pass --create-client-key with ADMIN_TOKEN"
    );
    if (testStream) {
      skip("POST /v1/chat/completions streams a response", "requires ROUTER_API_KEY");
    }
  }

  finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRouterSmoke();
}
