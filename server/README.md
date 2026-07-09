# ServerStats — API Monitoring & Alerting Backend

A multi-tenant backend that ingests API telemetry (hits, latency, status codes) from client
applications, aggregates it for analytics, and evaluates alert rules against it in real time.
Built as a small set of independently deployable services around a message queue, so a burst of
ingest traffic never blocks the write path or the dashboard.

## How it works

A client application sends one event per API call it wants monitored, using a per-client API key.
That write is decoupled from processing: the HTTP layer only validates and publishes to RabbitMQ,
then returns. A separate consumer process does the actual persistence, so ingest stays fast even
if MongoDB or Postgres is briefly slow. A third process polls for alert rules that have crossed
their threshold and dispatches notifications.

![Architecture diagram](docs/architecture.svg)

<sub>Source: [docs/architecture.mmd](docs/architecture.mmd). Regenerate after editing with:
`npx @mermaid-js/mermaid-cli -i docs/architecture.mmd -o docs/architecture.svg -b white --theme neutral`</sub>

### Request/event flow

1. **Ingest** — a client POSTs to `/api/v1/ingest` with an `x-api-key` header. `validateApiKey`
   resolves the key to a client + its write/read permissions, `rateLimiter` throttles per key via
   Redis, and the payload is Zod-validated. The route only publishes an `API_HITS` event to
   RabbitMQ (`eventProducer.publishApiHits`) and returns — it never touches Mongo/Postgres itself.
2. **Consume** — `EventConsumer` (runs in the separate `consumer` container/process) pulls events
   off the queue with `noAck: false` and a configurable prefetch. Each message is deduped through
   a Redis-backed idempotency store, then:
   - the raw hit is written to MongoDB (`apiHits`, TTL set per-client from a cached retention
     setting — see `ClientRetentionCache`),
   - an hourly bucket in Postgres' `endpoint_metrics` is upserted (total hits, error hits, min/max/
     total latency) with a bounded retry.
   Failures are classified as retryable/non-retryable; retryable ones are re-queued with backoff,
   everything else (or exhausted retries) goes to the `_dl` dead-letter queue. A circuit breaker
   trips on repeated failures so the consumer backs off instead of hammering a struggling DB.
3. **Analyze** — the dashboard/API reads aggregated stats from Postgres (`overview`, `top/hits`,
   `top/errors`, `top/latency`, `timeseries`) and raw events from Mongo (`logs`, `endpoint`
   drilldown, CSV `export`).
4. **Alert** — `AlertingWorker` polls on an interval, evaluates each client's alert rules against
   recent metrics, and on a rule firing (outside its cooldown) dispatches through whichever
   channel(s) the rule is configured for — Slack, Discord, email, or a generic webhook — and
   records a fire log entry in Mongo for the incident feed.

## Multi-tenancy & auth

Everything is scoped to a **client** (tenant). A `super_admin` onboards clients and their first
`client_admin`; client admins can then create `client_user` accounts with a granular permission
set (`canCreateApiKeys`, `canManageUsers`, `canViewRawLogs`, `canViewAnalytics`,
`canManageSettings`, `canExportData`). Dashboard auth is a JWT in an httpOnly cookie; ingest auth
is a per-client API key with independent read/write flags, never the JWT.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24, TypeScript (strict) |
| HTTP | Express 5 |
| Message queue | RabbitMQ (amqplib), with a dead-letter queue for poison messages |
| Document store | MongoDB (Mongoose) — clients, users, API keys, alert configs, fire log, audit log, raw API hits |
| Relational store | PostgreSQL (Kysely) — `endpoint_metrics` hourly aggregates |
| Cache / coordination | Redis (ioredis) — rate limiting, client retention TTL cache, consumer idempotency store |
| Validation | Zod |
| Auth | JWT + bcrypt, httpOnly cookies |
| Logging | Winston + express-winston |

## Project layout

```
src/
  index.ts                       # HTTP API entrypoint
  modules/
    auth/                        # login, onboarding, JWT/cookie sessions
    client/                      # tenant + user + API key management
    ingest/                      # POST /ingest — validates + publishes to the queue
    processor/                   # EventConsumer + DLQ consumer (separate entrypoints)
    analytics/                   # overview/top/timeseries/logs/export, reads PG + Mongo
    alerting/                    # alert CRUD API + AlertingWorker (poll/evaluate/dispatch)
    audit/                       # admin action audit log
  shared/
    infra/                       # Mongo/Postgres/Redis/AMQP connections, resilience primitives
    middleware/                  # auth, API key validation, rate limiting, error handling
    config/                      # env schema + validation (fails loudly on boot, not at first use)
```

Each module follows the same shape: `routes → controllers → services → repos`, wired together by
a per-module `*.dependency.ts` container (manual DI, no framework).

## Running it

**Development** (hot reload via nodemon/ts-node, source bind-mounted into the container):
```bash
make up-dev      # docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
make down-dev
```

**Production** (multi-stage build — compiles TypeScript, installs only prod deps, runs the
compiled `dist/` as a non-root user, no source bind-mounts):
```bash
make up          # build + start detached
make up-with-logs
make down
./scripts/deploy.sh   # git pull, rebuild, restart, wait for healthcheck, prune images
```

Both flows bring up Postgres, MongoDB, RabbitMQ, Redis, pgAdmin, `server-api`, and `consumer` via
`docker-compose.yml`. The alerting worker and DLQ consumer (`start:alerting`, `start:dlq`) aren't
wired into compose yet — run them with `npm run dev:alerting` / `dev:dlq` locally, or add a
service block per the existing `consumer` pattern when ready to deploy them.

### npm scripts

| Script | Purpose |
|---|---|
| `dev` / `dev:consumer` / `dev:alerting` / `dev:dlq` | nodemon + ts-node, per entrypoint |
| `build` | `tsc` → `dist/` |
| `start` / `start:consumer` / `start:alerting` / `start:dlq` | run the compiled entrypoint |
| `migrate` / `migrate:down` | Postgres schema migrations (Kysely) |
| `sync-indexes` | sync Mongo indexes to the model definitions |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |

## Configuration

All env vars are parsed and validated once at boot (`shared/config/global.config.ts`) — a
malformed value fails loudly at startup instead of surfacing as a runtime bug later. When
`NODE_ENV=production`, `JWT_SECRET`, `POSTGRES_PASSWORD`, and `API_KEY_HMAC_SECRET` are required
to be real values (no dev fallback). See `.env` for the full list; the main groups are:

- **Core**: `NODE_ENV`, `PORT`, `CORS_ALLOWED_ORIGINS`
- **Postgres / Mongo / Redis / RabbitMQ**: connection strings and credentials
- **Consumer tuning**: prefetch count, upsert retry attempts, idempotency TTL, poison-message
  failure threshold
- **Resilience**: retry strategy (max retries, base/max delay, jitter) and circuit breaker
  (failure threshold, cooldown, half-open probe count) — shared by the consumer's RabbitMQ and DB
  calls
- **Rate limiting**: window + max requests, separate limits for ingest vs auth endpoints

## Health check

`GET /health` checks Mongo, Postgres, RabbitMQ, and Redis in parallel and returns `503` if any of
the first three are down (Redis failing is non-fatal — rate limiting fails open by design). In
production the response omits per-connection detail; non-production environments get the full
breakdown.
