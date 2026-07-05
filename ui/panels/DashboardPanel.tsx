import type { DashboardBreakdown, DashboardStats, StatsWindow } from "../types";
import { formatNumber, formatPercent } from "../utils";

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
          <div key={row.id} className="breakdown-row">
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

export function DashboardPanel({
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
