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

## Email desk

Blasts (research reports, newsletter issues, ad-hoc notes) are drafted and previewed in
**CMS → Email desk** and leave one of two ways:

- **Send now** — `POST /api/cms/email-blasts/{id}/send`. The API plans the batches, queues a
  `SendEmailBlast` job, and the job sends through **Microsoft Graph** from the staff member's own
  mailbox (`users.outlook_email`), so the mail lands in their Sent Items with Exchange's
  SPF/DKIM standing. Clients and typed addresses ride BCC in batches of ≤500 (Exchange's
  per-message cap); every newsletter subscriber gets a direct message carrying their own
  unsubscribe link. Each batch is a row in `email_deliveries`; a blast with any failed batch
  ends `failed`, and sending it again retries only those batches. Content is frozen once queued.
- **Outlook hand-off** — copy the rendered HTML and BCC list into Outlook, then
  `POST …/{id}/sent` records who sent it. This is the fallback while Graph consent is pending.

Graph is inert until `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, and `MS_GRAPH_CLIENT_SECRET`
are set. The Azure AD app needs the **Mail.Send application permission** with admin consent
for the Regis tenant; restrict it to the desk's mailboxes with an Exchange
`ApplicationAccessPolicy`, and the API additionally refuses any sender outside
`MS_GRAPH_SENDER_DOMAIN`. Queued blasts need a worker: `php artisan queue:work`.

- **Local / Foreign split** — a report blast carries one subject and body; the Local leg gets the
  login-gated portal deep link, the Foreign leg gets the Jefferies link from `external_link`.
- **Distribution lists** (`distribution_lists`) are saved audiences the composer and the
  newsletter blast panel pick from; they are built from the same client/subscriber pool.
- **Rendering** — report and ad-hoc bodies are sanitized (`Html::clean`) on save and set inside
  `resources/views/email/blast.blade.php` (logo, ticker/sector/title, analyst signature, CTA),
  with every field escaped. `POST …/render` returns that exact HTML for the composer preview.
- **Unsubscribe** — `GET /api/newsletter/unsubscribe/{token}` clears `subscribers.verified`.

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
| Landing page | `PUT /api/cms/home-page` (full document; gated by `home.manage`), `POST /api/cms/home/upload` (multipart photo); public read `GET /api/content/home` |
| Insights | `POST/PUT/DELETE /api/cms/articles[/{id}]` |
| Reports | `POST /api/cms/reports` (multipart PDF), `PUT /api/cms/reports/{id}`, `DELETE …` |
| People | `POST/PUT/DELETE /api/cms/people[/{id}]`, `PUT /api/cms/people/reorder`, `POST /api/cms/people/upload` (multipart portrait) |
| About page copy | `PUT /api/cms/about-page` (full document; gated by `people.manage`) |
| Services | `PUT /api/cms/services/{id}`, `PUT /api/cms/services/page`, `PUT /api/cms/services/reorder`, `POST /api/cms/services/upload` (multipart image) |
| Careers | `POST/PUT/DELETE /api/cms/careers[/{id}]` |
| Market ribbon | `POST/PUT/DELETE /api/cms/watchlist[/{id}]`, `PUT /api/cms/watchlist/reorder` |
| Newsletter | `DELETE /api/cms/subscribers/{id}`, `GET /api/newsletter/unsubscribe/{token}` (public, one-click opt-out) |
| Email desk | `GET /api/cms/email-blasts` (ledger + monthly volume), `GET …/audience` (clients, subscribers, lists, dispatch readiness), `GET …/match?report=`, `POST …/render` (preview HTML), `POST/PUT/DELETE /api/cms/email-blasts[/{id}]`, `POST …/{id}/send` (Graph, queued), `GET …/{id}/deliveries`, `POST …/{id}/sent` (Outlook hand-off) |
| Distribution lists | `GET/POST/PUT/DELETE /api/cms/distribution-lists[/{id}]` |
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

## CRMS (`/crms`)

The Client Relationship Management System is a third area of the same app (see
`CRMSmasterplan.md` and `Database.md`). It has no accounts of its own: staff sign in at
`/login/crms` with their CMS account, and only roles holding `crms.access` (seeded to
**Administrator** and **Analyst**; Editors are refused) get in. Every `/api/crms/*` route
sits behind `auth:sanctum` + `staff` + `permission:crms.*` (routes in `routes/crms.php`).

The CRMS reads the legacy schema through its own `crms` database connection
(`config/database.php`, `CRMS_DB_*` in `.env`; defaults to a `crms` database on the same
MySQL server). Every model under `app/Models/Crms` pins that connection.

```bash
# One-time: the crms database beside regisph
#   CREATE DATABASE crms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
php artisan migrate          # creates the legacy tables only where missing, plus the
                             # additive columns/indexes/tables from CRMSmasterplan.md §11.5
php artisan db:seed --class=CrmsConfigSeeder   # template bindings, sector groups, backfills
php artisan db:seed --class=CrmsSeeder         # demo master data only; a no-op once clients exist
```

### Loading the client's dump

The production dump (`crms_latest_0810_2026.sql`, MySQL 8) imports into the `crms` database
with three adjustments, because XAMPP runs MariaDB 10.4:

1. Keep only the live tables — everything except `token`, `distribution_list`, `email_log`,
   `archive_email_log` and `archive_log` (retired per Database.md §8; the legacy `user` table
   stays, read-only, because `interactions.user_id` still references it).
2. Replace `utf8mb4_0900_ai_ci` with `utf8mb4_unicode_ci`.
3. Raise `max_allowed_packet` (the dump has ~1 MB INSERT statements): `SET GLOBAL max_allowed_packet=64M`
   before piping the file through `mysql --max_allowed_packet=64M crms`.

Then `php artisan migrate` adds the additive columns and tables on top of the imported schema, and
`php artisan db:seed --class=CrmsConfigSeeder` binds the six report-template clients (ids 10, 23, 59,
72, 126, 139), builds the Domestic/Foreign sector groups from the corporates' tickers, backfills
`corporate_contact.corporate_id` from the embedded JSON, and links portal accounts on exact email.

What the data taught us (differs from the planning notes): `roadshow.category` 3 is **Analyst
Marketing** (every category-3 row carries a travelling analyst), and one-off meetings live in the
separate `event` table (`OneOffMeeting`, `/api/crms/one-off-meetings`). Form-builder fields keep the
legacy shape (`textBox` / `select`, `Static` choices or a `Lookup` over Corporate, CorporateContact
or SellsideContact), and lookup values are stored as snapshots of the picked row, exactly as before.
The client row named "Generic Form" (id 81) is the legacy stand-in for the default form and the shared
interaction types: a client without its own form or types falls back to it.

| Permission | Unlocks |
|---|---|
| `crms.access` | sign-in, dashboard, calendar, every read |
| `crms.contacts.manage` | clients, addresses, client contacts, portal link/unlink, corporates, Regis directory, sector groups |
| `crms.interactions.manage` | interactions (create/edit/delete, send-to-recipients flag) |
| `crms.events.manage` | events and their meetings / investors / flights / transport / hotels / Regis party; meeting → interaction |
| `crms.reports.generate` | consumption workbooks (`POST /api/crms/reports/generate`) |
| `crms.admin` | interaction types, form builder, report-template bindings, CRMS logs |

Notes that differ from the legacy Angular app:

- Times are stored in the legacy `{"hour":H,"minute":M,"second":S}` shape and exposed as
  `HH:mm` through `App\Casts\LegacyTime`; JSON-in-TEXT columns go through `LegacyJson`.
- Audit rows land in the CMS `audit_entries` ledger with a `CRMS · ` prefix, written server-side.
- Itineraries are built server-side (`GET /api/crms/events/{id}/itinerary?contactId=`), with a
  hotel line on every day of a stay, and printed to PDF from the browser's print dialog.
- Reports apply the date range as a real `WHERE` and include every row regardless of author;
  the Internal workbook carries Analysts, Sales and All-interactions sheets.
- "Save and send to recipients" flags the interaction and opens **CMS → Email desk** pre-filled
  (`/cms/email?compose=adhoc&subject=&body=&to=`); the CRMS never sends mail itself.
