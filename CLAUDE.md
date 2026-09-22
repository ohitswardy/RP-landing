# CLAUDE.md — RegisPH

Monorepo for Regis Partners (regis.ph), a Philippine institutional brokerage. One React SPA
(`web/`) and one Laravel API (`api/`) serve four areas: the public **Landing site**, the
**Client Portal** (`/portal`), the staff **CMS** (`/cms`), and the staff **CRMS** (`/crms`).

Audited 2026-09-21, gaps closed the same day. Type check clean (`tsc --noEmit`). PHPUnit: 111 pass, 0 fail. Vitest: 62 pass. `vite build` succeeds (see §8).

---

## 1. Run it

```bash
# MySQL through Laravel's `mysql` driver, databases `regisph` and `crms` (local XAMPP service on :3306)
cd api && composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed                       # seeds superadmin@cwdevs.com / CWDevs2021! AND a demo client (below)
php artisan accounts:import-legacy ../regis_accounts_export.sql --fresh   # the real 23 staff + 564 clients
php artisan newsletters:import-legacy ../Newsletters --fresh              # ~1,900 legacy mailers (image pass takes hours)
php artisan serve                                # http://127.0.0.1:8000
php artisan queue:work                           # required for Email desk "Send now" (the desk now detects a dead worker)
php artisan schedule:work                        # re-queues blasts stuck at `queued` (blasts:requeue-stale, every 10 min)

cd web && npm install && npm run dev             # http://localhost:5173, proxies /api -> :8000
npm run typecheck                                # tsc -p tsconfig.app.json --noEmit
npm test                                         # vitest (src/**/*.test.ts(x), jsdom, jest-dom)
cd api && php artisan test                       # sqlite in-memory for both DB connections
```

Seeded accounts: `superadmin@cwdevs.com / CWDevs2021!` (staff, super admin) and `client@regis.ph`, user id `RP-DEMO-0001`, `RegisClient2026!` (approved Local client, empty prefs = whole catalog). Seeded reports copy `web/public/reports/regis-sample-report.pdf` into the private disk so `/api/reports/{id}/file` streams.

- `api/.env` is gitignored and on this machine holds **live Microsoft Graph credentials**. `phpunit.xml` blanks `MS_GRAPH_*`; any new test that touches a mail path must still mock `MicrosoftGraphMailer`.
- `web/.env` (gitignored) holds the EmailJS keys for the public contact form.
- `FRONTEND_URL` in `api/.env` builds every link the system emails (onboarding, password reset, newsletter confirm). Defaults to localhost.
- `MS_GRAPH_SENDER` is the mailbox for system mail (password resets, subscribe confirmations). Without Graph configured those flows still succeed, are audited, and log a warning instead of sending.
- Deeper references: `api/README.md` (endpoints, RBAC, imports, Email desk), `CRMSmasterplan.md` (CRMS blueprint, cited by section number in code), `Database.md` (legacy CRMS schema), `PRODUCT.md` (brand/design).

## 2. Layout

```
web/src/
  App.tsx            all routes; CMS/CRMS/Portal are lazy chunks; public catch-all `*`
  pages/             public pages, 3 login doors, ForgotPassword, InsightArticle, Careers, NewsletterVerify, NotFound,
                     PortalRegister, PortalResetPassword (also serves /cms/reset/:token)
  components/        public-site components (SearchModal is now index-driven)
  lib/               api.ts (fetch+token+401 event), publicContent.ts (fetch-with-fallback + health), *Content.ts (bundled
                     fallbacks incl. careersContent, searchContent), activity.ts (rail orb bus), theme.tsx, reportSearch.ts, eml.ts
  hooks/useTicker.ts market ribbon (CMS watchlist + phisix)
  portal/            client portal: auth, reports, bookmarks, watermark, download, track, notice, preferences, PortalAccount
  cms/               staff CMS: auth.tsx, store.tsx, data.ts (wire types), ui.tsx, kit/, modules/ (incl. Careers, Watchlist, Media)
  crms/              staff CRMS: store.tsx, kit/, modules/ (incl. MyActivity, Help), help/content.ts
  __tests__/setup.ts vitest setup; tests live beside the code as *.test.ts(x)
api/
  routes/api.php     public content, auth, CMS, portal      routes/crms.php  CRMS      routes/console.php  scheduler
  app/Http/Controllers/Api/*   (+ PasswordResetController, SelfServiceController, NewsletterSubscribeController)
  app/Http/Controllers/Crms/*  (+ MyActivityController)
  app/Models/*       app/Models/Crms/* (all pin the `crms` DB connection)
  app/Support/*      Audit, ClientLog (hash chain), BlastRenderer, SimpleXlsx, *Defaults, SuperAdmin, AccountGate,
                     PasswordResetMail, QueueHealth, SectorGroupMatcher, MediaLibrary, Html
  app/Services/      MicrosoftGraphMailer, Crms/{ScheduleAggregator,ItineraryPdf,ReportGenerator,InteractionTypeResolver,PortalAccountResolver}
  app/Jobs/SendEmailBlast.php    app/Console/Commands/{ImportLegacyAccounts,ImportLegacyNewsletters,RequeueStaleBlasts}.php
  database/seeders/{RbacSeeder,ContentSeeder,CrmsSeeder,CrmsConfigSeeder}.php
```

