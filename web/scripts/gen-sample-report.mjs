/* Generates a branded, multi-page sample research PDF that seed reports
   in the client portal point to, so the viewer/download flow is real
   before the API layer ships. Run: node scripts/gen-sample-report.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/reports/regis-sample-report.pdf');

const W = 612;
const H = 792;
const NAVY = '0.13 0.16 0.30';
const INK = '0.11 0.11 0.14';
const GREY = '0.42 0.42 0.46';
const AMBER = '0.82 0.55 0.15';

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Fluent content-stream builder in PDF user space (origin bottom-left). */
function stream() {
  const ops = [];
  return {
    text(x, y, size, rgb, font, str) {
      ops.push(`BT ${rgb} rg /${font} ${size} Tf ${x} ${y} Td (${esc(str)}) Tj ET`);
      return this;
    },
    line(x1, y1, x2, y2, rgb, width) {
      ops.push(`${width} w ${rgb} RG ${x1} ${y1} m ${x2} ${y2} l S`);
      return this;
    },
    rect(x, y, w, h, rgb) {
      ops.push(`${rgb} rg ${x} ${y} ${w} ${h} re f`);
      return this;
    },
    build() {
      return ops.join('\n');
    },
  };
}

function paragraph(s, x, yStart, size, rgb, font, lead, maxChars) {
  const words = s.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  lines.forEach((ln, i) => s2.text(x, yStart - i * lead, size, rgb, font, ln));
  return yStart - lines.length * lead;
}

let s2 = stream();

// ── Page 1 ─────────────────────────────────────────────────
const p1 = stream();
p1.rect(0, H - 6, W, 6, NAVY);
p1.text(72, H - 78, 9, GREY, 'F2', 'REGIS PARTNERS  ·  INSTITUTIONAL EQUITY RESEARCH');
p1.rect(72, H - 96, 26, 3, AMBER);
p1.text(72, H - 150, 24, INK, 'F1', 'Philippine Banks: The Deposit War');
p1.text(72, H - 178, 24, INK, 'F1', 'Nobody Declared');
p1.text(72, H - 214, 10.5, GREY, 'F2', 'Sector Initiation  ·  Cerre Klyne M. Resullar, CFA  ·  14 pages');
p1.line(72, H - 232, 540, H - 232, '0.85 0.85 0.87', 0.75);

p1.text(72, H - 272, 12, NAVY, 'F1', 'Summary');
s2 = p1;
let y = H - 296;
y = paragraph(
  'Time-deposit repricing is running ahead of loan yields for the first time since 2022. We think consensus is still marking funding costs to the prior easing cycle, and that the market is mispricing which balance sheets can defend margins into the fourth quarter.',
  72, y, 10.5, INK, 'F2', 15.5, 92,
);
y -= 10;
y = paragraph(
  'Our channel work across 1,300 branches suggests three of the five large-cap banks can absorb the repricing without conceding book value, while two are structurally exposed. We initiate coverage with a differentiated view on deposit franchise quality rather than headline loan growth.',
  72, y, 10.5, INK, 'F2', 15.5, 92,
);

y -= 26;
p1.text(72, y, 12, NAVY, 'F1', 'Key Points');
y -= 24;
const bullets = [
  'CASA mix, not loan yield, is the swing variable for 2H net interest margins.',
  'Two names carry more wholesale funding than the street models; sensitivity is non-linear.',
  'A 25bp move in time-deposit cost maps to roughly 4 to 6 percent of pre-provision profit.',
  'We prefer franchises with sticky payroll and government-linked deposit bases.',
];
for (const b of bullets) {
  p1.rect(74, y + 3, 3, 3, AMBER);
  s2 = p1;
  y = paragraph(b, 88, y, 10.5, INK, 'F2', 15, 84);
  y -= 10;
}

p1.line(72, 96, 540, 96, '0.85 0.85 0.87', 0.75);
p1.text(72, 78, 8, GREY, 'F2', 'This is illustrative sample content distributed for client-portal demonstration only.');
p1.text(72, 64, 8, GREY, 'F2', 'Regis Partners  ·  20/F Tower One, Ayala Triangle, Makati City  ·  research@regis.ph');
p1.text(508, 64, 8, GREY, 'F2', 'Page 1 of 2');

// ── Page 2 ─────────────────────────────────────────────────
const p2 = stream();
p2.rect(0, H - 6, W, 6, NAVY);
p2.text(72, H - 78, 9, GREY, 'F2', 'REGIS PARTNERS  ·  INSTITUTIONAL EQUITY RESEARCH');
p2.rect(72, H - 96, 26, 3, AMBER);
p2.text(72, H - 132, 15, INK, 'F1', 'Exhibit 1  -  Funding cost vs. asset yield');

// simple bar exhibit
const bx = 72, by = H - 360, bw = 396, bh = 150;
p2.line(bx, by, bx, by + bh, '0.8 0.8 0.82', 0.75);
p2.line(bx, by, bx + bw, by, '0.8 0.8 0.82', 0.75);
const bars = [
  ['MBT', 0.58], ['BPI', 0.64], ['BDO', 0.71], ['SECB', 0.86], ['PNB', 0.93],
];
const slot = bw / bars.length;
bars.forEach(([label, v], i) => {
  const x = bx + i * slot + 22;
  const barH = v * (bh - 20);
  p2.rect(x, by, 40, barH, i >= 3 ? '0.70 0.30 0.24' : NAVY);
  p2.text(x + 6, by - 16, 9, GREY, 'F2', label);
});
p2.text(bx, by - 40, 8.5, GREY, 'F2', 'Marginal funding cost as a share of front-book loan yield.  Red = structurally exposed.');

let y2 = by - 78;
p2.text(72, y2, 12, NAVY, 'F1', 'Methodology');
y2 -= 22;
s2 = p2;
y2 = paragraph(
  'Estimates combine reported time-deposit schedules with branch-level pricing collected between June and August. Sensitivities are computed on a static balance sheet and do not assume management repricing actions. Figures are illustrative and provided for demonstration of the client portal only.',
  72, y2, 10.5, INK, 'F2', 15.5, 92,
);

y2 -= 26;
p2.text(72, y2, 12, NAVY, 'F1', 'Disclaimer');
y2 -= 22;
s2 = p2;
paragraph(
  'This document is sample material generated for the Regis client portal. It does not constitute investment advice, a research recommendation, or an offer to transact. Redistribution outside a licensed mandate is prohibited. All names, figures, and exhibits are fictional.',
  72, y2, 9, GREY, 'F2', 13.5, 100,
);

p2.line(72, 96, 540, 96, '0.85 0.85 0.87', 0.75);
p2.text(72, 64, 8, GREY, 'F2', 'Regis Partners  ·  Institutional Research  ·  research@regis.ph');
p2.text(508, 64, 8, GREY, 'F2', 'Page 2 of 2');

// ── Assemble ───────────────────────────────────────────────
const c1 = p1.build();
const c2 = p2.build();

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 5 0 R >>`,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 6 0 R >>`,
  `<< /Length ${c1.length} >>\nstream\n${c1}\nendstream`,
  `<< /Length ${c2.length} >>\nstream\n${c2}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
];

let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) {
  pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdf, 'latin1');
console.log(`Wrote ${OUT} (${pdf.length} bytes)`);
