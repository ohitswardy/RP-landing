/* ─────────────────────────────────────────────────────────────
   CRMS wire types — the camelCase shapes /api/crms returns (each
   model's toWire()). Ids are strings, dates are yyyy-mm-dd, times
   are HH:mm. Snapshot arrays keep the legacy snake_case keys they
   are stored with, since they are compliance records.
   ───────────────────────────────────────────────────────────── */

export type { AuditEntry } from '../cms/data';
export { fmtDate, timeAgo } from '../cms/data';

export type Client = {
  id: string;
  name: string;
  region: string | null;
  monikers: string | null;
  clientType: string | null;
  contactCount: number;
  addressCount: number;
  interactionCount: number;
  updatedAt: string | null;
};

export type ClientAddress = { id: string; clientId: string | null; name: string };

/** A corporate as copied into own / watchlist lists. */
export type CorporateSnapshot = { id: number; name: string; ticker: string | null; identifiers1?: string | null; identifiers2?: string | null };
/** A REGIS staff member as copied into coverage / attendee lists. */
export type SellsideSnapshot = { id: number; name: string; email?: string | null; type?: string | null; position?: string | null; office_no?: string | null; mobile_no?: string | null };
/** A client contact as copied onto interactions and events. */
export type ContactSnapshot = { id: number; name: string; email?: string | null; position?: string | null; contact_no?: string | null; mobile_no?: string | null; client_id?: number; client_name?: string | null };
export type CorporateContactSnapshot = { id: number; name: string; position?: string | null; email?: string | null; mobile?: string | null; phone?: string | null };

export type ClientContact = {
  id: string;
  clientId: string;
  clientName: string | null;
  addressId: string | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  contactNo: string | null;
  mobileNo: string | null;
  position: string | null;
  country: string | null;
  own: CorporateSnapshot[];
  watchlist: CorporateSnapshot[];
  coverageTeam: SellsideSnapshot[];
  sales: SellsideSnapshot[];
  assistant: string | null;
  assistantEmail: string | null;
  assistantContactNo: string | null;
  portalUserId: string | null;
  sectorGroupIds: string[];
  updatedAt: string | null;
};

export type Corporate = {
  id: string;
  name: string;
  ticker: string | null;
  identifiers1: string | null;
  identifiers2: string | null;
  address: string | null;
  sectorGeneric: string | null;
  sectorGmo: string | null;
  sectorJpmorgan: string | null;
  sectorSchroders: string | null;
  sectorTrowe: string | null;
  contactCount: number;
};

export type CorporateContact = {
  id: string;
  corporateId: string | null;
  corporateName: string | null;
  name: string;
  position: string | null;
  address: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  assistant: string | null;
  assistantEmail: string | null;
  analyst: SellsideSnapshot[];
};

export type SellsideContact = {
  id: string;
  name: string;
  email: string;
  type: string | null;
  position: string | null;
  officeNo: string | null;
  mobileNo: string | null;
};

/** sellside_contact.type as the production data holds it. */
export const SELLSIDE_TYPES = ['Analyst', 'Sales', 'N/A'];

export type InteractionType = { id: string; type: string; meetingTypes: string[]; clientId: string | null };

/* ── Dynamic form (Database.md §5) — the legacy shape, byte-compatible ── */

/** textBox and select are what production forms use; the others are additions the renderer understands. */
export type FieldType = 'textBox' | 'textArea' | 'select' | 'date' | 'number';
/** A select is a Static choice list or a Lookup over master data; other fields carry ''. */
export type OptionType = 'Static' | 'Lookup' | '';
export type LookupSource = 'Corporate' | 'CorporateContact' | 'SellsideContact';

export type FieldSchema = {
  id: number;
  internalName: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  multiLine?: boolean;
  rows?: number;
  multiSelect: boolean;
  /** Static: value = the choices. Lookup: value = the source name. bindLabel = the property shown (name | ticker). */
  options: { type: OptionType; value: string[] | LookupSource | string | null; bindLabel: string };
  column?: string;
  defaultValue: string | null;
};

export type Form = { id: string; clientId: string | null; fields: FieldSchema[] };

/** What a Lookup select stores: a snapshot of the picked master-data row. */
export type LookupSnapshot = { id: number; name: string; ticker?: string | null; email?: string | null; position?: string | null; identifiers1?: string | null; identifiers2?: string | null };
/** A captured value: '' for empty, a string, a list of strings, one snapshot, or a list of snapshots. */
export type FormFieldValue = string | string[] | LookupSnapshot | LookupSnapshot[] | null;

