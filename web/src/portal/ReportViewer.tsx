import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtBytes, fmtDate, type Report } from '../cms/data';
import { stampedReportBlob } from './download';
import { trackActivity } from './track';
import { IconX, IconDownload, IconExternal } from '../cms/icons';

const EASE = [0.25, 1, 0.5, 1] as const;

/** Resolve a report to a browser-usable URL. The copy the viewer renders is
    the stamped copy, so "New tab" and the PDF reader's own save button hand
    over exactly what the Download button would. */
function useReportUrl(report: Report | null) {
  const [state, setState] = useState<{ url: string | null; status: 'idle' | 'loading' | 'ready' | 'missing' }>({
    url: null, status: 'idle',
  });

  useEffect(() => {
    if (!report) { setState({ url: null, status: 'idle' }); return; }
    let objectUrl: string | null = null;
    let alive = true;

    setState({ url: null, status: 'loading' });
    void stampedReportBlob(report).then((blob) => {
      if (!alive) return;
      if (!blob) {
        setState({ url: null, status: 'missing' });
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, status: 'ready' });
    });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report]);

  return state;
}

export default function ReportViewer({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { url, status } = useReportUrl(report);

  useEffect(() => {
    if (!report) return;
    trackActivity('view', report, 'viewer');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [report, onClose]);

  function download() {
    if (!url || !report) return;
    trackActivity('download', report, 'viewer');
    const a = document.createElement('a');
    a.href = url;
    a.download = report.fileName || `${report.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AnimatePresence>
      {report && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'oklch(0.165 0.040 260 / 0.55)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            role="dialog"
            aria-label={report.title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-x-3 top-3 bottom-3 z-50 mx-auto flex max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl md:inset-x-6 md:top-6 md:bottom-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b rule px-5 py-4 md:px-7">
              <div className="min-w-0">
                <div className="mono mb-1.5 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.16em] text-graphite">
                  <span className="truncate">{report.category ?? 'General'}</span>
                  <span className="text-silver">·</span>
                  <span className="num">{fmtDate(report.date)}</span>
                  {report.pages ? <><span className="text-silver">·</span><span className="num">{report.pages}p</span></> : null}
                </div>
                <h2 className="truncate text-[16px] font-medium tracking-[-0.01em] text-ink md:text-[18px]">{report.title}</h2>
                {report.summary && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate">{report.summary}</p>
                )}
                <p className="mono mt-1.5 text-[11px] tracking-[0.04em] text-graphite">{report.analyst} · {fmtBytes(report.fileSize)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {url && (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackActivity('click', report, 'new-tab')}
                      className="hidden h-9 items-center gap-2 border rule px-3.5 text-[12.5px] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink sm:inline-flex"
                    >
                      <IconExternal size={13} /> New tab
                    </a>
                    <button
                      type="button"
                      onClick={download}
                      className="inline-flex h-9 items-center gap-2 bg-navy px-3.5 text-[12.5px] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)] active:translate-y-px"
                    >
                      <IconDownload size={14} /> Download
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center border rule text-graphite transition-colors hover:text-ink"
                >
                  <IconX />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="relative flex-1 bg-bone">
              {status === 'ready' && url ? (
                <iframe title={report.title} src={`${url}#view=FitH`} className="h-full w-full" />
              ) : status === 'loading' ? (
                <div className="grid h-full place-items-center">
                  <span className="mono text-[11px] uppercase tracking-[0.2em] text-graphite">Watermarking your copy…</span>
                </div>
              ) : (
                <div className="grid h-full place-items-center px-6">
                  <div className="max-w-[38ch] text-center">
                    <p className="text-[15px] font-medium text-ink">This PDF could not be retrieved.</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-graphite">
                      The document may still be publishing. Refresh the portal, or ask your Regis coverage if it keeps failing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
