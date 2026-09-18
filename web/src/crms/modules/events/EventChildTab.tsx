import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../cms/auth';
import { BtnGhost, BtnPrimary, DateField, RowAction, TextField, useConfirm } from '../../../cms/ui';
import { Modal } from '../../../cms/kit/parts';
import { IconArrowRight, IconCheck, IconPen, IconPlus, IconTrash } from '../../../cms/icons';
import { useCrms } from '../../store';
import DataTable, { type Column } from '../../kit/DataTable';
import { FormError, MultiPicker, Picker, TimeField } from '../../kit/fields';
import { useOptions } from '../../kit/options';
import { errorText, useToast } from '../../kit/toast';
import {
  fmtDay, today, type Accommodation, type AuditEntry, type CrmsEvent, type EventAttendee, type EventChildren, type Flight,
  type Investor, type Meeting, type MeetingClassification, type SellsideContact, type Transportation,
} from '../../data';

/* ─────────────────────────────────────────────────────────────
   One generic tab for every child resource of an event. A
   config per type supplies the columns, a blank draft, the
   fields to render, and the payload mapping; the tab handles
   list, add, edit, delete and the meeting → interaction hand-off.
   ───────────────────────────────────────────────────────────── */

export type ChildKey = keyof EventChildren;
type Row = EventChildren[ChildKey][number];

type Config<T extends Row, D> = {
  title: string;
  singular: string;
  columns: Column<T>[];
  blank: (event: CrmsEvent) => D;
  fromRow: (row: T) => D;
  fields: (draft: D, set: <K extends keyof D>(k: K, v: D[K]) => void, ctx: Ctx) => ReactNode;
  payload: (draft: D) => Record<string, unknown>;
  wide?: boolean;
};

type Ctx = {
  event: CrmsEvent;
  options: ReturnType<typeof useOptions>;
  /** Registered addresses, for the auto-fill when a counterparty is picked. */
  addressOf: { client: (id: string | null) => string; corporate: (id: string | null) => string };
  staffById: (id: string | null) => SellsideContact | null;
};

/** Free-text labels as the data holds them (MNL, SG, HK, HKG, KL, PH…); display-only, never converted. */
const TZ = ['MNL', 'PH', 'SG', 'HK', 'HKG', 'HKT', 'KL', 'JP', 'GMT'];
const nul = (s: string) => (s.trim() ? s : null);

/** Timezone as a free-text label with the usual suggestions. */
function TzField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Timezone</label>
      <input list="crms-tz" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} placeholder="MNL" className="mono w-full border rule bg-white px-3.5 py-2.5 text-[13px] uppercase text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]" />
      <datalist id="crms-tz">{TZ.map((t) => <option key={t} value={t} />)}</datalist>
    </div>
  );
}
const lines = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
  <TextField label={label} value={value} onChange={onChange} multiline placeholder={placeholder ?? 'One per line'} />
);

/* ── Meetings ──────────────────────────────────────────────── */

type MeetingDraft = {
  date: string; timeStart: string | null; timeEnd: string | null; timezone: string; location: string; meetingType: string;
  classification: MeetingClassification; description: string; contact: string; bookedBy: string; note: string; corporateAddress: string;
  clientId: string | null; corporateId: string | null; clientContactIds: string[]; corporateContactIds: string[];
  /** Analyst Marketing only: which of the travelling analysts sit in this meeting (kept in corporate_contact, as legacy did). */
  analystIds: string[];
};

const CLASS_LABEL: Record<MeetingClassification, string> = { client: 'Client meeting', corporate: 'Corporate meeting', expert_meeting: 'Expert / site visit' };

