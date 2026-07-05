import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortCandidatesByHealth } from "../../src/adaptive-routing.ts";

describe("sortCandidatesByHealth", () => {
  const candidates = [
    {
      provider_id: "openai",
      provider_name: "OpenAI",
      base_url: "https://api.openai.com/v1",
      provider_key_id: "key-openai",
      api_key_ciphertext: "cipher",
      upstream_model: "gpt-4o",
      position: 0
    },
    {
      provider_id: "groq",
      provider_name: "Groq",
      base_url: "https://api.groq.com/openai/v1",
      provider_key_id: "key-groq",
      api_key_ciphertext: "cipher",
      upstream_model: "llama-3.3-70b",
      position: 1
    }
  ];

  it("prefers healthier providers while preserving configured order on ties", () => {
    const sorted = sortCandidatesByHealth(candidates, [
      { providerId: "openai", upstreamModel: "gpt-4o", requests: 10, errors: 5 },
      { providerId: "groq", upstreamModel: "llama-3.3-70b", requests: 10, errors: 1 }
    ]);

    assert.equal(sorted[0]?.provider_id, "groq");
    assert.equal(sorted[1]?.provider_id, "openai");
  });

  it("keeps configured order when health is equal", () => {
    const sorted = sortCandidatesByHealth(candidates, [
      { providerId: "openai", upstreamModel: "gpt-4o", requests: 10, errors: 1 },
      { providerId: "groq", upstreamModel: "llama-3.3-70b", requests: 10, errors: 1 }
    ]);

    assert.equal(sorted[0]?.provider_id, "openai");
    assert.equal(sorted[1]?.provider_id, "groq");
  });
});
