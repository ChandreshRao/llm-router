import { Hono } from "hono";
import { cors } from "hono/cors";
import { authenticateClient } from "./auth";
import { createAdminApi } from "./admin-api";
import { handleChatCompletions } from "./router";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type", "http-referer", "x-title"],
    allowMethods: ["POST", "OPTIONS"]
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/admin", createAdminApi());

app.post("/v1/chat/completions", async (c) => {
  const authResponse = await authenticateClient(c);
  if (authResponse) {
    return authResponse;
  }

  return handleChatCompletions(c.req.raw, c.env, c.executionCtx, c.get("clientKeyId") ?? null);
});

app.all("/v1/*", (c) => c.json({ error: "Unsupported OpenAI-compatible endpoint" }, 404));

app.get("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