/** A captured field inside interactions.form — the field definition plus its value. */
export type FormValue = {
  id?: number;
  internalName: string;
  label: string;
  fieldType: string;
  options?: FieldSchema['options'];
  multiSelect?: boolean;
  value: FormFieldValue;
};

export type Disposition = 'closed' | 'flagged';

export type Interaction = {
  id: string;
  reference: string;
  date: string;
  timeStart: string | null;
  timeEnd: string | null;
  duration: string | null;
  minutes: number;
  meetingType: string | null;
  description: string | null;
  internalNotes: string | null;
  actionPoint: string | null;
  recipients: string | null;
  clientContacts: ContactSnapshot[];
  sellsideContacts: SellsideSnapshot[];
  form: FormValue[];
  clientId: string;
  clientName: string | null;
  typeId: string | null;
  typeName: string | null;
  authorId: string | null;
  disposition: Disposition;
  actionedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type InteractionPayload = {
  clientId: string;
  typeId: string | null;
  date: string;
  timeStart: string | null;
  timeEnd: string | null;
  duration: number | null;
  meetingType: string | null;
  description: string;
  internalNotes: string;
  actionPoint: string;
  recipients: string;
  clientContactIds: string[];
  sellsideContactIds: string[];
  form: FormValue[];
  disposition: Disposition;
};

export type Paged<T> = { items: T[]; total: number; page: number; pages: number };

/* ── Events ────────────────────────────────────────────────── */

export type EventCategory = 'roadshows' | 'reverse-roadshows' | 'meetings' | 'analyst-marketing';
/** The three that share the roadshow table; one-off meetings are their own record. */
export type RoadshowCategory = Exclude<EventCategory, 'meetings'>;

export const EVENT_TYPES: Record<EventCategory, { label: string; plural: string; code: string; subject: string }> = {
  'roadshows': { label: 'Company Roadshow', plural: 'Company roadshows', code: 'RS', subject: 'Corporate presenting' },
  'reverse-roadshows': { label: 'Reverse Roadshow', plural: 'Reverse roadshows', code: 'RR', subject: 'Visiting client' },
  'meetings': { label: 'One-Off Meeting', plural: 'One-off meetings', code: 'MT', subject: 'Counterparty' },
  'analyst-marketing': { label: 'Analyst Marketing', plural: 'Analyst marketing', code: 'AM', subject: 'Travelling analyst' },
};

export type CrmsEvent = {
  id: string;
  category: EventCategory;
  categoryLabel: string;
  classification: string | null;
  subject: string;
  startDate: string;
  endDate: string | null;
  coordinator: string | null;
  telNo: string | null;
  mobileNo: string | null;
  email: string | null;
  corporateId: string | null;
  corporateName: string | null;
  clientId: string | null;
  clientName: string | null;
  clientContacts: ContactSnapshot[];
  sellsideContacts: SellsideSnapshot[];
  meetingCount: number;
  updatedAt: string | null;
};

export type MeetingClassification = 'client' | 'corporate' | 'expert_meeting';

export type Meeting = {
  id: string;
  eventId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  timezone: string | null;
  location: string;
  meetingType: string;
  classification: MeetingClassification | null;
  description: string | null;
  contact: string | null;
  bookedBy: string | null;
  note: string | null;
  corporateAddress: string | null;
  clientContacts: ContactSnapshot[];
  corporateContacts: CorporateContactSnapshot[];
  clientId: string | null;
  clientName: string | null;
  corporateId: string | null;
  corporateName: string | null;
  counterparty: string;
  interactionId: string | null;
};

export type OneOffClassification = 'analyst' | 'corporate' | 'expert_meeting';

/** A standalone meeting — the legacy `event` table. */
export type OneOffMeeting = {
  id: string;
  category: 'meetings';
  categoryLabel: string;
  subject: string;
  startDate: string;
  endDate: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  timezone: string | null;
  location: string;
  meetingType: string | null;
  classification: OneOffClassification | null;
  description: string | null;
  note: string | null;
  corporateAddress: string | null;
  clientId: string | null;
  clientName: string | null;
  corporateId: string | null;
  corporateName: string | null;
  clientContacts: ContactSnapshot[];
  corporateContacts: CorporateContactSnapshot[];
  interactionId: string | null;
  updatedAt: string | null;
};

export type Investor = { id: string; eventId: string; clientId: string | null; clientName: string | null; clientContacts: ContactSnapshot[] };

export type Flight = {
  id: string; eventId: string; date: string; time: string; timezone: string | null; location: string; description: string | null;
  dateArrival: string | null; timeArrival: string | null; timezoneArrival: string | null; locationArrival: string | null;
  descriptionArrival: string | null; passenger: string | null; note: string | null;
};

export type Transportation = {
  id: string; eventId: string; date: string; startTime: string; endTime: string; timezone: string | null; location: string;
  description: string | null; driverName: string; driverMobile: string; vehicleType: string; confirmNo: string;
  remarks: string | null; passenger: string | null; note: string | null;
};

export type Accommodation = {
  id: string; eventId: string; date: string; timeIn: string | null; dateOut: string | null; timeOut: string | null;
  location: string | null; description: string | null; accommodator: string | null; note: string | null;
};

export type EventAttendee = {
  id: string; eventId: string; sellsideContactId: string; name: string | null; position: string | null;
  officeNo: string | null; mobileNo: string | null; email: string | null;
};

export type EventChildren = {
  meetings: Meeting[];
  investors: Investor[];
  flights: Flight[];
  transportation: Transportation[];
  accommodation: Accommodation[];
  attendees: EventAttendee[];
};

export type EventDetail = { item: CrmsEvent; children: EventChildren };

export type ItineraryItem = {
  kind: 'meeting' | 'flight' | 'transport' | 'hotel';
  time: string | null;
  timeEnd: string | null;
  timezone: string | null;
  title: string;
  subtitle: string | null;
  detail: string;
  people: string[];
  note: string | null;
};

export type Itinerary = {
  event: CrmsEvent;
  participants: {
    investors: { client: string | null; contacts: { name: string; position: string | null; email: string | null; phone: string | null }[] }[];
    regis: { name: string | null; position: string | null; email: string | null; phone: string | null }[];
  };
  summary: { date: string; meetings: { time: string; timeEnd: string; timezone: string | null; title: string; type: string; location: string }[] }[];
  days: { date: string; items: ItineraryItem[] }[];
  filteredTo: string | null;
  generatedAt: string;
};

/* ── Taxonomy, templates, portal ───────────────────────────── */

export type SectorScope = 'domestic' | 'foreign';
export type SectorGroup = { id: string; name: string; scope: SectorScope; position: number; corporateIds: string[]; subscriberCount: number };

export type ReportTemplateCode = 'corpaxe' | 'gmo' | 'jpmorgan' | 'schroders' | 'trowe';
export const TEMPLATE_CODES: Record<ReportTemplateCode, string> = {
  corpaxe: 'Corpaxe consumption', gmo: 'GMO', jpmorgan: 'JPMorgan', schroders: 'Schroders', trowe: 'T. Rowe Price',
};
export type ReportTemplate = { id: string; clientId: string; clientName: string | null; code: ReportTemplateCode; active: boolean };

export type PortalAccount = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  position: string | null;
  firm: string | null;
  clientType: 'Local' | 'Foreign' | null;
  sectorPrefs: string[];
  preferredAnalysts: string[];
  status: 'invited' | 'pending' | 'approved' | 'declined' | null;
  suspended: boolean;
  lastActive: string | null;
  approvedAt: string | null;
};

export type Consumption = { id: string; event: 'view' | 'download' | 'click'; target: string; context: string; reportId: string | null; at: string };

export type PortalLink = {
  state: 'unlinked' | 'linked' | 'missing';
  account: PortalAccount | null;
  mismatches: { field: string; crms: string; portal: string }[];
  suggestions: PortalAccount[];
  consumption: Consumption[];
};

export type DashboardSummary = {
  range: { from: string; to: string };
  totals: { interactions: number; minutes: number; clients: number; openFlags: number; upcomingEvents: number };
  byMonth: { month: string; minutes: number; count: number }[];
  byClient: { client: string; clientId: string; minutes: number; count: number }[];
  topStocks: { stock: string; mentions: number }[];
  reverseDemand: { corporate: string; ticker: string | null; requests: number; clients: string[] }[];
};

/* ── Helpers ───────────────────────────────────────────────── */

export const today = (): string => new Date().toISOString().slice(0, 10);

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtRange(from: string, to: string | null): string {
  if (!to || to === from) return fmtDay(from);
  return `${fmtDay(from)} – ${fmtDay(to)}`;
}
