import type { ClientKeyRow, Env } from "./types";

export type QuotaCheckResult = { ok: true } | { ok: false; status: 429; error: string };

// RPM counters live in KV via read-modify-write; concurrent requests on the same key can
// lose increments and admit slightly more traffic than the configured limit. Daily token
// limits are checked here but debited after the response completes, so in-flight bursts
// can exceed the cap. Strict enforcement would need a single-writer store (e.g. Durable Object).
export async function consumeClientQuotas(
  env: Env,
  key: Pick<ClientKeyRow, "id" | "rpm_limit" | "daily_token_limit">
): Promise<QuotaCheckResult> {
  if (key.daily_token_limit != null && key.daily_token_limit > 0) {
    const tokens = await readDailyTokens(env, key.id);
    if (tokens >= key.daily_token_limit) {
      return {
        ok: false,
        status: 429,
        error: `Client key daily token limit exceeded (${key.daily_token_limit})`
      };
    }
  }

  if (key.rpm_limit != null && key.rpm_limit > 0) {
    const bucket = currentMinuteBucket();
    const kvKey = rpmKey(key.id, bucket);
    const current = Number(await env.COOLDOWNS.get(kvKey)) || 0;
    if (current >= key.rpm_limit) {
      return { ok: false, status: 429, error: `Client key RPM limit exceeded (${key.rpm_limit})` };
    }

    await env.COOLDOWNS.put(kvKey, String(current + 1), { expirationTtl: 120 });
  }

  return { ok: true };
}

export async function addClientDailyTokens(env: Env, clientKeyId: string, tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return;
  }

  const day = currentUtcDay();
  const key = dailyTokenKey(clientKeyId, day);
  const current = Number(await env.COOLDOWNS.get(key)) || 0;
  await env.COOLDOWNS.put(key, String(current + tokens), { expirationTtl: 86_400 });
}

async function readDailyTokens(env: Env, clientKeyId: string): Promise<number> {
  const value = await env.COOLDOWNS.get(dailyTokenKey(clientKeyId, currentUtcDay()));
  return Number(value) || 0;
}

function rpmKey(clientKeyId: string, bucket: string): string {
  return `quota:rpm:${clientKeyId}:${bucket}`;
}

function dailyTokenKey(clientKeyId: string, day: string): string {
  return `quota:tokens:${clientKeyId}:${day}`;
}

function currentMinuteBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
}

function currentUtcDay(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
