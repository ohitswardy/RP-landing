import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import type { Company, Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Client-portal research catalog, fed by /api/portal/reports.
   Reports posted in the CMS appear here on the next load.
   ───────────────────────────────────────────────────────────── */

type ReportsValue = {
  reports: Report[];
  /** The covered-companies registry, grouped local/foreign by the filter UI. */
  companies: Company[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  reload: () => void;
};

const ReportsContext = createContext<ReportsValue | null>(null);

export function PortalReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<ReportsValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await apiFetch<{ reports: Report[]; companies?: Company[] }>('/portal/reports', { audience: 'portal' });
      if (!alive.current) return;
      setReports(data.reports);
      setCompanies(data.companies ?? []);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load the research catalog.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const value = useMemo<ReportsValue>(
    () => ({ reports, companies, status, error, reload: () => { void load(); } }),
    [reports, companies, status, error, load],
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports(): ReportsValue {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports must be used inside <PortalReportsProvider>');
  return ctx;
}
