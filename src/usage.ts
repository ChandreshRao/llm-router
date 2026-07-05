import { addClientDailyTokens } from "./client-quotas";
import { makeId } from "./crypto";
import type { Env, UsagePayload } from "./types";

export async function logUsage(env: Env, usage: UsagePayload): Promise<void> {
  if (usage.clientKeyId && usage.totalTokens && usage.totalTokens > 0) {
    await addClientDailyTokens(env, usage.clientKeyId, usage.totalTokens);
  }

  await env.DB.prepare(
    `INSERT INTO usage_log (
      id, client_key_id, route_name, provider_id, provider_key_id, upstream_model,
      status, latency_ms, prompt_tokens, completion_tokens, total_tokens, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      makeId("usage"),
      usage.clientKeyId,
      usage.routeName,
      usage.providerId,
      usage.providerKeyId,
      usage.upstreamModel,
      usage.status,
      usage.latencyMs,
      usage.promptTokens ?? null,
      usage.completionTokens ?? null,
      usage.totalTokens ?? null,
      usage.error ?? null
    )
    .run();
}

export async function parseJsonUsage(response: Response): Promise<Partial<UsagePayload>> {
  try {
    const data = (await response.clone().json()) as { usage?: TokenUsage };
    return usageFromObject(data.usage);
  } catch {
    return {};
  }
}

export async function parseStreamingUsage(stream: ReadableStream<Uint8Array>): Promise<Partial<UsagePayload>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Partial<UsagePayload> = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const payload = line.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }

        try {
          const data = JSON.parse(payload) as { usage?: TokenUsage | null };
          if (data.usage) {
            usage = usageFromObject(data.usage);
          }
        } catch {
          // Some providers emit non-JSON keepalive payloads. They are safe to ignore.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return usage;
}

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function usageFromObject(usage?: TokenUsage | null): Partial<UsagePayload> {
  if (!usage) {
    return {};
  }

  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  };
}
