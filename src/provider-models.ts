import { decryptSecret } from "./crypto";
import { formatModelInUseError, type RouteModelUsage } from "./model-route-usage";
import {
  isOpenRouterProvider,
  OPENROUTER_MODELS_URL,
  providerDefaults,
  resolveProviderCatalog
} from "./providers";
import type { Env } from "./types";

export type ProviderModelsResult = {
  models: string[];
  source: "upstream" | "cached" | "fallback";
  error: string | null;
};

export type ProviderModelsSyncResult = {
  providerId: string;
  modelCount: number;
  syncedAt: string;
  models: string[];
  addedCount?: number;
};

export type ProviderModelRenameResult = {
  newModelId: string;
  routesUpdated: number;
};

export type MergeUpstreamModelsResult = {
  addedCount: number;
  modelCount: number;
  models: string[];
};

export type CachedProviderModel = {
  modelId: string;
  source: "sync" | "manual";
};

export type CachedProviderModelsResponse = {
  models: CachedProviderModel[];
  excludedCount: number;
};

export async function fetchProviderModels(env: Env, providerId: string): Promise<ProviderModelsResult> {
  const provider = await env.DB.prepare("SELECT id, base_url FROM providers WHERE id = ?")
    .bind(providerId)
    .first<{ id: string; base_url: string }>();

  if (!provider) {
    return { models: [], source: "fallback", error: "Provider not found" };
  }

  const fallback = fallbackModels(providerId);
  const cachedModels = await getCachedProviderModels(env, providerId);
  if (cachedModels.length > 0) {
    return { models: cachedModels, source: "cached", error: null };
  }

  const keyRow = await env.DB.prepare(
    "SELECT api_key_ciphertext FROM provider_keys WHERE provider_id = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1"
  )
    .bind(providerId)
    .first<{ api_key_ciphertext: string }>();

  if (keyRow) {
    try {
      const apiKey = await decryptSecret(keyRow.api_key_ciphertext, env.ENCRYPTION_KEY);
      const nativeModels = await fetchNativeModels(provider.base_url, apiKey);
      if (nativeModels.length > 0) {
        return { models: nativeModels, source: "upstream", error: null };
      }
    } catch (error) {
      const nativeError = error instanceof Error ? error.message : "Failed to fetch models";
      return withFallback({ models: [], source: "fallback", error: nativeError }, fallback);
    }
  }

  return withFallback(
    { models: [], source: "fallback", error: null },
    fallback,
    "Add a provider API key or sync models from OpenRouter"
  );
}

export async function getCachedProviderModels(env: Env, providerId: string): Promise<string[]> {
  const rows = await getCachedProviderModelsWithMeta(env, providerId);
  return rows.map((row) => row.modelId);
}

export async function getCachedProviderModelsWithMeta(env: Env, providerId: string): Promise<CachedProviderModel[]> {
  const rows = await env.DB.prepare(
    "SELECT model_id, source FROM provider_models WHERE provider_id = ? ORDER BY model_id"
  )
    .bind(providerId)
    .all<{ model_id: string; source: string }>();

  return (rows.results ?? []).map((row) => ({
    modelId: row.model_id,
    source: row.source === "manual" ? "manual" : "sync"
  }));
}

export async function getCachedProviderModelsResponse(env: Env, providerId: string): Promise<CachedProviderModelsResponse> {
  const provider = await env.DB.prepare("SELECT id FROM providers WHERE id = ?").bind(providerId).first<{ id: string }>();
  if (!provider) {
    throw new Error("Provider not found");
  }

  const [models, excludedCount] = await Promise.all([
    getCachedProviderModelsWithMeta(env, providerId),
    getProviderModelExclusionCount(env, providerId)
  ]);

  return { models, excludedCount };
}

