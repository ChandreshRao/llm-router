# LLM Router — Agent Guidelines

OpenAI-compatible LLM router on **Cloudflare Workers** (Hono) with a **React admin UI**
(Vite), **D1** for config/usage, and **KV** for provider-key cooldowns. These standards
apply to CodeRabbit and any AI coding assistant working in this repo.

## Project layout

| Path | Purpose |
|------|---------|
| `src/` | Worker entry (`index.ts`), routing, auth, crypto, admin API, D1/KV access |
| `ui/` | Admin SPA — panels under `ui/panels/`, shared types in `ui/types.ts` |
| `migrations/` | Numbered D1 SQL migrations (`000N_description.sql`) |
| `tests/unit/` | Pure-logic tests via `node:test` + `tsx` |
| `tests/smoke/` | Live Worker smoke tests (`.mjs`, need running dev server + keys) |
| `wrangler.jsonc` | Worker bindings, vars, assets, D1/KV config |

Keep domain logic in focused modules (`router-logic.ts`, `adaptive-routing.ts`,
`client-quotas.ts`, etc.) rather than growing `router.ts` or `admin-api.ts` further.
`admin-api.ts` is already large — new admin endpoints should prefer extraction into
helpers or sibling modules when the diff would add substantial surface area.

## Runtime constraints (Workers)

- Use **Web Platform APIs** (`crypto.subtle`, `fetch`, `TextEncoder`) — not Node-only
  modules (`fs`, `path`, `node:crypto`) in `src/`.
- Offload non-blocking work (usage logging, quota counters) with `ctx.waitUntil()`; do
  not delay chat completion responses for bookkeeping.
- Preserve **streaming pass-through** for upstream SSE responses; do not buffer full
  streams unless there is a clear, documented reason.
- Bindings and secrets are typed in `Env` (`src/types.ts`); add new bindings to
  `wrangler.jsonc` and `Env` together.

## Dependencies — prefer stdlib, justify additions

Runtime dependencies are intentionally minimal (`hono`, `react`, `react-dom`). Default to:

- **Workers / Web APIs** for crypto, HTTP, and encoding (`src/crypto.ts` is the pattern).
- **`node:test` + `assert`** for unit tests — no test framework packages.

Only add a package if at least one is true:

- Hand-rolling is genuinely error-prone (crypto, complex parsing).
- A maintained package owns ongoing security patches better than we would.
- It is already used elsewhere in the repo for the same class of problem.

**Review guidance:** flag new dependencies for functionality covered in ~20 lines of
straightforward stdlib or Web API code.

## DRY, but abstract only on the third occurrence

- Two similar copies: leave duplicated.
- Three or more, or duplicated **business logic**: extract (e.g. shared validation,
  quota checks, SQL fragments).
- No new interface/factory/strategy unless there are 2+ concrete implementations today
  or a near-certain third. One case → a plain function.

**Review guidance:** name the trigger when suggesting extraction; name the simpler
alternative when flagging premature abstraction.

## File size — soft cap ~500 lines

Prefer splits along domain boundaries (types, handlers, helpers). `admin-api.ts` and
`provider-models.ts` are already at or above the cap — avoid making them larger without
extracting first.

## Simplicity over cleverness

- Straight-line logic; comments explain *why*, not *what*.
- Prefer early returns / guard clauses over nesting deeper than three levels.
- Flag functions mixing unrelated concerns (e.g. SQL + HTTP shaping + crypto in one block).

## D1 and migrations

- Schema changes go in **new numbered migration files** under `migrations/`, not ad-hoc
  DDL in application code.
- Match existing conventions: `TEXT` primary keys, `INTEGER` booleans, ISO timestamps via
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`, foreign keys with explicit `ON DELETE` behavior.
- Type query results with row types from `src/types.ts`; use `.prepare().bind()` — avoid
  string-concatenated SQL with user input.
- After adding a migration, document the local apply command: `npm run db:migrate:local`.

## Security

- **Provider API keys**: encrypt at rest with `encryptSecret` / `decryptSecret`
  (`ENCRYPTION_KEY`); never log or return plaintext keys from admin endpoints except on
  intentional one-time reveal at creation.
- **Client router keys**: store **SHA-256 hashes only** (`sha256Hex`); compare with
  `constantTimeEqual`.
- **Admin API**: gated by `ADMIN_TOKEN` bearer auth; UI stores token in session storage
  only.
- Do not commit secrets (`.dev.vars`, real `database_id` / KV ids in docs are placeholders
  in `wrangler.jsonc` until deploy).

## Testing

| Command | Scope |
|---------|--------|
| `npm run test:unit` | Fast pure-logic tests in `tests/unit/` |
| `npm test` | Unit tests + Gemini integration smoke |
| `npm run test:smoke` | Full smoke suite (requires local Worker) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Vite UI build + typecheck |

- Add unit tests for routing, validation, quota, and parsing logic — not for thin Hono
  wiring unless behavior is non-trivial.
- Unit test imports use explicit `.ts` extensions (see existing tests).
- Smoke tests belong in `tests/smoke/` and should stay optional in CI unless secrets are
  wired up.

## Admin UI

- React 19, plain CSS (`ui/styles.css`) — no component library or CSS framework unless
  explicitly requested.
- Mirror backend shapes in `ui/types.ts`; call admin routes through `ui/api.ts`.
- New panels live under `ui/panels/` and are wired from `ui/App.tsx`.

## CI

GitHub Actions runs: `lint` → `typecheck` → `npm test` → `build` → `wrangler deploy --dry-run`.
Changes should pass all five locally before opening a PR.

PR titles must use [Conventional Commits](https://www.conventionalcommits.org/) prefixes
(`feat:`, `fix:`, `chore:`, etc.); CI enforces this via `.github/workflows/pr-title.yml`.

## Linting

- `npm run lint` — ESLint flat config in `eslint.config.js` (`typescript-eslint`, React
  hooks/refresh rules for `ui/`).
- No Prettier; formatting nits are lower priority than correctness and Workers compatibility.