**Shared conventions**
- Frontend calls go through `apiFetch`/`apiBlob` in `web/src/lib/api.ts`. Tokens are Sanctum PATs: `regis.cms.token` (CMS and CRMS share it) and `regis.portal.token`, in **sessionStorage** by default; "Remember for 30 days" stores them in localStorage with an expiry that Sanctum also enforces (`expires_at`). A 401 clears the token and dispatches `regis:unauthorized`; an account-state 403 dispatches it with the server message. `cms/auth.tsx` and `portal/auth.tsx` listen and send you to the right login door with a notice.
- Models expose `toWire()` returning the camelCase shapes in `web/src/cms/data.ts` (ids as strings). Mutations return `{item, audit}`; stores merge the item and prepend the audit row.
- Every CMS/CRMS mutation writes `audit_entries` via `App\Support\Audit`. CRMS rows carry a `CRMS · ` prefix.
- RBAC is custom: `roles` ⇄ `permissions` pivot, keys map 1:1 to modules. Route groups use `permission:{key}` middleware; the sidebar and `<RequirePermission>` use the same keys. Pattern for a new module: seed key in `RbacSeeder`, wrap routes, add nav item with `perm`, wrap route in `RequirePermission`, add store mutator.
- `App\Support\AccountGate` is the single source of truth for "may this account be on the system right now" and its refusal copy; login, `/api/me`, `EnsureClient` and `EnsureStaff` all use it, so status changes and suspensions bite on the next request.
- Design: public site = drenched navy + amber tick, Geist sans (see `PRODUCT.md`). CMS/CRMS = "Vercel x Nothing" utility register inside the same tokens. Dark mode is a token remap on `html.dark` for the three signed-in shells only; wrap anything that must look like the public site in `theme-light`. Never use native `<select>`, `type="date"`, `type="time"` in CMS/CRMS; use `web/src/cms/kit/pickers`.
- Keep migrations and queries driver-agnostic (Schema builder / Eloquent only). New tables use `datetime` for audit-style columns rather than a first `TIMESTAMP` column.

---

## 3. Landing page (public site)

**Routes** (`web/src/App.tsx`, all inside `PublicLayout` = MarketRibbon → Navbar → Breadcrumb → page → Footer):
`/`, `/about`, `/services`, `/services/:slug`, `/insights`, `/insights/:slug`, `/careers`, `/contact`, `/newsletter/verify/:token`, `/forgot-password`, `/forgot-password/staff`, `/login`, `/login/cms`, `/login/crms`, and `*` → `NotFound`.

**Data flow.** Every page is CMS-driven with a bundled fallback. `usePublicContent(path, fallback, normalize)` in `web/src/lib/publicContent.ts` fetches once per session, dedupes in-flight calls, and on failure keeps the fallback. Failures are now visible: a DEV `console.warn`, a `usePublicContentHealth()` store, and a discreet "Live content unavailable — showing cached copy" line in the Footer. A non-JSON 200 (an SPA rewrite swallowing `/api`) counts as a failure.

| Page | Hook (`web/src/lib/`) | Endpoint | Edited in CMS by |
|---|---|---|---|
| Home | `homeContent.ts` | `GET /api/content/home` | Landing page module (8 sections, each with `enabled`) |
| About | `aboutContent.ts` (+ `peopleContent.ts`) | `GET /api/content/about` (copy + roster in one call) | People module |
| Services | `servicesContent.ts` | `GET /api/content/services` | Services module |
| Insights list / article | `insightsContent.ts` | `GET /api/content/insights`, `GET /api/content/insights/{slug}` | Insights module (slug + body) |
| Careers | `careersContent.ts` | `GET /api/content/careers` | Careers module |
| Contact (+ social links) | `contactContent.ts` | `GET /api/content/contact` | Pages module |
| Legal modals | `legalContent.ts` | `GET /api/content/legal` (lazy, on first open) | Pages module |
| Navbar photos | `navMedia.ts` | `GET /api/content/nav` | (derived from the four page docs) |
| Search index | `searchContent.ts` | `GET /api/content/search` (cached 60 s server-side) | (derived: people, services, insights, pages) |
| Market ribbon | `hooks/useTicker.ts` | `GET /api/content/watchlist` + phisix | Market ribbon module |

Uploaded images are served by `GET /api/media/{path}` from `storage/app/public/site/`.