export async function addManualProviderModel(env: Env, providerId: string, modelId: string): Promise<void> {
  const provider = await env.DB.prepare("SELECT id FROM providers WHERE id = ?").bind(providerId).first<{ id: string }>();
  if (!provider) {
    throw new Error("Provider not found");
  }

  const existing = await env.DB.prepare("SELECT model_id FROM provider_models WHERE provider_id = ? AND model_id = ?")
    .bind(providerId, modelId)
    .first<{ model_id: string }>();
  if (existing) {
    throw new Error("Model already exists in catalog");
  }

  await env.DB.batch([
    env.DB.prepare("INSERT INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'manual')").bind(providerId, modelId),
    env.DB.prepare("DELETE FROM provider_model_exclusions WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId)
  ]);
}

export async function renameProviderModel(
  env: Env,
  providerId: string,
  oldModelId: string,
  newModelId: string
): Promise<ProviderModelRenameResult> {
  const row = await env.DB.prepare("SELECT source FROM provider_models WHERE provider_id = ? AND model_id = ?")
    .bind(providerId, oldModelId)
    .first<{ source: string }>();
  if (!row) {
    throw new Error("Model not found");
  }

  const duplicate = await env.DB.prepare("SELECT model_id FROM provider_models WHERE provider_id = ? AND model_id = ?")
    .bind(providerId, newModelId)
    .first<{ model_id: string }>();
  if (duplicate) {
    throw new Error("Target model ID already exists in catalog");
  }

  const entryCountRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM route_entries WHERE provider_id = ? AND upstream_model = ?"
  )
    .bind(providerId, oldModelId)
    .first<{ count: number }>();
  const entriesUpdated = entryCountRow?.count ?? 0;

  const statements = [
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, oldModelId),
    env.DB.prepare("INSERT INTO provider_models (provider_id, model_id, source) VALUES (?, ?, ?)").bind(
      providerId,
      newModelId,
      row.source
    ),
    env.DB.prepare("DELETE FROM provider_model_exclusions WHERE provider_id = ? AND model_id = ?").bind(providerId, newModelId),
    env.DB.prepare(
      "UPDATE route_entries SET upstream_model = ? WHERE provider_id = ? AND upstream_model = ?"
    ).bind(newModelId, providerId, oldModelId)
  ];

  if (row.source === "sync") {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO provider_model_exclusions (provider_id, model_id) VALUES (?, ?)").bind(
        providerId,
        oldModelId
      )
    );
  }

  await env.DB.batch(statements);

  return {
    newModelId,
    routesUpdated: entriesUpdated
  };
}

export async function deleteProviderModel(env: Env, providerId: string, modelId: string): Promise<void> {
  const row = await env.DB.prepare("SELECT source FROM provider_models WHERE provider_id = ? AND model_id = ?")
    .bind(providerId, modelId)
    .first<{ source: string }>();
  if (!row) {
    throw new Error("Model not found");
  }

  const routeUsage = await getRoutesUsingUpstreamModel(env, providerId, modelId);
  if (routeUsage.length > 0) {
    throw new Error(formatModelInUseError(modelId, routeUsage));
  }

  const statements = [
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId)
  ];

  if (row.source === "sync") {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO provider_model_exclusions (provider_id, model_id) VALUES (?, ?)").bind(
        providerId,
        modelId
      )
    );
  }

  await env.DB.batch(statements);
}

export async function syncProviderModelsFromOpenRouter(env: Env, providerId: string): Promise<ProviderModelsSyncResult> {
  const provider = await env.DB.prepare(
    "SELECT id, open_router_authors, open_router_providers, strip_open_router_prefix FROM providers WHERE id = ?"
  )
    .bind(providerId)
    .first<{
      id: string;
      open_router_authors: string | null;
      open_router_providers: string | null;
      strip_open_router_prefix: string | null;
    }>();

  if (!provider) {
    throw new Error("Provider not found");
  }

  const catalog = resolveProviderCatalog(providerId, provider);
  if (!catalog?.openRouterAuthors && !catalog?.openRouterProviders && !isOpenRouterProvider(providerId)) {
    throw new Error("Provider has no OpenRouter catalog mapping");
  }

  const rawIds = await fetchOpenRouterModelIds(catalog);
  const models = uniqueSorted(
    isOpenRouterProvider(providerId)
      ? rawIds
      : rawIds.map((id) => transformOpenRouterModelId(id, catalog?.stripOpenRouterPrefix))
  );

  if (models.length === 0) {
    throw new Error("OpenRouter catalog returned no models");
  }

  const exclusions = await getProviderModelExclusions(env, providerId);
  const existingModels = new Set(await getCachedProviderModels(env, providerId));
  const toInsert = models.filter((model) => !exclusions.has(model));
  const syncedAt = new Date().toISOString();
  let addedCount = 0;

  await env.DB.batch([
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND source = 'sync'").bind(providerId)
  ]);

  const insertStatements = toInsert.map((model) => {
    if (!existingModels.has(model)) {
      addedCount += 1;
    }
    return env.DB.prepare("INSERT OR IGNORE INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'sync')").bind(
      providerId,
      model
    );
  });
  await runStatementBatches(env, insertStatements);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE providers SET models_synced_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    ).bind(syncedAt, providerId)
  ]);

  const catalogModels = await getCachedProviderModels(env, providerId);

  return {
    providerId,
    modelCount: catalogModels.length,
    syncedAt,
    models: catalogModels,
    addedCount
  };
}

