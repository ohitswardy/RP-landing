import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtBytes, fmtDate, type Report } from '../cms/data';
import { ReportFileError, reportFileMessage, stampedReportBlob } from './download';
import { trackActivity } from './track';
import { IconX, IconDownload, IconExternal } from '../cms/icons';
import RatingTag from './RatingTag';

const EASE = [0.25, 1, 0.5, 1] as const;

type UrlState =
  | { status: 'idle' | 'loading'; url: null; error: null; retryable: false }
  | { status: 'ready'; url: string; error: null; retryable: false }
  | { status: 'error'; url: null; error: string; retryable: boolean };

/** Resolve a report to a browser-usable URL. The copy the viewer renders is
    the stamped copy, so "New tab" and the PDF reader's own save button hand
    over exactly what the Download button would. An unstamped copy is never
    shown: a failed stamp is an error state with a retry. */
function useReportUrl(report: Report | null) {
  const [state, setState] = useState<UrlState>({ status: 'idle', url: null, error: null, retryable: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!report) { setState({ status: 'idle', url: null, error: null, retryable: false }); return; }
    let objectUrl: string | null = null;
    let alive = true;

    setState({ status: 'loading', url: null, error: null, retryable: false });
    stampedReportBlob(report)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl, error: null, retryable: false });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // A dead session is on its way to the door; nothing to show here.
        if (e instanceof ReportFileError && e.kind === 'session') return;
        setState({
          status: 'error',
          url: null,
          error: reportFileMessage(e),
          retryable: !(e instanceof ReportFileError && e.kind === 'missing'),
        });
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

export default function ReportViewer({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { url, status, error, retryable, retry } = useReportUrl(report);

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
                <div className="mono mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-graphite">
                  {report.companySymbol && (
                    <>
                      <span className="text-ink">{report.companySymbol}</span>
                      <span className="text-silver">·</span>
                    </>
                  )}
                  <span className="truncate">{report.reportType ?? report.category ?? 'General'}</span>
                  <span className="text-silver">·</span>
                  <span className="num">{fmtDate(report.date)}</span>
                  {report.pages ? <><span className="text-silver">·</span><span className="num">{report.pages}p</span></> : null}
                  {report.rating && <><span className="text-silver">·</span><RatingTag rating={report.rating} /></>}
                </div>
                <h2 className="truncate text-[16px] font-medium tracking-[-0.01em] text-ink md:text-[18px]">{report.title}</h2>
                {report.summary && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate">{report.summary}</p>
                )}
                <p className="mono mt-1.5 text-[11px] tracking-[0.04em] text-graphite">
                  {[report.analyst, report.companyName, fmtBytes(report.fileSize)].filter(Boolean).join(' · ')}
                </p>
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
              ) : status === 'error' ? (
                <div className="grid h-full place-items-center px-6">
                  <div className="flex max-w-[40ch] flex-col items-center text-center">
                    <span aria-hidden className="mb-5 block h-[2px] w-6" style={{ background: 'var(--color-warn)' }} />
                    <p className="text-[15px] font-medium text-ink">
                      {retryable ? 'Your copy could not be prepared.' : 'This report has no file yet.'}
                    </p>
                    <p role="alert" className="mt-2 text-[13px] leading-relaxed text-graphite">{error}</p>
                    <div className="mt-6 flex items-center gap-2.5">
                      {retryable && (
                        <button
                          type="button"
                          onClick={retry}
                          className="inline-flex h-9 items-center gap-2 bg-navy px-4 text-[12.5px] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)] active:translate-y-px"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 items-center border rule px-4 text-[12.5px] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
                      >
                        Close
                      </button>
                    </div>
                    <p className="mono mt-6 text-[10px] uppercase tracking-[0.18em] text-silver">
                      Copies leave only with a watermark
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center">
                  <span className="mono text-[11px] uppercase tracking-[0.2em] text-graphite">Watermarking your copy…</span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
