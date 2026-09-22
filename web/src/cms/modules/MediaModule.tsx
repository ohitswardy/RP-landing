import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MediaInUseError, useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, RowAction, SelectField, Stat, useConfirm, EASE,
} from '../ui';
import { IconCheck, IconCopy, IconSearch, IconTrash, IconUndo, IconUpload } from '../icons';
import { Modal, Panel } from '../kit/parts';
import { MEDIA_KINDS, type MediaAsset, type MediaKind } from '../data';
import { clipboardEventImage } from '@/lib/clipboard';

/* ─────────────────────────────────────────────────────────────
   The media library: every photo, portrait, and graphic the
   site's pages and mailers draw from. Uploads here are filed
   unattached; the same list feeds every ImagePicker's Library
   tab, so a file dropped here is a click away on any page.
   ───────────────────────────────────────────────────────────── */

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MAX_BYTES = 8 * 1024 * 1024;

type KindFilter = 'all' | MediaKind;
const FILTERS: KindFilter[] = ['all', 'photo', 'portrait', 'graphic'];

const KIND_LABEL: Record<MediaKind, string> = Object.fromEntries(MEDIA_KINDS.map((k) => [k.value, k.label])) as Record<MediaKind, string>;

export default function MediaModule() {
  const { media, status, uploadMedia, deleteMedia, refreshMedia } = useCms();

  const [filter, setFilter] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MediaKind>('photo');
  const [hover, setHover] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [inUse, setInUse] = useState<{ asset: MediaAsset; message: string; references: string[] } | null>(null);
  const [armed, confirm] = useConfirm();
  const input = useRef<HTMLInputElement>(null);

  const loading = status === 'loading';

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  /* Ctrl+V anywhere on the page files an image straight off the clipboard. */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = clipboardEventImage(e);
      if (!file) return;
      e.preventDefault();
      void accept([file]);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const counts = useMemo(() => {
    const m = new Map<KindFilter, number>([['all', media.length]]);
    for (const k of MEDIA_KINDS) m.set(k.value, media.filter((a) => a.kind === k.value).length);
    return m;
  }, [media]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media
      .filter((a) => filter === 'all' || a.kind === filter)
      .filter((a) => !q || a.label.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.usedBy.toLowerCase().includes(q));
  }, [media, filter, query]);

  /** Validate each file, then upload one at a time so the rail orb reads as one steady job. */
  async function accept(files: File[]) {
    const list = files.filter(Boolean);
    if (list.length === 0) return;
    setUploadError(null);
    const bad = list.find((f) => !ACCEPT.split(',').includes(f.type));
    if (bad) { setUploadError(`${bad.name}: use a JPG, PNG, WebP, or AVIF file.`); return; }
    const big = list.find((f) => f.size > MAX_BYTES);
    if (big) { setUploadError(`${big.name} is over 8 MB. Compress it before uploading.`); return; }

    setUploading({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i += 1) {
        const f = list[i];
        await uploadMedia(f, { label: f.name.replace(/\.[^.]+$/, ''), kind });
        setUploading({ done: i + 1, total: list.length });
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'The upload failed. Try again.');
    } finally {
      setUploading(null);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setHover(false);
    void accept(Array.from(e.dataTransfer.files ?? []));
  }

  async function copyPath(a: MediaAsset) {
    try {
      await navigator.clipboard.writeText(a.path);
      setCopied(a.id);
    } catch {
      setRowError('The browser would not hand over the clipboard. Select the path and copy it by hand.');
    }
  }

  async function remove(a: MediaAsset) {
    setRowError(null);
    try {
      await deleteMedia(a.id);
    } catch (e) {
      if (e instanceof MediaInUseError) {
        setInUse({ asset: a, message: e.message, references: e.references });
        return;
      }
      setRowError(e instanceof Error ? e.message : 'The image could not be deleted.');
    }
  }

  async function refresh() {
    setRefreshing(true);
    setRowError(null);
    try {
      await refreshMedia();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'The library could not be re-read.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="13 / Media"
        title="Media library"
        blurb="Every image the site and the mailers draw from. Files uploaded here are unattached until a page picks them; every image picker's Library tab reads this same list."
        actions={
          <>
            <BtnGhost onClick={() => void refresh()} disabled={refreshing}>
              <IconUndo size={13} /> {refreshing ? 'Re-reading…' : 'Re-read library'}
            </BtnGhost>
            <BtnPrimary onClick={() => input.current?.click()} disabled={uploading !== null}>
              <IconUpload size={14} /> Upload
            </BtnPrimary>
          </>
        }
      />

      {!loading && media.length > 0 && (
        <div className="grid grid-cols-2 gap-6 border-b rule pb-8 md:grid-cols-4">
          <Stat value={String(media.length)} label="Assets" />
          {MEDIA_KINDS.map((k) => (
            <Stat key={k.value} value={String(counts.get(k.value) ?? 0)} label={`${k.label}s`} />
          ))}
        </div>
      )}

      {/* ── Drop zone ───────────────────────────────────────── */}
      <Panel
        code="Upload"
        title="Add to the library"
        hint="Drop files, choose them, or paste an image from the clipboard. The rail orb shows the transfer."
        actions={
          <div className="w-[150px]">
            <SelectField label="File as" value={kind} onChange={(v) => setKind(v as MediaKind)} options={MEDIA_KINDS.map((k) => k.value)} size="sm" />
          </div>
        }
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { void accept(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setHover(true); }}
          onDragLeave={() => setHover(false)}
          onDrop={onDrop}
          className="grid place-items-center border border-dashed px-8 py-12 text-center transition-colors duration-300"
          style={{
            borderColor: hover ? 'var(--color-amber-deep)' : 'color-mix(in oklab, var(--color-ink) 18%, transparent)',
            background: hover ? 'color-mix(in oklab, var(--color-amber) 7%, transparent)' : 'var(--color-bone)',
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
            <p className="text-[14.5px] text-ink">
              {uploading ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…` : 'Drop images here, or paste one'}
            </p>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-graphite">
              JPG, PNG, WebP, or AVIF up to 8 MB each. Filed as {KIND_LABEL[kind].toLowerCase()}s; the label is taken from the file name.
            </p>
            <BtnPrimary onClick={() => input.current?.click()} disabled={uploading !== null}>
              <IconUpload size={14} /> {uploading ? 'Uploading…' : 'Choose files'}
            </BtnPrimary>
            <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-silver">Ctrl+V works anywhere on this page</p>
          </div>
        </div>
        {uploadError && (
          <p className="mt-4 border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {uploadError}
          </p>
        )}
      </Panel>

      {/* ── Filter rail ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                filter === f ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
              }`}
            >
              {f === 'all' ? 'all' : `${KIND_LABEL[f]}s`}
              <span className="ml-2 opacity-50">{counts.get(f) ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full md:w-[280px]">
          <span className="sr-only">Search the library</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Label, path, or page…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>
      </div>

      {rowError && (
        <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
          {rowError}
        </p>
      )}

      {/* ── Grid ────────────────────────────────────────────── */}
      {loading ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="aspect-[4/3] skeleton-bar" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          title={query ? 'Nothing in the library matches.' : media.length === 0 ? 'The library is empty.' : 'Nothing of this kind yet.'}
          hint={query ? 'Search covers the label, the stored path, and the page that last used it.' : 'Drop a file above, or upload from any page’s image picker; both land here.'}
          action={query || filter !== 'all' ? <BtnGhost onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</BtnGhost> : undefined}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {rows.map((a, i) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: Math.min(i * 0.02, 0.2) } }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                className="group flex flex-col border rule bg-paper"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-bone">
                  <img src={a.path} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]" />
                  <span className="absolute left-2 top-2">
                    <span className="mono bg-paper/90 px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.16em] text-ink">{KIND_LABEL[a.kind]}</span>
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1 px-3 pt-3">
                  <span className="truncate text-[13px] text-ink" title={a.label}>{a.label || 'Untitled'}</span>
                  <span className="mono truncate text-[9.5px] uppercase tracking-[0.14em] text-graphite" title={a.usedBy}>{a.usedBy || 'Unattached'}</span>
                  <span className="mono truncate text-[9.5px] tracking-[0.04em] text-silver" title={a.path}>{a.path}</span>
                </span>
                <span className="mt-auto flex items-center justify-between gap-2 px-3 py-3">
                  <span className="min-w-0">
                    {copied === a.id && <Chip tone="live">Path copied</Chip>}
                    {armed === a.id && copied !== a.id && (
                      <span className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--color-warn)' }}>sure?</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <RowAction label="Copy path" onClick={() => void copyPath(a)}>
                      {copied === a.id ? <IconCheck /> : <IconCopy />}
                    </RowAction>
                    <RowAction label={armed === a.id ? 'Confirm delete' : 'Delete image'} danger onClick={() => confirm(a.id, () => { void remove(a); })}>
                      {armed === a.id ? <IconCheck /> : <IconTrash />}
                    </RowAction>
                  </span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* ── Still referenced ────────────────────────────────── */}
      <Modal
        open={inUse !== null}
        title="Still in use"
        onClose={() => setInUse(null)}
        footer={<BtnPrimary onClick={() => setInUse(null)}>Understood</BtnPrimary>}
      >
        {inUse && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="block h-14 w-20 shrink-0 overflow-hidden bg-bone">
                <img src={inUse.asset.path} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] text-ink">{inUse.asset.label || 'Untitled'}</p>
                <p className="mono truncate text-[10px] tracking-[0.04em] text-graphite">{inUse.asset.path}</p>
              </div>
            </div>
            <p className="text-[13.5px] leading-relaxed text-slate">{inUse.message}</p>
            <div>
              <div className="mono mb-2 text-[9.5px] uppercase tracking-[0.2em] text-graphite">Referenced by</div>
              <ul className="divide-y rule border-y rule">
                {inUse.references.map((r) => (
                  <li key={r} className="py-2 text-[13px] text-ink">{r}</li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] leading-relaxed text-graphite">
              Replace the image on each of those pages first; the delete goes through once nothing points at the file.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