export async function mergeUpstreamModelsIntoCatalog(env: Env, providerId: string): Promise<MergeUpstreamModelsResult> {
  const provider = await env.DB.prepare("SELECT id, base_url FROM providers WHERE id = ?")
    .bind(providerId)
    .first<{ id: string; base_url: string }>();

  if (!provider) {
    throw new Error("Provider not found");
  }

  const keyRow = await env.DB.prepare(
    "SELECT api_key_ciphertext FROM provider_keys WHERE provider_id = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1"
  )
    .bind(providerId)
    .first<{ api_key_ciphertext: string }>();

  if (!keyRow) {
    throw new Error("Add a provider API key before refreshing models from upstream");
  }

  const apiKey = await decryptSecret(keyRow.api_key_ciphertext, env.ENCRYPTION_KEY);
  const upstreamModels = await fetchNativeModels(provider.base_url, apiKey);
  if (upstreamModels.length === 0) {
    throw new Error("Upstream returned no models");
  }

  const [existingModels, exclusions] = await Promise.all([
    new Set(await getCachedProviderModels(env, providerId)),
    getProviderModelExclusions(env, providerId)
  ]);

  const toAdd = upstreamModels.filter((model) => !existingModels.has(model) && !exclusions.has(model));
  const insertStatements = toAdd.map((model) =>
    env.DB.prepare("INSERT OR IGNORE INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'sync')").bind(
      providerId,
      model
    )
  );
  await runStatementBatches(env, insertStatements);

  const catalogModels = await getCachedProviderModels(env, providerId);
  return {
    addedCount: toAdd.length,
    modelCount: catalogModels.length,
    models: catalogModels
  };
}

export async function getRoutesUsingUpstreamModel(
  env: Env,
  providerId: string,
  upstreamModel: string
): Promise<RouteModelUsage[]> {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.id AS route_id, r.name AS route_name
     FROM route_entries re
     JOIN routes r ON r.id = re.route_id
     WHERE re.provider_id = ? AND re.upstream_model = ?`
  )
    .bind(providerId, upstreamModel)
    .all<{ route_id: string; route_name: string }>();

  return (rows.results ?? []).map((row) => ({
    routeId: row.route_id,
    routeName: row.route_name
  }));
}

async function getProviderModelExclusions(env: Env, providerId: string): Promise<Set<string>> {
  const rows = await env.DB.prepare("SELECT model_id FROM provider_model_exclusions WHERE provider_id = ?")
    .bind(providerId)
    .all<{ model_id: string }>();

  return new Set((rows.results ?? []).map((row) => row.model_id));
}

async function getProviderModelExclusionCount(env: Env, providerId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM provider_model_exclusions WHERE provider_id = ?")
    .bind(providerId)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function fetchNativeModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: { authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    throw new Error((await safeText(response)) || `Upstream returned ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return uniqueSorted((payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)));
}

async function fetchOpenRouterModelIds(catalog: ReturnType<typeof resolveProviderCatalog>): Promise<string[]> {
  const params = new URLSearchParams();
  if (catalog?.openRouterAuthors) {
    params.set("model_authors", catalog.openRouterAuthors);
  }
  if (catalog?.openRouterProviders) {
    params.set("providers", catalog.openRouterProviders);
  }

  const url = params.size > 0 ? `${OPENROUTER_MODELS_URL}?${params}` : OPENROUTER_MODELS_URL;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error((await safeText(response)) || `OpenRouter catalog returned ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id));
}

function transformOpenRouterModelId(id: string, stripPrefix?: string): string {
  if (stripPrefix && id.startsWith(stripPrefix)) {
    return id.slice(stripPrefix.length);
  }
  return id;
}

function withFallback(
  result: ProviderModelsResult,
  fallback: string[],
  message?: string
): ProviderModelsResult {
  if (fallback.length === 0) {
    return {
      models: [],
      source: "fallback",
      error: message ?? result.error
    };
  }

  return {
    models: fallback,
    source: "fallback",
    error: message ?? result.error
  };
}

function fallbackModels(providerId: string): string[] {
  const preset = providerDefaults.find((item) => item.id === providerId);
  return preset ? [preset.exampleModel] : [];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

const D1_BATCH_CHUNK_SIZE = 50;

async function runStatementBatches(env: Env, statements: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += D1_BATCH_CHUNK_SIZE) {
    await env.DB.batch(statements.slice(i, i + D1_BATCH_CHUNK_SIZE));
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
