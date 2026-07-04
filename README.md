# LLM Router

OpenAI-compatible LLM router for Cloudflare Workers. It lets your apps call one endpoint with a generated router key while the Worker tries your configured provider sequence, rotates provider keys, cools down failing or rate-limited keys, and logs usage.

## Features

- OpenAI-compatible `POST /v1/chat/completions`
- Streaming response pass-through
- Provider fallback by virtual model route, for example `default`, `fast`, or `smart`
- Multiple API keys per provider with basic rotation
- KV cooldowns for rate-limited or failing provider keys
- D1-backed admin UI for providers, keys, routes, client keys, and usage
- Provider API keys encrypted in D1 using `ENCRYPTION_KEY`
- Client app keys stored only as SHA-256 hashes

## Local Setup

Install dependencies:

```powershell
npm install
```

Create local secrets in `.dev.vars`:

```dotenv
ADMIN_TOKEN=sk-admin-change-me
ENCRYPTION_KEY=use-a-long-random-string-here
```

Apply local D1 migrations:

```powershell
npm run db:migrate:local
```

Build the UI and typecheck:

```powershell
npm run build
```

Run locally:

```powershell
npm run build
npx wrangler dev
```

Open the local Worker URL and enter `ADMIN_TOKEN` in the admin UI.

## Cloudflare Setup

Create a D1 database:

```powershell
npx wrangler d1 create llm-router
```

Create a KV namespace:

```powershell
npx wrangler kv namespace create COOLDOWNS
```

Update `wrangler.jsonc`:

- Replace `replace-with-d1-database-id` with the D1 `database_id`
- Replace `replace-with-kv-namespace-id` with the KV namespace `id`

Set Worker secrets:

```powershell
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put ENCRYPTION_KEY
```

Use a strong random value for `ENCRYPTION_KEY`. If you change it after storing provider keys, existing encrypted provider keys cannot be decrypted.

Apply remote migrations:

```powershell
npm run db:migrate
```

Deploy:

```powershell
npm run deploy
```

## Configure Providers

The migration seeds these OpenAI-compatible provider base URLs:

- OpenAI: `https://api.openai.com/v1`
- Groq: `https://api.groq.com/openai/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- GitHub Models: `https://models.github.ai/inference`
- Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`
- Anthropic: `https://api.anthropic.com/v1` (native API is not OpenAI-compatible; use OpenRouter or another gateway for `/chat/completions`)

In the admin UI:

1. Add one or more API keys for each provider you want to use.
2. Create or edit a route, such as `default`.
3. Add fallback steps in the order you prefer, each with a provider and upstream model name.
4. Generate a client key for each application.

Provider keys are write-only in the UI. Generated client keys are shown once.

## Calling From Apps

Use any OpenAI-compatible client by changing the base URL and API key.

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://llm-router.your-subdomain.workers.dev/v1",
  apiKey: "sk-router-generated-client-key"
});

const response = await client.chat.completions.create({
  model: "default",
  messages: [{ role: "user", content: "Say hello" }]
});

console.log(response.choices[0]?.message?.content);
```

Streaming works the same way:

```ts
const stream = await client.chat.completions.create({
  model: "default",
  stream: true,
  messages: [{ role: "user", content: "Write one paragraph about Cloudflare Workers" }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

## Routing Behavior

When a request arrives:

1. The Worker verifies the generated `sk-router-...` client key.
2. The requested `model` is treated as a route name. Unknown routes fall back to `default`.
3. Route entries are tried in order.
4. For each provider, enabled keys are tried by oldest `last_used_at` first.
5. `401`, `402`, `403`, `408`, `409`, `429`, `5xx`, network errors, and timeouts trigger cooldown and fallback.
6. If all candidates fail, the Worker returns `502` with the attempted providers.

Default cooldowns are configured in `wrangler.jsonc`:

- `DEFAULT_COOLDOWN_429_SECONDS`: `300`
- `DEFAULT_COOLDOWN_5XX_SECONDS`: `60`
- `UPSTREAM_TIMEOUT_MS`: `60000`

## Verification

Build and deploy checks:

```powershell
npm run build
npm run db:migrate:local
npx wrangler deploy --dry-run
```

Smoke test against a running local or deployed router:

```powershell
npm run build
npx wrangler dev
```

In another terminal, after configuring a provider key, the `default` route, and a client key in the admin UI:

```powershell
$env:ROUTER_BASE_URL = "http://localhost:8787"
$env:ROUTER_API_KEY = "sk-router-your-generated-client-key"
npm run test:router
```

The script always checks `/health` and client-key auth. With `ROUTER_API_KEY` set, it also sends a real chat completion through the router. Add `$env:STREAM = "1"` to test streaming, or pass `--create-client-key` with `ADMIN_TOKEN` to create a temporary client key for the run.

Real-provider verification requires adding at least one provider API key in the admin UI and configuring at least one route entry.
