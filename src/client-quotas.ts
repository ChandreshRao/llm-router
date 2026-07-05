import type { ClientKeyRow, Env } from "./types";

export type QuotaCheckResult = { ok: true } | { ok: false; status: 429; error: string };

export async function checkClientQuotas(
  env: Env,
  key: Pick<ClientKeyRow, "id" | "rpm_limit" | "daily_token_limit">
): Promise<QuotaCheckResult> {
  if (key.rpm_limit != null && key.rpm_limit > 0) {
    const rpm = await readRpm(env, key.id);
    if (rpm >= key.rpm_limit) {
      return { ok: false, status: 429, error: `Client key RPM limit exceeded (${key.rpm_limit})` };
    }
  }

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

  return { ok: true };
}

export async function incrementClientRpm(env: Env, clientKeyId: string): Promise<void> {
  const bucket = currentMinuteBucket();
  const key = rpmKey(clientKeyId, bucket);
  const current = Number(await env.COOLDOWNS.get(key)) || 0;
  await env.COOLDOWNS.put(key, String(current + 1), { expirationTtl: 120 });
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

async function readRpm(env: Env, clientKeyId: string): Promise<number> {
  const value = await env.COOLDOWNS.get(rpmKey(clientKeyId, currentMinuteBucket()));
  return Number(value) || 0;
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