**Works**
- All content fetch + fallback, mega-menu, legal modals, breadcrumb, scroll restoration, designed 404.
- **Insights are readable**: `/insights/{slug}` renders the sanitized article body plus three related notes; 404 for unpublished slugs (does not trip the outage flag).
- **Market ribbon**: the CMS watchlist (pinned first) polled against the community `phisix-api` every 60 s straight from the browser; fallback = the old 15-symbol list; honest "Delayed"/"demo" badge.
- **Newsletter subscribe** in the Footer: `POST /api/newsletter/subscribe` (always 200, honeypot, throttled) → Graph confirmation email → `/newsletter/verify/{token}` → `GET /api/newsletter/verify/{token}` marks `subscribers.verified`.
- **Careers** page lists open postings (dept/type/location, expandable body); "Apply" → `/contact?topic=Careers: {title}`, which the Contact page pre-selects.
- **Search** (`components/SearchModal.tsx`) is built from the live index with a small bundled fallback; people results open `/about#{slug}`.
- **Contact form** (`pages/Contact.tsx`): two EmailJS templates using `VITE_EMAILJS_*`. Nothing is stored server-side.
- Three login doors share `components/PortalAuth.tsx`; "Remember for 30 days" is real; "Forgot password" goes to `/forgot-password` (client, `POST /api/portal/forgot-password {identity}`) or `/forgot-password/staff` (`POST /api/cms/forgot-password {email}`), both neutral-200. Reset links: `/portal/reset/{token}` (client) and `/cms/reset/{token}` (staff), same page, redirects to the right door.
- Footer: social links come from the contact doc and render only when set; Home service cards resolve to a live `/services/{slug}` by slug or title, else `/services#{slug}`.
- `web/vercel.json` proxies `/api/:path*` to the API origin and excludes `/api` from the SPA rewrite.

**Still open**
- **Regulatory placeholders**: `REGULATORY_IDS` in `web/src/lib/legalContent.ts` (`SEC Reg. No.`, `PSE Trading Participant License No.`) is a single `// TODO before launch` constant; the real numbers are unknown.
- **API origin in `web/vercel.json`** is `https://api.regis.ph`; change it to the real host before a Vercel deploy.
- Footer "Prime Brokerage / Regis Access / Wealth Management" have no portal of their own; they route to `/contact?topic=…`.
- Home insight cards are CMS-authored `href`s; a card whose title matches a published note opens it, otherwise `/insights`.
- `GET /api/content/people` still has no caller (About gets the roster via `/content/about`).
- `@number-flow/react` IS used (ring charts via `components/charts/ring-center.tsx`); `gsap` is used by `TextType` and CMS files. `three` is needed by `RegisLogo3D` (CMS Overview).
- Dev harness `web/ring-preview.html` + `src/dev/ring-preview.tsx` stubs `/api/cms/client-logs` to preview one Overview chart. Dev-only, not built.

---

## 4. Client Portal (`/portal`)

**Auth.** `POST /api/portal/login` accepts `identity` = Regis-issued user id (`users.username`, case-insensitive) **or** email, `kind = client` only, optional `remember`. `users.status` gates sign-in via `AccountGate`: `invited` / `pending` / `declined` / `suspended` get a 403 with distinct copy; only `approved` may enter, and `EnsureClient` re-checks this on **every** request. On boot the provider validates the stored token with `GET /api/me` (returns `{kind:"client", client:{id,name,email,username,firm}}`); a 401/403 signs you out with a notice.

**Onboarding** (issued from CMS → Users & access; the admin copies templated bodies from `web/src/cms/modules/access/templates.ts`):
1. Admin provisions → account `invited` + 14-day single-use registration token (`portal_tokens`). Or "Set password now & approve" → `approved` immediately.
2. Client opens `/portal/register/{token}` (`GET/POST /api/portal/register/{token}`), confirms details, sets password → `pending`.
3. Admin approves (`/api/cms/portal-clients/{id}/approve`) → `approved`. Decline deletes all tokens.
4. Reset: admin issues `/portal/reset/{token}` or sets a password directly, **or the client self-serves** at `/forgot-password` (emailed 24-h token; an `invited` account gets its registration link re-sent). Every password change revokes live sessions (self-service keeps the current one).

**Self-service** (`/portal/account`, `portal/PortalAccount.tsx`): profile (`GET /api/portal/profile`: user id, firm, client type, coverage mandate), change password (`PUT /api/portal/password {current, password, password_confirmation}`), per-viewer preferences (default sector view + company filter, localStorage `regis.portal.preferences`), theme, "remembered until", sign out.

**Reports.** One unpaginated `GET /api/portal/reports` on mount returns `reports`, `companies`, `trending` (the unused `reportTypes` key is gone). Coverage mandate is server-side: `Report::scopeVisibleTo` filters by `users.sector_prefs` and `preferred_analysts` (empty = whole catalog) and is re-enforced on the PDF stream, bookmark toggle and activity beacon. Client-side: sector view × Local/Foreign company × year/month × free-text search (`lib/reportSearch.ts`). Above 400 reports the grids window in 60-row "Show more" pages.

