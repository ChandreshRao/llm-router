import type { UsageRow } from "../types";
import { formatDate } from "../utils";

export function UsagePanel({
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
