import { Hono } from "hono";
import { adminAuth } from "./auth";
import { encryptSecret, makeClientSecret, makeId, sha256Hex } from "./crypto";
import { fetchProviderModels, syncProviderModelsFromOpenRouter } from "./provider-models";
import { isOpenRouterProvider, providerDefaults, resolveProviderCatalog } from "./providers";
import type { ClientKeyRow, Env, ProviderCatalogRow, ProviderRow, RouteEntryRow, RouteRow, Variables } from "./types";

type AdminApp = { Bindings: Env; Variables: Variables };

export function createAdminApi(): Hono<AdminApp> {
  const app = new Hono<AdminApp>();
  app.use("*", adminAuth());

  app.get("/bootstrap", (c) => c.json({ providerDefaults }));

  app.get("/providers", async (c) => {
    const providers = await c.env.DB.prepare(
      `SELECT
        p.id, p.name, p.base_url, p.enabled, p.created_at, p.updated_at,
        COUNT(pk.id) AS key_count
      FROM providers p
      LEFT JOIN provider_keys pk ON pk.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.name`
    ).all<ProviderRow & { key_count: number }>();

    const keys = await c.env.DB.prepare(
      "SELECT id, provider_id, name, enabled, last_used_at, created_at, updated_at FROM provider_keys ORDER BY created_at DESC"
    ).all();

    return c.json({ providers: providers.results ?? [], keys: keys.results ?? [] });
  });

  app.get("/provider-catalog", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT
        p.id, p.name, p.base_url, p.enabled,
        p.open_router_authors, p.open_router_providers, p.strip_open_router_prefix,
        p.models_synced_at, p.created_at, p.updated_at,
        COUNT(pm.model_id) AS model_count
      FROM providers p
      LEFT JOIN provider_models pm ON pm.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.name`
    ).all<ProviderCatalogRow>();

    const providers = (rows.results ?? []).map((provider) => {
      const catalog = resolveProviderCatalog(provider.id, provider);
      return {
        id: provider.id,
        name: provider.name,
        openRouterAuthors: catalog?.openRouterAuthors ?? "",
        openRouterProviders: catalog?.openRouterProviders ?? "",
        stripOpenRouterPrefix: catalog?.stripOpenRouterPrefix ?? "",
        modelCount: provider.model_count,
        modelsSyncedAt: provider.models_synced_at,
        syncEnabled: isOpenRouterProvider(provider.id) || Boolean(catalog?.openRouterAuthors || catalog?.openRouterProviders)
      };
    });

    return c.json({ providers });
  });

  app.post("/providers", async (c) => {
    const body = await c.req.json<{ id?: string; name?: string; baseUrl?: string; enabled?: boolean }>();
    if (!body.name || !body.baseUrl) {
      return c.json({ error: "name and baseUrl are required" }, 400);
    }

    const id = body.id?.trim() || makeId("provider");
    await c.env.DB.prepare(
      `INSERT INTO providers (id, name, base_url, enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url, enabled = excluded.enabled, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
      .bind(id, body.name.trim(), body.baseUrl.trim(), body.enabled === false ? 0 : 1)
      .run();

    return c.json({ id });
  });

  app.patch("/providers/:id", async (c) => {
    const body = await c.req.json<{ name?: string; baseUrl?: string; enabled?: boolean }>();
    await c.env.DB.prepare(
      `UPDATE providers
       SET name = COALESCE(?, name), base_url = COALESCE(?, base_url), enabled = COALESCE(?, enabled), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
      .bind(body.name?.trim() ?? null, body.baseUrl?.trim() ?? null, body.enabled === undefined ? null : body.enabled ? 1 : 0, c.req.param("id"))
      .run();

    return c.json({ ok: true });
  });

  app.patch("/providers/:id/catalog", async (c) => {
    const body = await c.req.json<{
      openRouterAuthors?: string;
      openRouterProviders?: string;
      stripOpenRouterPrefix?: string;
    }>();

    await c.env.DB.prepare(
      `UPDATE providers
       SET open_router_authors = ?, open_router_providers = ?, strip_open_router_prefix = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
      .bind(
        body.openRouterAuthors?.trim() ?? "",
        body.openRouterProviders?.trim() ?? "",
        body.stripOpenRouterPrefix?.trim() ?? "",
        c.req.param("id")
      )
      .run();

    return c.json({ ok: true });
  });

  app.delete("/providers/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM providers WHERE id = ?").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });

  app.get("/providers/:id/models", async (c) => {
    const result = await fetchProviderModels(c.env, c.req.param("id"));
    return c.json(result);
  });

  app.post("/providers/:id/models/sync", async (c) => {
    try {
      return c.json(await syncProviderModelsFromOpenRouter(c.env, c.req.param("id")));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Failed to sync provider models" }, 400);
    }
  });

  app.post("/provider-catalog/sync-all", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT id, open_router_authors, open_router_providers, strip_open_router_prefix
       FROM providers
       ORDER BY name`
    ).all<Pick<ProviderRow, "id" | "open_router_authors" | "open_router_providers" | "strip_open_router_prefix">>();

    const results = [];
    for (const provider of rows.results ?? []) {
      const catalog = resolveProviderCatalog(provider.id, provider);
      if (!isOpenRouterProvider(provider.id) && !catalog?.openRouterAuthors && !catalog?.openRouterProviders) {
        continue;
      }

      try {
        results.push(await syncProviderModelsFromOpenRouter(c.env, provider.id));
      } catch (error) {
        results.push({
          providerId: provider.id,
          error: error instanceof Error ? error.message : "Failed to sync provider models"
        });
      }
    }

    return c.json({ results });
  });

  app.post("/providers/:id/keys", async (c) => {
    const body = await c.req.json<{ name?: string; apiKey?: string; enabled?: boolean }>();
    if (!body.name || !body.apiKey) {
      return c.json({ error: "name and apiKey are required" }, 400);
    }

    const id = makeId("pkey");
    const ciphertext = await encryptSecret(body.apiKey.trim(), c.env.ENCRYPTION_KEY);
    await c.env.DB.prepare(
      "INSERT INTO provider_keys (id, provider_id, name, api_key_ciphertext, enabled) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(id, c.req.param("id"), body.name.trim(), ciphertext, body.enabled === false ? 0 : 1)
      .run();

    return c.json({ id });
  });

  app.patch("/provider-keys/:id", async (c) => {
    const body = await c.req.json<{ name?: string; apiKey?: string; enabled?: boolean }>();
    const ciphertext = body.apiKey ? await encryptSecret(body.apiKey.trim(), c.env.ENCRYPTION_KEY) : null;

    await c.env.DB.prepare(
      `UPDATE provider_keys
       SET name = COALESCE(?, name), api_key_ciphertext = COALESCE(?, api_key_ciphertext), enabled = COALESCE(?, enabled), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
      .bind(body.name?.trim() ?? null, ciphertext, body.enabled === undefined ? null : body.enabled ? 1 : 0, c.req.param("id"))
      .run();

    return c.json({ ok: true });
  });

  app.delete("/provider-keys/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM provider_keys WHERE id = ?").bind(c.req.param("id")).run();
    await c.env.COOLDOWNS.delete(`cooldown:${c.req.param("id")}`);
    return c.json({ ok: true });
  });

  app.get("/routes", async (c) => {
    const routes = await c.env.DB.prepare("SELECT id, name, created_at, updated_at FROM routes ORDER BY name").all<RouteRow>();
    const entries = await c.env.DB.prepare(
      `SELECT
        re.id, re.route_id, re.provider_id, p.name AS provider_name, p.base_url,
        re.upstream_model, re.position
      FROM route_entries re
      JOIN providers p ON p.id = re.provider_id
      ORDER BY re.route_id, re.position`
    ).all<RouteEntryRow>();

    return c.json({ routes: routes.results ?? [], entries: entries.results ?? [] });
  });

  app.post("/routes", async (c) => {
    const body = await c.req.json<{ name?: string; entries?: Array<{ providerId: string; upstreamModel: string }> }>();
    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    const id = makeId("route");
    await saveRoute(c.env, id, body.name.trim(), body.entries ?? []);
    return c.json({ id });
  });

  app.put("/routes/:id", async (c) => {
    const body = await c.req.json<{ name?: string; entries?: Array<{ providerId: string; upstreamModel: string }> }>();
    const id = c.req.param("id");
    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    await saveRoute(c.env, id, body.name.trim(), body.entries ?? []);
    return c.json({ id });
  });

  app.delete("/routes/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM routes WHERE id = ? AND name <> 'default'").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });

  app.get("/client-keys", async (c) => {
    const keys = await c.env.DB.prepare(
      "SELECT id, name, enabled, created_at, last_used_at FROM client_keys ORDER BY created_at DESC"
    ).all<Omit<ClientKeyRow, "key_hash">>();
    return c.json({ keys: keys.results ?? [] });
  });

  app.post("/client-keys", async (c) => {
    const body = await c.req.json<{ name?: string; enabled?: boolean }>();
    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    const id = makeId("ckey");
    const secret = makeClientSecret();
    const keyHash = await sha256Hex(secret);
    await c.env.DB.prepare("INSERT INTO client_keys (id, name, key_hash, enabled) VALUES (?, ?, ?, ?)")
      .bind(id, body.name.trim(), keyHash, body.enabled === false ? 0 : 1)
      .run();

    return c.json({ id, secret });
  });

  app.patch("/client-keys/:id", async (c) => {
    const body = await c.req.json<{ name?: string; enabled?: boolean }>();
    await c.env.DB.prepare("UPDATE client_keys SET name = COALESCE(?, name), enabled = COALESCE(?, enabled) WHERE id = ?")
      .bind(body.name?.trim() ?? null, body.enabled === undefined ? null : body.enabled ? 1 : 0, c.req.param("id"))
      .run();
    return c.json({ ok: true });
  });

  app.delete("/client-keys/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM client_keys WHERE id = ?").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });

  app.get("/usage", async (c) => {
    const limit = readBoundedLimit(c.req.query("limit"), 100, 500);
    const rows = await c.env.DB.prepare(
      `SELECT
        u.*, ck.name AS client_key_name, p.name AS provider_name
      FROM usage_log u
      LEFT JOIN client_keys ck ON ck.id = u.client_key_id
      LEFT JOIN providers p ON p.id = u.provider_id
      ORDER BY u.created_at DESC
      LIMIT ?`
    )
      .bind(limit)
      .all();

    const summary = await c.env.DB.prepare(
      `SELECT
        COUNT(*) AS requests,
        SUM(COALESCE(total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors
      FROM usage_log`
    ).first();

    return c.json({ rows: rows.results ?? [], summary });
  });

  app.get("/cooldowns", async (c) => {
    const listed = await c.env.COOLDOWNS.list({ prefix: "cooldown:" });
    return c.json({ cooldowns: listed.keys });
  });

  return app;
}

function readBoundedLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(limit, max);
}

async function saveRoute(
  env: Env,
  id: string,
  name: string,
  entries: Array<{ providerId: string; upstreamModel: string }>
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO routes (id, name)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(id, name),
    env.DB.prepare("DELETE FROM route_entries WHERE route_id = ?").bind(id),
    ...entries.map((entry, index) =>
      env.DB.prepare("INSERT INTO route_entries (id, route_id, provider_id, upstream_model, position) VALUES (?, ?, ?, ?, ?)")
        .bind(makeId("rent"), id, entry.providerId, entry.upstreamModel, index)
    )
  ]);
}