- **PDF stream**: `GET /api/reports/{id}/file` for any authenticated, non-suspended account; 403 outside coverage; 404 if no `file_path`.
- **Watermark** (`portal/watermark.ts`, pdf-lib, lazy-loaded) **never degrades silently**: `stampPdf` throws `WatermarkError`, the viewer shows an error state with Retry, and no unstamped bytes are handed over. `download.ts` fetches through the authenticated API first and falls back to `report.fileUrl` only on 404 (still stamped).
- **Bookmarks** are server-side per account (`GET/PUT/DELETE /api/portal/bookmarks[/{id}]`), optimistic with rollback; failures raise a notice (`portal/notice.tsx`).
- **Trending** (`app/Support/Trending.php`) ranks off `client_activities`; rules are a singleton `portal_settings` row (fixed: a freshly created row is refreshed so trending works on first load). **Spotlight** is a single slot set in CMS → Reports.
- **Blast deep link** `/portal?report={id}` opens the viewer once the catalog lands.

**Activity ledger.** `POST /api/portal/activity` (`view` / `download` / `click`) → `ClientLog::record` appends to `client_activities` with an **HMAC-SHA256 hash chain keyed by `APP_KEY`**, inserted under `lockForUpdate` on the chain head. Beacons use `fetch(..., {keepalive:true})` so unload-time events survive; failures raise one rate-limited notice. `GET /api/cms/client-logs/verify` recomputes and names the first broken row. No login, search or impression events.

**Local vs Foreign — two different axes.** `companies.type` is only the portal's company filter. `users.client_type` is **never read by the portal**; it drives the Email desk: Local clients get the login-gated portal deep link, Foreign clients get a manually pasted Jefferies link (`email_blasts.external_link`).

**Works end to end:** login + status gating, remember me, register/reset/forgot flows, mandate filtering, search, bookmarks, watermarking, hash chain + verify, trending, spotlight, deep links, dark mode, account page. Covered by `tests/Feature/Portal/*` (33 tests) and vitest (`lib/api.test.ts`, `portal/watermark.test.ts`, `portal/preferences.test.ts`).

**Still open**
- Whole catalog ships in one payload (by design: client-side search); windowing only tames the DOM.
- Forgot-password / subscribe emails need `MS_GRAPH_*` + `MS_GRAPH_SENDER`; otherwise the token is issued and audited but not sent.

---

## 5. CMS (`/cms`)

**Auth.** `POST /api/cms/login` (`kind = staff`, 403 if suspended, optional `remember`) issues a token with ability `cms`. Session `{id, name, email, role, permissions[], outlookEmail, superAdmin, expiresAt}` in `regis.cms.session` (localStorage mirror when remembered). On boot `cms/auth.tsx` calls `GET /api/me` so **permissions are live**; the rail user block has a refresh-permissions icon beside the pin, and the name/role block opens the **Account page** (`/cms/account`, and `/crms/account` in the CRMS, one `cms/modules/AccountModule.tsx`): profile, live grants, session, theme, and change password (`PUT /api/cms/password`, form in `cms/kit/ChangePasswordForm.tsx`). All `/api/cms/*` routes sit behind `auth:sanctum` + `staff` (suspension re-checked per request), then `permission:{key}`.

**Permissions and roles** (`api/database/seeders/RbacSeeder.php`)

| Key | Module | Administrator | Editor | Analyst |
|---|---|---|---|---|
| `home.manage` | Landing page | ✓ | ✓ | |
| `insights.manage` | Insights | ✓ | ✓ | ✓ |
| `reports.manage` | Reports | ✓ | ✓ | ✓ |
| `services.manage` | Services | ✓ | ✓ | |
| `people.manage` | People (+ About copy) | ✓ | ✓ | |
| `pages.manage` | Pages (Contact copy + social links + legal docs) | ✓ | ✓ | |
| `careers.manage` | Careers | ✓ | ✓ | |
| `market.manage` | Market ribbon (watchlist) | ✓ | ✓ | |
| `media.manage` | Media library | ✓ | ✓ | |
| `newsletter.manage` | Newsletter | ✓ | ✓ | |
| `email.manage` | Email desk | ✓ | ✓ | ✓ |
| `access.manage` | Users & access | ✓ | | |
| `logs.view` | Client logs | ✓ | | |
| `crms.*` (6 keys) | CRMS | ✓ | | all but `crms.admin` |

Administrator is a locked system role. Legacy import adds Newsletter Desk, Client Desk, Site Editor. Guards: cannot suspend/delete yourself; no change may leave zero active `access.manage` holders; system roles cannot be renamed or re-permissioned; suspending an account and any admin-set password revoke its tokens.

