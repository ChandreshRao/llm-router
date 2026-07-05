import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addClientDailyTokens, consumeClientQuotas } from "../../src/client-quotas.ts";
import type { Env } from "../../src/types.ts";

function makeEnv(store: Map<string, string>): Env {
  return {
    COOLDOWNS: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      }
    } as KVNamespace,
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    ADMIN_TOKEN: "admin",
    ENCRYPTION_KEY: "secret"
  };
}

describe("consumeClientQuotas", () => {
  it("allows requests when limits are unset", async () => {
    const env = makeEnv(new Map());
    const result = await consumeClientQuotas(env, { id: "ckey_1", rpm_limit: null, daily_token_limit: null });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects when RPM limit is reached", async () => {
    const store = new Map<string, string>();
    const env = makeEnv(store);
    const key = { id: "ckey_1", rpm_limit: 2, daily_token_limit: null };

    assert.equal((await consumeClientQuotas(env, key)).ok, true);
    assert.equal((await consumeClientQuotas(env, key)).ok, true);
    const result = await consumeClientQuotas(env, key);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 429);
    }
  });

  it("rejects when daily token limit is reached", async () => {
    const store = new Map<string, string>();
    const env = makeEnv(store);
    await addClientDailyTokens(env, "ckey_1", 500);

    const result = await consumeClientQuotas(env, { id: "ckey_1", rpm_limit: null, daily_token_limit: 500 });
    assert.equal(result.ok, false);
  });
});
