/* ─────────────────────────────────────────────────────────────
   Plain-text ↔ HTML helpers shared by the rich-text editor and
   the newsletter template renderer. Kept apart from the TipTap
   module so rendering an issue never drags the editor bundle in.
   ───────────────────────────────────────────────────────────── */

/** Escape a plain-text chunk for safe embedding in HTML. */
export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function looksLikeHtml(text: string): boolean {
  return /<[a-z][^>]*>/i.test(text);
}

/** Upgrade the legacy plain-text convention ("- " bullets, two
    leading spaces for a sub-bullet) into the editor's HTML. */
export function plainToHtml(text: string): string {
  if (!text.trim()) return '';
  if (looksLikeHtml(text)) return text;

  const out: string[] = [];
  let depth = 0; // 0 = outside lists, 1 = in <ul>, 2 = in nested <ul>

  const closeTo = (level: number) => {
    while (depth > level) { out.push('</ul>'); depth -= 1; }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const sub = /^\s{2,}-\s+/.test(line);
    const top = /^-\s+/.test(line.trim());
    if (sub || top) {
      const want = sub ? 2 : 1;
      while (depth < want) { out.push('<ul>'); depth += 1; }
      closeTo(want);
      out.push(`<li><p>${esc(line.trim().replace(/^-\s+/, ''))}</p></li>`);
    } else {
      closeTo(0);
      out.push(`<p>${esc(line.trim())}</p>`);
    }
  }
  closeTo(0);
  return out.join('');
}

/* ── Pasted markup ────────────────────────────────────────────── */

/** A table Word, Outlook, and Excel wrap around copied text purely to
    position it: one cell, or a single column of cells. Anything two or
    more columns wide is a real table and is left alone. */
function isLayoutTable(table: HTMLTableElement): boolean {
  const rows = Array.from(table.rows);
  if (rows.length === 0) return true;
  return rows.every((r) => r.cells.length <= 1);
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'UL', 'OL', 'LI', 'TABLE', 'HR', 'BLOCKQUOTE', 'PRE', 'FIGURE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
]);

/** Lift a table's content out and drop the table itself. A cell holding
    only inline content is given a paragraph of its own, so unwrapping a
    column of cells does not run every row into one paragraph. */
function unwrapTable(table: HTMLTableElement): void {
  const doc = table.ownerDocument;
  const frag = doc.createDocumentFragment();

  for (const row of Array.from(table.rows)) {
    for (const cell of Array.from(row.cells)) {
      const hasBlock = Array.from(cell.children).some((el) => BLOCK_TAGS.has(el.tagName));
      if (hasBlock) {
        while (cell.firstChild) frag.appendChild(cell.firstChild);
      } else if (cell.textContent?.trim() || cell.querySelector('img')) {
        const p = doc.createElement('p');
        while (cell.firstChild) p.appendChild(cell.firstChild);
        frag.appendChild(p);
      }
    }
  }

  table.replaceWith(frag);
}

/**
 * Strip the layout tables out of pasted HTML. Copying a paragraph from
 * Word or an Outlook message hands the browser a <table> wrapper, which
 * lands in the editor — and in the mailer — as a bordered box nobody
 * asked for. Real tables (two columns or more) paste through untouched.
 */
export function unwrapLayoutTables(html: string): string {
  if (!/<table/i.test(html) || typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Document order puts a nested table after its parent, so walking the
  // list backwards collapses wrappers from the inside out.
  for (let guard = 0; guard < 50; guard += 1) {
    const target = Array.from(doc.querySelectorAll('table')).reverse().find(isLayoutTable);
    if (!target) break;
    unwrapTable(target);
  }

  return doc.body.innerHTML;
}
