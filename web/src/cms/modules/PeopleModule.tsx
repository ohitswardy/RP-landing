import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, SkeletonRows, Switch, EASE,
} from '../ui';
import {
  IconArrowDown, IconArrowUp, IconExternal, IconPen, IconPlus, IconTrash,
} from '../icons';
import { TEAMS, type StaffMember, type StaffTeam } from '../data';
import ImagePicker from '../kit/ImagePicker';
import { Field, MiniBtn, Modal, Panel, TinyBtn, move } from '../kit/parts';
import { Segmented } from './access/parts';
import { BioEditor, RoleList, SectorEditor } from './people/ProfileLists';
import AboutCopyEditor from './people/AboutCopyEditor';
import ProfilePreview from './people/ProfilePreview';

/* ── Draft model ───────────────────────────────────────────── */

type Draft = Pick<StaffMember, 'name' | 'roles' | 'bio' | 'sectors' | 'phone' | 'email' | 'img' | 'team'>;

function toDraft(m: StaffMember): Draft {
  return {
    name: m.name,
    roles: m.roles.length > 0 ? m.roles : [''],
    bio: m.bio,
    sectors: m.sectors,
    phone: m.phone,
    email: m.email,
    img: m.img,
    team: m.team,
  };
}

function blankDraft(team: StaffTeam): Draft {
  return { name: '', roles: [''], bio: [], sectors: [], phone: '', email: '', img: '', team };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validate(d: Draft): string | null {
  if (!d.name.trim()) return 'The profile needs a name.';
  const roles = d.roles.filter((r) => r.trim());
  if (roles.length === 0) return 'Give the profile at least one title.';
  if (d.bio.some((p) => !p.trim())) return 'One of the summary paragraphs is empty — write it or remove it.';
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'That email address does not look right.';
  return null;
}

/** Trim the draft down to what the API stores. */
function toPayload(d: Draft) {
  return {
    name: d.name.trim(),
    team: d.team,
    roles: d.roles.map((r) => r.trim()).filter(Boolean),
    bio: d.bio.map((p) => p.trim()).filter(Boolean),
    sectors: d.sectors.map((s) => s.trim()).filter(Boolean),
    phone: d.phone.trim(),
    email: d.email.trim(),
    img: d.img.trim(),
  };
}

/* ── Module ────────────────────────────────────────────────── */

export default function PeopleModule() {
  const { people, status, createPerson, updatePerson, deletePerson, reorderPeople } = useCms();

  const [view, setView] = useState<'roster' | 'copy'>('roster');
  const [copyDirty, setCopyDirty] = useState(false);
  const [team, setTeam] = useState<StaffTeam>('Board of Directors');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const savedTimer = useRef<number | null>(null);

  const loading = status === 'loading' && people.length === 0;
  const roster = useMemo(() => people.filter((p) => p.team === team), [people, team]);
  const hiddenCount = people.filter((p) => !p.visible).length;

  const selected = useMemo(
    () => people.find((p) => p.id === selectedId) ?? null,
    [people, selectedId],
  );

  // Load the draft only when the selection changes — saving and reordering
  // both replace the underlying records, and neither should wipe an edit.
  useEffect(() => {
    if (creating) return; // startCreate() already seeded a blank draft
    setDraft(selected ? toDraft(selected) : null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, creating]);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  const dirty = creating
    ? true
    : Boolean(selected && draft) && !same(draft, selected ? toDraft(selected) : null);

  /** A new profile, or a saved one still hidden, can be published on save. */
  const publishable = creating || (selected ? !selected.visible : false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  /** Throw away the open draft and leave create mode. */
  function resetDraft() {
    setError(null);
    setCreating(false);
    setDraft(selected ? toDraft(selected) : null);
  }

  /** Swap between the roster and the page-copy editor, guarding open drafts. */
  function switchView(next: 'roster' | 'copy') {
    if (next === view) return;
    const blocked = view === 'roster' ? dirty : copyDirty;
    const go = () => {
      setCopyDirty(false);
      setSelectedId(null);
      setCreating(false);
      setDraft(null);
      setError(null);
      setView(next);
    };
    if (blocked) { setPending(() => go); return; }
    go();
  }

  /** Run an action, but make the editor confirm first if a draft is open. */
  function guard(action: () => void) {
    if (dirty) { setPending(() => action); return; }
    action();
  }

  /** The same person on another team — their bio is maintained separately. */
  const twin = useMemo(() => {
    if (!selected) return null;
    return people.find((p) => p.id !== selected.id && p.name === selected.name) ?? null;
  }, [people, selected]);

  async function save(publish: boolean) {
    if (!draft) return;
    const problem = validate(draft);
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError(null);
    try {
      if (creating) {
        const created = await createPerson({ ...toPayload(draft), visible: publish });
        setCreating(false);
        setSelectedId(created.id);
      } else if (selected) {
        // Publishing is part of the same save, so "Save & publish" really does.
        await updatePerson(selected.id, { ...toPayload(draft), ...(publish ? { visible: true } : {}) });
      }
      setJustSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  /** Open a blank editor. Nothing is written until the editor saves. */
  function startCreate() {
    setError(null);
    setSelectedId(null);
    setCreating(true);
    setDraft(blankDraft(team));
  }

  function toggleVisible(m: StaffMember) {
    setError(null);
    void updatePerson(m.id, { visible: !m.visible }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Visibility could not be changed.');
    });
  }

  /** Move within the team, carrying the change into the global order. */
  function reorder(index: number, dir: -1 | 1) {
    const target = roster[index + dir];
    if (!target) return;
    const from = people.findIndex((p) => p.id === roster[index].id);
    const to = people.findIndex((p) => p.id === target.id);
    void reorderPeople(move(people, from, to).map((p) => p.id));
  }

  async function confirmRemove() {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    try {
      await deletePerson(id);
      if (selectedId === id) { setSelectedId(null); setCreating(false); setDraft(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The profile could not be removed.');
    }
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="04 / People"
        title="People of Regis"
        blurb={
          view === 'copy'
            ? 'Every text block on the About page — the hero, the company overview, the heritage timeline, and the awards wall. Edits publish to the live site on save.'
            : `The profile cards under “The people behind the platform” on the About page — names, titles, summaries, sector coverage, contact details, and portraits. ${
                hiddenCount > 0 ? `${hiddenCount} profile${hiddenCount === 1 ? '' : 's'} hidden from the public site.` : 'Everyone listed is publicly visible.'
              }`
        }
        actions={
          <>
            {view === 'roster' && (
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                aria-pressed={showPreview}
                className={`mono inline-flex items-center gap-2 border px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                  showPreview ? 'border-navy bg-navy text-paper' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                }`}
              >
                Preview
              </button>
            )}
            <a
              href="/about#leadership"
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              View live page <IconExternal size={12} />
            </a>
            {view === 'roster' && (
              <BtnPrimary onClick={() => guard(startCreate)}><IconPlus size={14} /> Add profile</BtnPrimary>
            )}
          </>
        }
      />

      {loading && <SkeletonRows rows={6} />}

      {!loading && (
        <Segmented
          options={[
            { value: 'roster' as const, label: 'Team roster', count: people.length },
            { value: 'copy' as const, label: 'Page copy' },
          ]}
          value={view}
          onChange={switchView}
        />
      )}

      {!loading && view === 'copy' && (
        <AboutCopyEditor onDirty={setCopyDirty} onOpenRoster={() => switchView('roster')} />
      )}

      {!loading && view === 'roster' && people.length === 0 && (
        <EmptyState
          title="No profiles yet."
          hint="Add the first profile to start building the roster on the About page."
          action={<BtnPrimary onClick={startCreate}><IconPlus size={14} /> Add profile</BtnPrimary>}
        />
      )}

      {!loading && view === 'roster' && people.length > 0 && (
        <>
          {/* Team tabs — mirror the tabs on the public page */}
          <div role="tablist" aria-label="Teams" className="tabs-scroll flex gap-0.5 overflow-x-auto border-b rule">
            {TEAMS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={team === t}
                onClick={() => guard(() => { setTeam(t); setSelectedId(null); setCreating(false); setDraft(null); })}
                className={`relative whitespace-nowrap px-5 py-3 text-[13px] transition-colors duration-200 ${
                  team === t ? 'text-ink' : 'text-graphite hover:text-slate'
                }`}
              >
                {t}
                <span className="mono ml-2 text-[10px] text-silver">{people.filter((p) => p.team === t).length}</span>
                {team === t && (
                  <motion.span
                    layoutId="people-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5"
                    style={{ background: 'var(--color-amber)' }}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className={`grid gap-6 ${showPreview && draft && (creating || selected) ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
            <div className="min-w-0 space-y-6">
              {/* Roster */}
              <ul className="divide-y rule border-y rule">
                {roster.map((m, i) => {
                  const on = m.id === selected?.id;
                  return (
                    <li
                      key={m.id}
                      className="group flex items-center gap-4 py-3 transition-colors duration-200"
                      style={on ? { background: 'color-mix(in oklab, var(--color-amber) 6%, transparent)' } : undefined}
                    >
                      <div className="flex flex-col gap-0.5">
                        <MiniBtn label={`Move ${m.name} up`} disabled={i === 0} onClick={() => reorder(i, -1)}>
                          <IconArrowUp size={12} />
                        </MiniBtn>
                        <MiniBtn label={`Move ${m.name} down`} disabled={i === roster.length - 1} onClick={() => reorder(i, 1)}>
                          <IconArrowDown size={12} />
                        </MiniBtn>
                      </div>

                      <button
                        type="button"
                        onClick={() => guard(() => setSelectedId(m.id))}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <span className="h-14 w-11 shrink-0 overflow-hidden bg-bone">
                          {m.img ? (
                            <img
                              src={m.img}
                              alt=""
                              loading="lazy"
                              className={`h-full w-full object-cover object-top transition-all duration-500 ${m.visible ? '' : 'opacity-40 grayscale'}`}
                            />
                          ) : (
                            <span className="mono grid h-full w-full place-items-center text-[11px] text-silver">
                              {m.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('')}
                            </span>
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[14.5px] ${m.visible ? 'text-ink' : 'text-graphite'}`}>
                            {m.name}
                          </span>
                          <span className="block truncate text-[12.5px] text-graphite">{m.roles.join(' · ') || '—'}</span>
                          <span className="mono mt-1 flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.14em] text-silver">
                            <span>{m.bio.length > 0 ? `${m.bio.length} para` : 'No summary'}</span>
                            {m.sectors.length > 0 && <span>{m.sectors.length} sectors</span>}
                            {!m.img && <span style={{ color: 'var(--color-warn)' }}>No photo</span>}
                          </span>
                        </span>
                      </button>

                      <div className="hidden md:block">
                        <Chip tone={m.visible ? 'live' : 'muted'}>{m.visible ? 'On site' : 'Hidden'}</Chip>
                      </div>

                      <Switch on={m.visible} onToggle={() => toggleVisible(m)} label={`Toggle visibility for ${m.name}`} />
                      <MiniBtn label={`Edit ${m.name}`} onClick={() => guard(() => setSelectedId(m.id))}>
                        <IconPen size={13} />
                      </MiniBtn>
                      <MiniBtn label={`Remove ${m.name}`} danger onClick={() => setRemoving(m)}>
                        <IconTrash size={13} />
                      </MiniBtn>
                    </li>
                  );
                })}
              </ul>

              {roster.length === 0 && (
                <p className="border border-dashed rule px-6 py-10 text-center text-[13px] text-graphite">
                  Nobody is filed under {team} yet.
                </p>
              )}

              <p className="text-[12.5px] leading-relaxed text-graphite">
                Order here is the order on the About page, and it applies immediately. Hidden profiles keep their slot
                and photo but are left out of the public roster.
              </p>

              {/* Editor. The draft is cleared by an effect, so it can outlive the
                  selection by a frame — require both rather than asserting. */}
              {draft && (creating || selected) && (
                <div className="space-y-6">
                  <Panel
                    code={creating ? `${draft.team} · new profile` : `${draft.team} · profile`}
                    title={draft.name.trim() || (creating ? 'New profile' : 'Untitled profile')}
                    hint={
                      creating
                        ? 'Nothing is written until you save. Publishing puts the card straight onto the About page.'
                        : 'Everything on this profile’s card and in the dialog it opens.'
                    }
                    actions={
                      !creating && selected ? (
                        <div className="flex items-center gap-3">
                          <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">
                            {selected.visible ? 'On site' : 'Hidden'}
                          </span>
                          <Switch on={selected.visible} onToggle={() => toggleVisible(selected)} label={`Toggle ${selected.name}`} />
                        </div>
                      ) : (
                        <Chip tone="amber">Not saved yet</Chip>
                      )
                    }
                  >
                    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
                      <div className="flex flex-col gap-3">
                        <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Portrait</span>
                        <div className="group relative aspect-[4/5] overflow-hidden border rule bg-navy">
                          {draft.img ? (
                            <img src={draft.img} alt="" className="h-full w-full object-cover object-top" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-[3.5rem] font-medium leading-none tracking-tighter text-paper/10">
                              {draft.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                          )}
                          <div
                            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-2 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100"
                            style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
                          >
                            <TinyBtn onClick={() => setPicking(true)} tone="accent">
                              <IconPen size={11} /> {draft.img ? 'Replace' : 'Add'}
                            </TinyBtn>
                            {draft.img && (
                              <TinyBtn onClick={() => set('img', '')}>
                                <IconTrash size={11} /> Clear
                              </TinyBtn>
                            )}
                          </div>
                        </div>
                        <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite" title={draft.img}>
                          {draft.img || '— no portrait —'}
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-graphite">
                          Cards crop to 4:5 from the top, so leave headroom above the face.
                        </p>
                      </div>

                      <div className="flex flex-col gap-5">
                        <Field label="Full name" value={draft.name} max={120} onChange={(v) => set('name', v)} />

                        <div className="flex flex-col gap-2">
                          <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Titles</span>
                          <RoleList roles={draft.roles} onChange={(v) => set('roles', v)} />
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Team</span>
                          <select
                            value={draft.team}
                            onChange={(e) => set('team', e.target.value as StaffTeam)}
                            className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
                          >
                            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <p className="text-[11.5px] leading-relaxed text-graphite">
                            Moving a profile changes which tab it appears under on the About page.
                          </p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Phone" value={draft.phone} max={40} onChange={(v) => set('phone', v)} placeholder="+63 2 8894 0000" />
                          <Field label="Email" value={draft.email} max={160} onChange={(v) => set('email', v)} placeholder="name@regis.ph" />
                        </div>
                      </div>
                    </div>
                  </Panel>

                  {!creating && selected && !selected.visible && (
                    <div className="border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
                      <p className="text-[12.5px] leading-relaxed text-graphite">
                        This profile is hidden, so it does not appear on the About page yet. Save with
                        <strong className="text-ink"> Save &amp; publish</strong> to put the card live.
                      </p>
                    </div>
                  )}

                  <Panel
                    code="Summary"
                    title="Profile summary"
                    hint="The first paragraph doubles as the teaser that appears over the card on hover."
                  >
                    <BioEditor bio={draft.bio} onChange={(v) => set('bio', v)} />

                    {!creating && selected && twin && (
                      <div className="mt-5 border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
                        <p className="text-[12.5px] leading-relaxed text-graphite">
                          {selected.name} also appears under <strong className="text-ink">{twin.team}</strong>. That card
                          keeps its own summary and photo, so a change here does not carry across.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <TinyBtn onClick={() => guard(() => setSelectedId(twin.id))}>
                            Open the {twin.team} profile
                          </TinyBtn>
                          {!same(twin.bio, draft.bio) && (
                            <TinyBtn onClick={() => set('bio', twin.bio)}>
                              Copy the summary from there
                            </TinyBtn>
                          )}
                        </div>
                      </div>
                    )}
                  </Panel>

                  <Panel
                    code="Coverage"
                    title="Sector coverage"
                    hint="Optional chips under the name. Research analysts use them; most other profiles leave this empty."
                  >
                    <SectorEditor sectors={draft.sectors} onChange={(v) => set('sectors', v)} />
                  </Panel>
                </div>
              )}

              {!selected && !creating && roster.length > 0 && (
                <div className="border border-dashed rule px-8 py-12 text-center">
                  <span aria-hidden className="mx-auto mb-3 block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
                  <p className="text-[14.5px] text-ink">Pick a profile to edit it.</p>
                  <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-graphite">
                    Names, titles, the summary behind each card, sector chips, contact details, and the portrait.
                  </p>
                </div>
              )}
            </div>

            {showPreview && draft && (creating || selected) && (
              <aside className="min-w-0 xl:sticky xl:top-[92px] xl:self-start">
                <div className="mb-3 flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Live preview</span>
                  <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Updates as you type</span>
                </div>
                <ProfilePreview draft={draft} />
              </aside>
            )}
          </div>

          <SaveBar
            dirty={dirty}
            saving={saving}
            justSaved={justSaved}
            error={error}
            creating={creating}
            publishable={publishable}
            name={creating ? (draft?.name.trim() || 'New profile') : (selected?.name ?? '')}
            onDiscard={resetDraft}
            onSave={(publish) => void save(publish)}
          />
        </>
      )}

      <ImagePicker
        open={picking}
        title="Portrait"
        usedBy={selected ? `People of Regis / ${selected.team}` : 'People of Regis'}
        scope="people"
        aspect="4/5"
        hint="JPG, PNG, WebP, or AVIF up to 8 MB. Portraits crop to 4:5 from the top of the frame."
        onPick={(path) => set('img', path)}
        onClose={() => setPicking(false)}
      />

      {/* Leaving an edited profile behind */}
      <Modal
        open={pending !== null}
        title="Unsaved changes"
        onClose={() => setPending(null)}
        footer={
          <>
            <BtnGhost onClick={() => setPending(null)}>Stay here</BtnGhost>
            <BtnPrimary
              onClick={() => {
                const action = pending;
                setPending(null);
                resetDraft();
                action?.();
              }}
            >
              Discard and continue
            </BtnPrimary>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate">
          {view === 'copy'
            ? 'The About page copy has edits that have not been published. Moving on now throws them away.'
            : creating
              ? 'This new profile has not been saved yet. Moving on now throws it away.'
              : `${selected?.name ?? 'This profile'} has edits that have not been published. Moving on now throws them away.`}
        </p>
      </Modal>

      {/* Removing a profile for good */}
      <Modal
        open={removing !== null}
        title="Remove profile"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <BtnGhost onClick={() => setRemoving(null)}>Keep it</BtnGhost>
            <BtnGhost danger onClick={() => void confirmRemove()}>Remove permanently</BtnGhost>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate">
          This deletes {removing?.name}’s profile and its summary for good. To take someone off the public page
          without losing the copy, switch them to <strong className="text-ink">Hidden</strong> instead.
        </p>
      </Modal>
    </div>
  );
}

/* ── Save bar ──────────────────────────────────────────────── */

function SaveBar({
  dirty, saving, justSaved, error, creating, publishable, name, onDiscard, onSave,
}: {
  dirty: boolean; saving: boolean; justSaved: boolean; error: string | null;
  creating: boolean; publishable: boolean; name: string;
  onDiscard: () => void; onSave: (publish: boolean) => void;
}) {
  const show = dirty || saving || justSaved || Boolean(error);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="sticky bottom-4 z-30 border rule bg-paper/95 shadow-[0_10px_30px_-12px_oklch(0.165_0.040_260_/_0.4)] backdrop-blur-md"
        >
          <div className="flex w-full flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="text-[13px] leading-snug" style={{ color: 'var(--color-warn)' }}>{error}</p>
              ) : justSaved && !dirty ? (
                <Chip tone="live">Saved to the live site</Chip>
              ) : (
                <p className="truncate text-[13px] text-slate">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber-deep)' }}>
                    {creating ? 'New' : 'Unsaved'}
                  </span>
                  {name}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <BtnGhost onClick={onDiscard}>{creating ? 'Cancel' : 'Discard'}</BtnGhost>
              {/* A hidden or brand-new profile gets both: park it, or put it on the site. */}
              {publishable && (
                <BtnGhost onClick={() => onSave(false)}>
                  {saving ? 'Saving…' : 'Save as draft'}
                </BtnGhost>
              )}
              <BtnPrimary onClick={() => onSave(publishable)} disabled={saving || !dirty}>
                {saving
                  ? (publishable ? 'Publishing…' : 'Saving…')
                  : (publishable ? 'Save & publish' : 'Save changes')}
              </BtnPrimary>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
