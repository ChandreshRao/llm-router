import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePinnedProviderKeys, type ProviderKeyRecord } from "../../src/route-validation.ts";

const keys = new Map<string, ProviderKeyRecord>([
  ["pkey-openai-1", { id: "pkey-openai-1", provider_id: "openai", enabled: 1 }],
  ["pkey-groq-1", { id: "pkey-groq-1", provider_id: "groq", enabled: 1 }],
  ["pkey-openai-disabled", { id: "pkey-openai-disabled", provider_id: "openai", enabled: 0 }]
]);

describe("validatePinnedProviderKeys", () => {
  it("accepts entries without a pinned key", () => {
    assert.equal(
      validatePinnedProviderKeys([{ providerId: "openai", upstreamModel: "gpt-4o-mini" }], keys),
      null
    );
  });

  it("accepts a valid pinned key for the same provider", () => {
    assert.equal(
      validatePinnedProviderKeys(
        [{ providerId: "openai", providerKeyId: "pkey-openai-1", upstreamModel: "gpt-4o-mini" }],
        keys
      ),
      null
    );
  });

  it("rejects missing keys", () => {
    assert.match(
      validatePinnedProviderKeys(
        [{ providerId: "openai", providerKeyId: "missing", upstreamModel: "gpt-4o-mini" }],
        keys
      ),
      /not found/
    );
  });

  it("rejects keys from another provider", () => {
    assert.match(
      validatePinnedProviderKeys(
        [{ providerId: "openai", providerKeyId: "pkey-groq-1", upstreamModel: "gpt-4o-mini" }],
        keys
      ),
      /different provider/
    );
  });

  it("rejects disabled keys", () => {
    assert.match(
      validatePinnedProviderKeys(
        [{ providerId: "openai", providerKeyId: "pkey-openai-disabled", upstreamModel: "gpt-4o-mini" }],
        keys
      ),
      /disabled/
    );
  });
});
