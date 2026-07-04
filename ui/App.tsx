import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

const tabs = ["Providers", "Routes", "Client keys", "Usage"] as const;
const CUSTOM_MODEL_VALUE = "__custom__";
const ADMIN_TOKEN_KEY = "adminToken";
type Tab = (typeof tabs)[number];

function readAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function App() {
  const [adminToken, setAdminToken] = useState(() => readAdminToken());
  const [tokenInput, setTokenInput] = useState(adminToken);
  const [activeTab, setActiveTab] = useState<Tab>("Providers");
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

  const api = useMemo(() => makeApi(adminToken), [adminToken]);

  useEffect(() => {
    if (!adminToken) {
      return;
    }

    void refreshAll();
  }, [adminToken]);

  async function refreshAll() {
    await Promise.all([loadProviders(), loadProviderCatalog(), loadRoutes(), loadClientKeys(), loadUsage(), loadCooldowns()]);
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

      {activeTab === "Providers" && (
        <ProvidersPanel
          api={api}
          providers={providers}
          providerKeys={providerKeys}
          providerCatalog={providerCatalog}
          onChange={async (text) => {
            setMessage(text);
            await Promise.all([loadProviders(), loadProviderCatalog()]);
          }}
        />
      )}

      {activeTab === "Routes" && (
        <RoutesPanel
          api={api}
          providers={providers}
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
    </main>
  );
}

function ProvidersPanel({
  api,
  providers,
  providerKeys,
  providerCatalog,
  onChange
}: {
  api: Api;
  providers: Provider[];
  providerKeys: ProviderKey[];
  providerCatalog: ProviderCatalog[];
  onChange: (message: string) => Promise<void>;
}) {
  const [providerForm, setProviderForm] = useState({ id: "", name: "", baseUrl: "" });
  const [keyForm, setKeyForm] = useState({ providerId: "", name: "", apiKey: "" });
  const [catalogDrafts, setCatalogDrafts] = useState<Record<string, Pick<ProviderCatalog, "openRouterAuthors" | "openRouterProviders" | "stripOpenRouterPrefix">>>(
    {}
  );
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

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

  async function syncCatalog(providerId: string) {
    setSyncing((current) => ({ ...current, [providerId]: true }));
    try {
      const response = await api.post<{ modelCount: number }>(`/admin/providers/${providerId}/models/sync`, {});
      await onChange(`Synced ${response.modelCount} models.`);
    } catch (error) {
      await onChange(error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed.");
    } finally {
      setSyncing((current) => ({ ...current, [providerId]: false }));
    }
  }

  async function syncAllCatalogs() {
    setSyncing((current) => ({ ...current, all: true }));
    try {
      const response = await api.post<{ results: Array<{ providerId: string; modelCount?: number; error?: string }> }>("/admin/provider-catalog/sync-all", {});
      const synced = response.results.filter((result) => result.modelCount !== undefined).length;
      const failed = response.results.length - synced;
      await onChange(failed > 0 ? `Synced ${synced} providers. ${failed} failed.` : `Synced ${synced} providers.`);
    } catch (error) {
      await onChange(error instanceof Error ? `Sync all failed: ${error.message}` : "Sync all failed.");
    } finally {
      setSyncing((current) => ({ ...current, all: false }));
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
    <section className="grid">
      <div className="card">
        <h2>Providers</h2>
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
        <div className="list">
          {providerKeys.map((key) => (
            <article key={key.id}>
              <strong>{key.name}</strong>
              <small>{providers.find((provider) => provider.id === key.provider_id)?.name ?? key.provider_id}</small>
              <button className="secondary" onClick={() => api.patch(`/admin/provider-keys/${key.id}`, { enabled: key.enabled !== 1 }).then(() => onChange("Provider key toggled."))}>
                {key.enabled === 1 ? "Disable" : "Enable"}
              </button>
              <button className="danger" onClick={() => api.delete(`/admin/provider-keys/${key.id}`).then(() => onChange("Provider key deleted."))}>
                Delete
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="card catalog-card">
        <div className="toolbar">
          <div>
            <h2>Model Catalog</h2>
            <p className="hint">Configure OpenRouter mapping, then sync models into the local D1 catalog.</p>
          </div>
          <button type="button" className="secondary" onClick={() => void syncAllCatalogs()} disabled={syncing.all}>
            {syncing.all ? "Syncing..." : "Sync all from OpenRouter"}
          </button>
        </div>
        <div className="catalog-list">
          {providerCatalog.map((provider) => {
            const draft = catalogDrafts[provider.id] ?? provider;
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
                  {provider.modelCount} synced models
                  {provider.modelsSyncedAt ? `, last synced ${formatDate(provider.modelsSyncedAt)}` : ""}
                </small>
                <button type="button" className="secondary" onClick={() => void saveCatalog(provider.id)}>
                  Save mapping
                </button>
                <button
                  type="button"
                  onClick={() => void syncCatalog(provider.id)}
                  disabled={syncing[provider.id] || !provider.syncEnabled}
                  title={provider.syncEnabled ? "Fetch models from OpenRouter" : "Add authors or providers mapping first"}
                >
                  {syncing[provider.id] ? "Syncing..." : "Sync"}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RoutesPanel({
  api,
  providers,
  routes,
  entries,
  onChange
}: {
  api: Api;
  providers: Provider[];
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
  const [draftEntries, setDraftEntries] = useState<Array<{ providerId: string; upstreamModel: string }>>([]);
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
    setDraftEntries(selectedEntries.map((entry) => ({ providerId: entry.provider_id, upstreamModel: entry.upstream_model })));
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
    setDraftEntries(updateAt(draftEntries, index, { providerId, upstreamModel: "" }));
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
      <p className="hint">Upstream models come from the live provider API when a key is available, otherwise from the synced catalog. Choose Other to type a custom model ID.</p>
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
            <button className="danger" onClick={() => setDraftEntries(draftEntries.filter((_, i) => i !== index))}>
              Remove
            </button>
          </article>
        ))}
      </div>
      <div className="toolbar">
        <button className="secondary" onClick={() => setDraftEntries([...draftEntries, { providerId: "", upstreamModel: "" }])}>
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
        <select
          value={selectValue}
          disabled={loading && models.length === 0}
          onChange={(event) => {
            const value = event.target.value;
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
        >
          <option value="">{loading ? "Loading models..." : "Select upstream model"}</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value={CUSTOM_MODEL_VALUE}>Other (type manually)...</option>
        </select>
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
      {!loading && modelState?.source === "cached" && !modelState.error && <small className="model-hint">Synced from OpenRouter catalog</small>}
    </div>
  );
}

function ClientKeysPanel({
  api,
  keys,
  generatedSecret,
  setGeneratedSecret,
  onChange
}: {
  api: Api;
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
            <button className="danger" onClick={() => api.delete(`/admin/client-keys/${key.id}`).then(() => onChange("Client key deleted."))}>
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
