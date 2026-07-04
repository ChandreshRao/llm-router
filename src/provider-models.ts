import { decryptSecret } from "./crypto";
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
};

export async function fetchProviderModels(env: Env, providerId: string): Promise<ProviderModelsResult> {
  const provider = await env.DB.prepare("SELECT id, base_url FROM providers WHERE id = ?")
    .bind(providerId)
    .first<{ id: string; base_url: string }>();

  if (!provider) {
    return { models: [], source: "fallback", error: "Provider not found" };
  }

  const fallback = fallbackModels(providerId);
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
      const cachedModels = await getCachedProviderModels(env, providerId);
      if (cachedModels.length > 0) {
        return {
          models: cachedModels,
          source: "cached",
          error: `${nativeError}. Showing synced catalog instead.`
        };
      }
      return withFallback({ models: [], source: "fallback", error: nativeError }, fallback);
    }
  }

  const cachedModels = await getCachedProviderModels(env, providerId);
  if (cachedModels.length > 0) {
    return { models: cachedModels, source: "cached", error: null };
  }

  return withFallback(
    { models: [], source: "fallback", error: null },
    fallback,
    keyRow ? "Could not load models from provider or synced catalog" : "Add a provider API key or sync models from OpenRouter"
  );
}

export async function getCachedProviderModels(env: Env, providerId: string): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT model_id FROM provider_models WHERE provider_id = ? ORDER BY model_id")
    .bind(providerId)
    .all<{ model_id: string }>();

  return (rows.results ?? []).map((row) => row.model_id);
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

  const syncedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ?").bind(providerId),
    ...models.map((model) =>
      env.DB.prepare("INSERT INTO provider_models (provider_id, model_id) VALUES (?, ?)").bind(providerId, model)
    ),
    env.DB.prepare(
      "UPDATE providers SET models_synced_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    ).bind(syncedAt, providerId)
  ]);

  return {
    providerId,
    modelCount: models.length,
    syncedAt,
    models
  };
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

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
