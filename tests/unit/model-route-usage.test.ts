import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatModelInUseError,
  formatModelRenamedMessage
} from "../../src/model-route-usage.ts";

describe("formatModelInUseError", () => {
  it("formats a single route reference", () => {
    assert.match(
      formatModelInUseError("gpt-4o-mini", [{ routeId: "route-1", routeName: "default" }]),
      /route "default"/
    );
  });

  it("formats multiple route references", () => {
    const message = formatModelInUseError("gpt-4o-mini", [
      { routeId: "route-1", routeName: "default" },
      { routeId: "route-2", routeName: "fast" }
    ]);
    assert.match(message, /"default"/);
    assert.match(message, /"fast"/);
  });
});

describe("formatModelRenamedMessage", () => {
  it("reports when no routes were updated", () => {
    assert.equal(formatModelRenamedMessage("old", "new", 0), 'Model renamed to "new".');
  });

  it("reports route entry updates", () => {
    assert.match(formatModelRenamedMessage("old", "new", 2), /2 route entries were updated/);
  });
});
