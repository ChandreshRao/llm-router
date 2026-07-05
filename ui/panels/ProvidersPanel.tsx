import { SubmitEvent, useEffect, useState } from "react";
import type { Api } from "../api";
import type {
  CachedProviderModel,
  CachedProviderModelsState,
  Provider,
  ProviderCatalog,
  ProviderKey,
  Route,
  RouteEntry
} from "../types";
import { formatDate, providerKeyDeleteMessage, routeNamesUsingProviderKey } from "../utils";

export function ProvidersPanel({
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

  async function addProvider(event: SubmitEvent) {
    event.preventDefault();
    await api.post("/admin/providers", providerForm);
    setProviderForm({ id: "", name: "", baseUrl: "" });
    await onChange("Provider saved.");
  }

  async function addKey(event: SubmitEvent) {
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
      const response = await api.patch<{ message?: string }>(
        `/admin/providers/${providerId}/models/${encodeURIComponent(oldModelId)}`,
        { modelId: newModelId }
      );
      setEditingModels((current) => {
        const next = { ...current };
        delete next[`${providerId}:${oldModelId}`];
        return next;
      });
      await Promise.all([loadCachedModels(providerId), onChange(response.message ?? "Model updated.")]);
    } catch (error) {
      await onChange(error instanceof Error ? `Update failed: ${error.message}` : "Update failed.");
    }
  }

  async function deleteCatalogModel(providerId: string, modelId: string) {
    if (!(await askConfirm(`Delete model "${modelId}" from the catalog? This is blocked if any route still uses the model.`))) {
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
              Sync from OpenRouter at the top to add new models to the catalog. Delete is blocked while a route still uses a model. Renaming updates matching
              route entries automatically.
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
