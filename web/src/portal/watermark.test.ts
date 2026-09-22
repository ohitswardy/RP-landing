import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stampPdf, WatermarkError } from './watermark';

/* pdf-lib is loaded through a dynamic import inside stampPdf. The mock keeps
   the real library but lets a test make `PDFDocument.load` reject, so the
   "bytes cannot be opened" branch can be exercised on demand. */
const state = vi.hoisted(() => ({ failLoad: false }));

vi.mock('pdf-lib', async () => {
  const actual = await vi.importActual<typeof import('pdf-lib')>('pdf-lib');
  const load: typeof actual.PDFDocument.load = (...args) =>
    state.failLoad ? Promise.reject(new Error('Not a PDF')) : actual.PDFDocument.load(...args);
  const PDFDocument = Object.assign(Object.create(actual.PDFDocument), { load, create: actual.PDFDocument.create });
  return { ...actual, PDFDocument };
});

const subject = { title: 'Banks: 2Q26 review', date: '2026-08-14' };
const actor = { name: 'Ana Reyes', email: 'ana@fund.com' };

async function samplePdf(): Promise<ArrayBuffer> {
  const { PDFDocument, degrees } = await vi.importActual<typeof import('pdf-lib')>('pdf-lib');
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  // A rotated page too, so the visual-frame mapping is exercised.
  doc.addPage([842, 595]).setRotation(degrees(90));
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** jsdom's Blob has no arrayBuffer(); FileReader is the portable route. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

beforeEach(() => {
  state.failLoad = false;
});

describe('stampPdf', () => {
  it('stamps every page and records the reference in the keywords', async () => {
    const out = await stampPdf(await samplePdf(), subject, actor);
    expect(out.type).toBe('application/pdf');
    expect(out.size).toBeGreaterThan(0);

    const { PDFDocument } = await vi.importActual<typeof import('pdf-lib')>('pdf-lib');
    const stamped = await PDFDocument.load(await bytesOf(out));
    expect(stamped.getPageCount()).toBe(2);
    expect(stamped.getKeywords()).toMatch(/RP-20260814-[0-9A-Z]+/);
    expect(stamped.getKeywords()).toContain('ana@fund.com');
  });

  it('throws a WatermarkError("load") when the bytes cannot be opened', async () => {
    state.failLoad = true;
    const err = await stampPdf(new ArrayBuffer(8), subject, actor).catch((e) => e as unknown);
    expect(err).toBeInstanceOf(WatermarkError);
    expect((err as WatermarkError).reason).toBe('load');
    expect((err as WatermarkError).message).toMatch(/could not be watermarked/);
  });

  it('never resolves to the unstamped bytes on failure', async () => {
    state.failLoad = true;
    await expect(stampPdf(new ArrayBuffer(8), subject, null)).rejects.toBeInstanceOf(WatermarkError);
  });

  it('throws a WatermarkError("engine") when pdf-lib itself cannot load', async () => {
    const source = await samplePdf();
    // A fresh module graph in which the pdf-lib chunk fails to load.
    vi.resetModules();
    vi.doMock('pdf-lib', () => { throw new Error('chunk load failed'); });
    try {
      const fresh = await import('./watermark');
      const err = await fresh.stampPdf(source, subject, actor).catch((e) => e as unknown);
      expect(err).toBeInstanceOf(fresh.WatermarkError);
      expect((err as InstanceType<typeof fresh.WatermarkError>).reason).toBe('engine');
    } finally {
      vi.doUnmock('pdf-lib');
      vi.resetModules();
    }
  });
});
