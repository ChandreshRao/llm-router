import { useCallback, useEffect, useMemo, useState } from "react";
import type { Api } from "../api";
import { UpstreamModelField } from "../components/UpstreamModelField";
import type { Provider, ProviderKey, ProviderModelSource, ProviderModelsState, Route, RouteEntry } from "../types";
import { move, updateAt } from "../utils";

export function RoutesPanel({
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
    () =>
      selectedEntries
        .map(
          (entry) =>
            `${entry.id}:${entry.provider_id}:${entry.provider_key_id ?? ""}:${entry.upstream_model}:${entry.position}`
        )
        .join("|"),
    [selectedEntries]
  );
  const [name, setName] = useState(selectedRoute?.name ?? "default");
  const [draftEntries, setDraftEntries] = useState<Array<{ providerId: string; providerKeyId: string; upstreamModel: string }>>([]);
  const [modelLists, setModelLists] = useState<Record<string, ProviderModelsState>>({});
  const [customModelRows, setCustomModelRows] = useState<Set<number>>(new Set());

  const loadModels = useCallback(
    async (providerId: string, mergeUpstream = false) => {
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
        const path = mergeUpstream
          ? `/admin/providers/${providerId}/models?mergeUpstream=1`
          : `/admin/providers/${providerId}/models`;
        const data = await api.get<{
          models: string[];
          source: ProviderModelSource;
          error: string | null;
          addedCount?: number;
        }>(path);
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
    try {
      if (selectedRoute) {
        await api.put(`/admin/routes/${selectedRoute.id}`, payload);
      } else {
        await api.post("/admin/routes", payload);
      }
      await onChange("Route saved.");
    } catch (error) {
      await onChange(error instanceof Error ? error.message : "Failed to save route.");
    }
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
      <p className="hint">
        Model list uses your curated catalog when populated. Use ↻ to fetch upstream models and add any missing IDs to the catalog. Only enabled provider keys
        can be pinned.
      </p>
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
                .filter((key) => key.provider_id === entry.providerId && key.enabled === 1)
                .map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                  </option>
                ))}
            </select>
            <UpstreamModelField
              providerId={entry.providerId}
              upstreamModel={entry.upstreamModel}
              modelState={entry.providerId ? modelLists[entry.providerId] : undefined}
              forceCustom={customModelRows.has(index)}
              onReload={() => void loadModels(entry.providerId, true)}
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
