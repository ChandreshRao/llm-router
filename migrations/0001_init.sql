CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  open_router_authors TEXT,
  open_router_providers TEXT,
  strip_open_router_prefix TEXT,
  models_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS route_entries (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_key_id TEXT REFERENCES provider_keys(id) ON DELETE SET NULL,
  upstream_model TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (route_id, position)
);

CREATE TABLE IF NOT EXISTS client_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  client_key_id TEXT REFERENCES client_keys(id) ON DELETE SET NULL,
  route_name TEXT NOT NULL,
  provider_id TEXT,
  provider_key_id TEXT,
  upstream_model TEXT,
  status INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS provider_models (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sync',
  PRIMARY KEY (provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS provider_model_exclusions (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  PRIMARY KEY (provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_route_entries_route ON route_entries(route_id, position);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_client_key ON usage_log(client_key_id);
CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_model_exclusions_provider ON provider_model_exclusions(provider_id);

INSERT OR IGNORE INTO providers (id, name, base_url, enabled) VALUES
  ('openai', 'OpenAI', 'https://api.openai.com/v1', 1),
  ('groq', 'Groq', 'https://api.groq.com/openai/v1', 1),
  ('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 1),
  ('github-models', 'GitHub Models', 'https://models.github.ai/inference', 1),
  ('gemini', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 1),
  ('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', 1);

INSERT OR IGNORE INTO routes (id, name) VALUES ('default', 'default');
