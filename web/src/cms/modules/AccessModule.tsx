import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../auth';
import { useCms } from '../store';
import { apiFetch } from '../../lib/api';
import {
  BtnGhost, BtnPrimary, Chip, Drawer, EmptyState, ModuleHeader,
  RowAction, SelectField, SkeletonRows, Stat, TextField, useConfirm, EASE,
} from '../ui';
import { IconCheck, IconPen, IconPlus, IconSearch, IconShield, IconTrash } from '../icons';
import {
  CLIENT_STATUS, REPORT_CATEGORIES, fmtDate, timeAgo,
  type Account, type AccountKind, type AuditEntry, type PermissionDef, type RoleDef,
} from '../data';
import { Segmented } from './access/parts';
import ClientProvisioning from './access/ClientProvisioning';
import ClientApprovals from './access/ClientApprovals';
import ClientPasswordReset from './access/ClientPasswordReset';

/* ─────────────────────────────────────────────────────────────
   Users & access. One module for every account on the system:
   provisioning, role assignment, the permission matrix, and the
   audit trail. Backed by /api/cms/access + /users + /roles.
   ───────────────────────────────────────────────────────────── */

type AccessData = { users: Account[]; roles: RoleDef[]; permissions: PermissionDef[] };

/** Ledger tabs list accounts; the rest are onboarding workflows. */
type AccessTab = 'staff' | 'client' | 'provision' | 'approvals' | 'passwords';

const TABS: Array<{ value: AccessTab; label: string }> = [
  { value: 'staff', label: 'Staff accounts' },
  { value: 'client', label: 'Portal clients' },
  { value: 'provision', label: 'Registered email template' },
  { value: 'approvals', label: 'User creation approval' },
  { value: 'passwords', label: 'Forgot password' },
];
type ItemResponse<T> = { item: T; audit?: AuditEntry };
type DeleteResponse = { audit?: AuditEntry };

const AUDIT_PAGE_SIZE = 10;

type AccountForm = {
  name: string; email: string; password: string;
  kind: AccountKind; roleId: string; firm: string;
  outlookEmail: string;
  clientType: 'Local' | 'Foreign' | null;
  sectorPrefs: string[];
  preferredAnalysts: string[];
};
type RoleForm = { name: string; description: string };

const BLANK_ACCOUNT: AccountForm = {
  name: '', email: '', password: '', kind: 'staff', roleId: '', firm: '',
  outlookEmail: '', clientType: null, sectorPrefs: [], preferredAnalysts: [],
};

