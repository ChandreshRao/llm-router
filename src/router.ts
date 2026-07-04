import { decryptSecret } from "./crypto";
import { logUsage, parseJsonUsage, parseStreamingUsage } from "./usage";
import type { Env, OpenAIChatBody, UsagePayload } from "./types";

type CandidateRow = {
  provider_id: string;
  provider_name: string;
  base_url: string;
  provider_key_id: string;
  api_key_ciphertext: string;
  upstream_model: string;
  position: number;
};

type AttemptFailure = {
  provider: string;
  model: string;
  status?: number;
  reason: string;
};

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

export async function handleChatCompletions(
  request: Request,
  env: Env,
  ctx: WaitUntilContext,
  clientKeyId: string | null
): Promise<Response> {
  const started = Date.now();
  const incomingBody = (await request.json()) as OpenAIChatBody;
  const requestedModel = typeof incomingBody.model === "string" ? incomingBody.model : "default";
  const routeName = await resolveRouteName(env, requestedModel);
  const candidates = await loadCandidates(env, routeName);
  const failures: AttemptFailure[] = [];

  if (candidates.length === 0) {
    await logUsage(env, {
      clientKeyId,
      routeName,
      providerId: null,
      providerKeyId: null,
      upstreamModel: null,
      status: 502,
      latencyMs: Date.now() - started,
      error: "No enabled route entries with enabled provider keys"
    });
    return jsonError(502, "No enabled route entries with enabled provider keys", failures);
  }

  for (const candidate of candidates) {
    if (await isCoolingDown(env, candidate.provider_key_id)) {
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        reason: "provider key is cooling down"
      });
      continue;
    }

    const apiKey = await decryptSecret(candidate.api_key_ciphertext, env.ENCRYPTION_KEY);
    const body = prepareBody(incomingBody, candidate.upstream_model);
    const upstreamStarted = Date.now();
    let upstreamResponse: Response;

    try {
      upstreamResponse = await fetchWithTimeout(
        `${candidate.base_url.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: buildUpstreamHeaders(request, apiKey),
          body: JSON.stringify(body)
        },
        readNumber(env.UPSTREAM_TIMEOUT_MS, 60_000)
      );
    } catch (error) {
      await setCooldown(env, candidate.provider_key_id, "network");
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        reason: error instanceof Error ? error.message : "network error"
      });
      continue;
    }

    if (shouldFallback(upstreamResponse.status)) {
      const errorText = await safeResponseText(upstreamResponse);
      await setCooldown(env, candidate.provider_key_id, `${upstreamResponse.status}`);
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        status: upstreamResponse.status,
        reason: errorText || upstreamResponse.statusText
      });
      continue;
    }

    const latencyMs = Date.now() - upstreamStarted;
    const baseUsage: UsagePayload = {
      clientKeyId,
      routeName,
      providerId: candidate.provider_id,
      providerKeyId: candidate.provider_key_id,
      upstreamModel: candidate.upstream_model,
      status: upstreamResponse.status,
      latencyMs,
      error: upstreamResponse.ok ? null : upstreamResponse.statusText
    };

    await env.DB.prepare(
      "UPDATE provider_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    )
      .bind(candidate.provider_key_id)
      .run();

    if (body.stream && upstreamResponse.body) {
      const [clientStream, loggingStream] = upstreamResponse.body.tee();
      const response = new Response(clientStream, copyResponseInit(upstreamResponse));
      queueUsage(env, ctx, {
        baseUsage: { ...baseUsage, latencyMs: Date.now() - started },
        stream: loggingStream
      });
      return response;
    }

    const responseForClient = upstreamResponse.clone();
    queueUsage(env, ctx, {
      baseUsage: { ...baseUsage, latencyMs: Date.now() - started },
      response: upstreamResponse
    });
    return responseForClient;
  }

  await logUsage(env, {
    clientKeyId,
    routeName,
    providerId: null,
    providerKeyId: null,
    upstreamModel: null,
    status: 502,
    latencyMs: Date.now() - started,
    error: failures.map((failure) => `${failure.provider}: ${failure.reason}`).join("; ")
  });

  return jsonError(502, "All configured providers failed or are cooling down", failures);
}

async function resolveRouteName(env: Env, requestedModel: string): Promise<string> {
  const directRoute = await env.DB.prepare("SELECT name FROM routes WHERE name = ?").bind(requestedModel).first<{ name: string }>();
  if (directRoute) {
    return directRoute.name;
  }

  const defaultRoute = await env.DB.prepare("SELECT name FROM routes WHERE name = 'default'").first<{ name: string }>();
  return defaultRoute?.name ?? requestedModel;
}

async function loadCandidates(env: Env, routeName: string): Promise<CandidateRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      p.id AS provider_id,
      p.name AS provider_name,
      p.base_url AS base_url,
      pk.id AS provider_key_id,
      pk.api_key_ciphertext AS api_key_ciphertext,
      re.upstream_model AS upstream_model,
      re.position AS position
    FROM routes r
    JOIN route_entries re ON re.route_id = r.id
    JOIN providers p ON p.id = re.provider_id
    JOIN provider_keys pk ON pk.provider_id = p.id
    WHERE r.name = ? AND p.enabled = 1 AND pk.enabled = 1
    ORDER BY re.position ASC, COALESCE(pk.last_used_at, '') ASC, pk.created_at ASC`
  )
    .bind(routeName)
    .all<CandidateRow>();

  return result.results ?? [];
}

