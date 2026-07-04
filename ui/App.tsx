import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Provider = {
  id: string;
  name: string;
  base_url: string;
  enabled: number;
  key_count: number;
};

type ProviderKey = {
  id: string;
  provider_id: string;
  name: string;
  enabled: number;
  last_used_at: string | null;
  created_at: string;
};

type Route = {
  id: string;
  name: string;
};

type RouteEntry = {
  id: string;
  route_id: string;
  provider_id: string;
  provider_key_id: string | null;
  provider_key_name: string | null;
  provider_name: string;
  upstream_model: string;
  position: number;
};

type ClientKey = {
  id: string;
  name: string;
  enabled: number;
  created_at: string;
  last_used_at: string | null;
};

type UsageRow = {
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

type StatsWindow = "24h" | "7d" | "30d" | "all";

type DashboardBreakdown = {
  name: string;
  requests: number;
  totalTokens: number;
  errors: number;
  avgLatencyMs: number;
  successRate: number;
};

type DashboardStats = {
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

type ProviderModelSource = "upstream" | "cached" | "fallback";

type ProviderModelsState = {
  models: string[];
  source: ProviderModelSource;
  loading: boolean;
  error: string | null;
};

type ProviderCatalog = {
  id: string;
  name: string;
  openRouterAuthors: string;
  openRouterProviders: string;
  stripOpenRouterPrefix: string;
  modelCount: number;
  modelsSyncedAt: string | null;
  syncEnabled: boolean;
};

type CachedProviderModel = {
  modelId: string;
  source: "sync" | "manual";
};

type CachedProviderModelsState = {
  models: CachedProviderModel[];
  excludedCount: number;
  loading: boolean;
};

type ConfirmRequest = {
  message: string;
  resolve: (confirmed: boolean) => void;
};

function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const askConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ message, resolve });
    });
  }, []);

  const confirmDialog = request ? (
    <ConfirmDialog
      message={request.message}
      onConfirm={() => {
        request.resolve(true);
        setRequest(null);
      }}
      onCancel={() => {
        request.resolve(false);
        setRequest(null);
      }}
    />
  ) : null;

  return { askConfirm, confirmDialog };
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-message" onClick={(event) => event.stopPropagation()}>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const tabs = ["Dashboard", "Providers", "Routes", "Client keys", "Usage"] as const;
const CUSTOM_MODEL_VALUE = "__custom__";
const ADMIN_TOKEN_KEY = "adminToken";
type Tab = (typeof tabs)[number];

function readAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function App() {
  const [adminToken, setAdminToken] = useState(() => readAdminToken());
  const [tokenInput, setTokenInput] = useState(adminToken);
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [statsWindow, setStatsWindow] = useState<StatsWindow>("24h");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeEntries, setRouteEntries] = useState<RouteEntry[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog[]>([]);
  const [clientKeys, setClientKeys] = useState<ClientKey[]>([]);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [usageSummary, setUsageSummary] = useState<{ requests: number; total_tokens: number; errors: number } | null>(null);
  const [cooldowns, setCooldowns] = useState<Array<{ name: string }>>([]);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [message, setMessage] = useState("");
  const { askConfirm, confirmDialog } = useConfirm();

  const api = useMemo(() => makeApi(adminToken), [adminToken]);

  useEffect(() => {
    if (!adminToken) {
      return;
    }

    void refreshAll();
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) {
      return;
    }

    void loadDashboardStats();
  }, [adminToken, statsWindow]);

  async function refreshAll() {
    await Promise.all([loadDashboardStats(), loadProviders(), loadProviderCatalog(), loadRoutes(), loadClientKeys(), loadUsage(), loadCooldowns()]);
  }

  async function loadDashboardStats() {
    const data = await api.get<DashboardStats>(`/admin/stats?window=${statsWindow}`);
    setDashboardStats(data);
  }

  async function loadProviders() {
    const data = await api.get<{ providers: Provider[]; keys: ProviderKey[] }>("/admin/providers");
    setProviders(data.providers);
    setProviderKeys(data.keys);
  }

  async function loadProviderCatalog() {
    const data = await api.get<{ providers: ProviderCatalog[] }>("/admin/provider-catalog");
    setProviderCatalog(data.providers);
  }

  async function loadRoutes() {
    const data = await api.get<{ routes: Route[]; entries: RouteEntry[] }>("/admin/routes");
    setRoutes(data.routes);
    setRouteEntries(data.entries);
  }

  async function loadClientKeys() {
    const data = await api.get<{ keys: ClientKey[] }>("/admin/client-keys");
    setClientKeys(data.keys);
  }

  async function loadUsage() {
    const data = await api.get<{ rows: UsageRow[]; summary: { requests: number; total_tokens: number; errors: number } | null }>(
      "/admin/usage?limit=100"
    );
    setUsageRows(data.rows);
    setUsageSummary(data.summary);
  }

  async function loadCooldowns() {
    const data = await api.get<{ cooldowns: Array<{ name: string }> }>("/admin/cooldowns");
    setCooldowns(data.cooldowns);
  }

  function saveToken(event: FormEvent) {
    event.preventDefault();
    sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput);
    setAdminToken(tokenInput);
  }

  if (!adminToken) {
    return (
      <main className="shell login">
        <section className="card">
          <h1>LLM Router Admin</h1>
          <p>Enter the Worker `ADMIN_TOKEN` secret to manage providers, routes, and app keys.</p>
          <form onSubmit={saveToken} className="stack">
            <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="sk-admin..." />
            <button type="submit">Continue</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header>
        <div>
          <h1>LLM Router</h1>
          <p>Configure OpenAI-compatible provider fallback and generated app keys.</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            setAdminToken("");
          }}
        >
          Sign out
        </button>
      </header>

      <nav>
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {message && <p className="notice">{message}</p>}

      {activeTab === "Dashboard" && (
        <DashboardPanel
          stats={dashboardStats}
          window={statsWindow}
          cooldownCount={cooldowns.length}
          onWindowChange={setStatsWindow}
          onRefresh={refreshAll}
        />
      )}

      {activeTab === "Providers" && (
        <ProvidersPanel
          api={api}
          askConfirm={askConfirm}
          providers={providers}
          providerKeys={providerKeys}
          providerCatalog={providerCatalog}
          routes={routes}
          routeEntries={routeEntries}
          onChange={async (text) => {
            setMessage(text);
            await Promise.all([loadProviders(), loadProviderCatalog(), loadRoutes()]);
          }}
        />
      )}

      {activeTab === "Routes" && (
        <RoutesPanel
          api={api}
          askConfirm={askConfirm}
          providers={providers}
          providerKeys={providerKeys}
          routes={routes}
          entries={routeEntries}
          onChange={async (text) => {
            setMessage(text);
            await loadRoutes();
          }}
        />
      )}

      {activeTab === "Client keys" && (
        <ClientKeysPanel
          api={api}
          askConfirm={askConfirm}
          keys={clientKeys}
          generatedSecret={generatedSecret}
          setGeneratedSecret={setGeneratedSecret}
          onChange={async (text) => {
            setMessage(text);
            await loadClientKeys();
          }}
        />
      )}

      {activeTab === "Usage" && (
        <UsagePanel rows={usageRows} summary={usageSummary} cooldowns={cooldowns} onRefresh={refreshAll} />
      )}

      {confirmDialog}
    </main>
  );
}

