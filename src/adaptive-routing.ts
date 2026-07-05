import { readNumber } from "./router-logic";
import type { Env } from "./types";

export type RoutableCandidate = {
  provider_id: string;
  provider_name: string;
  base_url: string;
  provider_key_id: string;
  api_key_ciphertext: string;
  upstream_model: string;
  position: number;
};

export type ProviderModelHealth = {
  providerId: string;
  upstreamModel: string;
  requests: number;
  errors: number;
};

export function isAdaptiveRoutingEnabled(env: Env): boolean {
  return env.ADAPTIVE_ROUTING_ENABLED === "true";
}

export function adaptiveRoutingWindowHours(env: Env): number {
  return readNumber(env.ADAPTIVE_ROUTING_WINDOW_HOURS, 24);
}

export function sortCandidatesByHealth<T extends RoutableCandidate>(
  candidates: T[],
  healthRows: ProviderModelHealth[]
): T[] {
  const scoreByTarget = new Map<string, number>();
  for (const row of healthRows) {
    const key = healthKey(row.providerId, row.upstreamModel);
    const successRate = row.requests > 0 ? (row.requests - row.errors) / row.requests : 1;
    scoreByTarget.set(key, successRate);
  }

  return [...candidates].sort((left, right) => {
    const leftScore = scoreByTarget.get(healthKey(left.provider_id, left.upstream_model)) ?? 1;
    const rightScore = scoreByTarget.get(healthKey(right.provider_id, right.upstream_model)) ?? 1;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return 0;
  });
}

export async function loadProviderModelHealth(env: Env, windowHours: number): Promise<ProviderModelHealth[]> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    `SELECT
      provider_id AS providerId,
      upstream_model AS upstreamModel,
      COUNT(*) AS requests,
      SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors
    FROM usage_log
    WHERE created_at >= ?
      AND provider_id IS NOT NULL
      AND upstream_model IS NOT NULL
    GROUP BY provider_id, upstream_model`
  )
    .bind(cutoff)
    .all<ProviderModelHealth>();

  return result.results ?? [];
}

function healthKey(providerId: string, upstreamModel: string): string {
  return `${providerId}:${upstreamModel}`;
}
