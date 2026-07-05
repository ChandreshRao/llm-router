export type Provider = {
  id: string;
  name: string;
  base_url: string;
  enabled: number;
  key_count: number;
};

export type ProviderKey = {
  id: string;
  provider_id: string;
  name: string;
  enabled: number;
  last_used_at: string | null;
  created_at: string;
};

export type Route = {
  id: string;
  name: string;
};

export type RouteEntry = {
  id: string;
  route_id: string;
  provider_id: string;
  provider_key_id: string | null;
  provider_key_name: string | null;
  provider_name: string;
  upstream_model: string;
  position: number;
};

export type ClientKey = {
  id: string;
  name: string;
  enabled: number;
  created_at: string;
  last_used_at: string | null;
};

export type UsageRow = {
  id: string;
  created_at: string;
  client_key_name: string | null;
  route_name: string;
  provider_name: string | null;
  upstream_model: string | null;
  status: number;
  latency_ms: number;
  total_tokens: number | null;
  error: string | null;
};

export type StatsWindow = "24h" | "7d" | "30d" | "all";

export type DashboardBreakdown = {
  id: string;
  name: string;
  requests: number;
  totalTokens: number;
  errors: number;
  avgLatencyMs: number;
  successRate: number;
};

export type DashboardStats = {
  window: StatsWindow;
  summary: {
    requests: number;
    totalTokens: number;
    errors: number;
    avgLatencyMs: number;
    successRate: number;
  };
  breakdowns: {
    providers: DashboardBreakdown[];
    routes: DashboardBreakdown[];
    clientKeys: DashboardBreakdown[];
  };
};

export type ProviderModelSource = "upstream" | "cached" | "fallback";

export type ProviderModelsState = {
  models: string[];
  source: ProviderModelSource;
  loading: boolean;
  error: string | null;
};

export type ProviderCatalog = {
  id: string;
  name: string;
  openRouterAuthors: string;
  openRouterProviders: string;
  stripOpenRouterPrefix: string;
  modelCount: number;
  modelsSyncedAt: string | null;
  syncEnabled: boolean;
};

export type CachedProviderModel = {
  modelId: string;
  source: "sync" | "manual";
};

export type CachedProviderModelsState = {
  models: CachedProviderModel[];
  excludedCount: number;
  loading: boolean;
};
