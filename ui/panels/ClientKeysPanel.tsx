import { SubmitEvent, useState } from "react";
import type { Api } from "../api";
import type { ClientKey } from "../types";
import { formatDate, formatNumber } from "../utils";

function quotaLabel(value: number | null, suffix: string): string {
  return value != null && value > 0 ? `${formatNumber(value)} ${suffix}` : "Unlimited";
}

export function ClientKeysPanel({
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
  const [rpmLimit, setRpmLimit] = useState("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState("");

  async function createKey(event: SubmitEvent) {
    event.preventDefault();
    const response = await api.post<{ id: string; secret: string }>("/admin/client-keys", {
      name,
      rpmLimit: parseQuotaInput(rpmLimit),
      dailyTokenLimit: parseQuotaInput(dailyTokenLimit)
    });
    setGeneratedSecret(response.secret);
    setName("");
    setRpmLimit("");
    setDailyTokenLimit("");
    await onChange("Client key generated. Store it now; it will not be shown again.");
  }

  async function saveLimits(key: ClientKey, nextRpm: string, nextDailyTokens: string) {
    await api.patch(`/admin/client-keys/${key.id}`, {
      rpmLimit: parseQuotaInput(nextRpm),
      dailyTokenLimit: parseQuotaInput(nextDailyTokens)
    });
    await onChange(`Updated limits for "${key.name}".`);
  }

  return (
    <section className="card">
      <h2>Client Keys</h2>
      <p className="hint">Optional RPM and daily token limits are enforced at the edge using KV counters.</p>
      <form onSubmit={createKey} className="stack compact">
        <div className="toolbar">
          <input required placeholder="Application name" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit">Generate key</button>
        </div>
        <div className="toolbar compact">
          <input
            type="number"
            min="1"
            placeholder="RPM limit (optional)"
            value={rpmLimit}
            onChange={(event) => setRpmLimit(event.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Daily token limit (optional)"
            value={dailyTokenLimit}
            onChange={(event) => setDailyTokenLimit(event.target.value)}
          />
        </div>
      </form>
      {generatedSecret && (
        <pre className="secret">
          <code>{generatedSecret}</code>
        </pre>
      )}
      <div className="list">
        {keys.map((key) => (
          <ClientKeyRow key={key.id} api={api} askConfirm={askConfirm} clientKey={key} onChange={onChange} onSaveLimits={saveLimits} />
        ))}
      </div>
    </section>
  );
}

function ClientKeyRow({
  api,
  askConfirm,
  clientKey,
  onChange,
  onSaveLimits
}: {
  api: Api;
  askConfirm: (message: string) => Promise<boolean>;
  clientKey: ClientKey;
  onChange: (message: string) => Promise<void>;
  onSaveLimits: (key: ClientKey, rpm: string, dailyTokens: string) => Promise<void>;
}) {
  const [rpmLimit, setRpmLimit] = useState(clientKey.rpm_limit?.toString() ?? "");
  const [dailyTokenLimit, setDailyTokenLimit] = useState(clientKey.daily_token_limit?.toString() ?? "");

  return (
    <article className="client-key-row">
      <div>
        <strong>{clientKey.name}</strong>
        <small>
          Created {formatDate(clientKey.created_at)} · RPM {quotaLabel(clientKey.rpm_limit, "req/min")} · Daily tokens{" "}
          {quotaLabel(clientKey.daily_token_limit, "tokens")}
        </small>
      </div>
      <div className="toolbar compact wrap">
        <input
          type="number"
          min="1"
          placeholder="RPM limit"
          value={rpmLimit}
          onChange={(event) => setRpmLimit(event.target.value)}
        />
        <input
          type="number"
          min="1"
          placeholder="Daily token limit"
          value={dailyTokenLimit}
          onChange={(event) => setDailyTokenLimit(event.target.value)}
        />
        <button
          className="secondary"
          onClick={() => {
            void onSaveLimits(clientKey, rpmLimit, dailyTokenLimit);
          }}
        >
          Save limits
        </button>
        <button
          className="secondary"
          onClick={() => api.patch(`/admin/client-keys/${clientKey.id}`, { enabled: clientKey.enabled !== 1 }).then(() => onChange("Client key toggled."))}
        >
          {clientKey.enabled === 1 ? "Disable" : "Enable"}
        </button>
        <button
          className="danger"
          onClick={() => {
            void (async () => {
              if (!(await askConfirm(`Delete client key "${clientKey.name}"?`))) {
                return;
              }
              await api.delete(`/admin/client-keys/${clientKey.id}`);
              await onChange("Client key deleted.");
            })();
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function parseQuotaInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}
