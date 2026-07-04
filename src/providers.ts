export type ProviderModelsCatalog = {
  /** OpenRouter catalog filter: hosting provider slugs, e.g. "openai,groq". */
  openRouterProviders?: string;
  /** OpenRouter catalog filter: model author slugs, e.g. "anthropic,openai". */
  openRouterAuthors?: string;
  /** When using the OpenRouter catalog for a direct (non-OpenRouter) provider, strip this prefix from ids. */
  stripOpenRouterPrefix?: string;
};

export type ProviderCatalogColumns = {
  open_router_authors: string | null;
  open_router_providers: string | null;
  strip_open_router_prefix: string | null;
};

export const providerDefaults = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    exampleModel: "gpt-4o-mini",
    modelsCatalog: {
      openRouterAuthors: "openai",
      stripOpenRouterPrefix: "openai/"
    }
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    exampleModel: "llama-3.1-8b-instant",
    modelsCatalog: {
      openRouterProviders: "groq"
    }
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    exampleModel: "meta-llama/llama-3.1-8b-instruct:free"
  },
  {
    id: "github-models",
    name: "GitHub Models",
    baseUrl: "https://models.github.ai/inference",
    exampleModel: "openai/gpt-4o-mini"
  },
  {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    exampleModel: "gemini-2.0-flash",
    modelsCatalog: {
      openRouterAuthors: "google",
      stripOpenRouterPrefix: "google/"
    }
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    exampleModel: "claude-3-5-haiku-latest",
    modelsCatalog: {
      openRouterAuthors: "anthropic"
    }
  }
] as const;

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export function getProviderCatalog(providerId: string): ProviderModelsCatalog | null {
  const preset = providerDefaults.find((item) => item.id === providerId);
  if (!preset || !("modelsCatalog" in preset)) {
    return null;
  }
  return preset.modelsCatalog;
}

export function resolveProviderCatalog(
  providerId: string,
  row?: Partial<ProviderCatalogColumns> | null
): ProviderModelsCatalog | null {
  const defaults = getProviderCatalog(providerId) ?? {};
  const catalog = {
    openRouterAuthors:
      row?.open_router_authors === null || row?.open_router_authors === undefined
        ? defaults.openRouterAuthors
        : normalizeCatalogValue(row.open_router_authors),
    openRouterProviders:
      row?.open_router_providers === null || row?.open_router_providers === undefined
        ? defaults.openRouterProviders
        : normalizeCatalogValue(row.open_router_providers),
    stripOpenRouterPrefix:
      row?.strip_open_router_prefix === null || row?.strip_open_router_prefix === undefined
        ? defaults.stripOpenRouterPrefix
        : normalizeCatalogValue(row.strip_open_router_prefix)
  };

  if (!catalog.openRouterAuthors && !catalog.openRouterProviders && !catalog.stripOpenRouterPrefix) {
    return null;
  }

  return catalog;
}

export function isOpenRouterProvider(providerId: string): boolean {
  return providerId === "openrouter";
}

export { OPENROUTER_MODELS_URL };

function normalizeCatalogValue(value: string): string | undefined {
  return value.trim() || undefined;
}
