import { Fragment } from 'react';
import type { NewsletterCadence, NewsletterSection } from '../../data';
import { looksLikeHtml } from '../../kit/RichTextField';

/* ─────────────────────────────────────────────────────────────
   Faithful render of the legacy REGIS mailer. This is the client's
   template, not the CMS design system: Arial, classic navy, literal
   +++ separators, the "In the news" index box on the daily issue.
   Change nothing here for CMS-styling reasons.
   ───────────────────────────────────────────────────────────── */

const NAVY = '#1f4e79';
/* The monthly REGIS Report letterhead: one solid blue band, the white
   lockup at the left, the report title and issue date at the right. */
const REPORT_BLUE = '#00539B';
const RULE = '#d9dde4';
const BODY = '#2b2b2b';

/* The house lockup, same file the site header and portal use. It is the
   flat-on-white artwork, which is what the masthead and the PDF need. */
const LOGO_SRC = '/DocumentHeader.png';

/* The same lockup knocked out to white, for the monthly letterhead's
   blue band. Flat artwork cannot be recolored by a CSS filter — its
   background is opaque — so the white cut is kept as its own file. */
const LOGO_WHITE_SRC = '/DocumentHeaderWhite.png';

type Line =
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string; depth: 0 | 1 };

/** The mailer's plain-text convention: "- " bullets, two leading
    spaces for a sub-bullet, anything else a paragraph. */
function parseBody(text: string): Line[] {
  return text
    .split('\n')
    .map((raw) => raw.trimEnd())
    .filter((l) => l.trim() !== '')
    .map<Line>((l) => {
      const sub = /^\s{2,}-\s+/.test(l);
      const top = /^-\s+/.test(l.trim());
      if (sub || top) {
        return { kind: 'li', text: l.trim().replace(/^-\s+/, ''), depth: sub ? 1 : 0 };
      }
      return { kind: 'p', text: l.trim() };
    });
}

