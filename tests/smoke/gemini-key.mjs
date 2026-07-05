/**
 * Optional integration test: verify a Gemini API key against the OpenAI-compatible endpoint.
 * Skips when GEMINI_API_KEY is not set (safe for CI).
 */

import { pathToFileURL } from "node:url";
import { createSmokeRunner, readJson } from "./helpers.mjs";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

export async function runGeminiKeySmoke() {
  const { run, skip, finish } = createSmokeRunner("Gemini integration");

  console.log(`Testing Gemini key against ${baseUrl}`);

  if (!apiKey) {
    skip("Gemini chat completion", "set GEMINI_API_KEY to run this integration test");
    finish();
    return;
  }

  await run("Gemini chat completion", async () => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: gemini ok" }]
      })
    });

    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`unexpected response shape: ${JSON.stringify(body)}`);
    }

    const preview = text.trim();
    return `${model}: ${preview.length > 60 ? `${preview.slice(0, 57)}...` : preview}`;
  });

  finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runGeminiKeySmoke();
}
