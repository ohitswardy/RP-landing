# Regis Partners — API (Laravel 12 + MySQL)

The backend for the Regis Partners CMS (`/cms`) and client research portal (`/portal`).
Token auth via Laravel Sanctum; role-based access control is custom (roles ⇄ permissions pivot).

## Run it

```bash
# 1. MySQL (XAMPP) must be running, with a `regisph` database:
#    CREATE DATABASE regisph CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 2. First time only
composer install
cp .env.example .env          # already configured for XAMPP MySQL (root, no password)
php artisan key:generate
php artisan migrate --seed

# 3. Serve
php artisan serve             # http://127.0.0.1:8000
```

The Vite dev server (`web/`) proxies `/api/*` to `127.0.0.1:8000`, so run both and the
frontend needs no extra configuration.

`FRONTEND_URL` in `.env` (default `http://localhost:5173`) is the origin the onboarding
links emailed to clients are built against. Point it at the real site before going live,
or clients will receive links to localhost.

## Seeded accounts

All seeded passwords are `password`.

| Kind   | Email                        | Role          |
|--------|------------------------------|---------------|
| Staff  | e.dagal@regis.ph             | Administrator |
| Staff  | r.chu@regis.ph               | Editor        |
| Staff  | c.sy@regis.ph                | Editor        |
| Staff  | p.garcia@regis.ph            | Analyst       |
| Staff  | c.resullar@regis.ph          | Analyst       |
| Staff  | m.salvador@regis.ph          | Editor (suspended) |
| Client | k.villaruel@arqcapital.ph    | ARQ Capital (approved) |
| Client | mdizon@lakefieldam.com       | Lakefield Asset Mgmt (approved) |
| Client | thea.abalos@sunwardpensions.ph | Sunward Pensions (approved) |
| Client | r.ocampo@bataancapital.ph    | Bataan Capital (invited, mid-onboarding) |
| Client | i.sarmiento@calderonpartners.com | Calderon Partners (awaiting approval) |

Clients sign in with their Regis-issued user id (`kvillaruel`, `mdizon`, `tabalos`) or their
email address. Staff sign in with email.

## Portal-client onboarding

Accounts for the research portal are provisioned by an administrator, completed by the
client, and then approved. `users.status` tracks where an account sits:

| Status | Meaning | Can sign in |
|--------|---------|-------------|
| `invited` | Provisioned. A create-password link was issued; the client has not used it. | No |
| `pending` | The client completed registration. Waiting on an administrator. | No |
| `approved` | Live mandate. | Yes |
| `declined` | Application refused. | No |

The flow, driven from **CMS → Users & access**:

1. **Registered email template** provisions the account and issues a single-use
   registration link (14 days). The tab composes the outbound email, which the
   administrator copies into their mail client. Nothing is dispatched by the system.
2. The client opens `/portal/register/{token}`, confirms their details, and sets a
   password. The account moves to `pending` and the link is spent.
3. **User creation approval** shows the queue. Approving flips the account to `approved`
   and unlocks sign-in; the tab has ready-to-copy acknowledgement and approval emails.
4. **Forgot password** issues a reset link (`/portal/reset/{token}`) with its own email
   template, or sets a password directly. Either route signs the client out everywhere.

One-time links live in `portal_tokens`. Issuing a new link of the same purpose retires the
previous unused one, and every link is single-use and expiring.

## RBAC model

- `users.kind` is `staff` (CMS) or `client` (portal). Staff carry a `role_id`; clients carry a `firm`.
- `roles` ⇄ `permissions` through `permission_role`. Permission keys map 1:1 to CMS modules
  (`insights.manage`, `reports.manage`, …, `access.manage`).
- The `Administrator` role is a system role: it always holds every permission and cannot be deleted.
- Guards: you cannot suspend or delete your own account, and no change may leave the system
  without at least one active account holding `access.manage`.
- Every mutation writes an `audit_entries` row attributed to the signed-in user.
- Client portal consumption (report views, downloads, clicks) lands in `client_activities`, an
  append-only ledger. Each row is sealed with an HMAC-SHA256 over its payload plus the previous
  row's hash (keyed by `APP_KEY`), so `GET /api/cms/client-logs/verify` can prove the trail was
  never edited — and name the first altered row if it was. The CMS module is gated by `logs.view`.

## Endpoints (all JSON, `Authorization: Bearer <token>`)

| Area | Routes |
|------|--------|
| Auth | `POST /api/cms/login`, `POST /api/portal/login`, `POST /api/logout`, `GET /api/me` |
| CMS bootstrap | `GET /api/cms/bootstrap` (all collections in one round-trip) |
| Insights | `POST/PUT/DELETE /api/cms/articles[/{id}]` |
| Reports | `POST /api/cms/reports` (multipart PDF), `PUT /api/cms/reports/{id}`, `DELETE …` |
| People | `POST/PUT/DELETE /api/cms/people[/{id}]`, `PUT /api/cms/people/reorder`, `POST /api/cms/people/upload` (multipart portrait) |
| About page copy | `PUT /api/cms/about-page` (full document; gated by `people.manage`) |
| Services | `PUT /api/cms/services/{id}`, `PUT /api/cms/services/page`, `PUT /api/cms/services/reorder`, `POST /api/cms/services/upload` (multipart image) |
| Careers | `POST/PUT/DELETE /api/cms/careers[/{id}]` |
| Market ribbon | `POST/PUT/DELETE /api/cms/watchlist[/{id}]`, `PUT /api/cms/watchlist/reorder` |
| Newsletter | `DELETE /api/cms/subscribers/{id}` |
| Page copy | `PUT /api/cms/pages/{id}` |
| Users & access | `GET /api/cms/access`, `POST/PUT/DELETE /api/cms/users[/{id}]`, `POST/PUT/DELETE /api/cms/roles[/{id}]` |
| Client onboarding | `POST /api/cms/portal-clients`, then `{id}/invite-link`, `{id}/approve`, `{id}/decline`, `{id}/reset-link`, `PUT {id}/password`, `PUT {id}/username` |
| Onboarding links (public) | `GET/POST /api/portal/register/{token}`, `GET/POST /api/portal/reset/{token}` |
| Portal | `GET /api/portal/reports`, `GET/PUT/DELETE /api/portal/bookmarks[/{reportId}]`, `POST /api/portal/activity` (consumption beacon) |
| Client logs | `GET /api/cms/client-logs` (filter/sort/paginate), `GET …/export` (`?format=xlsx` or CSV), `GET …/verify` (hash-chain integrity) |
| PDFs | `GET /api/reports/{id}/file` (streams; staff or client token) |
| Site content (public) | `GET /api/content/services` (published /services copy and photos), `GET /api/content/people` (published About roster), `GET /api/content/about` (About copy + roster in one round-trip) |
| Uploaded images (public) | `GET /api/media/{path}` (streams from the `site/` uploads folder) |

Every CMS route is wrapped in `auth:sanctum` + `staff` middleware plus a `permission:{key}`
check, so the API enforces the same matrix the sidebar shows. Uploaded report PDFs live on
the local disk (`storage/app/private/reports`); seeded catalog reports point at the public
sample PDF served by the web app.