function BodyText({ text, size = 12 }: { text: string; size?: number }) {
  // Composer output is HTML; issues filed before the rich editor keep
  // the plain-text convention and print through the legacy parser.
  if (looksLikeHtml(text)) {
    return (
      <div
        className="nl-rich"
        style={{ color: BODY, fontSize: size, lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }
  return (
    <div style={{ color: BODY }}>
      {parseBody(text).map((line, i) =>
        line.kind === 'p' ? (
          <p key={i} style={{ fontSize: size, lineHeight: 1.55, margin: '0 0 8px' }}>{line.text}</p>
        ) : (
          <p key={i} style={{ fontSize: size, lineHeight: 1.5, margin: '0 0 4px', paddingLeft: line.depth ? 26 : 12 }}>
            <span style={{ marginRight: 7 }}>{line.depth ? '◦' : '•'}</span>
            {line.text}
          </p>
        ),
      )}
    </div>
  );
}

/* How the mailer prints rich content. Scoped to the preview only.
   Tables take the template's navy header row, the same treatment the
   legacy Word-built issues used for their data tables. */
const RICH_CSS = `
.nl-rich p { margin: 0 0 8px; }
.nl-rich ul, .nl-rich ol { margin: 0 0 8px; padding-left: 20px; }
.nl-rich ul { list-style: disc; }
.nl-rich ul ul { list-style: circle; margin: 2px 0 2px; }
.nl-rich ol { list-style: decimal; }
.nl-rich li { margin: 0 0 4px; }
.nl-rich li p { margin: 0; }
.nl-rich a { color: ${NAVY}; text-decoration: underline; }
.nl-rich img { display: block; max-width: 100%; margin: 8px auto; }
.nl-rich hr { border: 0; border-top: 1px solid ${RULE}; margin: 12px 0; }
.nl-rich table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 8px 0; }
.nl-rich th, .nl-rich td { border: 1px solid ${RULE}; padding: 4px 8px; vertical-align: top; text-align: left; }
.nl-rich th { background: ${NAVY}; color: #fff; font-weight: 700; }
`;

/** A paragraph holding only +++ — the mailer's story separator. */
const HTML_SEPARATOR = /<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*\+{3}(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/i;

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: NAVY,
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '3px 8px',
      }}
    >
      {label}
    </span>
  );
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The letterhead prints the date day-first: "31 July 2026". */
function bannerDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${d.toLocaleDateString('en-PH', { month: 'long' })} ${d.getFullYear()}`;
}

export default function TemplatePreview({
  cadence, date, subject, intro, sections,
}: {
  cadence: NewsletterCadence;
  date: string;
  subject: string;
  intro: string;
  sections: NewsletterSection[];
}) {
  // The legacy mailer separates intro stories with a literal +++ line.
  const introBlocks = (looksLikeHtml(intro)
    ? intro.split(new RegExp(HTML_SEPARATOR.source, 'gi'))
    : intro.split(/\n\s*\+\+\+\s*\n/))
    .map((b) => b.trim())
    .filter(Boolean);

  const indexed = sections.filter((s) => s.badge.trim() && s.title.trim());

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', color: BODY, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      <style>{RICH_CSS}</style>
      {/* Masthead. The monthly issue prints the REGIS Report letterhead;
          the daily and weekly mailers keep the flat-on-white lockup. */}
      {cadence === 'monthly' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: REPORT_BLUE, padding: '20px 26px' }}>
            <img
              src={LOGO_WHITE_SRC}
              alt="Regis Partners"
              style={{ height: 44, width: 'auto', display: 'block', flexShrink: 0 }}
            />
            <div style={{ textAlign: 'right', color: '#fff' }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Regis Report</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6 }}>{bannerDate(date)}</div>
            </div>
          </div>
          {/* The letterhead carries the house title, so the issue's own
              subject line prints beneath it as the headline. */}
          <div style={{ padding: '16px 22px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, lineHeight: 1.35 }}>{subject || '—'}</div>
            <div style={{ height: 1, background: RULE, marginTop: 10 }} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '18px 22px 12px' }}>
            <img
              src={LOGO_SRC}
              alt="Regis Partners"
              style={{ height: 42, width: 'auto', display: 'block', flexShrink: 0 }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, textTransform: cadence === 'daily' ? 'uppercase' : 'none' }}>
                {subject || '—'}
              </div>
              <div style={{ fontSize: 10.5, color: NAVY, marginTop: 2 }}>{longDate(date)}</div>
            </div>
          </div>
          <div style={{ height: 2, background: NAVY, margin: '0 22px' }} />
        </>
      )}

      <div style={{ padding: '16px 22px 0' }}>
        {/* Intro stories, joined by the literal +++ separator */}
        {introBlocks.map((block, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <p style={{ textAlign: 'left', fontSize: 12, color: BODY, margin: '10px 0', fontWeight: 700 }}>+++</p>
            )}
            <BodyText text={block} />
          </Fragment>
        ))}

        {/* Daily issues carry the "In the news" index box */}
        {cadence === 'daily' && indexed.length > 0 && (
          <div style={{ border: `2px solid ${NAVY}`, margin: '18px 28px', padding: '14px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: BODY, marginBottom: 10 }}>In the news</div>
            {indexed.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '5px 0' }}>
                <span style={{ flex: '0 0 132px', fontSize: 9.5, fontWeight: 700, color: NAVY, textTransform: 'uppercase', paddingTop: 1.5 }}>
                  {s.badge}
                </span>
                <span style={{ fontSize: 11.5, color: BODY }}>{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Story sections */}
        {sections.map((s, i) => {
          const newBadge = s.badge.trim() && s.badge !== sections[i - 1]?.badge;
          return (
            <div key={i} style={{ borderTop: i > 0 || introBlocks.length > 0 ? `1px solid ${RULE}` : 'none', padding: '14px 0 6px' }}>
              {newBadge && <div style={{ marginBottom: 8 }}><Badge label={s.badge} /></div>}

              {cadence === 'monthly' ? (
                <>
                  {s.title.trim() && (
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: BODY, margin: '0 0 6px' }}>{s.title}</p>
                  )}
                  {s.body.trim() && <BodyText text={s.body} />}
                  {s.aside.trim() && <BodyText text={s.aside} size={11.5} />}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 18 }}>
                  <div style={{ flex: '0 0 34%' }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: BODY, margin: 0, lineHeight: 1.45 }}>{s.title}</p>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>{s.body.trim() && <BodyText text={s.body} size={11.5} />}</div>
                    {s.aside.trim() && <div style={{ flex: 1 }}><BodyText text={s.aside} size={11.5} /></div>}
                  </div>
                </div>
              )}

              {s.images.length > 0 && (
                <div style={{ margin: '10px auto 8px', maxWidth: 440 }}>
                  {s.images.map((src) => (
                    <img key={src} src={src} alt="" style={{ display: 'block', width: '100%', margin: '0 0 10px', border: `1px solid ${RULE}` }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: NAVY, color: '#fff', margin: '18px 0 0', padding: '10px 22px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em' }}>LEARN MORE</span>
        <span style={{ fontSize: 9, letterSpacing: '0.08em' }}>www.regis.ph</span>
      </div>
    </div>
  );
}
