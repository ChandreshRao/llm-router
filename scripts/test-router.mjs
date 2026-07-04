/**
 * Smoke test for a running LLM Router instance.
 *
 * Prerequisites:
 *   1. npm run build && npx wrangler dev   (or a deployed Worker URL)
 *   2. Admin UI: add a provider key, configure the "default" route, create a client key
 *
 * Usage (PowerShell):
 *   $env:ROUTER_BASE_URL = "http://localhost:8787"
 *   $env:ROUTER_API_KEY = "sk-router-..."   # from admin UI
 *   npm run test:router
 *
 * Optional:
 *   $env:STREAM = "1"                        # also test streaming
 *   $env:ADMIN_TOKEN = "..."                 # create a throwaway client key for the test
 */

const baseUrl = (process.env.ROUTER_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const apiKey = process.env.ROUTER_API_KEY;
const adminToken = process.env.ADMIN_TOKEN;
const testStream = process.env.STREAM === "1" || process.argv.includes("--stream");
const createClientKey = process.argv.includes("--create-client-key");

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name, detail) {
  passed += 1;
  console.log(`OK   ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name, detail) {
  skipped += 1;
  console.log(`SKIP ${name}${detail ? ` — ${detail}` : ""}`);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function testHealth() {
  const response = await fetch(`${baseUrl}/health`);
  const body = await readJson(response);

  if (!response.ok || body?.ok !== true) {
    throw new Error(`expected { ok: true }, got ${response.status} ${JSON.stringify(body)}`);
  }
}

async function testMissingAuth() {
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
}

async function testInvalidAuth() {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer sk-router-invalid-test-key",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: "ping" }]
    })
  });
  const body = await readJson(response);

  if (response.status !== 401) {
    throw new Error(`expected 401, got ${response.status} ${JSON.stringify(body)}`);
  }
}

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

async function run(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

console.log(`Testing router at ${baseUrl}`);

await run("GET /health", testHealth);
await run("POST /v1/chat/completions rejects missing auth", testMissingAuth);
await run("POST /v1/chat/completions rejects invalid auth", testInvalidAuth);

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

console.log("");
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

if (failed > 0) {
  process.exitCode = 1;
}
