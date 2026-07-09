# Frontend for the Server Monitoring Platform

## Context

The backend (`server/`) is a working multi-tenant **API-observability and alerting platform**: tenants ("Clients") send API-hit telemetry (service, endpoint, method, status, latency) through an API key into a RabbitMQ pipeline that lands raw events in MongoDB and hourly rollups in Postgres; an analytics module serves aggregate stats/timeseries/top-endpoints/raw-logs/CSV-export off that data; an alerting module lets tenants define threshold or digest rules that a standalone worker evaluates every 60s and dispatches to email/webhook/Slack/Discord. None of this is reachable except via raw HTTP calls today — there is no frontend in the repo. The goal of this effort is to design and build a production-grade Next.js dashboard for it, acting as the product/UX layer over the existing API surface, plus two small backend additions needed to support a coherent product experience (a cross-rule incident feed, and a client suspend/activate control) that the user explicitly approved adding.

Two architectural decisions were confirmed with the user up front: use **TanStack Query** for client-side data fetching/caching/polling (not a bare-fetch/Server-Components-only approach), and **patch the two identified backend gaps now** rather than working around them in the UI (SMS notification delivery is explicitly out of scope — no third-party provider has been chosen — so it stays a disabled "coming soon" option in the channel picker).

Research basis (already completed via 4 parallel deep-dive explorations): full endpoint inventories for `auth`, `client`, `analytics`, `alerting`, `ingest`, `processor`; the auth/RBAC model; the AMQP pipeline; and a reviewed technical-architecture proposal for the Next.js app. Two real backend quirks were found and are **intentionally left alone** (out of scope, noted for the backend owner, not touched by this plan): the `onboard-super-admin` endpoint doesn't actually enforce a true singleton (only email-uniqueness), and `Client.settings.dataRetentionPeriod` isn't wired to the Mongo TTL index (raw logs always expire at a hardcoded 30 days regardless of the configured value) — Settings UI should present retention as informational, not a live control, until that's fixed.

**Deviation from the plan as executed:** the frontend was scaffolded at `/home/nishant/BACKEND/server_monitoring_frontend` (a fully separate sibling project/repo, its own git init) rather than the `web/` directory inside this repo described below — the user redirected this mid-build. Everything else in this document (architecture, API contracts, folder layout *within* the frontend project) applies unchanged; only the top-level location differs.

---

## Product analysis

### Roles & what they see
Three roles share one app, gated by role + 6 boolean permission flags (`canCreateApiKeys, canManageUsers, canViewRawLogs, canViewAnalytics, canManageSettings, canExportData`):
- **super_admin** — platform operator. Manages tenants (Clients), can drill into any tenant's analytics/alerts/team/keys as if they were its admin (backend's `AuthorizationUtils` bypasses all clientId/permission checks for this role).
- **client_admin** — full control within their own tenant: analytics, alerts (read/write), team, API keys, tenant settings (partially — see below).
- **client_user** — read-only within their tenant, scoped further by their specific permission flags (defaults: `canViewRawLogs` + `canViewAnalytics` only). Notably, alert **rules** are readable by `client_user` (GET routes allow all three roles) but only **mutable** by `client_admin`/`super_admin` — the UI must render Alerts as read-only (no create/edit/delete/enable/disable controls) for plain client_user.
- A quirk worth designing around: `PATCH /api/v1/admin/clients/:clientId` (tenant name/email/website/description/settings) is **super_admin only** at the route level — `canManageSettings` doesn't actually unlock it for a client_admin. The tenant-metadata section of Settings should render read-only ("contact your platform admin to change this") for client_admin, while password/security stays self-service for everyone.

