import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStatsWindow, readBoundedLimit, statsWindowCutoff } from "../../src/query-params.ts";

describe("parseStatsWindow", () => {
  it("defaults to 24h", () => {
    assert.equal(parseStatsWindow(undefined), "24h");
    assert.equal(parseStatsWindow("bad"), "24h");
  });

  it("accepts supported windows", () => {
    assert.equal(parseStatsWindow("7d"), "7d");
    assert.equal(parseStatsWindow("30d"), "30d");
    assert.equal(parseStatsWindow("all"), "all");
  });
});

describe("readBoundedLimit", () => {
  it("caps values at the maximum", () => {
    assert.equal(readBoundedLimit("999", 100, 500), 500);
  });

  it("falls back for invalid values", () => {
    assert.equal(readBoundedLimit(undefined, 100, 500), 100);
    assert.equal(readBoundedLimit("-1", 100, 500), 100);
  });
});

describe("statsWindowCutoff", () => {
  it("returns null for all-time windows", () => {
    assert.equal(statsWindowCutoff("all"), null);
  });

  it("returns an ISO timestamp for bounded windows", () => {
    const cutoff = statsWindowCutoff("24h");
    assert.ok(cutoff);
    assert.doesNotThrow(() => new Date(cutoff!).toISOString());
  });
});
