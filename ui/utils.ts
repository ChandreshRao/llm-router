import type { Route, RouteEntry } from "./types";

export function updateAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

export function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
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

export function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function routeNamesUsingProviderKey(keyId: string, routes: Route[], entries: RouteEntry[]): string[] {
  const routeIds = new Set(entries.filter((entry) => entry.provider_key_id === keyId).map((entry) => entry.route_id));
  return routes
    .filter((route) => routeIds.has(route.id))
    .map((route) => route.name)
    .sort();
}

export function providerKeyDeleteMessage(keyName: string, routeNames: string[]): string {
  if (routeNames.length === 0) {
    return `Delete provider key "${keyName}"?`;
  }

  const routeList = routeNames.map((name) => `"${name}"`).join(", ");
  if (routeNames.length === 1) {
    return `Delete provider key "${keyName}"? Route ${routeList} is pinned to this key and will fall back to any enabled key for that provider.`;
  }

  return `Delete provider key "${keyName}"? Routes ${routeList} are pinned to this key and will fall back to any enabled key for that provider.`;
}
