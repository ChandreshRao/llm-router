ALTER TABLE providers ADD COLUMN open_router_authors TEXT;
ALTER TABLE providers ADD COLUMN open_router_providers TEXT;
ALTER TABLE providers ADD COLUMN strip_open_router_prefix TEXT;
ALTER TABLE providers ADD COLUMN models_synced_at TEXT;

CREATE TABLE IF NOT EXISTS provider_models (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  PRIMARY KEY (provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id);
