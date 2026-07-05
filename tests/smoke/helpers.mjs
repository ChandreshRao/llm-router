export function createSmokeRunner(label) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function pass(name, detail) {
    passed += 1;
    console.log(`OK   ${name}${detail ? ` — ${detail}` : ""}`);
  }

  function fail(name, detail) {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }

  function skip(name, detail) {
    skipped += 1;
    console.log(`SKIP ${name}${detail ? ` — ${detail}` : ""}`);
  }

  async function run(name, fn) {
    try {
      const detail = await fn();
      pass(name, detail);
    } catch (error) {
      fail(name, error instanceof Error ? error.message : String(error));
    }
  }

  function finish() {
    console.log("");
    console.log(`${label} results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    if (failed > 0) {
      process.exitCode = 1;
    }
    return { passed, failed, skipped };
  }

  return { pass, fail, skip, run, finish };
}

export async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
