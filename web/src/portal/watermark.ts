import type { PDFFont, PDFPage, RGB, Rotation } from 'pdf-lib';

/* ─────────────────────────────────────────────────────────────
   Download provenance for the client portal.

   Every PDF the portal hands over is stamped, page by page, with
   the house mark and the name of the client who took the copy,
   applied to files the CMS uploaded rather than to markup we
   render ourselves.

   The stamp is written into the document, so it survives a
   re-save, a forward, and a print to paper. A leaked copy points
   back at one client and one moment.
   ───────────────────────────────────────────────────────────── */

/** The signed-in client, recorded on every stamped page. */
export type DownloadActor = { name: string; email: string } | null;

export type StampSubject = {
  /** Runs along the foot of every page. */
  title: string;
  /** Publication date (ISO) — seeds the reference id. */
  date: string;
};

const MARK = 'REGIS PARTNERS';

/** Rotation of the diagonal mark, in degrees counter-clockwise. */
const MARK_ANGLE = 28;
/** Letter tracking in ems, matching the newsletter watermark. */
const MARK_TRACKING = 0.18;

const MARK_OPACITY = 0.06;
const LINE_OPACITY = 0.11;

const FOOT_SIZE = 7;
const FOOT_INSET = 22;
const FOOT_BASELINE = 12;

/** Anything past Latin-1 would throw on a standard PDF font, which speaks
    WinAnsi only. Fold the common typographic characters down, drop the rest. */
const NON_WINANSI = new RegExp('[^\\u0020-\\u007E\\u00A0-\\u00FF]', 'g');

function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(NON_WINANSI, '?');
}

/** Short, unique handle for one download — quotable when tracing a leak. */
function reference(date: string): string {
  const day = date.replace(/-/g, '') || 'UNDATED';
  return `RP-${day}-${Date.now().toString(36).toUpperCase()}`;
}

function timestamp(): string {
  const at = new Date().toLocaleString('en-PH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  });
  return `${at} PHT`;
}

/** Width of a run once per-character tracking is added. */
function trackedWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + tracking * size * Math.max(0, text.length - 1);
}

function ellipsize(text: string, font: PDFFont, size: number, max: number): string {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > max) out = out.slice(0, -1);
  return `${out}...`;
}

/* ── Page geometry ────────────────────────────────────────────
   Uploaded PDFs carry their own /Rotate, and drawing straight
   into user space would land the stamp sideways on a rotated
   scan. Each page therefore gets a frame mapping "visual"
   coordinates — origin at the bottom-left as the reader sees it
   — onto the coordinates pdf-lib actually draws in.
   ─────────────────────────────────────────────────────────── */

type Frame = {
  /** Page size as the reader sees it. */
  w: number;
  h: number;
  /** Visual point → user-space point. */
  pt: (u: number, v: number) => { x: number; y: number };
  /** Visual angle → the angle to draw at. */
  angle: (deg: number) => number;
};

function frameOf(page: PDFPage): Frame {
  const { width: w, height: h } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  switch (rotation) {
    case 90:
      return { w: h, h: w, pt: (u, v) => ({ x: w - v, y: u }), angle: (d) => d + 90 };
    case 180:
      return { w, h, pt: (u, v) => ({ x: w - u, y: h - v }), angle: (d) => d + 180 };
    case 270:
      return { w: h, h: w, pt: (u, v) => ({ x: v, y: h - u }), angle: (d) => d + 270 };
    default:
      return { w, h, pt: (u, v) => ({ x: u, y: v }), angle: (d) => d };
  }
}

/** The two pdf-lib constructors the drawing helpers need, passed in so the
    library itself stays behind a single dynamic import. */
type Ink = {
  rgb: (r: number, g: number, b: number) => RGB;
  degrees: (d: number) => Rotation;
};

const NAVY = (ink: Ink) => ink.rgb(0x1f / 255, 0x4e / 255, 0x79 / 255);
const GRAY = (ink: Ink) => ink.rgb(0x9a / 255, 0xa4 / 255, 0xb2 / 255);

type Run = {
  text: string;
  font: PDFFont;
  size: number;
  color: RGB;
  opacity: number;
};

