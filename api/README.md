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

## Legacy newsletter archive

The Daily / Weekly / Monthly mailers exported from the old regis.ph CMS (a
`newsletter-index.csv` beside `Daily/`, `Weekly/`, `Monthly/` year folders) import
into `newsletter_issues` with:

```bash
php artisan newsletters:import-legacy ../Newsletters --fresh   # --fresh drops existing issues first
```

Each issue keeps its old id in `legacy_id`, so re-running updates in place. The old
system's `TEST` and `Copy of` rows are skipped unless `--include-tests` is passed. Chart
images are copied from regis.ph into `storage/app/public/site/newsletter-legacy/` (served
at `/api/media/...`), with a URL manifest in `storage/app/private/`; the old site is slow,
so a full copy takes hours. `--no-images` leaves the URLs pointing at regis.ph.

## Accounts

The seeder creates exactly one account, the CWDevs super admin. Every other account comes
from the legacy regis.ph export (`regis_accounts_export.sql` in the repo root, 23 CMS staff
and 564 portal clients, dumped 2026-09-14):

| Kind  | Email                   | Password       | Role          |
|-------|-------------------------|----------------|---------------|
| Staff | superadmin@cwdevs.com   | `CWDevs2021!`  | Administrator |

Set `SUPER_ADMIN_PASSWORD` in `.env` to seed a different one. The account is re-asserted by
every import run, so it can never be lost.

The super admin, and only the super admin, can read an account's current password back from
the Edit account drawer in Users & access (`GET /api/cms/users/{id}/password`, audited as
"Viewed password"). Every password set through this system is kept beside its hash in
`users.password_recoverable`, encrypted under `APP_KEY`; a password that arrived already
hashed (the legacy import) reads "not on record" until it is next reset. Rotating `APP_KEY`
makes every stored copy unreadable.

```bash
php artisan accounts:import-legacy ../regis_accounts_export.sql --fresh
#   --fresh            drop every existing account first (super admin recreated)
#   --staff-password=  give every imported staff account this temporary password
#   --dry-run          map and report without writing
```

What the import does with the export:

- **Staff** (`cms_user`): legacy passwords use an in-house encoding and cannot be migrated, so
  imported staff get an unusable password until one is set in Users & access (or pass
  `--staff-password`). Roles are rebuilt from each account's old permission blob: system and
  super-admin logins become **Administrator**; everyone else lands on the smallest of
  **Newsletter Desk** (mailers + Email desk), **Client Desk** (mailers + portal clients + client
  logs) or **Site Editor** (public pages + mailers + clients) that covers what they had. Three
  inactive accounts with no modules get no role. Accounts inactive in the old CMS are suspended,
  as is the old vendor's master login (`dev@z3r0101.com`), which the super admin replaces.
- **Clients** (`client_account`): bcrypt hashes migrate as-is, so existing passwords keep
  working. Legacy statuses map to `approved` (Active with a password), `invited` (Active but
  sign-up never completed, 106 of them), `pending` (Waiting for approval), `declined`
  (Rejected); Blocked accounts are `approved` + suspended. `client_type` is Local for a
  Philippine address, Foreign otherwise. The address, MiFID flag, rolled-up login and read
  counts, and the export's data-quality flags are kept in `users.legacy_meta`.
- Three duplicate emails are skipped (the copy with a password and logins wins) and one
  duplicate user id is dropped; the command lists each. `legacy_id` keeps the old primary key,
  so re-running updates in place. CRMS client contacts are re-linked to portal accounts on
  exact email at the end.

An email is unique per **kind**, not per table: 18 Regis staff also hold a portal client
account under their work address, exactly as they did on the old system. Clients sign in with
their Regis-issued user id or email; staff sign in with email.

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

The sender mailbox resolves per staff member: their own `users.outlook_email` when the profile
carries one, otherwise the shared desk mailbox in `MS_GRAPH_SENDER`. Most staff profiles have no
personal Outlook address, so in practice the shared mailbox is the desk's sender. Whichever one
is used must be a real licensed mailbox in the tenant; Graph answers `404 ErrorInvalidUser` for
an address that does not exist and a bare `401` for one the app may not send as. The Email desk's
readiness strip names the mailbox it will use and what is missing when it cannot send.

Rendering for real mail clients: the house newsletter template keeps its stylesheet in a
`<style>` block inside the body, which browsers honour and Gmail discards. `BlastRenderer::forEmail`
copies every rule onto the elements it matches as inline styles and hoists the block into `<head>`;
the preview endpoint renders through the same pass, so the desk sees what leaves. At send time the
job replaces every image served from our own hosts (`FRONTEND_URL`, `APP_URL`, root-relative paths)
with an inline `cid:` attachment fetched once per run, so the logo renders even while the site is
not publicly reachable. Third-party image URLs are left alone.

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
