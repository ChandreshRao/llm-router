import { runGeminiKeySmoke } from "./gemini-key.mjs";
import { runRouterSmoke } from "./router.mjs";

await runRouterSmoke();
console.log("");
await runGeminiKeySmoke();

if (process.exitCode) {
  process.exit(process.exitCode);
}
