import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldFallback, readNumber } from "../../src/router-logic.ts";

describe("shouldFallback", () => {
  it("falls back on auth, billing, rate-limit, and server errors", () => {
    for (const status of [401, 402, 403, 408, 409, 429, 500, 503]) {
      assert.equal(shouldFallback(status), true, `expected fallback for ${status}`);
    }
  });

  it("does not fall back on client or success responses", () => {
    for (const status of [200, 400, 404, 422]) {
      assert.equal(shouldFallback(status), false, `did not expect fallback for ${status}`);
    }
  });
});

describe("readNumber", () => {
  it("parses positive numbers", () => {
    assert.equal(readNumber("120", 60), 120);
  });

  it("uses fallback for invalid values", () => {
    assert.equal(readNumber(undefined, 60), 60);
    assert.equal(readNumber("0", 60), 60);
    assert.equal(readNumber("abc", 60), 60);
  });
});
