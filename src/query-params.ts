export type StatsWindow = "24h" | "7d" | "30d" | "all";

export function parseStatsWindow(value: string | undefined): StatsWindow {
  return value === "7d" || value === "30d" || value === "all" ? value : "24h";
}

export function statsWindowCutoff(window: StatsWindow): string | null {
  if (window === "all") {
    return null;
  }

  const hours = window === "24h" ? 24 : window === "7d" ? 7 * 24 : 30 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function readBoundedLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(limit, max);
}
