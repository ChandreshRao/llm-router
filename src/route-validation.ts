export type RouteEntryInput = {
  providerId: string;
  providerKeyId?: string;
  upstreamModel: string;
};

export type ProviderKeyRecord = {
  id: string;
  provider_id: string;
  enabled: number;
};

export function validatePinnedProviderKeys(
  entries: RouteEntryInput[],
  keysById: Map<string, ProviderKeyRecord>
): string | null {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const providerKeyId = entry.providerKeyId?.trim();
    if (!providerKeyId) {
      continue;
    }

    const step = index + 1;
    const key = keysById.get(providerKeyId);
    if (!key) {
      return `Step ${step}: provider key not found`;
    }

    if (key.provider_id !== entry.providerId) {
      return `Step ${step}: provider key "${providerKeyId}" belongs to a different provider`;
    }

    if (key.enabled !== 1) {
      return `Step ${step}: provider key is disabled`;
    }
  }

  return null;
}
