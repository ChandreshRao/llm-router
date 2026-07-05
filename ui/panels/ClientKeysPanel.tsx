import { SubmitEvent, useState } from "react";
import type { Api } from "../api";
import type { ClientKey } from "../types";
import { formatDate } from "../utils";

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

  async function createKey(event: SubmitEvent) {
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
