import { SubmitEvent, useEffect, useMemo, useState } from "react";
import { makeApi } from "./api";
import { ADMIN_TOKEN_KEY, tabs, type Tab } from "./constants";
import { useConfirm } from "./hooks/useConfirm";
import { ClientKeysPanel } from "./panels/ClientKeysPanel";
import { DashboardPanel } from "./panels/DashboardPanel";
import { ProvidersPanel } from "./panels/ProvidersPanel";
import { RoutesPanel } from "./panels/RoutesPanel";
import { UsagePanel } from "./panels/UsagePanel";
import type {
  ClientKey,
  DashboardStats,
  Provider,
  ProviderCatalog,
  ProviderKey,
  Route,
  RouteEntry,
  StatsWindow,
  UsageRow
} from "./types";

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

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

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

  function saveToken(event: SubmitEvent) {
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