### Suggested product improvements
Included directly in the v1 information architecture below (cheap, high-value, and squarely within what the backend already supports):
- **A real dashboard home** (KPI cards + trend + top failing endpoints + recent incidents) instead of dropping users straight into raw analytics tables.
- **In-app incident feed + notification bell**, powered by the new cross-rule incidents endpoint — today the backend only exposes fired-alert history per rule, which is unusable as a "what's on fire right now" view.
- **Client switcher** for super_admin (searchable combobox), since they operate across many tenants.
- **One-time API key reveal flow with an integration snippet** (curl example using the just-created key) shown right after creating a key — this is the single highest-leverage activation improvement given the backend never returns the secret again.
- **Empty states with a getting-started checklist** ("create an API key → send your first event") for a tenant with zero ingested hits, instead of a blank chart.
- **A real permission-matrix editor** (labeled toggle groups, not 6 raw checkboxes) for managing client_user/client_admin permissions.
- **Alert quick-templates** (e.g., "Notify if error rate > 5%", "Notify if traffic goes silent for 15 min") that prefill the condition builder, since conditions are just three optional numeric fields with no self-explanatory UI otherwise.

Explicitly **out of scope / backlog**, flagged but not built (no backend support exists, and building the backend for these is a materially bigger effort than this pass):
- Audit log of admin actions (who revoked a key, who changed a permission).
- Billing/usage/plan tiers.
- Real SMS delivery (needs a third-party provider decision).
- Fixing the two known backend quirks noted in Context.

---

## Application flow & page hierarchy

Single Next.js app, one role-aware navigation shell, tenant-scoped routes parameterized by `clientId`. No public self-service signup exists in the backend (`/auth/register` requires an existing super_admin caller) — the only unauthenticated entry points are Login and the one-time bootstrap page.

**Unauthenticated**
- `/login` — email/password → on success, route by `user.role`: `super_admin` → `/clients`, else → `/overview`.
- `/setup` — one-time super-admin bootstrap form (linked from the login page as "First-time setup"), calls `onboard-super-admin`.

**Authenticated shell** (sidebar + topbar; nav items conditionally rendered by role/permission)
- `/clients` *(super_admin only)* — tenant management table: name, slug, status, created date. Row → tenant detail. "+ New Client" → `/clients/new`. Inline suspend/activate action (new endpoint).
- `/clients/new` *(super_admin only)* — onboarding form (name/email/website/description); on success, prompts "create the first API key now?" as an immediate next step.
- `/overview` — dashboard home for the current tenant context: KPI cards (hits, error rate, avg latency, unique endpoints) over a selectable range, error-rate trend, top-5 failing endpoints, latest incidents, empty state if no data yet. (For super_admin, this is the page they land on after picking a client from `/clients`.)
- `/analytics` — timeseries chart (filterable by service), and Top-by-Hits/Errors/Latency tables side by side; rows link into drilldown.
- `/analytics/endpoint?serviceName=&endpoint=&method=` — focused hourly chart for one endpoint. Query-params, not path segments, because `endpoint` strings can contain slashes (e.g. `/users/:id`) which would break a path-segment route.
- `/logs` — filterable, cursor-paginated raw-hit table (service/endpoint/method/status/date-range); row → detail slide-over; "Export CSV" (gated `canExportData`) streams `/analytics/export`. Gated `canViewRawLogs`.
- `/alerts` — rule list: name, type, enabled switch, channel icons, last fired. Create/edit/delete/enable-disable gated to super_admin/client_admin; client_user sees read-only rows.
- `/alerts/new`, `/alerts/[alertId]/edit` — rule form: name/description, alertType, condition builder (error-rate/avg-latency/min-hits thresholds + lookback/cooldown) for threshold/custom types, channel picker (email/webhook/slack/discord enabled; sms shown disabled "coming soon"), quick-templates.
- `/alerts/[alertId]` — rule detail + its fire-history timeline (existing per-rule history endpoint).
- `/incidents` — **new**: chronological cross-rule fired-alert feed for the tenant (rule name + reasons + stats snapshot + channels notified), backed by the new incidents endpoint. This is what the notification bell previews.
- `/team` *(gated `canManageUsers`)* — users in this tenant: username/email/role/status/permissions. Create user, edit permissions (matrix editor), activate/deactivate.
- `/api-keys` *(gated `canCreateApiKeys`)* — keys table (name/keyId/environment/status/expiry). Create → one-time secret reveal + copy + integration snippet. Revoke is a hard delete behind a destructive confirm dialog.
- `/settings` — tenant metadata (super_admin editable, client_admin read-only per the quirk above) + suspend/activate (super_admin) + retention/timezone (informational for retention, per the known TTL mismatch).
- `/profile` — own account: view info, change password. Available to everyone regardless of role.

