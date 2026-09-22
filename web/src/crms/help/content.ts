/* ─────────────────────────────────────────────────────────────
   In-app guide content for the CRMS. One entry per module plus
   the shared basics. Facts here mirror CLAUDE.md §6 and the code
   they describe; when a module changes, change its entry in the
   same commit. `perm` hides an entry from roles that cannot open
   the module; `to` is the route the heading links to.
   ───────────────────────────────────────────────────────────── */

export type HelpSection = {
  id: string;
  code: string;
  title: string;
  to: string | null;
  perm?: string;
  /** What it is, in one or two sentences. */
  summary: string;
  /** The things you do there. */
  actions: string[];
  /** Behaviour that surprises people, stated plainly. */
  gotchas: string[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'basics',
    code: '—',
    title: 'Signing in and permissions',
    to: null,
    summary: 'The CRMS has no accounts of its own. You sign in at /login/crms with your CMS staff account; only roles holding crms.access get in (Administrator and Analyst today, Editor is refused).',
    actions: [
      'Reads are open to every CRMS role. Writes are fenced by key: crms.contacts.manage (clients, contacts, corporates, directory, sector groups), crms.interactions.manage, crms.events.manage, crms.reports.generate, crms.admin (types, forms, templates, logs).',
      'Open CMS from the header: the same token serves both areas, so you are already signed in there.',
      'Dark mode is per browser (the toggle in the header) and shared with the CMS and portal shells.',
    ],
    gotchas: [
      'Permissions are frozen at sign-in. A role change in CMS → Users & access takes effect after you sign out and back in.',
      'The session lives in sessionStorage: closing the tab signs you out.',
      'Every write lands in the CMS audit ledger with a "CRMS · " prefix and your name; there is no client-side logging to skip.',
    ],
  },
  {
    id: 'dashboard',
    code: '00',
    title: 'Dashboard',
    to: '/crms',
    summary: 'Logged client contact for a date range: stat tiles, minutes by month, the clients taking the most time, the stocks most discussed, reverse-roadshow demand and the legacy tallies (company roadshows per corporate, reverse roadshows per client).',
    actions: [
      'Pick From / To; every figure but the important shelf follows the range.',
      'Click Important, Open flags or Upcoming events to jump to the filtered list, or the calendar.',
    ],
    gotchas: [
      'The important shelf is pinned, not range-bound: it always shows the latest 8 starred interactions regardless of the dates picked.',
      'Contact time is minutes: the typed duration, else end − start, else zero.',
    ],
  },
  {
    id: 'interactions',
    code: '01',
    title: 'Interactions',
    to: '/crms/interactions',
    summary: 'The consumption record — one row per client touchpoint, the evidence the firm is paid on. Listed server-side with filters for year, client, type, importance, disposition and free text.',
    actions: [
      'New interaction: pick the client first; it decides the form, the type list and the contacts offered.',
      'Save and close files the record (disposition closed). Save and send to recipients flags it, marks it actioned, and opens the CMS Email desk in a new tab with an ad-hoc composer seeded from the summary and the Recipients line.',
      'Star an interaction (list, record or dashboard) to pin it to the dashboard shelf with a one-line note; the star can be toggled without re-saving the form.',
    ],
    gotchas: [
      'The form is resolved in this order: the client\'s own form → a form with no client → the Generic Form owned by client id 81. Client 81 is a pseudo-client; do not delete it.',
      'Once flagged and actioned the record locks against Save and send: it cannot be handed to the Email desk twice. Save and close still works.',
      'The CRMS never sends mail. The Email desk does, through the same Graph pipeline and delivery log as every CMS email.',
      'Author attribution: interactions.user_id points at the legacy user directory and is set by matching your CMS email to a legacy row. When there is no match the form says so and the author lives in the audit ledger only; the record still counts in every report.',
      'Attendee lists and the captured form are snapshots taken at save time; editing a contact later does not rewrite old records.',
    ],
  },
  {
    id: 'events',
    code: '02',
    title: 'Events',
    to: '/crms/events/roadshows',
    summary: 'Company roadshows, reverse roadshows and analyst marketing trips share one record with six child tabs — Meetings, Investors, Flights, Transportation, Accommodation and the Regis party — printed together as an itinerary. One-off meetings are single slots with no children.',
    actions: [
      'Create the event header first, then fill the child tabs; each child saves on its own.',
      'Itinerary: view it, download the PDF (dompdf, legacy cover and page numbers), or email it — to yourself by default — through the shared Graph mailbox. Filter it to one client contact for a personal copy.',
      'Convert a meeting (or a one-off meeting) into an interaction from its row; the new record opens in Interactions.',
    ],
    gotchas: [
      'Subject rules are enforced server-side: a Company Roadshow needs its corporate, a Reverse Roadshow needs the visiting client, Analyst Marketing needs at least one travelling analyst, and a one-off meeting needs a client or a corporate.',
      'Convert to interaction answers 409 if the meeting was already converted (the link to the existing interaction is kept) and 422 when the meeting has no client — set one first.',
      'The interaction type on conversion is resolved on a normalised key ("Roadshow:Deal" and "Roadshow: Deal" are the same); a client-scoped type beats a global one.',
      'Itinerary email answers 503 when Microsoft Graph is not configured on the server; download the PDF instead.',
      'Deleting an event deletes all six child collections with it.',
      'The hotel line repeats on every day of the stay on the printed itinerary; that is by design.',
    ],
  },
  {
    id: 'calendar',
    code: '03',
    title: 'Calendar',
    to: '/crms/events/calendar',
    summary: 'Every roadshow, meeting slot and one-off meeting on one calendar: month, week, day and list views over a date range.',
    actions: ['Switch views for shape versus slots; click an entry to open its event.'],
    gotchas: ['Roadshows that span the visible range appear on every day they cover; meetings appear on their own date.'],
  },
  {
    id: 'clients',
    code: '04',
    title: 'Clients',
    to: '/crms/clients',
    summary: 'Institutional investor firms, the buy-side, with their offices (addresses), their people and the portal accounts the CMS has issued to them.',
    actions: ['Create or edit a client and its addresses; open a client to see its contacts and interactions.'],
    gotchas: [
      'Client id 81 "Generic Form" owns the default interaction form and the shared interaction types. It is a pseudo-client, not a firm.',
      'Writes need crms.contacts.manage.',
    ],
  },
  {
    id: 'client-contacts',
    code: '05',
    title: 'Client contacts',
    to: '/crms/client-contacts',
    summary: 'The individuals behind every interaction: what they own and watch, who covers them (coverage team and sales), which research sectors they are tagged for, and whether their portal account is linked.',
    actions: [
      'Own / Watchlist pick corporates; Coverage team / Sales pick people from the Regis directory. All four are stored as snapshots.',
      'Portal panel: link the CMS portal account by exact email (suggested automatically when there is exactly one match), or unlink.',
    ],
    gotchas: [
      'Portal panel states: unlinked (no account chosen), linked (account found; mismatched name, email or firm are flagged but never overwritten), missing (the linked account was deleted in the CMS — unlink or pick a replacement).',
      'Consumption shown in the panel comes from the portal\'s hash-chained activity ledger, read live from the CMS.',
      'The portal account itself is edited in CMS → Users & access, not here.',
    ],
  },
  {
    id: 'corporates',
    code: '06',
    title: 'Corporates',
    to: '/crms/corporates',
    summary: 'Listed companies the desk covers or arranges access to, with a sector under each client template (generic, GMO, JPMorgan, Schroders, T. Rowe), and the IR and management contacts met on roadshows.',
    actions: ['Edit the corporate and its five sector columns; add issuer contacts under it.'],
    gotchas: ['The five sector columns feed the By-client reports; a blank sector prints blank on that client\'s workbook.'],
  },
  {
    id: 'sellside',
    code: '07',
    title: 'Regis directory',
    to: '/crms/sellside-contacts',
    summary: 'Analysts, sales and management as they appear on itineraries, coverage teams and interaction records. Type is Analyst, Sales or N/A.',
    actions: ['Keep positions and numbers current: schedules print them, and the Regis tab on an event snapshots them.'],
    gotchas: [
      'My activity matches you to events by this directory\'s email: a Regis-tab row or a header analyst whose directory email equals your CMS email counts as attended.',
      'This directory is not the legacy user table; it does not affect author attribution on interactions.',
    ],
  },
  {
    id: 'distribution-list',
    code: '08',
    title: 'Distribution list',
    to: '/crms/distribution-list',
    summary: 'The research sector taxonomy, held separately for domestic and foreign audiences, down to the tickers in each sector. Client contacts are tagged into it from their record.',
    actions: [
      'Add or reorder sector groups and assign corporates to them; tag contacts from Client contacts.',
      'The CMS Email desk report matcher reads these tags: a report\'s company is matched to a corporate (ticker, else exact name), every sector group holding it names its tagged contacts, and those with a linked portal account join the prefill alongside the portal\'s own sector and analyst preferences.',
    ],
    gotchas: [
      'A contact with tags but no linked portal account cannot be reached: the matcher resolves recipients through client_contact.portal_user_id. The module lists those contacts; link them from their record.',
      'Nothing is sent from here. The legacy research-email blaster was not rebuilt; audiences and sends live in CMS → Email desk.',
    ],
  },
  {
    id: 'reports',
    code: '09',
    title: 'Reports',
    to: '/crms/reports',
    perm: 'crms.reports.generate',
    summary: 'Excel workbooks of logged interactions for a date range — the evidence clients\' compliance teams ask for.',
    actions: [
      'Generic: the flat Salesforce / T1C extract, one sheet, 18 fixed headers on row 1, no title rows.',
      'Internal: the call report with Bespoke, Official events, Summary, Monthly by firm, Sales and Analysts sheets.',
      'By client: one client in their own Excel template. Schroders and JPM (bound to the Commcise code) get the exact Commcise template each downloaded on 2026-09-21, bundled with the CRMS; any other client’s workbook is imported in Form builder → Report template. Clients on Corpaxe, GMO, T. Rowe or the legacy JPMorgan / Schroders sheets keep those built-in layouts; a client without a binding gets the generic layout.',
      'A client workbook (bundled or imported) is filled in place from the data-start row of its data tab. Every other tab (BuysideContacts, ClientInteractionType, Region, Roles, Client Data Quality Rules, Lookup, Instructions…), every style, merged band, dropdown and conditional format comes back exactly as in the file; a per-row formula such as Jefferies’ Errors column is re-addressed to every row; “Template Date” / “Downloaded by” cells are stamped.',
      'Commcise (Schroders / JPM): the 28 columns from A8, values separated by |, start times converted to UTC, REGIS-{id} as the all-time unique Interaction Id, Ticker identifiers in Bloomberg style; JPM gets APAC - Philippines and Equity / FI. The file is named the way Commcise names its downloads: “2026-09-22-Schroders-Commcise Template_20260922143000.xlsx”.',
      'Jefferies upload: Jefferies’ own bulk-upload workbook (“Aug 2026 - Regis Interactions.xlsx”, sample rows removed) filled with every Foreign-client interaction in range: Meeting Type and Method derived from the CRMS type so the Errors formula stays empty, Duration clamped to 15–480, Internal Attendee = owner + Regis emails, tickers Bloomberg style (ALI PM), GICS only when no ticker applies. Named “Sep 2026 - Regis Interactions.xlsx” for one month. The upload is bound to the client named Jefferies (Bindings → “Jefferies bulk upload”): Original downloads the bundled workbook, “Import a newer download” replaces it with the file Jefferies sends, and removing that import brings the bundled one back.',
    ],
    gotchas: [
      'Every interaction in range is included regardless of who logged it, and the range is applied exactly.',
      'Sales / Analysts sheets group by the legacy user\'s type; an author without a legacy match does not appear there by name.',
      'Report templates are bound under Administration; the seeder binds client ids 10, 23, 59, 72 (JPM → Commcise), 126 (Schroders → Commcise), 139 and the client named Jefferies (→ Jefferies bulk upload), and never overwrites a workbook the desk imported. Import Excel (here or in the Form builder) replaces a client’s binding with a workbook they sent, e.g. a fresher Commcise download.',
      'An imported template whose rows are “Every Foreign client” (a co-brand upload such as Jefferies’) ignores the client picked and lists the whole foreign book, as the Jefferies upload type does.',
    ],
  },
  {
    id: 'ticker-search',
    code: '10',
    title: 'Ticker search',
    to: '/crms/ticker-search',
    summary: 'How the register is covered: the stocks clients hold and watch most, the contacts with positions, the latest interactions naming a corporate, and the corporates still missing a ticker.',
    actions: ['Pick a stock for its call list: owners, watchers and the last interactions that discussed it.'],
    gotchas: ['Holders come from the own / watchlist snapshots on contacts; last-discussed reads the form\'s corporate lookups and the stock1–stock5 fields, so a bare ticker typed into a text field matches only by ticker.'],
  },
  {
    id: 'interaction-types',
    code: '11',
    title: 'Interaction types',
    to: '/crms/interaction-types',
    perm: 'crms.admin',
    summary: 'How the desk classifies a touchpoint. Global types apply everywhere; a client-scoped type appears only on that client\'s form. Sub-types become the meeting-type list.',
    actions: ['Add, rename or scope a type; edit its sub-types.'],
    gotchas: ['Meeting → interaction conversion matches types on a normalised key, client-scoped first; keep names close to the legacy spellings (Deal / Non-Deal Roadshow, Bespoke, Expert, Analyst meeting).'],
  },
  {
    id: 'form-builder',
    code: '12',
    title: 'Form builder',
    to: '/crms/form-builder',
    perm: 'crms.admin',
    summary: 'The structured fields captured on an interaction, one form per client, falling back to the Generic Form.',
    actions: [
      'Add fields (text or select); a select either lists typed choices (Static) or looks up Corporate, CorporateContact or SellsideContact rows (Lookup).',
      'Import columns: drop the client’s own CSV or .xlsx, tick the columns that should become fields (from any tab of the workbook), and adjust label, internal name and type before adding them. The first row of each tab is read as headers; repeating values become select choices, numbers and dates get their own types. The file is read in the browser and never uploaded.',
      'Report template (per client form): Schroders and JPM already show their bundled Commcise workbook (download it with Original). For any other client, or a newer download, import the Excel workbook the compliance desk sends. The data tab, header row and first data row are detected (a “Your data starts here” marker is understood); every column is matched to a CRMS data source by its header, using the Commcise or Jefferies vocabulary the workbook reveals, with live values from the client’s latest interactions to check against. Change any column: a system field, a form-builder field, fixed text, empty, or the template’s own formula. Lists take the separator the template asks for (“|” for Commcise, “,” for Jefferies); dates and times are written as real Excel values in the template’s own format.',
      'Rows included: “This client’s interactions” for a Commcise-style file, “Every Foreign client” for a co-brand upload like Jefferies’. Original downloads the workbook as imported; Replace or re-map drops a new version (the mapping carries over where headers match) or edits the mapping alone.',
    ],
    gotchas: [
      'The stored JSON stays byte-compatible with the legacy app: field types textBox | select, option types Static | Lookup, and lookup values saved as row snapshots.',
      'Internal names are what the reports read (e.g. stock1–stock5, Companies Discussed). Renaming one silently drops it from the workbooks, and from any imported template column mapped to that form field.',
      'The imported workbook is stored on the server as uploaded; only its data tab changes at generation time. Removing the template deletes the workbook and the client falls back to the generic layout.',
    ],
  },
  {
    id: 'logs',
    code: '13',
    title: 'Logs',
    to: '/crms/logs',
    perm: 'crms.admin',
    summary: 'The CRMS slice of the CMS audit ledger: every create, update, delete, link and report generated through the CRMS, attributed to the signed-in staff member.',
    actions: ['Filter by year and month, search actor, action or target; 50 rows a page.'],
    gotchas: ['Rows are written server-side on every mutation; the legacy `log` table is intentionally unused.'],
  },
  {
    id: 'my-activity',
    code: '14',
    title: 'My activity',
    to: '/crms/my-activity',
    summary: 'Your own footprint for a range: profile and legacy-user match, tiles, and one feed merging your interactions, one-off meetings, the roadshows you were on and your rows in the ledger.',
    actions: ['Pick a range; open any record from the feed.'],
    gotchas: [
      'Interactions and meetings are yours when their legacy author id matches your email. Events attended are matched through the Regis directory email. Events created and everything else come from the ledger.',
      'Not matched means the legacy user table has no row with your CMS email; ask an administrator to add one, then sign in again.',
    ],
  },
];