function DashboardPanel({
  stats,
  window,
  cooldownCount,
  onWindowChange,
  onRefresh
}: {
  stats: DashboardStats | null;
  window: StatsWindow;
  cooldownCount: number;
  onWindowChange: (window: StatsWindow) => void;
  onRefresh: () => Promise<void>;
}) {
  const summary = stats?.summary;

  return (
    <section className="dashboard">
      <div className="card">
        <div className="toolbar">
          <div>
            <h2>Dashboard</h2>
            <p className="hint">Request volume, health, latency, and token usage from the usage log.</p>
          </div>
          <div className="toolbar compact">
            <select value={window} onChange={(event) => onWindowChange(event.target.value as StatsWindow)}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <button className="secondary" onClick={() => void onRefresh()}>
              Refresh
            </button>
          </div>
        </div>

        <div className="stat-cards">
          <StatCard label="Requests" value={formatNumber(summary?.requests ?? 0)} />
          <StatCard label="Tokens" value={formatNumber(summary?.totalTokens ?? 0)} />
          <StatCard label="Errors" value={formatNumber(summary?.errors ?? 0)} />
          <StatCard label="Avg latency" value={`${formatNumber(summary?.avgLatencyMs ?? 0)} ms`} />
          <StatCard label="Success rate" value={formatPercent(summary?.successRate ?? 0)} />
          <StatCard label="Cooldowns" value={formatNumber(cooldownCount)} />
        </div>
      </div>

      <div className="dashboard-grid">
        <BreakdownTable title="By provider" rows={stats?.breakdowns.providers ?? []} emptyLabel="No provider usage yet." />
        <BreakdownTable title="By route" rows={stats?.breakdowns.routes ?? []} emptyLabel="No route usage yet." />
        <BreakdownTable title="By client key" rows={stats?.breakdowns.clientKeys ?? []} emptyLabel="No client key usage yet." />
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BreakdownTable({ title, rows, emptyLabel }: { title: string; rows: DashboardBreakdown[]; emptyLabel: string }) {
  return (
    <div className="card breakdown-card">
      <h3>{title}</h3>
      <div className="breakdown-table">
        <div className="breakdown-row heading">
          <span>Name</span>
          <span>Requests</span>
          <span>Tokens</span>
          <span>Errors</span>
          <span>Avg latency</span>
          <span>Success</span>
        </div>
        {rows.length === 0 && <p className="hint">{emptyLabel}</p>}
        {rows.map((row) => (
          <div key={row.name} className="breakdown-row">
            <span>{row.name}</span>
            <span>{formatNumber(row.requests)}</span>
            <span>{formatNumber(row.totalTokens)}</span>
            <span>{formatNumber(row.errors)}</span>
            <span>{formatNumber(row.avgLatencyMs)} ms</span>
            <span>{formatPercent(row.successRate)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvidersPanel({
  api,
  askConfirm,
  providers,
  providerKeys,
  providerCatalog,
  routes,
  routeEntries,
  onChange
}: {
  api: Api;
  askConfirm: (message: string) => Promise<boolean>;
  providers: Provider[];
  providerKeys: ProviderKey[];
  providerCatalog: ProviderCatalog[];
  routes: Route[];
  routeEntries: RouteEntry[];
  onChange: (message: string) => Promise<void>;
}) {
  const [providerForm, setProviderForm] = useState({ id: "", name: "", baseUrl: "" });
  const [keyForm, setKeyForm] = useState({ providerId: "", name: "", apiKey: "" });
  const [catalogDrafts, setCatalogDrafts] = useState<Record<string, Pick<ProviderCatalog, "openRouterAuthors" | "openRouterProviders" | "stripOpenRouterPrefix">>>(
    {}
  );
  const [syncingAll, setSyncingAll] = useState(false);
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [catalogModels, setCatalogModels] = useState<Record<string, CachedProviderModelsState>>({});
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [editingModels, setEditingModels] = useState<Record<string, string>>({});

  useEffect(() => {
    setCatalogDrafts(
      Object.fromEntries(
        providerCatalog.map((provider) => [
          provider.id,
          {
            openRouterAuthors: provider.openRouterAuthors,
            openRouterProviders: provider.openRouterProviders,
            stripOpenRouterPrefix: provider.stripOpenRouterPrefix
          }
        ])
      )
    );
  }, [providerCatalog]);

  async function addProvider(event: FormEvent) {
    event.preventDefault();
    await api.post("/admin/providers", providerForm);
    setProviderForm({ id: "", name: "", baseUrl: "" });
    await onChange("Provider saved.");
  }

  async function addKey(event: FormEvent) {
    event.preventDefault();
    await api.post(`/admin/providers/${keyForm.providerId}/keys`, { name: keyForm.name, apiKey: keyForm.apiKey });
    setKeyForm({ providerId: "", name: "", apiKey: "" });
    await onChange("Provider key saved.");
  }

  async function saveCatalog(providerId: string) {
    const draft = catalogDrafts[providerId];
    await api.patch(`/admin/providers/${providerId}/catalog`, draft ?? { openRouterAuthors: "", openRouterProviders: "", stripOpenRouterPrefix: "" });
    await onChange("Catalog mapping saved.");
  }

  async function loadCachedModels(providerId: string) {
    setCatalogModels((current) => ({
      ...current,
      [providerId]: {
        models: current[providerId]?.models ?? [],
        excludedCount: current[providerId]?.excludedCount ?? 0,
        loading: true
      }
    }));

    try {
      const data = await api.get<{ models: CachedProviderModel[]; excludedCount: number }>(
        `/admin/providers/${providerId}/models/cached`
      );
      setCatalogModels((current) => ({
        ...current,
        [providerId]: { models: data.models, excludedCount: data.excludedCount, loading: false }
      }));
    } catch (error) {
      setCatalogModels((current) => ({
        ...current,
        [providerId]: {
          models: [],
          excludedCount: 0,
          loading: false
        }
      }));
      await onChange(error instanceof Error ? `Failed to load models: ${error.message}` : "Failed to load models.");
    }
  }

  async function toggleProviderModels(providerId: string) {
    if (expandedProviderId === providerId) {
      setExpandedProviderId(null);
      return;
    }

    setExpandedProviderId(providerId);
    await loadCachedModels(providerId);
  }

  async function addCatalogModel(providerId: string) {
    const modelId = newModelInputs[providerId]?.trim();
    if (!modelId) {
      return;
    }

    try {
      await api.post(`/admin/providers/${providerId}/models`, { modelId });
      setNewModelInputs((current) => ({ ...current, [providerId]: "" }));
      await loadCachedModels(providerId);
      await onChange("Model added.");
    } catch (error) {
      await onChange(error instanceof Error ? `Add failed: ${error.message}` : "Add failed.");
    }
  }

  async function saveCatalogModelEdit(providerId: string, oldModelId: string) {
    const newModelId = editingModels[`${providerId}:${oldModelId}`]?.trim();
    if (!newModelId || newModelId === oldModelId) {
      setEditingModels((current) => {
        const next = { ...current };
        delete next[`${providerId}:${oldModelId}`];
        return next;
      });
      return;
    }

    try {
      await api.patch(`/admin/providers/${providerId}/models/${encodeURIComponent(oldModelId)}`, { modelId: newModelId });
      setEditingModels((current) => {
        const next = { ...current };
        delete next[`${providerId}:${oldModelId}`];
        return next;
      });
      await loadCachedModels(providerId);
      await onChange("Model updated.");
    } catch (error) {
      await onChange(error instanceof Error ? `Update failed: ${error.message}` : "Update failed.");
    }
  }

  async function deleteCatalogModel(providerId: string, modelId: string) {
    if (!(await askConfirm(`Delete model "${modelId}" from the catalog? Synced models stay excluded on the next sync.`))) {
      return;
    }

    try {
      await api.delete(`/admin/providers/${providerId}/models/${encodeURIComponent(modelId)}`);
      await loadCachedModels(providerId);
      await onChange("Model deleted.");
    } catch (error) {
      await onChange(error instanceof Error ? `Delete failed: ${error.message}` : "Delete failed.");
    }
  }

  async function syncAllCatalogs() {
    setSyncingAll(true);
    try {
      const response = await api.post<{ results: Array<{ providerId: string; modelCount?: number; error?: string }> }>("/admin/provider-catalog/sync-all", {});
      const synced = response.results.filter((result) => result.modelCount !== undefined).length;
      const failed = response.results.length - synced;
      if (expandedProviderId) {
        await loadCachedModels(expandedProviderId);
      }
      await onChange(failed > 0 ? `Synced ${synced} providers. ${failed} failed.` : `Synced ${synced} providers.`);
    } catch (error) {
      await onChange(error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed.");
    } finally {
      setSyncingAll(false);
    }
  }

  function updateCatalogDraft(providerId: string, field: keyof Pick<ProviderCatalog, "openRouterAuthors" | "openRouterProviders" | "stripOpenRouterPrefix">, value: string) {
    setCatalogDrafts((current) => ({
      ...current,
      [providerId]: {
        openRouterAuthors: current[providerId]?.openRouterAuthors ?? "",
        openRouterProviders: current[providerId]?.openRouterProviders ?? "",
        stripOpenRouterPrefix: current[providerId]?.stripOpenRouterPrefix ?? "",
        [field]: value
      }
    }));
  }

  return (
    <section className="providers-panel">
      <div className="card catalog-card">
        <div className="toolbar">
          <div>
            <h2>Model Catalog</h2>
            <p className="hint">
              Sync from OpenRouter at the top. Delete models you do not want; they stay excluded on the next sync. Add manual models anytime. Renaming a
              catalog model does not update existing route entries.
            </p>
          </div>
          <button type="button" className="secondary" onClick={() => void syncAllCatalogs()} disabled={syncingAll}>
            {syncingAll ? "Syncing..." : "Sync from OpenRouter"}
          </button>
        </div>
        <div className="catalog-list">
          {providerCatalog.map((provider) => {
            const draft = catalogDrafts[provider.id] ?? provider;
            const modelsState = catalogModels[provider.id];
            const isExpanded = expandedProviderId === provider.id;
            return (
              <article key={provider.id} className="catalog-row">
                <strong>{provider.name}</strong>
                <label>
                  <span>OpenRouter authors</span>
                  <input
                    placeholder="anthropic,openai"
                    value={draft.openRouterAuthors}
                    onChange={(event) => updateCatalogDraft(provider.id, "openRouterAuthors", event.target.value)}
                  />
                </label>
                <label>
                  <span>OpenRouter providers</span>
                  <input
                    placeholder="groq"
                    value={draft.openRouterProviders}
                    onChange={(event) => updateCatalogDraft(provider.id, "openRouterProviders", event.target.value)}
                  />
                </label>
                <label>
                  <span>Strip prefix</span>
                  <input
                    placeholder="openai/"
                    value={draft.stripOpenRouterPrefix}
                    onChange={(event) => updateCatalogDraft(provider.id, "stripOpenRouterPrefix", event.target.value)}
                  />
                </label>
                <small>
                  {provider.modelCount} catalog models
                  {modelsState?.excludedCount ? `, ${modelsState.excludedCount} excluded` : ""}
                  {provider.modelsSyncedAt ? `, last synced ${formatDate(provider.modelsSyncedAt)}` : ""}
                </small>
                <button type="button" className="secondary" onClick={() => void saveCatalog(provider.id)}>
                  Save mapping
                </button>
                <button type="button" className="secondary" onClick={() => void toggleProviderModels(provider.id)}>
                  {isExpanded ? "Hide models" : `Manage models (${provider.modelCount})`}
                </button>
                {isExpanded && (
                  <div className="catalog-models">
                    {modelsState?.loading && <p className="hint">Loading models...</p>}
                    {!modelsState?.loading && (modelsState?.models.length ?? 0) === 0 && (
                      <p className="hint">No models in catalog yet. Sync from OpenRouter or add one manually.</p>
                    )}
                    {!modelsState?.loading &&
                      (modelsState?.models ?? []).map((model) => {
                        const editKey = `${provider.id}:${model.modelId}`;
                        const isEditing = editKey in editingModels;
                        return (
                          <div key={model.modelId} className="catalog-model-row">
                            {isEditing ? (
                              <input
                                value={editingModels[editKey] ?? model.modelId}
                                onChange={(event) =>
                                  setEditingModels((current) => ({ ...current, [editKey]: event.target.value }))
                                }
                              />
                            ) : (
                              <span className="catalog-model-id">{model.modelId}</span>
                            )}
                            <span className={`badge ${model.source}`}>{model.source}</span>
                            {isEditing ? (
                              <>
                                <button type="button" className="secondary" onClick={() => void saveCatalogModelEdit(provider.id, model.modelId)}>
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() =>
                                    setEditingModels((current) => {
                                      const next = { ...current };
                                      delete next[editKey];
                                      return next;
                                    })
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() =>
                                    setEditingModels((current) => ({ ...current, [editKey]: model.modelId }))
                                  }
                                >
                                  Edit
                                </button>
                                <button type="button" className="danger" onClick={() => void deleteCatalogModel(provider.id, model.modelId)}>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    {!modelsState?.loading && (
                      <div className="catalog-model-add">
                        <input
                          placeholder="Add model ID"
                          value={newModelInputs[provider.id] ?? ""}
                          onChange={(event) =>
                            setNewModelInputs((current) => ({ ...current, [provider.id]: event.target.value }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void addCatalogModel(provider.id);
                            }
                          }}
                        />
                        <button type="button" onClick={() => void addCatalogModel(provider.id)}>
                          Add model
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Providers</h2>
          <p className="hint">Register upstream APIs (name + OpenAI-compatible base URL). Preset IDs like `openai` pick up default catalog mappings.</p>
          <form onSubmit={addProvider} className="stack">
            <input placeholder="id (optional, e.g. groq)" value={providerForm.id} onChange={(event) => setProviderForm({ ...providerForm, id: event.target.value })} />
            <input required placeholder="Provider name" value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} />
            <input required placeholder="Base URL" value={providerForm.baseUrl} onChange={(event) => setProviderForm({ ...providerForm, baseUrl: event.target.value })} />
            <button type="submit">Add or update provider</button>
          </form>
          <div className="list">
            {providers.map((provider) => (
              <article key={provider.id}>
                <strong>{provider.name}</strong>
                <small>{provider.base_url}</small>
                <span>{provider.key_count} keys</span>
                <button className="secondary" onClick={() => api.patch(`/admin/providers/${provider.id}`, { enabled: provider.enabled !== 1 }).then(() => onChange("Provider toggled."))}>
                  {provider.enabled === 1 ? "Disable" : "Enable"}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Provider Keys</h2>
          <form onSubmit={addKey} className="stack">
            <select required value={keyForm.providerId} onChange={(event) => setKeyForm({ ...keyForm, providerId: event.target.value })}>
              <option value="">Select provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <input required placeholder="Key name" value={keyForm.name} onChange={(event) => setKeyForm({ ...keyForm, name: event.target.value })} />
            <input required type="password" placeholder="API key (write-only)" value={keyForm.apiKey} onChange={(event) => setKeyForm({ ...keyForm, apiKey: event.target.value })} />
            <button type="submit">Add encrypted key</button>
          </form>
          <div className="table keys-table">
            <div className="row heading">
              <span>Name</span>
              <span>Provider</span>
              <span>Status</span>
              <span>Last used</span>
              <span>Actions</span>
            </div>
            {providerKeys.length === 0 && <p className="hint">No provider keys yet.</p>}
            {providerKeys.map((key) => (
              <div key={key.id} className="row">
                <span>{key.name}</span>
                <span>{providers.find((provider) => provider.id === key.provider_id)?.name ?? key.provider_id}</span>
                <span>{key.enabled === 1 ? "Enabled" : "Disabled"}</span>
                <span>{key.last_used_at ? formatDate(key.last_used_at) : "Never"}</span>
                <span className="row-actions">
                  <button className="secondary" onClick={() => api.patch(`/admin/provider-keys/${key.id}`, { enabled: key.enabled !== 1 }).then(() => onChange("Provider key toggled."))}>
                    {key.enabled === 1 ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      void (async () => {
                        const routeNames = routeNamesUsingProviderKey(key.id, routes, routeEntries);
                        if (!(await askConfirm(providerKeyDeleteMessage(key.name, routeNames)))) {
                          return;
                        }
                        await api.delete(`/admin/provider-keys/${key.id}`);
                        await onChange("Provider key deleted.");
                      })();
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoutesPanel({
  api,
  askConfirm,
  providers,
  providerKeys,
  routes,
  entries,
  onChange
}: {
  api: Api;
  askConfirm: (message: string) => Promise<boolean>;
  providers: Provider[];
  providerKeys: ProviderKey[];
  routes: Route[];
  entries: RouteEntry[];
  onChange: (message: string) => Promise<void>;
}) {
  const firstRoute = routes[0];
  const [selectedRouteId, setSelectedRouteId] = useState(firstRoute?.id ?? "");
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? firstRoute;
  const selectedEntries = selectedRoute ? entries.filter((entry) => entry.route_id === selectedRoute.id).sort((a, b) => a.position - b.position) : [];
  const entriesKey = useMemo(
    () => selectedEntries.map((entry) => `${entry.id}:${entry.provider_id}:${entry.upstream_model}:${entry.position}`).join("|"),
    [selectedEntries]
  );
  const [name, setName] = useState(selectedRoute?.name ?? "default");
  const [draftEntries, setDraftEntries] = useState<Array<{ providerId: string; providerKeyId: string; upstreamModel: string }>>([]);
  const [modelLists, setModelLists] = useState<Record<string, ProviderModelsState>>({});
  const [customModelRows, setCustomModelRows] = useState<Set<number>>(new Set());

  const loadModels = useCallback(
    async (providerId: string) => {
      if (!providerId) {
        return;
      }

      setModelLists((current) => ({
        ...current,
        [providerId]: {
          models: current[providerId]?.models ?? [],
          source: current[providerId]?.source ?? "fallback",
          loading: true,
          error: null
        }
      }));

      try {
        const data = await api.get<{ models: string[]; source: ProviderModelSource; error: string | null }>(`/admin/providers/${providerId}/models`);
        setModelLists((current) => ({
          ...current,
          [providerId]: {
            models: data.models,
            source: data.source,
            loading: false,
            error: data.error
          }
        }));
      } catch (error) {
        setModelLists((current) => ({
          ...current,
          [providerId]: {
            models: current[providerId]?.models ?? [],
            source: "fallback",
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load models"
          }
        }));
      }
    },
    [api]
  );

  useEffect(() => {
    if (!selectedRoute) {
      return;
    }

    setName(selectedRoute.name);
    setDraftEntries(selectedEntries.map((entry) => ({ providerId: entry.provider_id, providerKeyId: entry.provider_key_id ?? "", upstreamModel: entry.upstream_model })));
    setCustomModelRows(new Set());

    for (const entry of selectedEntries) {
      if (entry.provider_id) {
        void loadModels(entry.provider_id);
      }
    }
  }, [selectedRoute?.id, entriesKey, loadModels]);

  async function saveRoute() {
    const payload = { name, entries: draftEntries.filter((entry) => entry.providerId && entry.upstreamModel) };
    if (selectedRoute) {
      await api.put(`/admin/routes/${selectedRoute.id}`, payload);
    } else {
      await api.post("/admin/routes", payload);
    }
    await onChange("Route saved.");
  }

  function updateProvider(index: number, providerId: string) {
    setDraftEntries(updateAt(draftEntries, index, { providerId, providerKeyId: "", upstreamModel: "" }));
    setCustomModelRows((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
    void loadModels(providerId);
  }

  return (
    <section className="card">
      <h2>Routes</h2>
      <p className="hint">Model list uses your curated catalog when populated. Choose Other to type a custom model ID.</p>
      <div className="toolbar">
        <select value={selectedRoute?.id ?? ""} onChange={(event) => setSelectedRouteId(event.target.value)}>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.name}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() => {
            setSelectedRouteId("");
            setName("");
            setDraftEntries([]);
            setCustomModelRows(new Set());
          }}
        >
          New route
        </button>
      </div>
      <input placeholder="Virtual model name (default, fast, smart)" value={name} onChange={(event) => setName(event.target.value)} />
      <div className="list">
        {draftEntries.map((entry, index) => (
          <article key={`${entry.providerId}-${index}`} className="route-entry">
            <span>#{index + 1}</span>
            <select value={entry.providerId} onChange={(event) => updateProvider(index, event.target.value)}>
              <option value="">Provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <select
              value={entry.providerKeyId}
              onChange={(event) => setDraftEntries(updateAt(draftEntries, index, { ...entry, providerKeyId: event.target.value }))}
              disabled={!entry.providerId}
              title="Pin this route step to a specific provider key"
            >
              <option value="">Any enabled key</option>
              {providerKeys
                .filter((key) => key.provider_id === entry.providerId)
                .map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                    {key.enabled !== 1 ? " (disabled)" : ""}
                  </option>
                ))}
            </select>
            <UpstreamModelField
              providerId={entry.providerId}
              upstreamModel={entry.upstreamModel}
              modelState={entry.providerId ? modelLists[entry.providerId] : undefined}
              forceCustom={customModelRows.has(index)}
              onReload={() => void loadModels(entry.providerId)}
              onChange={(upstreamModel) => setDraftEntries(updateAt(draftEntries, index, { ...entry, upstreamModel }))}
              onCustomModeChange={(enabled) =>
                setCustomModelRows((current) => {
                  const next = new Set(current);
                  if (enabled) {
                    next.add(index);
                  } else {
                    next.delete(index);
                  }
                  return next;
                })
              }
            />
            <button className="secondary" onClick={() => setDraftEntries(move(draftEntries, index, -1))}>
              Up
            </button>
            <button className="secondary" onClick={() => setDraftEntries(move(draftEntries, index, 1))}>
              Down
            </button>
            <button
              className="danger"
              onClick={() => {
                void (async () => {
                  if (!(await askConfirm(`Remove fallback step #${index + 1}?`))) {
                    return;
                  }
                  setDraftEntries(draftEntries.filter((_, i) => i !== index));
                })();
              }}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
      <div className="toolbar">
        <button className="secondary" onClick={() => setDraftEntries([...draftEntries, { providerId: "", providerKeyId: "", upstreamModel: "" }])}>
          Add fallback step
        </button>
        <button onClick={saveRoute}>Save route</button>
      </div>
    </section>
  );
}

function UpstreamModelField({
  providerId,
  upstreamModel,
  modelState,
  forceCustom,
  onReload,
  onChange,
  onCustomModeChange
}: {
  providerId: string;
  upstreamModel: string;
  modelState?: ProviderModelsState;
  forceCustom: boolean;
  onReload: () => void;
  onChange: (upstreamModel: string) => void;
  onCustomModeChange: (enabled: boolean) => void;
}) {
  if (!providerId) {
    return (
      <div className="model-field">
        <input disabled placeholder="Select a provider first" value="" readOnly />
      </div>
    );
  }

  const models = modelState?.models ?? [];
  const loading = modelState?.loading ?? false;
  const knownModel = upstreamModel && models.includes(upstreamModel);
  const showCustomInput = forceCustom || (!loading && upstreamModel !== "" && !knownModel);
  const selectValue = showCustomInput ? CUSTOM_MODEL_VALUE : upstreamModel;

  return (
    <div className="model-field">
      <div className="model-field-controls">
        <SearchableModelSelect
          value={selectValue}
          models={models}
          disabled={loading && models.length === 0}
          loading={loading}
          placeholder={loading ? "Loading models..." : "Search or select upstream model"}
          onSelect={(value) => {
            if (value === CUSTOM_MODEL_VALUE) {
              onCustomModeChange(true);
              if (knownModel) {
                onChange("");
              }
              return;
            }

            onCustomModeChange(false);
            onChange(value);
          }}
        />
        <button type="button" className="secondary model-reload" onClick={onReload} disabled={loading} title="Refresh model list">
          ↻
        </button>
      </div>
      {showCustomInput && (
        <input
          placeholder="Custom upstream model"
          value={upstreamModel}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {modelState?.error && <small className="model-hint">{modelState.error}</small>}
      {!loading && modelState?.source === "upstream" && !modelState.error && <small className="model-hint">Live list from provider API</small>}
      {!loading && modelState?.source === "cached" && !modelState.error && <small className="model-hint">Curated catalog</small>}
    </div>
  );
}

function SearchableModelSelect({
  value,
  models,
  placeholder,
  disabled,
  loading,
  onSelect
}: {
  value: string;
  models: string[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onSelect: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel =
    value === CUSTOM_MODEL_VALUE ? "Other (type manually)..." : value || (loading ? "Loading models..." : "");

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return models;
    }

    return models.filter((model) => model.toLowerCase().includes(normalized));
  }, [models, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function choose(nextValue: string) {
    onSelect(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={`searchable-select${open ? " open" : ""}${disabled ? " disabled" : ""}`}>
      <button
        type="button"
        className="searchable-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <span className={selectedLabel ? "" : "placeholder"}>{selectedLabel || placeholder}</span>
        <span className="searchable-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="searchable-select-menu" role="listbox">
          <input
            ref={inputRef}
            className="searchable-select-search"
            value={query}
            placeholder="Type to filter models..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <div className="searchable-select-options">
            {!loading && filteredModels.length === 0 && <p className="hint searchable-select-empty">No models match your search.</p>}
            {filteredModels.map((model) => (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={value === model}
                className={value === model ? "selected" : ""}
                onClick={() => choose(model)}
              >
                {model}
              </button>
            ))}
            <button
              type="button"
              role="option"
              aria-selected={value === CUSTOM_MODEL_VALUE}
              className={`searchable-select-custom${value === CUSTOM_MODEL_VALUE ? " selected" : ""}`}
              onClick={() => choose(CUSTOM_MODEL_VALUE)}
            >
              Other (type manually)...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientKeysPanel({
  api,
  askConfirm,
  keys,
  generatedSecret,
  setGeneratedSecret,
  onChange
}: {
  api: Api;
  askConfirm: (message: string) => Promise<boolean>;
  keys: ClientKey[];
  generatedSecret: string;
  setGeneratedSecret: (secret: string) => void;
  onChange: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState("");

  async function createKey(event: FormEvent) {
    event.preventDefault();
    const response = await api.post<{ id: string; secret: string }>("/admin/client-keys", { name });
    setGeneratedSecret(response.secret);
    setName("");
    await onChange("Client key generated. Store it now; it will not be shown again.");
  }

  return (
    <section className="card">
      <h2>Client Keys</h2>
      <form onSubmit={createKey} className="toolbar">
        <input required placeholder="Application name" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit">Generate key</button>
      </form>
      {generatedSecret && (
        <pre className="secret">
          <code>{generatedSecret}</code>
        </pre>
      )}
      <div className="list">
        {keys.map((key) => (
          <article key={key.id}>
            <strong>{key.name}</strong>
            <small>Created {formatDate(key.created_at)}</small>
            <button className="secondary" onClick={() => api.patch(`/admin/client-keys/${key.id}`, { enabled: key.enabled !== 1 }).then(() => onChange("Client key toggled."))}>
              {key.enabled === 1 ? "Disable" : "Enable"}
            </button>
            <button
              className="danger"
              onClick={() => {
                void (async () => {
                  if (!(await askConfirm(`Delete client key "${key.name}"?`))) {
                    return;
                  }
                  await api.delete(`/admin/client-keys/${key.id}`);
                  await onChange("Client key deleted.");
                })();
              }}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function UsagePanel({
  rows,
  summary,
  cooldowns,
  onRefresh
}: {
  rows: UsageRow[];
  summary: { requests: number; total_tokens: number; errors: number } | null;
  cooldowns: Array<{ name: string }>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="card">
      <div className="toolbar">
        <h2>Usage</h2>
        <button className="secondary" onClick={() => void onRefresh()}>
          Refresh
        </button>
      </div>
      <div className="stats">
        <span>Requests: {summary?.requests ?? 0}</span>
        <span>Tokens: {summary?.total_tokens ?? 0}</span>
        <span>Errors: {summary?.errors ?? 0}</span>
        <span>Cooldowns: {cooldowns.length}</span>
      </div>
      <div className="table">
        <div className="row heading">
          <span>Time</span>
          <span>App</span>
          <span>Route</span>
          <span>Provider</span>
          <span>Status</span>
          <span>Tokens</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="row">
            <span>{formatDate(row.created_at)}</span>
            <span>{row.client_key_name ?? "-"}</span>
            <span>{row.route_name}</span>
            <span>{row.provider_name ?? "-"}</span>
            <span>{row.status}</span>
            <span>{row.total_tokens ?? "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type Api = ReturnType<typeof makeApi>;

function makeApi(adminToken: string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T,>(path: string) => request<T>(path),
    post: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    patch: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T = { ok: boolean },>(path: string) => request<T>(path, { method: "DELETE" })
  };
}

function updateAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return next;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function routeNamesUsingProviderKey(keyId: string, routes: Route[], entries: RouteEntry[]): string[] {
  const routeIds = new Set(entries.filter((entry) => entry.provider_key_id === keyId).map((entry) => entry.route_id));
  return routes
    .filter((route) => routeIds.has(route.id))
    .map((route) => route.name)
    .sort();
}

function providerKeyDeleteMessage(keyName: string, routeNames: string[]): string {
  if (routeNames.length === 0) {
    return `Delete provider key "${keyName}"?`;
  }

  const routeList = routeNames.map((name) => `"${name}"`).join(", ");
  if (routeNames.length === 1) {
    return `Delete provider key "${keyName}"? Route ${routeList} is pinned to this key and will fall back to any enabled key for that provider.`;
  }

  return `Delete provider key "${keyName}"? Routes ${routeList} are pinned to this key and will fall back to any enabled key for that provider.`;
}
