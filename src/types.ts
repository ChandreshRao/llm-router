export type Env = {
  DB: D1Database;
  COOLDOWNS: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_TOKEN: string;
  ENCRYPTION_KEY: string;
  DEFAULT_COOLDOWN_429_SECONDS?: string;
  DEFAULT_COOLDOWN_5XX_SECONDS?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  ADAPTIVE_ROUTING_ENABLED?: string;
  ADAPTIVE_ROUTING_WINDOW_HOURS?: string;
};

export type Variables = {
  clientKeyId?: string;
};

export type ProviderRow = {
  id: string;
  name: string;
  base_url: string;
  enabled: number;
  open_router_authors: string | null;
  open_router_providers: string | null;
  strip_open_router_prefix: string | null;
  models_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderCatalogRow = ProviderRow & {
  model_count: number;
};

export type ProviderModelRow = {
  provider_id: string;
  model_id: string;
  source: "sync" | "manual";
};

export type ProviderKeyRow = {
  id: string;
  provider_id: string;
  name: string;
  api_key_ciphertext: string;
  enabled: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RouteEntryRow = {
  id: string;
  route_id: string;
  provider_id: string;
  provider_key_id: string | null;
  provider_key_name: string | null;
  provider_name: string;
  base_url: string;
  upstream_model: string;
  position: number;
};

export type ClientKeyRow = {
  id: string;
  name: string;
  key_hash: string;
  enabled: number;
  rpm_limit: number | null;
  daily_token_limit: number | null;
  created_at: string;
  last_used_at: string | null;
};

export type UsagePayload = {
  clientKeyId: string | null;
  routeName: string;
  providerId: string | null;
  providerKeyId: string | null;
  upstreamModel: string | null;
  status: number;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  error?: string | null;
};

export type UpstreamAttempt = {
  providerId: string;
  providerName: string;
  providerKeyId: string;
  baseUrl: string;
  upstreamModel: string;
  apiKey: string;
};

export type OpenAIChatBody = {
  model?: string;
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