/** Draw one tracked run centred on a visual point, at a visual angle. */
function drawTracked(
  page: PDFPage,
  frame: Frame,
  ink: Ink,
  run: Run & { tracking: number; cu: number; cv: number; angle: number },
): void {
  const rad = (run.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const total = trackedWidth(run.text, run.font, run.size, run.tracking / run.size);
  // Drop the baseline half a cap height so the run reads visually centred.
  const drop = run.size * 0.35;
  const rotate = ink.degrees(frame.angle(run.angle));

  let along = -total / 2;
  for (const ch of [...run.text]) {
    if (ch !== ' ') {
      const { x, y } = frame.pt(run.cu + along * cos + drop * sin, run.cv + along * sin - drop * cos);
      page.drawText(ch, { x, y, size: run.size, font: run.font, color: run.color, opacity: run.opacity, rotate });
    }
    along += run.font.widthOfTextAtSize(ch, run.size) + run.tracking;
  }
}

/** Left-anchored plain run at a visual point. */
function drawAt(page: PDFPage, frame: Frame, ink: Ink, run: Run & { u: number; v: number }): void {
  const { x, y } = frame.pt(run.u, run.v);
  page.drawText(run.text, {
    x, y, size: run.size, font: run.font, color: run.color, opacity: run.opacity,
    rotate: ink.degrees(frame.angle(0)),
  });
}

function stampPage(
  page: PDFPage,
  ink: Ink,
  fonts: { bold: PDFFont; body: PDFFont },
  text: { provenance: string; trail: string; title: string; page: string },
): void {
  const frame = frameOf(page);
  const cu = frame.w / 2;
  const cv = frame.h / 2;

  // Size the mark to span the page, whatever the paper — bounded on both
  // axes so a landscape sheet does not run the diagonal off the edge.
  const rad = (MARK_ANGLE * Math.PI) / 180;
  const span = Math.min((frame.w * 0.92) / Math.cos(rad), (frame.h * 0.92) / Math.sin(rad));
  const markSize = span / trackedWidth(MARK, fonts.bold, 1, MARK_TRACKING);

  drawTracked(page, frame, ink, {
    text: MARK, font: fonts.bold, size: markSize, tracking: MARK_TRACKING * markSize,
    color: NAVY(ink), opacity: MARK_OPACITY, cu, cv, angle: MARK_ANGLE,
  });

  // Directly beneath the mark, on the same diagonal: who took this copy.
  const lineSize = Math.max(7.5, markSize * 0.185);
  const drop = markSize * 0.9;
  drawTracked(page, frame, ink, {
    text: text.provenance, font: fonts.body, size: lineSize, tracking: 0.1 * lineSize,
    color: NAVY(ink), opacity: LINE_OPACITY,
    cu: cu + drop * Math.sin(rad),
    cv: cv - drop * Math.cos(rad),
    angle: MARK_ANGLE,
  });

  // Foot of the page: subject, the full trail, page number.
  const usable = frame.w - FOOT_INSET * 2;
  const trail = ellipsize(text.trail, fonts.body, FOOT_SIZE, usable * 0.58);
  const trailW = fonts.body.widthOfTextAtSize(trail, FOOT_SIZE);
  const pageW = fonts.body.widthOfTextAtSize(text.page, FOOT_SIZE);
  const foot: Omit<Run, 'text'> = { font: fonts.body, size: FOOT_SIZE, color: GRAY(ink), opacity: 0.9 };

  drawAt(page, frame, ink, {
    ...foot,
    text: ellipsize(text.title, fonts.body, FOOT_SIZE, Math.max(40, usable * 0.28)),
    u: FOOT_INSET, v: FOOT_BASELINE,
  });
  drawAt(page, frame, ink, { ...foot, text: trail, u: cu - trailW / 2, v: FOOT_BASELINE });
  drawAt(page, frame, ink, { ...foot, text: text.page, u: frame.w - FOOT_INSET - pageW, v: FOOT_BASELINE });
}

/**
 * Stamp a stored PDF with this download's provenance.
 *
 * Returns `null` — never throws — when the bytes cannot be re-written
 * (a malformed or password-protected file). Callers fall back to the
 * stored file rather than leaving the client with nothing.
 */
export async function stampPdf(
  source: ArrayBuffer,
  subject: StampSubject,
  actor: DownloadActor,
): Promise<Blob | null> {
  try {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
    const ink: Ink = { rgb, degrees };

    const doc = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false });
    const fonts = {
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      body: await doc.embedFont(StandardFonts.Helvetica),
    };

    const stamp = timestamp();
    const ref = reference(subject.date);
    const by = actor ? `Downloaded by ${actor.name}` : 'Downloaded from the Regis client portal';
    const provenance = safe(`${by} · ${stamp}`);
    const trail = safe(actor ? `${by} (${actor.email}) · ${stamp} · ${ref}` : `${by} · ${stamp} · ${ref}`);
    const title = safe(subject.title);

    const pages = doc.getPages();
    pages.forEach((page, i) => {
      stampPage(page, ink, fonts, { provenance, trail, title, page: `Page ${i + 1} of ${pages.length}` });
    });

    // The reference is the point of record, so keep it quotable in the file.
    doc.setKeywords([ref, actor?.email ?? 'portal', stamp]);

    // Object streams keep the stamped copy the same size as the stored one;
    // writing them out flat inflates a real report by a third.
    const bytes = await doc.save();
    // TS models Uint8Array over ArrayBufferLike; Blob only accepts a view
    // onto a plain ArrayBuffer, which this always is at runtime.
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  } catch {
    return null;
  }
}
