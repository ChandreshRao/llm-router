// Quick smoke test for a Gemini API key (no router, no extra deps).

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Set GEMINI_API_KEY first.");
  console.error('  PowerShell: $env:GEMINI_API_KEY = "your-key"');
  process.exit(1);
}

const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

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

const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`Gemini request failed (${response.status})`);
  console.error(body ?? "(no JSON body)");
  process.exit(1);
}

const text = body?.choices?.[0]?.message?.content;
if (typeof text !== "string" || !text.trim()) {
  console.error("Unexpected response shape:");
  console.error(body);
  process.exit(1);
}

console.log("Gemini key works.");
console.log(`Model: ${model}`);
console.log(`Reply: ${text.trim()}`);