const meetings: Config<Meeting, MeetingDraft> = {
  title: 'Meetings', singular: 'meeting', wide: true,
  columns: [
    { key: 'date', label: 'Date', mono: true, render: (m) => <span className="mono text-[12.5px]">{fmtDay(m.date)}</span> },
    { key: 'time', label: 'Time', mono: true, value: (m) => `${m.timeStart}–${m.timeEnd} ${m.timezone ?? ''}` },
    { key: 'counterparty', label: 'With', render: (m) => <span className="text-ink">{m.counterparty}</span> },
    { key: 'classification', label: 'Kind', value: (m) => (m.classification ? CLASS_LABEL[m.classification] : '') },
    { key: 'meetingType', label: 'Format' },
    { key: 'location', label: 'Location' },
    { key: 'attendees', label: 'Attendees', value: (m) => [...m.clientContacts, ...m.corporateContacts].map((c) => c.name).join(', '), hidden: true },
    { key: 'interactionId', label: 'Interaction', sortable: false, value: (m) => m.interactionId ?? '', render: (m) => m.interactionId ? <Link to={`/crms/interactions/${m.interactionId}`} className="mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)] hover:underline">Logged →</Link> : <span className="text-silver">—</span> },
  ],
  blank: (e) => ({
    date: e.startDate, timeStart: '09:00', timeEnd: '10:00', timezone: 'MNL', location: '', meetingType: 'One-on-one',
    classification: e.category === 'reverse-roadshows' ? 'corporate' : 'client', description: '', contact: '', bookedBy: '', note: '', corporateAddress: '',
    clientId: e.clientId, corporateId: e.category === 'reverse-roadshows' ? null : e.corporateId, clientContactIds: [], corporateContactIds: [],
    analystIds: e.category === 'analyst-marketing' ? e.sellsideContacts.map((s) => String(s.id)) : [],
  }),
  fromRow: (m) => ({
    date: m.date, timeStart: m.timeStart, timeEnd: m.timeEnd, timezone: m.timezone ?? 'MNL', location: m.location, meetingType: m.meetingType,
    classification: m.classification ?? 'client', description: m.description ?? '', contact: m.contact ?? '', bookedBy: m.bookedBy ?? '', note: m.note ?? '', corporateAddress: m.corporateAddress ?? '',
    clientId: m.clientId, corporateId: m.corporateId, clientContactIds: m.clientContacts.map((c) => String(c.id)), corporateContactIds: m.corporateContacts.map((c) => String(c.id)),
    analystIds: m.corporateContacts.map((c) => String(c.id)),
  }),
  fields: (d, set, { event, options, addressOf }) => (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Meeting classification" className="grid gap-px border rule bg-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] sm:grid-cols-3">
        {(Object.keys(CLASS_LABEL) as MeetingClassification[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={d.classification === k} onClick={() => set('classification', k)} className={`px-4 py-3 text-left text-[13px] transition-colors ${d.classification === k ? 'bg-navy text-paper' : 'bg-paper text-slate hover:bg-bone'}`}>{CLASS_LABEL[k]}</button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {d.classification !== 'expert_meeting' && (
          d.classification === 'client'
            // Picking a counterparty fills its registered address in unless one was typed, as the legacy form did.
            ? <Picker label="Client" options={options.clients} value={d.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); if (!d.corporateAddress.trim()) set('corporateAddress', addressOf.client(v)); }} allowEmpty={false} />
            : <Picker label="Corporate" options={options.corporates} value={d.corporateId} onChange={(v) => { set('corporateId', v); set('corporateContactIds', []); if (!d.corporateAddress.trim()) set('corporateAddress', addressOf.corporate(v)); }} allowEmpty={false} />
        )}
        {d.classification === 'expert_meeting' && <div className="sm:col-span-2"><TextField label="Expert / site" value={d.description} onChange={(v) => set('description', v)} placeholder="Who or where, typed by hand" /></div>}
        {d.classification === 'client' && <MultiPicker label="Client contacts" options={options.contactsOf(d.clientId)} value={d.clientContactIds} onChange={(v) => set('clientContactIds', v)} />}
        {d.classification === 'corporate' && <MultiPicker label="Corporate contacts" options={options.corporateContactsOf(d.corporateId)} value={d.corporateContactIds} onChange={(v) => set('corporateContactIds', v)} />}
      </div>
      {d.classification === 'client' && event.category === 'analyst-marketing' && (
        <MultiPicker label="Analysts in this meeting" options={options.sellside.filter((s) => event.sellsideContacts.some((t) => String(t.id) === s.id))} value={d.analystIds} onChange={(v) => set('analystIds', v)} hint="from the travelling party" />
      )}
      {d.classification === 'client' && event.category === 'roadshows' && event.corporateId && (
        <MultiPicker label={`${event.corporateName ?? 'Corporate'} contacts attending`} options={options.corporateContactsOf(event.corporateId)} value={d.corporateContactIds} onChange={(v) => set('corporateContactIds', v)} />
      )}
      {d.classification === 'corporate' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Picker label="Client attending" options={options.clients} value={d.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); }} hint="optional" />
          <MultiPicker label="Client contacts" options={options.contactsOf(d.clientId)} value={d.clientContactIds} onChange={(v) => set('clientContactIds', v)} />
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-4">
        <DateField label="Date" value={d.date} onChange={(v) => set('date', v)} />
        <TimeField label="Start" value={d.timeStart} onChange={(v) => set('timeStart', v)} />
        <TimeField label="End" value={d.timeEnd} onChange={(v) => set('timeEnd', v)} />
        <TzField value={d.timezone} onChange={(v) => set('timezone', v)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Location" value={d.location} onChange={(v) => set('location', v)} placeholder="Office, hotel, venue" />
        <TextField label="Format" value={d.meetingType} onChange={(v) => set('meetingType', v)} placeholder="One-on-one, Group meeting, Site visit" />
      </div>
      <TextField label="Address" value={d.corporateAddress} onChange={(v) => set('corporateAddress', v)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Booked by" value={d.bookedBy} onChange={(v) => set('bookedBy', v)} />
        <TextField label="Other attendees" value={d.contact} onChange={(v) => set('contact', v)} />
      </div>
      {d.classification !== 'expert_meeting' && <TextField label="Description" value={d.description} onChange={(v) => set('description', v)} multiline />}
      <TextField label="Note (printed on the itinerary)" value={d.note} onChange={(v) => set('note', v)} multiline />
    </div>
  ),
  payload: (d) => ({
    date: d.date, timeStart: d.timeStart, timeEnd: d.timeEnd, timezone: nul(d.timezone), location: d.location, meetingType: d.meetingType, classification: d.classification,
    description: nul(d.description), contact: nul(d.contact), bookedBy: nul(d.bookedBy), note: nul(d.note), corporateAddress: nul(d.corporateAddress),
    clientId: d.clientId ? Number(d.clientId) : null, corporateId: d.corporateId ? Number(d.corporateId) : null,
    clientContactIds: d.clientContactIds.map(Number), corporateContactIds: d.corporateContactIds.map(Number),
    analystIds: d.analystIds.map(Number),
  }),
};

/* ── Investors ─────────────────────────────────────────────── */

type InvestorDraft = { clientId: string | null; clientContactIds: string[] };
const investors: Config<Investor, InvestorDraft> = {
  title: 'Investors', singular: 'investor',
  columns: [
    { key: 'clientName', label: 'Client', render: (i) => <span className="text-ink">{i.clientName}</span> },
    { key: 'contacts', label: 'Contacts', value: (i) => i.clientContacts.map((c) => c.name).join(', ') },
    { key: 'count', label: 'People', mono: true, align: 'right', value: (i) => i.clientContacts.length },
  ],
  blank: () => ({ clientId: null, clientContactIds: [] }),
  fromRow: (i) => ({ clientId: i.clientId, clientContactIds: i.clientContacts.map((c) => String(c.id)) }),
  fields: (d, set, { options }) => (
    <div className="space-y-5">
      <Picker label="Client" options={options.clients} value={d.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); }} allowEmpty={false} />
      <MultiPicker label="Contacts attending" options={options.contactsOf(d.clientId)} value={d.clientContactIds} onChange={(v) => set('clientContactIds', v)} />
    </div>
  ),
  payload: (d) => ({ clientId: d.clientId ? Number(d.clientId) : null, clientContactIds: d.clientContactIds.map(Number) }),
};