export default function AccessModule() {
  const { session } = useAuth();
  const { audit, appendAudit, people, reports } = useCms();
  const [data, setData] = useState<AccessData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const res = await apiFetch<AccessData>('/cms/access', { audience: 'cms' });
      if (!alive.current) return;
      setData(res);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setLoadError(e instanceof Error ? e.message : 'Failed to load accounts.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── Account state ─────────────────────────────────────────── */

  const [tab, setTab] = useState<AccessTab>('staff');
  const kindTab: AccountKind = tab === 'client' ? 'client' : 'staff';
  const isLedger = tab === 'staff' || tab === 'client';
  const [query, setQuery] = useState('');
  const [accountEditing, setAccountEditing] = useState<Account | 'new' | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(BLANK_ACCOUNT);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [armedUser, confirmUser] = useConfirm(4000);

  const users = data?.users ?? [];
  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? [];

  const shownUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.kind === kindTab)
      .filter((u) => !q
        || u.name.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || (u.role ?? '').toLowerCase().includes(q)
        || (u.firm ?? '').toLowerCase().includes(q));
  }, [users, kindTab, query]);

  const clients = useMemo(() => users.filter((u) => u.kind === 'client'), [users]);
  const clientCount = clients.length;
  const staffCount = users.length - clientCount;
  const activeStaff = users.filter((u) => u.kind === 'staff' && !u.suspended).length;
  const pendingCount = clients.filter((c) => c.status === 'pending').length;

  const setUser = (item: Account) => {
    setData((d) => d && ({
      ...d,
      users: d.users.some((u) => u.id === item.id)
        ? d.users.map((u) => (u.id === item.id ? item : u))
        : [...d.users, item],
    }));
  };

  const refreshRoleCounts = useCallback(async () => {
    // Role user-counts shift when accounts move; re-pull quietly.
    try {
      const res = await apiFetch<AccessData>('/cms/access', { audience: 'cms' });
      if (alive.current) setData(res);
    } catch {
      /* the visible lists are already correct; counts catch up next load */
    }
  }, []);

  function openAccountEditor(target: Account | 'new') {
    setAccountError(null);
    if (target === 'new') {
      // Clients are provisioned through the registration flow, never here.
      setAccountForm({ ...BLANK_ACCOUNT, kind: 'staff', roleId: roles.find((r) => !r.system)?.id ?? roles[0]?.id ?? '' });
    } else {
      setAccountForm({
        name: target.name, email: target.email, password: '',
        kind: target.kind, roleId: target.roleId ?? '', firm: target.firm ?? '',
        outlookEmail: target.outlookEmail ?? '',
        clientType: target.clientType,
        sectorPrefs: target.sectorPrefs ?? [],
        preferredAnalysts: target.preferredAnalysts ?? [],
      });
    }
    setAccountEditing(target);
  }

  async function saveAccount() {
    const f = accountForm;
    if (!f.name.trim()) { setAccountError('Give the account a full name.'); return; }
    if (accountEditing === 'new') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setAccountError('Enter a valid email address.'); return; }
      if (f.password.length < 8) { setAccountError('Passwords are at least 8 characters.'); return; }
      if (f.kind === 'staff' && !f.roleId) { setAccountError('Assign the staff account a role.'); return; }
      if (f.kind === 'client' && !f.firm.trim()) { setAccountError('Name the institutional firm on the mandate.'); return; }
    } else if (f.password && f.password.length < 8) {
      setAccountError('Replacement passwords are at least 8 characters.');
      return;
    }

    setSavingAccount(true);
    try {
      if (accountEditing === 'new') {
        const res = await apiFetch<ItemResponse<Account>>('/cms/users', {
          method: 'POST', audience: 'cms',
          body: {
            name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password,
            kind: f.kind,
            roleId: f.kind === 'staff' ? Number(f.roleId) : null,
            firm: f.kind === 'client' ? f.firm.trim() : null,
            ...(f.kind === 'staff' ? { outlookEmail: f.outlookEmail.trim() || null } : {}),
          },
        });
        setUser(res.item);
        appendAudit(res.audit);
        setTab(f.kind);
      } else if (accountEditing) {
        const res = await apiFetch<ItemResponse<Account>>(`/cms/users/${accountEditing.id}`, {
          method: 'PUT', audience: 'cms',
          body: {
            name: f.name.trim(),
            ...(accountEditing.kind === 'staff'
              ? { roleId: f.roleId ? Number(f.roleId) : null, outlookEmail: f.outlookEmail.trim() || null }
              : {}),
            ...(accountEditing.kind === 'client'
              ? { firm: f.firm.trim(), clientType: f.clientType, sectorPrefs: f.sectorPrefs, preferredAnalysts: f.preferredAnalysts }
              : {}),
            ...(f.password ? { password: f.password } : {}),
          },
        });
        setUser(res.item);
        appendAudit(res.audit);
      }
      setAccountEditing(null);
      void refreshRoleCounts();
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSavingAccount(false);
    }
  }

  async function toggleSuspend(u: Account) {
    try {
      const res = await apiFetch<ItemResponse<Account>>(`/cms/users/${u.id}`, {
        method: 'PUT', audience: 'cms', body: { suspended: !u.suspended },
      });
      setUser(res.item);
      appendAudit(res.audit);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The change was rejected.');
    }
  }

  async function removeUser(u: Account) {
    try {
      const res = await apiFetch<DeleteResponse>(`/cms/users/${u.id}`, { method: 'DELETE', audience: 'cms' });
      setData((d) => d && ({ ...d, users: d.users.filter((x) => x.id !== u.id) }));
      appendAudit(res.audit);
      void refreshRoleCounts();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The account could not be deleted.');
    }
  }

  /* ── Client mandate helpers ────────────────────────────────── */

  /** Sector and byline tallies off the live catalog. The portal matches a
      client's preferences against these exact strings, so the chips offer what
      the shelf actually carries rather than a guess. */
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) if (r.category) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [reports]);

  const analystCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) if (r.analyst) m.set(r.analyst, (m.get(r.analyst) ?? 0) + 1);
    return m;
  }, [reports]);

  const analystOptions = useMemo(
    () => [...new Set([
      ...analystCounts.keys(),
      ...people.filter((p) => p.team === 'Research').map((p) => p.name),
      ...accountForm.preferredAnalysts,
    ])].sort((a, b) => a.localeCompare(b)),
    [analystCounts, people, accountForm.preferredAnalysts],
  );

  /** What the mandate on screen resolves to, under the same union rule the
      portal and the Email desk apply: a report qualifies on either a preferred
      sector or a preferred analyst. null = no restriction set. */
  const coverageCount = useMemo(() => {
    const norm = (v: string) => v.trim().toLowerCase();
    const sectors = new Set(accountForm.sectorPrefs.map(norm).filter(Boolean));
    const analysts = new Set(accountForm.preferredAnalysts.map(norm).filter(Boolean));
    if (sectors.size === 0 && analysts.size === 0) return null;
    return reports.filter((r) => sectors.has(norm(r.category ?? '')) || analysts.has(norm(r.analyst ?? ''))).length;
  }, [reports, accountForm.sectorPrefs, accountForm.preferredAnalysts]);

  /* ── Role state ────────────────────────────────────────────── */

  const [roleEditing, setRoleEditing] = useState<RoleDef | 'new' | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>({ name: '', description: '' });
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [armedRole, confirmRole] = useConfirm(4000);
  const [auditPage, setAuditPage] = useState(1);

  const setRole = (item: RoleDef) => {
    setData((d) => d && ({
      ...d,
      roles: d.roles.some((r) => r.id === item.id)
        ? d.roles.map((r) => (r.id === item.id ? item : r))
        : [...d.roles, item],
    }));
  };

  function openRoleEditor(target: RoleDef | 'new') {
    setRoleError(null);
    if (target === 'new') {
      setRoleForm({ name: '', description: '' });
      setRolePerms([]);
    } else {
      setRoleForm({ name: target.name, description: target.description });
      setRolePerms(target.permissions);
    }
    setRoleEditing(target);
  }

  async function saveRole() {
    if (roleEditing !== 'new' && roleEditing?.system) {
      // Only the description is editable on the system role.
      setSavingRole(true);
      try {
        const res = await apiFetch<ItemResponse<RoleDef>>(`/cms/roles/${roleEditing.id}`, {
          method: 'PUT', audience: 'cms', body: { description: roleForm.description.trim() },
        });
        setRole(res.item);
        appendAudit(res.audit);
        setRoleEditing(null);
      } catch (e) {
        setRoleError(e instanceof Error ? e.message : 'Saving failed. Try again.');
      } finally {
        setSavingRole(false);
      }
      return;
    }

    if (!roleForm.name.trim()) { setRoleError('Name the role.'); return; }
    setSavingRole(true);
    try {
      if (roleEditing === 'new') {
        const res = await apiFetch<ItemResponse<RoleDef>>('/cms/roles', {
          method: 'POST', audience: 'cms',
          body: { name: roleForm.name.trim(), description: roleForm.description.trim(), permissions: rolePerms },
        });
        setRole(res.item);
        appendAudit(res.audit);
      } else if (roleEditing) {
        const res = await apiFetch<ItemResponse<RoleDef>>(`/cms/roles/${roleEditing.id}`, {
          method: 'PUT', audience: 'cms',
          body: { name: roleForm.name.trim(), description: roleForm.description.trim(), permissions: rolePerms },
        });
        setRole(res.item);
        appendAudit(res.audit);
      }
      setRoleEditing(null);
    } catch (e) {
      setRoleError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSavingRole(false);
    }
  }

  async function removeRole(r: RoleDef) {
    try {
      const res = await apiFetch<DeleteResponse>(`/cms/roles/${r.id}`, { method: 'DELETE', audience: 'cms' });
      setData((d) => d && ({ ...d, roles: d.roles.filter((x) => x.id !== r.id) }));
      appendAudit(res.audit);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The role could not be deleted.');
    }
  }

  /** Flip one cell of the permission matrix, optimistically. */
  async function toggleMatrix(role: RoleDef, permKey: string) {
    if (role.system) return;
    const next = role.permissions.includes(permKey)
      ? role.permissions.filter((k) => k !== permKey)
      : [...role.permissions, permKey];
    const prev = role.permissions;
    setRole({ ...role, permissions: next });
    try {
      const res = await apiFetch<ItemResponse<RoleDef>>(`/cms/roles/${role.id}`, {
        method: 'PUT', audience: 'cms', body: { permissions: next },
      });
      setRole(res.item);
      appendAudit(res.audit);
    } catch (e) {
      setRole({ ...role, permissions: prev });
      setLoadError(e instanceof Error ? e.message : 'The permission change was rejected.');
    }
  }

  /* ── Render ────────────────────────────────────────────────── */

  const isSelf = (u: Account) => session?.email === u.email;
  const auditPages = Math.max(1, Math.ceil(audit.length / AUDIT_PAGE_SIZE));
  const auditPageSafe = Math.min(auditPage, auditPages);
  const auditShown = useMemo(
    () => audit.slice((auditPageSafe - 1) * AUDIT_PAGE_SIZE, auditPageSafe * AUDIT_PAGE_SIZE),
    [audit, auditPageSafe],
  );
  const permGroups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      if (!byGroup.has(p.group)) { byGroup.set(p.group, []); order.push(p.group); }
      byGroup.get(p.group)!.push(p);
    }
    return order.map((g) => ({ group: g, perms: byGroup.get(g)! }));
  }, [permissions]);

  if (status === 'error' && !data) {
    return (
      <div className="space-y-9">
        <ModuleHeader
          code="10 / Access"
          title="Users & access"
          blurb="Every account on the system, the role that scopes what it can touch, and the trail of what it changed."
        />
        <EmptyState
          title="The access service did not answer."
          hint={loadError ?? 'Check that the API is running, then retry.'}
          action={<BtnGhost onClick={() => void load()}>Retry</BtnGhost>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <ModuleHeader
        code="10 / Access"
        title="Users & access"
        blurb="Every account on the system, the role that scopes what it can touch, and the trail of what it changed. Staff sign into this CMS; clients sign into the research portal."
        actions={
          tab === 'client' || tab === 'provision' ? (
            <BtnPrimary onClick={() => setTab('provision')}><IconPlus size={14} /> Provision a client</BtnPrimary>
          ) : (
            <BtnPrimary onClick={() => openAccountEditor('new')}><IconPlus size={14} /> New staff account</BtnPrimary>
          )
        }
      />

      {/* Inline API failure note (mutations) */}
      {loadError && data && (
        <div className="flex items-center justify-between border-l-2 pl-4" style={{ borderColor: 'var(--color-warn)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="mono text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stat band */}
      <div className="grid grid-cols-3 gap-6 border-y rule py-7">
        <div className="px-1 md:px-4"><Stat value={String(activeStaff)} label="Active staff" /></div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={String(clientCount)} label="Client mandates" />
        </div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={String(roles.length)} label="Roles" />
        </div>
      </div>

      {/* ── Accounts ───────────────────────────────────────────── */}
      <section>
        <div role="tablist" aria-label="Access views" className="tabs-scroll flex gap-0.5 overflow-x-auto border-b rule">
          {TABS.map((t) => {
            const on = tab === t.value;
            const count = t.value === 'staff' ? staffCount
              : t.value === 'client' ? clientCount
              : t.value === 'approvals' ? pendingCount
              : undefined;
            const flag = t.value === 'approvals' && pendingCount > 0;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.value)}
                className={`relative whitespace-nowrap px-5 py-3 text-[13px] transition-colors duration-200 ${on ? 'text-ink' : 'text-graphite hover:text-slate'}`}
              >
                {t.label}
                {count !== undefined && count > 0 && (
                  <span
                    className="mono ml-2 text-[10px]"
                    style={{ color: flag ? 'var(--color-amber-deep)' : 'var(--color-silver)' }}
                  >
                    {count}
                  </span>
                )}
                {on && (
                  <motion.span layoutId="access-tab" className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: 'var(--color-amber)' }} transition={{ duration: 0.3, ease: EASE }} />
                )}
              </button>
            );
          })}
        </div>

        {isLedger && (
          <div className="mt-6 flex justify-end">
            <label className="relative block w-full md:w-[280px]">
              <span className="sr-only">Search accounts</span>
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, role, firm…"
                className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              />
            </label>
          </div>
        )}

        {/* ── Onboarding workflows ───────────────────────────── */}
        {!isLedger && (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-10"
          >
            {status === 'loading' && !data ? (
              <SkeletonRows rows={4} />
            ) : tab === 'provision' ? (
              <ClientProvisioning onAccount={setUser} onAudit={appendAudit} />
            ) : tab === 'approvals' ? (
              <ClientApprovals clients={clients} onAccount={setUser} onAudit={appendAudit} />
            ) : (
              <ClientPasswordReset clients={clients} onAccount={setUser} onAudit={appendAudit} />
            )}
          </motion.div>
        )}

        {isLedger && (status === 'loading' && !data ? (
          <div className="mt-6"><SkeletonRows rows={5} /></div>
        ) : shownUsers.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={query ? 'No account matches that search.' : kindTab === 'staff' ? 'No staff accounts yet.' : 'No client mandates yet.'}
              hint={query ? 'Search covers names, emails, roles, and firms.' : 'Provision the first account and it will appear in this ledger.'}
              action={
                query ? (
                  <BtnGhost onClick={() => setQuery('')}>Clear search</BtnGhost>
                ) : kindTab === 'client' ? (
                  <BtnPrimary onClick={() => setTab('provision')}><IconPlus size={14} /> Provision a client</BtnPrimary>
                ) : (
                  <BtnPrimary onClick={() => openAccountEditor('new')}><IconPlus size={14} /> New staff account</BtnPrimary>
                )
              }
            />
          </div>
        ) : (
          <ul className="mt-6 divide-y rule border-y rule">
            <AnimatePresence initial={false}>
              {shownUsers.map((u, i) => (
                <motion.li
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.3) } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                  className="group grid grid-cols-12 items-center gap-x-4 gap-y-2 py-4"
                >
                  <div className="col-span-12 md:col-span-4">
                    <p className={`text-[14px] ${u.suspended ? 'text-graphite line-through decoration-1' : 'text-ink'}`}>
                      {u.name}
                      {isSelf(u) && <span className="mono ml-2 text-[9px] uppercase tracking-[0.16em] text-graphite">You</span>}
                    </p>
                    <p className="mono text-[11px] tracking-[0.04em] text-graphite">
                      {u.email}
                      {u.kind === 'client' && u.username && (
                        <>
                          <span className="mx-1.5 text-silver">/</span>
                          {u.username}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="mono col-span-6 text-[10.5px] uppercase tracking-[0.16em] text-slate md:col-span-2">
                    {u.kind === 'staff' ? (u.role ?? 'No role') : u.firm}
                  </span>
                  <span className="mono num col-span-6 text-[11px] text-graphite md:col-span-2" title={u.lastActive ? new Date(u.lastActive).toLocaleString('en-PH') : undefined}>
                    {u.lastActive ? fmtDate(u.lastActive) : 'Never signed in'}
                  </span>
                  <span className="col-span-4 md:col-span-1">
                    {u.suspended ? (
                      <Chip tone="warn">Suspended</Chip>
                    ) : u.kind === 'client' ? (
                      <Chip tone={CLIENT_STATUS[u.status].tone}>{CLIENT_STATUS[u.status].label}</Chip>
                    ) : (
                      <Chip tone="live">Active</Chip>
                    )}
                  </span>
                  <div className="col-span-8 flex flex-wrap items-center justify-end gap-2 md:col-span-3">
                    {!isSelf(u) && (
                      <BtnGhost danger={!u.suspended} onClick={() => void toggleSuspend(u)}>
                        {u.suspended ? 'Restore' : 'Suspend'}
                      </BtnGhost>
                    )}
                    <RowAction label={`Edit ${u.name}`} onClick={() => openAccountEditor(u)}><IconPen /></RowAction>
                    {!isSelf(u) && (
                      <RowAction
                        label={armedUser === u.id ? 'Confirm delete' : `Delete ${u.name}`}
                        danger
                        onClick={() => confirmUser(u.id, () => { void removeUser(u); })}
                      >
                        {armedUser === u.id ? <IconCheck /> : <IconTrash />}
                      </RowAction>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ))}
      </section>

      {/* ── Roles & permissions (staff concern only) ───────────── */}
      {tab === 'staff' && (
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-[17px] font-medium tracking-[-0.01em]">Roles & permissions</h2>
            <p className="mt-1.5 max-w-[58ch] text-[13px] leading-relaxed text-slate">
              A role is a column; every module it can manage gets a mark. Click a cell to grant or revoke. The Administrator column is fixed by the system.
            </p>
          </div>
          <BtnGhost onClick={() => openRoleEditor('new')}><IconPlus size={14} /> New role</BtnGhost>
        </div>

        {status === 'loading' && !data ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="overflow-x-auto border-y rule">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b rule">
                  <th className="mono py-3 pr-4 text-left text-[9.5px] font-normal uppercase tracking-[0.2em] text-graphite">
                    Module
                  </th>
                  {roles.map((r) => (
                    <th key={r.id} className="min-w-[120px] px-3 py-3 text-left align-bottom">
                      <div className="flex items-center gap-1.5">
                        {r.system && <IconShield size={12} className="shrink-0 text-[color:var(--color-amber-deep)]" />}
                        <span className="text-[13px] font-medium tracking-[-0.01em] text-ink">{r.name}</span>
                      </div>
                      <div className="mono mt-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.14em] text-graphite">
                        <span className="num">{r.users}</span>
                        <span>{r.users === 1 ? 'account' : 'accounts'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <RowAction label={`Edit ${r.name}`} onClick={() => openRoleEditor(r)}><IconPen size={12} /></RowAction>
                        {!r.system && r.users === 0 && (
                          <RowAction
                            label={armedRole === r.id ? 'Confirm delete' : `Delete ${r.name}`}
                            danger
                            onClick={() => confirmRole(r.id, () => { void removeRole(r); })}
                          >
                            {armedRole === r.id ? <IconCheck size={12} /> : <IconTrash size={12} />}
                          </RowAction>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permGroups.map((g) => (
                  <Fragment key={g.group}>
                    <tr>
                      <td colSpan={roles.length + 1} className="pb-2 pt-5">
                        <span className="eyebrow">{g.group}</span>
                      </td>
                    </tr>
                    {g.perms.map((p) => (
                      <tr key={p.key} className="border-b rule last:border-b-0">
                        <td className="py-2.5 pr-4">
                          <span className="text-[13.5px] text-ink">{p.label}</span>
                          <span className="mono ml-2 hidden text-[9.5px] tracking-[0.06em] text-silver lg:inline">{p.key}</span>
                        </td>
                        {roles.map((r) => {
                          const granted = r.permissions.includes(p.key);
                          return (
                            <td key={r.id} className="px-3 py-2.5">
                              <button
                                type="button"
                                disabled={r.system}
                                aria-pressed={granted}
                                aria-label={`${granted ? 'Revoke' : 'Grant'} ${p.label} for ${r.name}`}
                                title={r.system ? 'Fixed for the Administrator role' : granted ? `Revoke ${p.label}` : `Grant ${p.label}`}
                                onClick={() => void toggleMatrix(r, p.key)}
                                className={`grid h-6 w-6 place-items-center border transition-all duration-200 ${
                                  r.system
                                    ? 'cursor-default border-transparent'
                                    : granted
                                      ? 'border-[color:var(--color-amber-deep)] hover:opacity-70'
                                      : 'rule hover:border-[color:var(--color-amber-deep)]'
                                } active:scale-[0.9]`}
                                style={granted ? { background: 'color-mix(in oklab, var(--color-amber) 14%, white)' } : undefined}
                              >
                                {granted && <IconCheck size={12} className="text-[color:var(--color-amber-deep)]" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* ── Audit trail ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-[17px] font-medium tracking-[-0.01em]">Audit trail</h2>
        <div className="border-y rule">
          <div className="mono grid grid-cols-12 gap-4 border-b rule py-2.5 text-[9.5px] uppercase tracking-[0.2em] text-graphite">
            <span className="col-span-3 md:col-span-2">When</span>
            <span className="col-span-3 md:col-span-2">Actor</span>
            <span className="col-span-6 md:col-span-3">Action</span>
            <span className="col-span-12 md:col-span-5">Target</span>
          </div>
          {audit.length === 0 ? (
            <div className="py-6">
              <EmptyState title="No audit entries yet." hint="Actions taken across this module will be logged here." />
            </div>
          ) : (
            <ul className="divide-y rule">
              <AnimatePresence initial={false} mode="popLayout">
                {auditShown.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * 0.03, 0.25) }}
                    className="grid grid-cols-12 items-baseline gap-4 py-3"
                  >
                    <span className="mono num col-span-3 text-[11px] text-graphite md:col-span-2" title={new Date(e.at).toLocaleString('en-PH')}>
                      {timeAgo(e.at)}
                    </span>
                    <span className="col-span-3 text-[13px] text-ink md:col-span-2">{e.actor}</span>
                    <span className="col-span-6 text-[13px] text-slate md:col-span-3">{e.action}</span>
                    <span className="col-span-12 truncate text-[12.5px] text-graphite md:col-span-5">{e.target}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {audit.length > 0 && (
            <div className="flex items-center justify-between border-t rule py-3">
              <span className="mono num text-[10.5px] uppercase tracking-[0.14em] text-graphite">
                {(auditPageSafe - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(auditPageSafe * AUDIT_PAGE_SIZE, audit.length)} of {audit.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPageSafe <= 1}
                  className="mono border rule px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="mono num px-1 text-[10.5px] text-graphite">
                  {auditPageSafe} / {auditPages}
                </span>
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
                  disabled={auditPageSafe >= auditPages}
                  className="mono border rule px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Account drawer ─────────────────────────────────────── */}
      <Drawer
        open={accountEditing !== null}
        title={accountEditing === 'new' ? 'New staff account' : 'Edit account'}
        onClose={() => setAccountEditing(null)}
        footer={
          <>
            <BtnGhost onClick={() => setAccountEditing(null)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void saveAccount()} disabled={savingAccount}>
              {savingAccount ? 'Saving…' : accountEditing === 'new' ? 'Create account' : 'Save changes'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-6">
          {accountEditing === 'new' && (
            <p className="border-l-2 pl-4 text-[12.5px] leading-relaxed text-graphite" style={{ borderColor: 'var(--color-amber)' }}>
              This creates a staff account for the CMS. Portal clients are provisioned under Registered email template,
              which issues their create-password link.
            </p>
          )}

          <TextField
            label="Full name"
            value={accountForm.name}
            onChange={(v) => setAccountForm((f) => ({ ...f, name: v }))}
            placeholder="As it should appear in bylines and logs."
          />

          {accountEditing === 'new' ? (
            <TextField
              label="Email"
              value={accountForm.email}
              onChange={(v) => setAccountForm((f) => ({ ...f, email: v }))}
              placeholder={accountForm.kind === 'staff' ? 'name@regis.ph' : 'name@firm.com'}
              helper="This is the sign-in identity. It cannot change later."
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Email</span>
              <p className="mono border rule bg-bone px-3.5 py-2.5 text-[13px] text-graphite">{accountForm.email}</p>
            </div>
          )}

          {accountForm.kind === 'staff' ? (
            <div className="space-y-3">
              <SelectField
                label="Role"
                value={roles.find((r) => r.id === accountForm.roleId)?.name ?? ''}
                onChange={(v) => setAccountForm((f) => ({ ...f, roleId: roles.find((r) => r.name === v)?.id ?? '' }))}
                options={roles.map((r) => r.name)}
              />
              {accountForm.roleId && (
                <p className="border-l-2 pl-4 text-[12.5px] leading-relaxed text-graphite" style={{ borderColor: 'var(--color-amber)' }}>
                  {roles.find((r) => r.id === accountForm.roleId)?.description || 'No description yet.'}
                </p>
              )}
              <TextField
                label="Outlook email"
                value={accountForm.outlookEmail}
                onChange={(v) => setAccountForm((f) => ({ ...f, outlookEmail: v }))}
                placeholder="name@regis.ph"
                helper="The account email blasts are sent from. Recorded on every blast in the Email desk."
              />
            </div>
          ) : (
            <div className="space-y-6">
              <TextField
                label="Institutional firm"
                value={accountForm.firm}
                onChange={(v) => setAccountForm((f) => ({ ...f, firm: v }))}
                placeholder="ARQ Capital"
                helper="Shown in the portal header and coverage reports."
              />
              <div className="space-y-2.5">
                <span className="mono block text-[10.5px] uppercase tracking-[0.18em] text-graphite">Client type</span>
                <Segmented
                  options={[{ value: 'Local', label: 'Local' }, { value: 'Foreign', label: 'Foreign' }]}
                  value={accountForm.clientType}
                  onChange={(v) => setAccountForm((f) => ({ ...f, clientType: v }))}
                />
                {accountForm.clientType === null && (
                  <p className="text-[11.5px] leading-relaxed text-graphite">Not set yet — pick one to enable blast matching.</p>
                )}
              </div>
              <PrefChips
                label="Preferred sectors"
                options={REPORT_CATEGORIES}
                selected={accountForm.sectorPrefs}
                count={(c) => sectorCounts.get(c) ?? 0}
                onToggle={(s) => setAccountForm((f) => ({
                  ...f,
                  sectorPrefs: f.sectorPrefs.includes(s) ? f.sectorPrefs.filter((x) => x !== s) : [...f.sectorPrefs, s],
                }))}
                hint="Sets what this client sees in the portal, and queues them automatically for blasts in these sectors."
              />
              <PrefChips
                label="Preferred analysts"
                options={analystOptions}
                selected={accountForm.preferredAnalysts}
                count={(n) => analystCounts.get(n) ?? 0}
                onToggle={(n) => setAccountForm((f) => ({
                  ...f,
                  preferredAnalysts: f.preferredAnalysts.includes(n) ? f.preferredAnalysts.filter((x) => x !== n) : [...f.preferredAnalysts, n],
                }))}
                onAdd={(n) => setAccountForm((f) => ({
                  ...f,
                  preferredAnalysts: f.preferredAnalysts.includes(n) ? f.preferredAnalysts : [...f.preferredAnalysts, n],
                }))}
                hint="Names match report bylines exactly. A name carrying no reports shows a zero — check the spelling against the Reports module."
              />
              <CoverageNote count={coverageCount} total={reports.length} />
            </div>
          )}

          <TextField
            label={accountEditing === 'new' ? 'Password' : 'Reset password'}
            value={accountForm.password}
            onChange={(v) => setAccountForm((f) => ({ ...f, password: v }))}
            placeholder={accountEditing === 'new' ? 'At least 8 characters' : 'Leave blank to keep the current password'}
            helper={accountEditing === 'new' ? 'Share it through a secure channel; it is never emailed.' : undefined}
          />

          {accountError && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {accountError}
            </p>
          )}
        </div>
      </Drawer>

      {/* ── Role drawer ────────────────────────────────────────── */}
      <Drawer
        open={roleEditing !== null}
        title={roleEditing === 'new' ? 'Create a role' : roleEditing ? `Edit role` : ''}
        onClose={() => setRoleEditing(null)}
        footer={
          <>
            <BtnGhost onClick={() => setRoleEditing(null)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void saveRole()} disabled={savingRole}>
              {savingRole ? 'Saving…' : roleEditing === 'new' ? 'Create role' : 'Save changes'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-6">
          {roleEditing !== 'new' && roleEditing?.system ? (
            <div className="flex flex-col gap-2">
              <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Role</span>
              <p className="mono flex items-center gap-2 border rule bg-bone px-3.5 py-2.5 text-[13px] text-graphite">
                <IconShield size={13} className="text-[color:var(--color-amber-deep)]" /> {roleForm.name} (system role)
              </p>
            </div>
          ) : (
            <TextField
              label="Role name"
              value={roleForm.name}
              onChange={(v) => setRoleForm((f) => ({ ...f, name: v }))}
              placeholder="Research Editor"
            />
          )}

          <TextField
            label="Description"
            value={roleForm.description}
            onChange={(v) => setRoleForm((f) => ({ ...f, description: v }))}
            multiline
            placeholder="One sentence on who holds this role and why."
          />

          {(roleEditing === 'new' || (roleEditing && !roleEditing.system)) && (
            <div className="flex flex-col gap-3">
              <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Module access</span>
              {permGroups.map((g) => (
                <div key={g.group} className="border-t rule pt-3 first:border-t-0 first:pt-0">
                  <p className="mono mb-2 text-[9.5px] uppercase tracking-[0.2em] text-silver">{g.group}</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {g.perms.map((p) => {
                      const on = rolePerms.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setRolePerms((prev) => (on ? prev.filter((k) => k !== p.key) : [...prev, p.key]))}
                          className={`flex items-center gap-2.5 border px-3 py-2 text-left text-[13px] transition-colors duration-200 active:translate-y-px ${
                            on ? 'border-[color:var(--color-amber-deep)] text-ink' : 'rule text-graphite hover:text-ink'
                          }`}
                          style={on ? { background: 'color-mix(in oklab, var(--color-amber) 10%, white)' } : undefined}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center border ${on ? 'border-[color:var(--color-amber-deep)]' : 'rule'}`}
                          >
                            {on && <IconCheck size={10} className="text-[color:var(--color-amber-deep)]" />}
                          </span>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {roleEditing !== 'new' && roleEditing?.system && (
            <p className="border-l-2 pl-4 text-[12.5px] leading-relaxed text-graphite" style={{ borderColor: 'var(--color-amber)' }}>
              The Administrator role always holds every permission, so the system can never lock itself out. Only its description can change.
            </p>
          )}

          {roleError && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {roleError}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}

/* ── Preference chip grid ──────────────────────────────────── */

function PrefChips({ label, options, selected, onToggle, onAdd, count, hint }: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  /** When present, a free-add input is shown after the chips. */
  onAdd?: (value: string) => void;
  /** Published reports carrying this value — a zero is a spelling warning. */
  count?: (value: string) => number;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (v && onAdd) onAdd(v);
    setDraft('');
  };

  return (
    <div className="space-y-2.5">
      <span className="mono block text-[10.5px] uppercase tracking-[0.18em] text-graphite">
        {label}
        {selected.length > 0 && <span className="num ml-2 opacity-60">{selected.length}</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          const n = count?.(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              aria-pressed={on}
              title={n === undefined ? undefined : `${n} ${n === 1 ? 'report' : 'reports'} published under ${o}`}
              className={`mono border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors duration-200 active:translate-y-px ${
                on ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
              }`}
            >
              {o}
              {n !== undefined && (
                <span className={`num ml-2 ${on ? 'opacity-60' : n === 0 ? 'text-silver' : 'text-slate'}`}>{n}</span>
              )}
            </button>
          );
        })}
        {onAdd && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            onBlur={add}
            placeholder="Other…"
            className="mono w-[110px] border rule bg-white px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        )}
      </div>
      {hint && <p className="text-[11.5px] leading-relaxed text-graphite">{hint}</p>}
    </div>
  );
}

/* ── Mandate readout ───────────────────────────────────────── */

/** What the preferences on screen mean for the client's portal: how many
    reports they will see once saved. No preferences means the whole shelf. */
function CoverageNote({ count, total }: { count: number | null; total: number }) {
  const restricted = count !== null;
  const empty = restricted && count === 0;

  return (
    <div className="border-l-2 pl-4" style={{ borderColor: empty ? 'var(--color-warn)' : 'var(--color-amber)' }}>
      <p className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Portal coverage</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite" style={empty ? { color: 'var(--color-warn)' } : undefined}>
        {!restricted ? (
          <>
            No preferences set — this client sees the full catalog of{' '}
            <span className="num">{total}</span> {total === 1 ? 'report' : 'reports'}.
          </>
        ) : empty ? (
          <>Nothing on the shelf matches these preferences. This client's portal stays empty until research lands on one of them.</>
        ) : (
          <>
            This client sees <span className="num">{count}</span> of <span className="num">{total}</span>{' '}
            {total === 1 ? 'report' : 'reports'} — those on a preferred sector, or by a preferred analyst.
          </>
        )}
      </p>
    </div>
  );
}