---

## Design system

- **Aesthetic**: clean, neutral SaaS register (Linear/Vercel-adjacent) — subtle borders over heavy shadows, generous whitespace, `rounded-lg`, restrained type scale.
- **Font**: `next/font` Geist Sans (UI) + Geist Mono (numeric/log/key data: latencies, status codes, API keys) — zero extra dependency, ships with Next.js.
- **Color**: shadcn CSS-variable tokens on a neutral (zinc) base + one accent color; semantic colors for success/warning/destructive/info (active vs suspended, healthy vs error-rate-breached, environment badges). Dark mode via `next-themes` (standard shadcn pairing) — monitoring dashboards are commonly run in dark mode.
- **Components to install (shadcn primitives)**: button, input, textarea, select, checkbox, switch, badge, card, table, dialog, sheet, dropdown-menu, tabs, tooltip, popover, calendar, form, sonner (toasts), skeleton, avatar, separator, alert, command (client-switcher combobox), chart, pagination.
- **Composed/reusable components**: `StatCard`, `TimeRangePicker`, generic `DataTable` (TanStack Table + cursor pager, no client-side re-sort — see below), `EmptyState`, `RequireRole`/`RequirePermission` gates, `ClientSwitcher`, `CopyableSecret` (one-time key reveal), `StatusBadge`/`ChannelIcon`, `AlertConditionBuilder`, `IncidentRow`/`IncidentTimeline` (shared between rule-detail history and the tenant-wide feed), `ConfirmDialog`, `PageHeader`, `AppShell`/`SidebarNav`.

---

## Backend additions (small, approved scope)

### 1. Cross-rule incident feed — `GET /api/v1/alerting/:clientId/incidents`
File: `server/src/modules/alerting/routes/alerting.route.ts`. **Must be registered before** `router.get("/:clientId/:id", ...)` (currently at line 59) since both are 2-segment paths and Express would otherwise route `/clientXYZ/incidents` into the `:id` handler. Same role gate as the other read routes (`SUPER_ADMIN, CLIENT_ADMIN, CLIENT_USER`), reuses `AlertHistoryQueryDTO` for `limit`/`cursor` — new param schema `IncidentsClientParamSchema` (plain `z.string().min(1)` clientId, matching this module's existing convention, not the `client` module's `mongoObjectId` convention).

- **Repo**: add `findByClientId(clientId, limit, cursor?)` to `AlertFireLogBaseRepo`/`alertFireLog.repo.ts`, filtering `alert_fire_logs` by `clientId` only (not `alertId`), sorted + cursor'd on `_id: -1` (mirrors the existing `findByAlertId` pattern exactly — no new compound-cursor scheme), using a single `.populate("alertId", "name")` call to attach each entry's rule name without N+1 queries.
- **Service/Controller**: add `getIncidents` to `IAlertingService`/`AlertingService` (same `canViewAnalytics`-equivalent permission check as `getAlertHistory`) and `AlertingController`, following the existing method shapes exactly.
- New DTO file `incidentFeed.dto.ts`: `IncidentFeedItem { _id, alertId, alertName, clientId, firedAt, reasons, stats, channelsNotified }`.

### 2. Client suspend/activate — `PATCH /:clientId/activate` and `/:clientId/deactivate`
Files: `server/src/modules/client/routes/clientAdmin.route.ts`, `controllers/client.controller.ts`, `services/client.service.ts` (+ `IClientService` contract). Mirrors the existing `setUserActive` pattern exactly: both routes call one controller method (`setClientActive`) that derives the boolean from `req.path.endsWith("/activate")`. Super_admin only. Reuses the existing `clientIdParamSchema` — no new DTO. Service calls `clientRepo.update(clientId, { isActive })` (repo already supports partial updates) and throws `ResourceNotFoundError` if the tenant doesn't exist. `UpdateClientDTO`/the generic `PATCH /:clientId` stay untouched. This closes a real gap: `validateApiKey` middleware already rejects all API keys for `isActive: false` clients, so this genuinely suspends a tenant's ingestion — it just had no way to be toggled.