**Bootstrap + store.** `GET /api/cms/bootstrap` returns every collection in one call (articles, reports, companies, reportTypes, trendingRules, people, services, servicePage, homePage, aboutPage, contactPage, insightsPage, careers, watchlist, newsletter *summaries*, subscribers, legal pages, media, last 60 audit rows). `web/src/cms/store.tsx` merges it over `EMPTY`, loads once, and writers await the API and merge `res.item` (server-authoritative, except reorders). Newsletter bodies are fetched on open via `GET /cms/newsletters/{id}`.

**Modules** (`web/src/cms/modules/`)

| Module | Manages | Feeds |
|---|---|---|
| Overview | KPIs, 12-week output chart, attention list, audit feed | — |
| Landing page | One 8-section `home_pages` JSON doc with live miniature preview; `PUT /cms/home-page` | public `/` |
| Insights | Notes CRUD with **slug + rich-text body**, single `featured` lead, `/insights` page composition, "Read on site" link | public `/insights`, `/insights/{slug}` |
| Reports | Catalog with multipart PDF upload, company registry, report-type registry, Spotlight, Trending rules + preview, "Copy blast link" | Portal dashboard, `/api/reports/{id}/file` |
| Services | Service lines **create / update / reorder / delete** (409 when deleting the last live line), pillars, hero slideshow, `live` toggle, `/services` landing doc | public `/services*` |
| People | Staff roster by team, portraits, reorder, `visible`; About-page copy | public `/about` |
| Pages | Contact page copy + **social links** + two legal documents | public `/contact`, Footer, legal modals |
| Careers | Postings CRUD (dept, type, location, summary, rich-text body, open/closed) | public `/careers` |
| Market ribbon | Watchlist add / pin / reorder / delete with a live preview strip | public MarketRibbon |
| Media | Library grid, drag-drop/paste upload (8 MB), copy path, delete (409 lists where the image is still used) | ImagePicker Library tab |
| Newsletter | Daily/Weekly/Monthly archive, issue composer, subscriber list with verified / unverified / unsubscribed filters and dates; `TemplatePreview.tsx` is a byte-faithful port of the legacy mailers ("change nothing here") | Email desk |
| Email desk | See below | outbound mail |
| Users & access | Staff accounts, portal clients, roles; onboarding tabs | Portal sign-in |
| Client logs | Filter/sort/page the hash-chained ledger, verify strip, CSV/XLSX export | reads Portal beacons |

Shared kit: `ui.tsx`, `kit/pickers`, `kit/RichTextField` (TipTap), `kit/ImagePicker`, `kit/SaveBar`, `kit/RailOrb` + `lib/activity.ts` (raw `fetch` downloads/uploads must call `trackActivity`/`markSuccess`), `kit/UserBlobatar`, `kit/ChangePasswordForm`.

**Email desk** (`modules/EmailModule.tsx` + `email/`, `EmailBlastController`, `SendEmailBlast` job, `MicrosoftGraphMailer`)
- Kinds: `report` (prefilled; "Prefill matched clients" via `GET …/match?report=` matches **Local** clients on sector/analyst prefs **and on CRMS sector groups** (`App\Support\SectorGroupMatcher`: report company ↔ crms `corporate` by ticker or name → `sector_group_corporate` → `client_contact_sector_group` → `client_contact.portal_user_id`); each match carries `via: prefs | sectorGroup | both`), `newsletter`, `adhoc` (the CRMS hand-off target).
- Preview `POST …/render` runs the same `BlastRenderer` as the send.
- **Send now** `POST …/{id}/send`: refuses until Graph is configured, **refuses with 409 when the queue worker heartbeat is stale** (unless `confirmNoWorker: true`, which the UI offers as a confirm), plans batches under a transaction lock, queues `SendEmailBlast`. Clients ride BCC in batches ≤500; each subscriber gets a direct message with a personal unsubscribe link. Sender = `users.outlook_email` else `MS_GRAPH_SENDER`.
- **Queue health**: `Queue::looping`/`Queue::after` hooks write `Cache::put('queue.heartbeat')`; `GET /cms/email-blasts/readiness` (and the audience call) return `dispatch.queue {driver, alive, lastSeenAt, pending, stale}`; the readiness strip polls it every 30 s and warns loudly when the worker is down. `php artisan blasts:requeue-stale` re-dispatches blasts stuck at `queued` > 15 min and is scheduled every 10 minutes (`routes/console.php`). The cache store must be shared between worker and web process (file/database/redis, not `array`).
- **Outlook hand-off** fallback: download an `.eml` draft, copy HTML/BCC, then `POST …/{id}/sent` records channel `outlook`.
- Distribution lists (`/cms/distribution-lists`) are saved audiences and **personal**: each Administrator/Analyst sees only their own (`created_by`, name unique per owner; an ownerless list is shared until someone edits it). The Distribution lists tab also shows the CRMS **research hierarchy** read-only (`audience.research[]` from `App\Support\ResearchAudience`: Research-Domestics / Research-Foreign sectors, tickers, and the contacts reachable through an approved portal account); every sector is a one-click pool in the composer. Unsubscribe is `GET /api/newsletter/unsubscribe/{token}`.