/* ── Flights ───────────────────────────────────────────────── */

type FlightDraft = { date: string; time: string | null; timezone: string; location: string; description: string; dateArrival: string; timeArrival: string | null; timezoneArrival: string; locationArrival: string; descriptionArrival: string; passenger: string; note: string };
const flights: Config<Flight, FlightDraft> = {
  title: 'Flights', singular: 'flight', wide: true,
  columns: [
    { key: 'date', label: 'Departs', mono: true, value: (f) => `${f.date} ${f.time}`, render: (f) => <span className="mono text-[12.5px]">{fmtDay(f.date)} {f.time} {f.timezone}</span> },
    { key: 'location', label: 'From', render: (f) => <span className="text-ink">{f.location}</span> },
    { key: 'locationArrival', label: 'To' },
    { key: 'arrival', label: 'Arrives', mono: true, value: (f) => (f.dateArrival ? `${f.dateArrival} ${f.timeArrival ?? ''}` : ''), render: (f) => <span className="mono text-[12.5px]">{f.dateArrival ? `${fmtDay(f.dateArrival)} ${f.timeArrival ?? ''} ${f.timezoneArrival ?? ''}` : '—'}</span> },
    { key: 'description', label: 'Flight' },
    { key: 'passenger', label: 'Passengers', value: (f) => (f.passenger ?? '').replace(/\n/g, ', ') },
  ],
  blank: (e) => ({ date: e.startDate, time: '08:00', timezone: 'MNL', location: '', description: '', dateArrival: e.startDate, timeArrival: null, timezoneArrival: 'MNL', locationArrival: '', descriptionArrival: '', passenger: '', note: '' }),
  fromRow: (f) => ({ date: f.date, time: f.time, timezone: f.timezone ?? 'MNL', location: f.location, description: f.description ?? '', dateArrival: f.dateArrival ?? '', timeArrival: f.timeArrival, timezoneArrival: f.timezoneArrival ?? 'MNL', locationArrival: f.locationArrival ?? '', descriptionArrival: f.descriptionArrival ?? '', passenger: f.passenger ?? '', note: f.note ?? '' }),
  fields: (d, set) => (
    <div className="space-y-5">
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Departure</p>
      <div className="grid gap-5 sm:grid-cols-4">
        <DateField label="Date" value={d.date} onChange={(v) => set('date', v)} />
        <TimeField label="Time" value={d.time} onChange={(v) => set('time', v)} />
        <TzField value={d.timezone} onChange={(v) => set('timezone', v)} />
        <TextField label="Airport" value={d.location} onChange={(v) => set('location', v)} placeholder="MNL · NAIA T3" />
      </div>
      <TextField label="Flight" value={d.description} onChange={(v) => set('description', v)} placeholder="PR 507" />
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Arrival</p>
      <div className="grid gap-5 sm:grid-cols-4">
        <DateField label="Date" value={d.dateArrival} onChange={(v) => set('dateArrival', v)} />
        <TimeField label="Time" value={d.timeArrival} onChange={(v) => set('timeArrival', v)} />
        <TzField value={d.timezoneArrival} onChange={(v) => set('timezoneArrival', v)} />
        <TextField label="Airport" value={d.locationArrival} onChange={(v) => set('locationArrival', v)} placeholder="SIN · Changi T1" />
      </div>
      <TextField label="Arrival notes" value={d.descriptionArrival} onChange={(v) => set('descriptionArrival', v)} />
      <div className="grid gap-5 sm:grid-cols-2">
        {lines('Passengers', d.passenger, (v) => set('passenger', v))}
        <TextField label="Note" value={d.note} onChange={(v) => set('note', v)} multiline />
      </div>
    </div>
  ),
  payload: (d) => ({ date: d.date, time: d.time, timezone: nul(d.timezone), location: d.location, description: nul(d.description), dateArrival: nul(d.dateArrival), timeArrival: d.timeArrival, timezoneArrival: nul(d.timezoneArrival), locationArrival: nul(d.locationArrival), descriptionArrival: nul(d.descriptionArrival), passenger: nul(d.passenger), note: nul(d.note) }),
};