function prepareBody(body: OpenAIChatBody, upstreamModel: string): OpenAIChatBody {
  const nextBody: OpenAIChatBody = {
    ...body,
    model: upstreamModel
  };

  if (nextBody.stream) {
    nextBody.stream_options = {
      ...(typeof body.stream_options === "object" ? body.stream_options : {}),
      include_usage: true
    };
  }

  return nextBody;
}

function buildUpstreamHeaders(request: Request, apiKey: string): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`
  });

  const referer = request.headers.get("HTTP-Referer") ?? request.headers.get("Referer");
  if (referer) {
    headers.set("HTTP-Referer", referer);
  }

  const title = request.headers.get("X-Title");
  if (title) {
    headers.set("X-Title", title);
  }

  return headers;
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function isCoolingDown(env: Env, providerKeyId: string): Promise<boolean> {
  return (await env.COOLDOWNS.get(cooldownKey(providerKeyId))) !== null;
}

async function setCooldown(env: Env, providerKeyId: string, reason: string): Promise<void> {
  const ttl = reason === "429" || reason === "402" ? readNumber(env.DEFAULT_COOLDOWN_429_SECONDS, 300) : readNumber(env.DEFAULT_COOLDOWN_5XX_SECONDS, 60);
  await env.COOLDOWNS.put(cooldownKey(providerKeyId), reason, { expirationTtl: ttl });
}

function cooldownKey(providerKeyId: string): string {
  return `cooldown:${providerKeyId}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream timeout"), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function copyResponseInit(response: Response): ResponseInit {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return {
    status: response.status,
    statusText: response.statusText,
    headers
  };
}

function queueUsage(
  env: Env,
  ctx: WaitUntilContext,
  options: { baseUsage: UsagePayload; response?: Response; stream?: ReadableStream<Uint8Array> }
): void {
  const promise = (async () => {
    const parsed = options.stream ? await parseStreamingUsage(options.stream) : options.response ? await parseJsonUsage(options.response) : {};
    await logUsage(env, {
      ...options.baseUsage,
      ...parsed
    });
  })();

  ctx.waitUntil(promise);
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return "";
  }
}

function jsonError(status: number, error: string, attempts: AttemptFailure[]): Response {
  return Response.json({ error, attempts }, { status });
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