**Users & access specifics.** Portal-client actions under `/api/cms/portal-clients/*`: store, invite-link, approve, decline, reset-link, password, username. Only the **super admin** (`SuperAdmin::is`, literally `superadmin@cwdevs.com`) can read a password back via `GET /cms/users/{id}/password`; `users.password_recoverable` holds an `APP_KEY`-encrypted copy written by every password mutator (incl. self-service). Every reveal is audited. Imported staff (unusable passwords) self-serve via `/login/cms` → Forgot password.

**Console commands**: `accounts:import-legacy`, `newsletters:import-legacy`, `blasts:requeue-stale [--minutes=15] [--dry-run]`, `crms:distribution-list [--force] [--dry-run]`.

**Works:** every module has a real handler for every button; every frontend call has a matching route; no orphaned permissions; Graph send path exercised for real. Tests: `tests/Feature/{EmailBlastSendTest,DistributionListTest}` (fixed), `tests/Feature/Cms/*` (RBAC middleware, bootstrap, content endpoints, subscribe, media, service lines, queue guard, email match), `tests/Feature/Portal/AccessGuardsTest`; vitest `cms/auth.test.tsx`, `cms/store.test.tsx`.

**Still open**
- Watchlist symbols have no editable display name (the controller sets `name = sym`; the feed fills it).
- Careers `posted` is stamped by the API on create and not editable.
- The Media 409 `references` and the send 409 `queue` payloads are read around `apiFetch` (which keeps only `message`/`errors`).
- The `list.noteHref` field still exists in the Insights page doc but the public site ignores it.

---

## 6. CRMS (`/crms`)

Rebuild of the legacy Angular CRMS. **No accounts of its own**: staff sign in at `/login/crms` with their CMS account (`POST /api/crms/login`, same `cms`-ability token, `remember` supported), and only roles with `crms.access` get in. Every `/api/crms/*` route: `auth:sanctum` + `staff` + `permission:crms.access`, writes behind `crms.contacts.manage` / `crms.interactions.manage` / `crms.events.manage` / `crms.reports.generate` / `crms.admin`.

**Data.** Second Eloquent connection `crms` (`config/database.php`, `CRMS_DB_*`, **`strict => false`** because legacy rows carry zero dates; do not re-enable). Every model extends `App\Models\Crms\CrmsModel`. Legacy tables keep their odd names: `client`, `client_contact`, `corporate`, `corporate_contact`, `sellside_contact`, `interactions`, `interactionsType`, `form`, `roadshow` (= `Event`, category 1 Roadshow / 2 Reverse / **3 Analyst Marketing**), `meeting`, `event` (= `OneOffMeeting`), `investor`, `flight`, `transpo`, `accommodation`, `bank` (= `EventAttendee`), `user` (legacy staff, read-only, still referenced by `interactions.user_id`). Casts: `LegacyTime`, `LegacyJson`. Migrations are **additive only** and hasTable/hasColumn-guarded; `tests/Feature/Crms/SchemaDriftTest.php` freezes the exact column list of every legacy table and `tests/Unit/Crms/ConnectionGuardTest.php` asserts every CRMS model is on `crms` and no CRMS controller touches a CMS model outside an allowlist (masterplan §11.6). The legacy `log` table and `client_contact.distribution_list` are intentionally unused (commented in the migration).

**Client id 81 "Generic Form"** is a pseudo-client owning the default form and shared interaction types. Fallback: client's own → `client_id NULL` → Generic Form (`Form::forClient`, mirrored in `InteractionForm.tsx` and `kit/options.ts`). Form-builder JSON must stay byte-compatible with legacy.

**Loading the production dump** (`crms_latest_0810_2026.sql`): drop `token`, `distribution_list`, `email_log`, `archive_email_log`, `archive_log` (keep `user`); replace `utf8mb4_0900_ai_ci` → `utf8mb4_unicode_ci` if the target server lacks it; `SET GLOBAL max_allowed_packet=64M`. Then `migrate` and `db:seed --class=CrmsConfigSeeder`.

**Store.** One `GET /crms/bootstrap` holds all master data plus `meta.genericClientId`, `meta.legacyUserMatched`, `meta.legacyUserId`, `meta.eventCategories[] {slug, label, id, legacyName}`. Interactions, events, one-off meetings, calendar, logs, dashboard, holders and My Activity are fetched per module, paged server-side. `kit/DataTable.tsx`, `kit/fields.tsx`, `kit/toast.tsx`, `kit/important.tsx`.