/* ── Ground transportation ─────────────────────────────────── */

type TranspoDraft = { date: string; startTime: string | null; endTime: string | null; timezone: string; location: string; description: string; driverName: string; driverMobile: string; vehicleType: string; confirmNo: string; remarks: string; passenger: string; note: string };
const transportation: Config<Transportation, TranspoDraft> = {
  title: 'Ground transportation', singular: 'transport booking', wide: true,
  columns: [
    { key: 'date', label: 'Date', mono: true, render: (t) => <span className="mono text-[12.5px]">{fmtDay(t.date)}</span> },
    { key: 'time', label: 'Window', mono: true, value: (t) => `${t.startTime}–${t.endTime} ${t.timezone ?? ''}` },
    { key: 'vehicleType', label: 'Vehicle', render: (t) => <span className="text-ink">{t.vehicleType || '—'}</span> },
    { key: 'location', label: 'Pick-up' },
    { key: 'driverName', label: 'Driver', value: (t) => [t.driverName, t.driverMobile].filter(Boolean).join(' · ') },
    { key: 'confirmNo', label: 'Conf. no.', mono: true },
  ],
  blank: (e) => ({ date: e.startDate, startTime: '08:00', endTime: '18:00', timezone: 'MNL', location: '', description: '', driverName: '', driverMobile: '', vehicleType: '', confirmNo: '', remarks: '', passenger: '', note: '' }),
  fromRow: (t) => ({ date: t.date, startTime: t.startTime, endTime: t.endTime, timezone: t.timezone ?? 'MNL', location: t.location, description: t.description ?? '', driverName: t.driverName, driverMobile: t.driverMobile, vehicleType: t.vehicleType, confirmNo: t.confirmNo, remarks: t.remarks ?? '', passenger: t.passenger ?? '', note: t.note ?? '' }),
  fields: (d, set) => (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-4">
        <DateField label="Date" value={d.date} onChange={(v) => set('date', v)} />
        <TimeField label="From" value={d.startTime} onChange={(v) => set('startTime', v)} />
        <TimeField label="To" value={d.endTime} onChange={(v) => set('endTime', v)} />
        <TzField value={d.timezone} onChange={(v) => set('timezone', v)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Pick-up location" value={d.location} onChange={(v) => set('location', v)} />
        <TextField label="Vehicle (optional)" value={d.vehicleType} onChange={(v) => set('vehicleType', v)} placeholder="Toyota Alphard" />
        <TextField label="Driver (optional)" value={d.driverName} onChange={(v) => set('driverName', v)} />
        <TextField label="Driver mobile (optional)" value={d.driverMobile} onChange={(v) => set('driverMobile', v)} />
        <TextField label="Confirmation no. (optional)" value={d.confirmNo} onChange={(v) => set('confirmNo', v)} />
        <TextField label="Description" value={d.description} onChange={(v) => set('description', v)} placeholder="Full-day car" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {lines('Passengers', d.passenger, (v) => set('passenger', v))}
        <TextField label="Remarks" value={d.remarks} onChange={(v) => set('remarks', v)} multiline />
      </div>
      <TextField label="Note" value={d.note} onChange={(v) => set('note', v)} />
    </div>
  ),
  payload: (d) => ({ date: d.date, startTime: d.startTime, endTime: d.endTime, timezone: nul(d.timezone), location: d.location, description: nul(d.description), driverName: nul(d.driverName), driverMobile: nul(d.driverMobile), vehicleType: nul(d.vehicleType), confirmNo: nul(d.confirmNo), remarks: nul(d.remarks), passenger: nul(d.passenger), note: nul(d.note) }),
};

/* ── Accommodation ─────────────────────────────────────────── */

type HotelDraft = { date: string; timeIn: string | null; dateOut: string; timeOut: string | null; location: string; description: string; accommodator: string; note: string };
const accommodation: Config<Accommodation, HotelDraft> = {
  title: 'Accommodation', singular: 'hotel booking',
  columns: [
    { key: 'description', label: 'Hotel', render: (a) => <span className="text-ink">{a.description ?? a.location}</span> },
    { key: 'location', label: 'City' },
    { key: 'date', label: 'Check-in', mono: true, value: (a) => `${a.date} ${a.timeIn ?? ''}`, render: (a) => <span className="mono text-[12.5px]">{fmtDay(a.date)} {a.timeIn ?? ''}</span> },
    { key: 'dateOut', label: 'Check-out', mono: true, value: (a) => `${a.dateOut ?? ''} ${a.timeOut ?? ''}`, render: (a) => <span className="mono text-[12.5px]">{a.dateOut ? `${fmtDay(a.dateOut)} ${a.timeOut ?? ''}` : '—'}</span> },
    { key: 'accommodator', label: 'Guests', value: (a) => (a.accommodator ?? '').replace(/\n/g, ', ') },
  ],
  blank: (e) => ({ date: e.startDate, timeIn: '14:00', dateOut: e.endDate ?? e.startDate, timeOut: '12:00', location: '', description: '', accommodator: '', note: '' }),
  fromRow: (a) => ({ date: a.date, timeIn: a.timeIn, dateOut: a.dateOut ?? '', timeOut: a.timeOut, location: a.location ?? '', description: a.description ?? '', accommodator: a.accommodator ?? '', note: a.note ?? '' }),
  fields: (d, set) => (
    <div className="space-y-5">
      <TextField label="Hotel" value={d.description} onChange={(v) => set('description', v)} placeholder="The Fullerton Hotel Singapore" />
      <TextField label="City" value={d.location} onChange={(v) => set('location', v)} />
      <div className="grid gap-5 sm:grid-cols-4">
        <DateField label="Check-in" value={d.date} onChange={(v) => set('date', v)} />
        <TimeField label="Time" value={d.timeIn} onChange={(v) => set('timeIn', v)} />
        <DateField label="Check-out" value={d.dateOut} onChange={(v) => set('dateOut', v)} />
        <TimeField label="Time" value={d.timeOut} onChange={(v) => set('timeOut', v)} />
      </div>
      {lines('Guests', d.accommodator, (v) => set('accommodator', v))}
      <TextField label="Note" value={d.note} onChange={(v) => set('note', v)} placeholder="Corporate rate; breakfast included" />
      <p className="text-[12px] text-graphite">The itinerary prints this stay on every day it covers, not only at check-in.</p>
    </div>
  ),
  payload: (d) => ({ date: d.date, timeIn: d.timeIn, dateOut: nul(d.dateOut), timeOut: d.timeOut, location: nul(d.location), description: nul(d.description), accommodator: nul(d.accommodator), note: nul(d.note) }),
};

/* ── Regis party ───────────────────────────────────────────── */

type AttendeeDraft = { sellsideContactId: string | null; position: string; officeNo: string; mobileNo: string; email: string };
const attendees: Config<EventAttendee, AttendeeDraft> = {
  title: 'Regis', singular: 'Regis attendee',
  columns: [
    { key: 'name', label: 'Name', render: (a) => <span className="text-ink">{a.name}</span> },
    { key: 'position', label: 'Position' },
    { key: 'email', label: 'Email', mono: true },
    { key: 'mobileNo', label: 'Mobile', mono: true },
    { key: 'officeNo', label: 'Office', mono: true, hidden: true },
  ],
  blank: () => ({ sellsideContactId: null, position: '', officeNo: '', mobileNo: '', email: '' }),
  fromRow: (a) => ({ sellsideContactId: a.sellsideContactId, position: a.position ?? '', officeNo: a.officeNo ?? '', mobileNo: a.mobileNo ?? '', email: a.email ?? '' }),
  fields: (d, set, { options, staffById }) => (
    <div className="space-y-5">
      {/* Picking the staff member copies their directory details in; each can then be overridden for this trip (a roaming number, say). */}
      <Picker label="Staff member" options={options.sellside} value={d.sellsideContactId} allowEmpty={false} onChange={(v) => {
        const s = staffById(v);
        set('sellsideContactId', v); set('position', s?.position ?? ''); set('officeNo', s?.officeNo ?? ''); set('mobileNo', s?.mobileNo ?? ''); set('email', s?.email ?? '');
      }} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Position" value={d.position} onChange={(v) => set('position', v)} />
        <TextField label="Email" value={d.email} onChange={(v) => set('email', v)} />
        <TextField label="Mobile" value={d.mobileNo} onChange={(v) => set('mobileNo', v)} />
        <TextField label="Office no." value={d.officeNo} onChange={(v) => set('officeNo', v)} />
      </div>
      <p className="text-[12px] text-graphite">Copied from the directory when you pick the person; edit any line to print something different on this itinerary.</p>
    </div>
  ),
  payload: (d) => ({ sellsideContactId: d.sellsideContactId ? Number(d.sellsideContactId) : null, position: nul(d.position), officeNo: nul(d.officeNo), mobileNo: nul(d.mobileNo), email: nul(d.email) }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CHILD_CONFIG: Record<ChildKey, Config<any, any>> = { meetings, investors, flights, transportation, accommodation, attendees };

/* ── The tab ───────────────────────────────────────────────── */

type ItemResponse<T> = { item: T; audit?: AuditEntry };

export default function EventChildTab<T extends Row, D>({ type, event, rows, onChange, onRequestSave, autoOpen = false, onOpened }: {
  type: ChildKey; event: CrmsEvent; rows: T[]; onChange: (next: T[]) => void;
  /** Set while the event has no id yet: "Add" hands off to the form, which saves the header first. */
  onRequestSave?: () => void;
  /** Open the blank modal as soon as the tab mounts (the form just created the event for this tab). */
  autoOpen?: boolean;
  onOpened?: () => void;
}) {
  const config = CHILD_CONFIG[type] as Config<T, D>;
  const { appendAudit, addresses, corporates, sellsideContacts } = useCrms();
  const { can } = useAuth();
  const options = useOptions();
  const { notify } = useToast();
  const navigate = useNavigate();
  const ctx: Ctx = {
    event, options,
    addressOf: {
      client: (id) => addresses.find((a) => a.clientId === id)?.name ?? '',
      corporate: (id) => corporates.find((c) => c.id === id)?.address ?? '',
    },
    staffById: (id) => sellsideContacts.find((s) => s.id === id) ?? null,
  };
  const [draft, setDraft] = useState<{ id: string | null; data: D } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();
  const manage = can('crms.events.manage');

  const open = (row?: T) => { setError(null); setDraft(row ? { id: row.id, data: config.fromRow(row) } : { id: null, data: config.blank(event) }); };
  const pending = !event.id;
  useEffect(() => {
    if (autoOpen && !pending && manage) { open(); onOpened?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);
  const set = <K extends keyof D>(k: K, v: D[K]) => setDraft((d) => (d ? { ...d, data: { ...d.data, [k]: v } } : d));

  async function save() {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      const path = `/crms/events/${event.id}/${type}${draft.id ? `/${draft.id}` : ''}`;
      const res = await apiFetch<ItemResponse<T>>(path, { method: draft.id ? 'PUT' : 'POST', audience: 'cms', body: config.payload(draft.data) });
      appendAudit(res.audit);
      onChange(draft.id ? rows.map((r) => (r.id === res.item.id ? res.item : r)) : [...rows, res.item]);
      notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} saved.`);
      setDraft(null);
    } catch (e) { setError(errorText(e, `The ${config.singular} could not be saved.`)); } finally { setSaving(false); }
  }

  async function remove(row: T) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/crms/events/${event.id}/${type}/${row.id}`, { method: 'DELETE', audience: 'cms' });
      appendAudit(res.audit);
      onChange(rows.filter((r) => r.id !== row.id));
      notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} removed.`);
    } catch (e) { notify(errorText(e, `Could not remove the ${config.singular}.`), 'warn'); }
  }

  async function convert(m: Meeting) {
    try {
      const res = await apiFetch<{ item: { id: string; reference: string }; meeting: Meeting; audit?: AuditEntry }>(`/crms/meetings/${m.id}/convert-to-interaction`, { method: 'POST', audience: 'cms' });
      appendAudit(res.audit);
      onChange(rows.map((r) => (r.id === res.meeting.id ? (res.meeting as unknown as T) : r)));
      notify(`Interaction ${res.item.reference} logged from the meeting — check it over.`);
      // Open the new record for review, as the legacy hand-off did.
      navigate(`/crms/interactions/${res.item.id}`);
    } catch (e) { notify(errorText(e, 'The meeting could not be converted.'), 'warn'); }
  }

  return (
    <div className="space-y-4">
      <DataTable rows={rows} columns={config.columns} title={`${event.subject} · ${config.title}`} storageKey={`event-${type}`} initialPageSize={0} hideSearch={rows.length < 8}
        emptyTitle={`No ${config.title.toLowerCase()} yet.`} emptyHint={pending ? `Add the first ${config.singular} — the event header above is saved as you do.` : `Add the first ${config.singular} to this event.`}
        toolbar={manage && <BtnPrimary onClick={() => (pending ? onRequestSave?.() : open())} disabled={pending && !onRequestSave}><IconPlus size={13} /> Add {config.singular}</BtnPrimary>}
        actions={(row) => (
          <>
            {type === 'meetings' && manage && !(row as unknown as Meeting).interactionId && (
              <RowAction label="Log as interaction" onClick={() => void convert(row as unknown as Meeting)}><IconArrowRight size={14} /></RowAction>
            )}
            {manage && <RowAction label="Edit" onClick={() => open(row)}><IconPen /></RowAction>}
            {manage && <RowAction label={armed === row.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(row.id, () => { void remove(row); })}>{armed === row.id ? <IconCheck /> : <IconTrash />}</RowAction>}
          </>
        )} />

      {draft && (
        <Modal open wide={config.wide} title={`${draft.id ? 'Edit' : 'Add'} ${config.singular} · ${event.subject}`} onClose={() => setDraft(null)}
          footer={<><BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save changes' : `Add ${config.singular}`}</BtnPrimary></>}>
          <div className="space-y-5">
            {config.fields(draft.data, set, ctx)}
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export const CHILD_TABS: { id: ChildKey; label: string }[] = [
  { id: 'meetings', label: 'Meetings' }, { id: 'investors', label: 'Investors' }, { id: 'flights', label: 'Flights' },
  { id: 'transportation', label: 'Ground transportation' }, { id: 'accommodation', label: 'Accommodation' }, { id: 'attendees', label: 'Regis' },
];

export { today };
