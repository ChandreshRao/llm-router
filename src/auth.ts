import type { Context, MiddlewareHandler } from "hono";
import { constantTimeEqual, sha256Hex } from "./crypto";
import type { ClientKeyRow, Env, Variables } from "./types";

export function adminAuth(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const token = bearerToken(c);
    if (!c.env.ADMIN_TOKEN || !token || !constantTimeEqual(token, c.env.ADMIN_TOKEN)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
}

export async function authenticateClient(c: Context<{ Bindings: Env; Variables: Variables }>): Promise<Response | null> {
  const token = bearerToken(c);
  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const keyHash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    "SELECT id, name, key_hash, enabled, created_at, last_used_at FROM client_keys WHERE key_hash = ?"
  )
    .bind(keyHash)
    .first<ClientKeyRow>();

  if (!row || row.enabled !== 1) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  c.set("clientKeyId", row.id);
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE client_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .bind(row.id)
      .run()
  );

  return null;
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}
