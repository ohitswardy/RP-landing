import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { motion } from 'framer-motion';
import { useCms, type UploadScope } from '../store';
import type { MediaAsset } from '../data';
import { BtnGhost, BtnPrimary, EASE } from '../ui';
import { IconCheck, IconSearch, IconUpload } from '../icons';
import { Field, Modal } from './parts';

type Tab = 'upload' | 'library' | 'path';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'upload', label: 'Upload' },
  { value: 'library', label: 'Library' },
  { value: 'path', label: 'Path' },
];

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * One dialog for every way an editor gets a photo onto a page: upload a
 * new file, reuse something already in the media library, or paste the
 * path of a file that ships with the front-end build.
 */
export default function ImagePicker({
  open, title, usedBy, scope, onPick, onClose, aspect = '16/9', hint, kind,
}: {
  open: boolean;
  title: string;
  /** Recorded on the media-library entry when a new file is uploaded. */
  usedBy: string;
  /** Which module's upload route to post to — permissions differ per module. */
  scope: UploadScope;
  onPick: (path: string) => void;
  onClose: () => void;
  /** Preview aspect for the pasted-path tab and the drop-zone advice. */
  aspect?: string;
  hint?: string;
  /** How the upload is filed in the media library. */
  kind?: MediaAsset['kind'];
}) {
  const { media, uploadImage } = useCms();
  const [tab, setTab] = useState<Tab>('upload');
  const [query, setQuery] = useState('');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab('upload');
    setQuery('');
    setPath('');
    setError(null);
    setBusy(false);
    setHover(false);
  }, [open]);

  const assets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter((a) => a.label.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.usedBy.toLowerCase().includes(q));
  }, [media, query]);

  async function accept(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a JPG, PNG, WebP, or AVIF file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is over 8 MB. Compress it before uploading.');
      return;
    }
    setBusy(true);
    try {
      const asset = await uploadImage(file, { label: file.name.replace(/\.[^.]+$/, ''), usedBy, scope, kind });
      onPick(asset.path);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setHover(false);
    void accept(e.dataTransfer.files?.[0]);
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
      footer={
        tab === 'path' ? (
          <>
            <BtnGhost onClick={onClose}>Cancel</BtnGhost>
            <BtnPrimary
              disabled={!path.trim()}
              onClick={() => { onPick(path.trim()); onClose(); }}
            >
              Use this path
            </BtnPrimary>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`mono border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                tab === t.value ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:text-ink'
              }`}
            >
              {t.label}
              {t.value === 'library' && <span className={`ml-2 ${tab === t.value ? 'opacity-60' : 'text-silver'}`}>{media.length}</span>}
            </button>
          ))}
        </div>

        {error && (
          <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {error}
          </p>
        )}

        {tab === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
            className="grid place-items-center border border-dashed px-8 py-16 text-center transition-colors duration-300"
            style={{
              borderColor: hover ? 'var(--color-amber-deep)' : 'color-mix(in oklab, var(--color-ink) 18%, transparent)',
              background: hover ? 'color-mix(in oklab, var(--color-amber) 7%, transparent)' : 'var(--color-bone)',
            }}
          >
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }}
            />
            <div className="flex flex-col items-center gap-4">
              <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
              <p className="text-[14.5px] text-ink">{busy ? 'Uploading…' : 'Drop a photo here'}</p>
              <p className="max-w-[42ch] text-[12.5px] leading-relaxed text-graphite">
                {hint ?? 'JPG, PNG, WebP, or AVIF up to 8 MB. Landscape crops at roughly 16:9 read best in a page hero.'}
              </p>
              <BtnPrimary onClick={() => input.current?.click()} disabled={busy}>
                <IconUpload size={14} /> {busy ? 'Uploading…' : 'Choose file'}
              </BtnPrimary>
            </div>
          </div>
        )}

        {tab === 'library' && (
          <div className="flex flex-col gap-4">
            <label className="relative block">
              <span className="sr-only">Search the media library</span>
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, path, or page"
                className="w-full border rule bg-white py-2.5 pl-9 pr-3.5 text-[13.5px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              />
            </label>

            {assets.length === 0 ? (
              <p className="border border-dashed rule px-6 py-10 text-center text-[13px] text-graphite">
                Nothing in the library matches “{query}”.
              </p>
            ) : (
              <ul className="grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                {assets.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <button
                      type="button"
                      onClick={() => { onPick(a.path); onClose(); }}
                      className="group block w-full text-left"
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden bg-bone">
                        <img src={a.path} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.04]" />
                        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'oklch(0.165 0.040 260 / 0.5)' }}>
                          <span className="mono inline-flex items-center gap-1.5 bg-paper px-2.5 py-1.5 text-[9.5px] uppercase tracking-[0.16em] text-ink">
                            <IconCheck size={11} /> Use
                          </span>
                        </span>
                      </span>
                      <span className="mt-2 block truncate text-[12.5px] text-ink">{a.label}</span>
                      <span className="mono mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.14em] text-graphite">{a.usedBy}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'path' && (
          <div className="flex flex-col gap-5">
            <Field
              label="Image path"
              value={path}
              onChange={setPath}
              placeholder="/Services1.jpg"
              hint="For files that ship with the site build — anything inside the front-end public folder. Uploaded photos already carry their own path."
            />
            {path.trim() && (
              <div className="w-full max-w-[420px] overflow-hidden bg-bone" style={{ aspectRatio: aspect }}>
                <img src={path.trim()} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
