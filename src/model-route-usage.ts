export type RouteModelUsage = {
  routeId: string;
  routeName: string;
};

export function formatModelInUseError(modelId: string, routes: RouteModelUsage[]): string {
  const names = routes.map((route) => route.routeName).sort();
  if (names.length === 1) {
    return `Model "${modelId}" is used by route "${names[0]}". Remove it from the route before deleting.`;
  }

  return `Model "${modelId}" is used by routes: ${names.map((name) => `"${name}"`).join(", ")}. Remove it from those routes before deleting.`;
}

export function formatModelRenamedMessage(modelId: string, newModelId: string, routesUpdated: number): string {
  if (routesUpdated === 0) {
    return `Model renamed to "${newModelId}".`;
  }

  if (routesUpdated === 1) {
    return `Model renamed to "${newModelId}" and 1 route entry was updated.`;
  }

  return `Model renamed from "${modelId}" to "${newModelId}" and ${routesUpdated} route entries were updated.`;
}