**Modules** (all 16 implemented against real endpoints)

| Module | Notes |
|---|---|
| Dashboard | `GET /crms/dashboard/summary?from&to`: stat tiles, minutes by month, top clients/stocks, reverse-roadshow demand, legacy tallies, important shelf |
| Interactions | Server-paged list; dynamic form per client; **Save** (`closed`) vs **Save and send to recipients** (`flagged` + `/actioned` + opens CMS Email desk). Important star via `POST …/important`. Shows a notice when the signed-in staff has no legacy `user` match (author attribution then lives in the audit ledger only; the API logs a warning once per request and returns `meta.legacyUserMatched`) |
| Events | Roadshow / Reverse / Analyst Marketing + one-off meetings; six child tabs; subject rules server-side; delete cascades in PHP |
| Itinerary | `GET /crms/events/{id}/itinerary?contactId=` → JSON, `…/itinerary.pdf` (dompdf), `POST …/itinerary/email` (Graph; 503 unconfigured) |
| Meeting → interaction | `POST /crms/meetings/{id}/convert-to-interaction`; `InteractionTypeResolver`; 409 if already converted |
| Calendar | month/week/day/list, `GET /crms/calendar?from&to` |
| Clients / Client contacts | CRUD, addresses, pickers, sector-group tags. Portal panel resolves the CMS `users` row live; `POST /crms/client-contacts/{id}/portal` links/unlinks |
| Corporates / Regis directory | CRUD; sellside types Analyst / Sales / N/A |
| Distribution list | Research-Domestics / Research-Foreign sector-group taxonomy (`/crms/sector-groups`), the client's spec in `App\Support\ResearchDistribution` (`crms:distribution-list [--force] [--dry-run]`), **read by the Email desk matcher** for contacts with a linked portal account |
| Reports | `POST /crms/reports/generate` → XLSX: `generic`, `internal`, `client`, `jefferies`. **The clients' own workbooks are filled in place, never recreated**: `api/resources/report-templates/{jefferies,schroders-commcise,jpm-commcise}.xlsx` are the files the clients sent (Jefferies' bulk upload with last month's rows removed; the Commcise downloads of 2026-09-21 untouched), described by `App\Services\Crms\BundledTemplates` (sheet, header row, data start, column → source map, scope). `jefferies` fills the Jefferies workbook with the Foreign book through the binding on the client named Jefferies (id 297; `ReportTemplate::jefferies()`: code `jefferies` = the bundle, a `custom` import on that client takes over; bootstrap `meta.jefferies`); a client bound to `commcise` (Schroders 126, JPM 72) gets its Commcise workbook, named as Commcise names downloads. Filling = `App\Services\Crms\LayoutRenderer` + `App\Support\XlsxTemplate` (string surgery on the data sheet: sample rows replaced, the sample row's styles/formulas reused and re-addressed per row, validation/CF ranges re-based, every other part byte-identical). `App\Services\Crms\ReportSources::catalog()` is every fillable source (bootstrap `meta.reportSources`), plus `form.*`, `meta.*`, `const`, `blank`, `formula`; the third-party vocabularies (Jefferies Meeting Type/Method, Commcise ClientInteractionType, roles, Bloomberg tickers) are derived in `UploadLayouts`. **Imported templates** (`code = custom`, workbook on the private disk under `crms/report-layouts/`, map in `report_templates.layout`, `scope` = `client` / `foreign` / `all`) use the same renderer. Endpoints under `crms.admin`: `POST /crms/report-templates/layout` (multipart), `…/layout/preview`, `GET …/{id}/layout/file`, `GET …/bundled/{key}/file` |
| Ticker search | Coverage rings, holders via `GET /crms/corporates/{id}/holders` |
| **My activity** | `GET /crms/my-activity?from&to&page`: profile + legacy-match chip, 7 stat tiles, merged feed of own interactions / meetings / events attended / `CRMS · ` audit rows with links into the modules |
| **Help** | `web/src/crms/help/content.ts`: searchable, anchored, permission-aware guide to every module and its gotchas |
| Interaction types / Form builder / Logs | `crms.admin`. Form builder also holds each client's **Report template**: import the client's Excel workbook (`modules/ReportLayoutImport.tsx`, parsed in the browser by `kit/sheet.ts`; `kit/layout.ts` detects the data tab / header row / "data starts here" marker, the Commcise or Jefferies vocabulary, and auto-matches headers to `meta.reportSources`, form fields, T1C constants or the template's formula; live preview via `…/layout/preview`), then upload file + map. Logs = paged slice of CMS `audit_entries` where `action LIKE 'CRMS · %'` |

**Works:** everything above, with tests for access, events parity, important marks, workbook layout, casts, my-activity, schema drift, connection guard (35 CRMS tests).

**Still open**
- Event category enum stays hardcoded 1/2/3 (routes and subject rules depend on it); the legacy `event_category` id/name is exposed in bootstrap meta but not consumed.
- With an empty `crms` DB every list is empty; Generic Form fallback, report templates and the type resolver depend on imported rows.
- No CRMS-specific vitest specs yet (runner exists).

---

## 7. How the four areas interact

```
                 public GET /api/content/*  ┌─────────────┐
   Landing site ◄──────────────────────────│             │
   POST /newsletter/subscribe, forgot-pw ─►│             │
                                            │   Laravel   │   regisph DB
   Client Portal ──POST /portal/activity──► │     API     │   (users, reports, content,
     ▲  GET /portal/reports (coverage)      │             │    audit_entries, client_activities,
     │  GET /reports/{id}/file, /me         │             │    email_blasts, portal_tokens…)
     │                                      │             │
     │ provisions / approves / resets       │             │   crms DB (legacy schema + additive)
   CMS ─────────────────────────────────────│             │
     ▲  Email desk: Graph send / .eml       │             │
     │  Client logs: reads the ledger       └─────────────┘
     │ /cms/email?compose=adhoc&…                 ▲
   CRMS ──────────────────────────────────────────┘  same staff token, audit_entries with "CRMS · "
```

1. **CMS → Landing.** Each content module writes a document or collection; the public page reads it through `GET /api/content/*` and falls back to bundled copy on failure (now surfaced in the Footer). Only `published`/`live`/`visible`/`open` rows are returned. Watchlist feeds the ribbon, Careers the `/careers` page, contact `social` the Footer, articles' `body` the article page, and the search index is derived from all of them.
2. **CMS → Portal.** Users & access provisions client accounts, issues single-use tokens, approves the queue, resets passwords. Reports module uploads PDFs, sets Spotlight, tunes Trending. `sector_prefs`/`preferred_analysts` are the portal's coverage mandate.
3. **Portal → CMS.** Every view/download/click posts a beacon into the hash-chained `client_activities` ledger. Bookmarks are per account.
4. **CMS Email desk → Portal.** Report blasts to Local clients carry `/portal?report={id}` deep links. Foreign clients get a manually pasted Jefferies link. Auto-match (prefs + CRMS sector groups) always stops in the desk for staff review.
5. **CMS ↔ CRMS.** Same accounts, same Sanctum token, `crms.*` keys seeded beside the CMS keys. CRMS audit rows land in `audit_entries` with `CRMS · `. `client_contact.portal_user_id` is the only cross-DB write; the Email desk matcher reads it.
6. **CRMS → CMS Email desk.** "Save and send to recipients" flags the interaction, posts `/actioned`, and opens `/cms/email?compose=adhoc&…`. The CRMS never sends mail itself, except the itinerary email.
7. **System mail.** Password resets (client + staff) and newsletter confirmations go out through `MicrosoftGraphMailer` from `MS_GRAPH_SENDER` (`App\Support\PasswordResetMail`, `resources/views/email/subscribe-confirm.blade.php`); onboarding invitations are still copy-paste from the CMS.
8. **Shared shells.** CMS, CRMS and Portal share dark mode, the picker kit, the rail orb activity bus, `apiFetch` and the `regis:unauthorized` sign-out event. The Landing site is always light and shares only `lib/api.ts` for the login doors and public forms.

---

## 8. Test status

Run 2026-09-21 after the gap-closing pass:

- **PHPUnit: 111 passed, 0 failed (1,259 assertions).** `tests/Feature/{EmailBlastSendTest,DistributionListTest}` rebuilt on `User::factory()` + `Role::where('name', …)`; new `tests/Feature/Portal/*` (33), `tests/Feature/Cms/*` (24), `tests/Feature/Crms/{MyActivityTest,SchemaDriftTest}`, `tests/Unit/Crms/ConnectionGuardTest`. `phpunit.xml` blanks `MS_GRAPH_*`. `PortalTestCase` resets the auth guard between token switches and disables throttling.
- **Vitest: 62 passed** across `lib/{api,eml,reportSearch}`, `portal/{watermark,preferences}`, `cms/{auth,store}`, `hooks/useTicker`, `components/SearchModal`, `pages/NotFound`.
- `npx tsc -p tsconfig.app.json --noEmit` clean; `vite build` succeeds (chunk-size warning only).
- CRMS tests run both CRMS migration files by `--path` in `setUp`. `migrate:status` on the default connection lists the CRMS `add_important` migration as pending because it belongs to the `crms` connection; that is expected.

**Uncommitted work on `main`** (as of this pass): the rail-orb / blobatar feature described in the previous audit plus everything in §3 to §7 above (104 modified files, ~50 new). Nothing has been committed; review and commit in logical groups (backend auth + portal, backend content + CMS, CRMS, public site, CMS frontend, portal frontend, test runner).