No DI container changes needed for either addition (both modules' dependency containers already wire the repos/services being extended).

---

## Frontend technical architecture

### Repo placement & topology
New sibling directory `web/` (not `client/` — that name is already the tenant-organization domain term in this backend). Two fully independent apps (own `package.json`, no shared workspace tooling) — a monorepo/workspace would add real setup cost for a 2-app repo with a short, stable list of shapes to duplicate.

### Cross-origin auth — Route Handler reverse proxy (not `next.config` rewrites, not direct cross-origin fetch)
`web/src/app/api/backend/[...path]/route.ts`: one catch-all handler forwarding method/body/`cookie` header to `${BACKEND_INTERNAL_URL}/api/v1/<path>`, streaming the response body straight through (this is what makes the CSV `/analytics/export` endpoint work unmodified) and re-appending every `Set-Cookie` value from the backend response. All browser calls hit relative `/api/backend/...` paths — genuinely same-origin, so the `authToken` cookie's storage/behavior doesn't depend on prod domain topology and no `credentials:'include'`/CORS config is needed for the dashboard's own traffic. Server Components/Route Handlers making their own server-to-server calls go straight to `BACKEND_INTERNAL_URL`, manually forwarding the incoming cookie via `next/headers`.

### Route protection
`web/src/middleware.ts` — presence-only check on the `authToken` cookie (redirect to `/login` if absent); it must **not** attempt to decode the JWT (that needs `JWT_SECRET`, which must never reach the frontend). Real validation happens in `app/(dashboard)/layout.tsx` (Server Component), which calls `GET /auth/profile` and `redirect("/login")` on 401, seeding the TanStack Query cache via hydration so there's no client-side re-fetch/flash. Post-login redirect uses the `user` object already returned by the login response directly (no extra profile round-trip). Fine-grained UI gating (`RequireRole`/`RequirePermission`) reads the cached profile query — this is UX only, the backend's `authorize()`/`AuthorizationUtils` remain the real security boundary.

### TanStack Query
`QueryClientProvider` in a `"use client"` `app/providers.tsx`, one instance per session via `useState`. Split API client: `lib/api/http.client.ts` (browser, hits `/api/backend/...`) and `lib/api/http.server.ts` (marked `server-only`, forwards cookies, hits `BACKEND_INTERNAL_URL` directly) — both parse the `{success,data,errorCode,error}` envelope into a typed result/`ApiError`, and unwrap the double-nested cursor shape (`response.data.data`/`response.data.nextCursor`) once into `{items, nextCursor}` so no call site touches the nesting. Hierarchical query-key factories per resource (`['analytics',clientId,'overview',{range}]`, `['alerts',clientId,'list',{cursor}]`, `['incidents',clientId,{cursor}]`, etc.). `refetchInterval` (paused when `document.hidden`) only on the incidents feed and analytics overview; everything else is one-shot + `invalidateQueries` after mutations.

### Forms & validation
`react-hook-form` + `zod` + `@hookform/resolvers/zod` (what shadcn's `<Form>` is built on — nothing extra). Hand-duplicate small Zod schemas client-side (`lib/validation/*.schema.ts`, ~8 short schemas: login, client onboarding, client-user creation, permissions, API key creation, alert create/update, change password) rather than standing up a shared workspace package — trivial duplication cost vs. real build-tooling cost for a 2-app repo with no other shared code.

### Charts & tables
shadcn's official `chart` component (Recharts under the hood) for timeseries/top-endpoints/drilldown visuals. shadcn data-table pattern (`@tanstack/react-table`) for logs/users/keys/alerts/history/incidents via one generic `components/shared/data-table.tsx`. **No client-side column sorting** on any of these — they're server-side cursor-paginated pages, so re-sorting only the fetched page would misleadingly imply a full-dataset sort the backend doesn't do; keep these to filter inputs + Prev/Next, with cursor state reflected in the URL (bookmarkable, back-button-safe) rather than component-local state. Date-range filtering uses shadcn's `Calendar`+`Popover`.

### Folder structure
```
web/src/
  middleware.ts
  app/
    layout.tsx  providers.tsx  globals.css
    (auth)/layout.tsx  login/page.tsx  setup/page.tsx
    (dashboard)/
      layout.tsx                      # profile fetch + redirect + AppShell
      page.tsx                        # role-based redirect
      clients/page.tsx  new/page.tsx  [clientId]/page.tsx
      overview/page.tsx
      analytics/page.tsx  analytics/endpoint/page.tsx
      logs/page.tsx
      alerts/page.tsx  new/page.tsx  [alertId]/page.tsx
      incidents/page.tsx
      team/page.tsx
      api-keys/page.tsx
      settings/page.tsx
      profile/page.tsx
    api/backend/[...path]/route.ts
  components/
    ui/                               # shadcn primitives
    layout/  clients/  users/  api-keys/  analytics/  alerts/  incidents/  shared/
  lib/
    api/{http.client,http.server,auth,clients,analytics,alerts,incidents}.ts
    hooks/{useAuth,useClients,useUsers,useApiKeys,useAnalytics,useAlerts,useIncidents}.ts
    validation/*.schema.ts
    query-client.ts  utils.ts
  types/{api,domain}.ts
```

### Environment
`web/.env.local`: `BACKEND_INTERNAL_URL=http://localhost:4000` — deliberately **not** `NEXT_PUBLIC_` since it's only read server-side (Route Handler proxy + Server Components), letting the same build promote across environments by changing one var. No frontend env var is needed for an API base URL at all, since the browser only ever calls same-origin `/api/backend/*`. No backend `CORS_ALLOWED_ORIGINS` change needed.

---

## Suggested build order (incremental)

0. Commit this design document itself into the repo at `docs/frontend-plan.md` — done.
1. Backend additions first (incidents endpoint, client activate/deactivate) — small, isolated, testable via curl/existing patterns before any frontend depends on them.
2. Scaffold `web/`: Next.js + Tailwind + shadcn init, the reverse-proxy route, providers, middleware, typed API client + query-key foundations.
3. Auth flow end-to-end: `/setup`, `/login`, dashboard layout guard, profile query, logout.
4. Tenant shell: `/clients` (super_admin), client onboarding, `/team`, `/api-keys` (these unlock the ability to actually generate a working API key and send a test hit end-to-end).
5. `/overview`, `/analytics`, `/analytics/endpoint`, `/logs` (the read-heavy analytics surface — biggest value, no mutations to design around).
6. `/alerts` CRUD + condition builder + channel picker, `/incidents`.
7. `/settings`, `/profile`, polish (empty states, permission-matrix editor, alert templates, dark mode).

## Verification

- Backend additions: run the server (`npm run dev` in `server/`) and hit the two new endpoints directly with curl/Postman using an existing test client + JWT cookie, confirming role gating (client_user forbidden from mutation-shaped ones where applicable), pagination correctness on `/incidents`, and that `isActive:false` on a client actually causes `validateApiKey` to reject that tenant's keys (existing behavior, just confirming the new toggle wires into it).
- Frontend: run `web/` dev server alongside `server/` dev server, walk the golden path in a browser end-to-end — bootstrap super admin → login → create a client → create an API key → send a real curl hit using that key → see it appear in `/overview`/`/logs` → create an alert rule with a low threshold → confirm it fires (worker polls every 60s) and appears in `/incidents` and the configured channel (e.g. a webhook to a local listener). Test the client_user read-only view and the client_admin-vs-super_admin Settings distinction explicitly, since those are role-gating edge cases easy to get wrong.
