import { Fragment } from 'react';
import { filledRail, type NewsletterCadence, type NewsletterRailBlock, type NewsletterSection } from '../../data';
import { looksLikeHtml, plainToHtml } from '../../kit/textFormat';

/* ─────────────────────────────────────────────────────────────
   Exact replica of the legacy REGIS mailers — ported table-for-
   table from the production Daily/Weekly/Monthly .htm files the
   desk has been sending. This is the client's template, not the
   CMS design system: Arial, #005096 navy, #ebebeb panels, the
   same class names and CSS the legacy files carry. The markup is
   all tables, so the screen preview and the Outlook email export
   share one render. Change nothing here for CMS-styling reasons.
   ───────────────────────────────────────────────────────────── */

const NAVY = '#005096';
const GREY = '#a9a9a9';
const PANEL = '#ebebeb';
const RULE = '#d4d4d4';   // hairline that still reads on the grey panel

/* The legacy mailer artwork, mirrored from regis.ph into /public
   so the template survives the old site being retired. Root-
   relative paths are absolutized by the email exporter. */
const LOGO_SRC = '/newsletter/logo.png';                   // flat-on-white lockup (daily, weekly)
const LOGO_BLUE_BG_SRC = '/newsletter/logo-blue-bg.png';   // lockup on the navy band (monthly)
const HEADER_CURVE_SRC = '/newsletter/header-bg-bottom.png'; // the 25px curve under the monthly band

/* Legacy stylesheet, scoped under .nlt so the composer's live
   preview cannot leak rules into the CMS page. Selectors and
   values are lifted from the shipped .htm files; the .nl-rich
   block styles composer-authored content at the same 10pt/11pt
   the Word-built issues carried inline. */
const TEMPLATE_CSS = `
.nlt { font-family: Arial, Helvetica, sans-serif; font-size: 16px; }
.nlt img { max-width: 100%; }
.nlt .newsletter-title { display: inline-block; width: 100%; font-weight: bold; }
.nlt .newsletter-date { display: inline-block; width: 100%; font-size: 1em; font-weight: bold; }
.nlt .font-common { font-family: Arial; font-size: 0.9em; }
.nlt .font-common p { font-family: Arial; font-size: 0.9em; }
.nlt .font-common a { color: ${NAVY}; }

/* Daily (container pad 1.5%, navy date, "In the news" box) */
.nlt-daily .container-pad { padding: 1.5%; }
.nlt-daily .container-pad.left { padding: 0 0 0 1.5%; }
.nlt-daily .container-pad.right { padding: 0 1.5% 0 0; }
.nlt-daily .newsletter-title { margin-bottom: 1%; }
.nlt-daily .newsletter-date { color: ${NAVY}; }
.nlt-daily .header-content { background-color: #fff; padding: 3%; vertical-align: top; }
.nlt-daily .header-item-title { font-family: Arial; font-size: 0.8em; width: 30%; color: ${NAVY}; font-weight: bold; padding-bottom: 1%; vertical-align: top; padding-right: 3%; }
.nlt-daily .header-item-description { width: 70%; color: black; }
.nlt-daily .content-item-title { display: inline-block; width: 100%; color: ${NAVY}; font-weight: bold; padding: 0 0 0.5% 0; }
.nlt-daily .content-item-border { height: 1px; border-bottom: 1px solid ${GREY}; }

/* Weekly (container pad 3%, navy date) */
.nlt-weekly .container-pad { padding: 3%; }
.nlt-weekly .container-pad.left { padding: 0 0 0 3%; }
.nlt-weekly .container-pad.right { padding: 0 3% 0 0; }
.nlt-weekly .newsletter-title { margin-bottom: 1%; }
.nlt-weekly .newsletter-date { color: ${NAVY}; }

/* Monthly (navy letterhead band, white title/date) */
.nlt-monthly .container-pad { padding: 3%; }
.nlt-monthly .container-pad.left { padding: 0 0 0 3%; }
.nlt-monthly .container-pad.right { padding: 0 3% 0 0; }
.nlt-monthly .newsletter-title { margin-bottom: 3%; color: #fff; }
.nlt-monthly .newsletter-date { color: #fff; }
.nlt-monthly .header-title { font-size: 1.2em; font-weight: bold; }

/* Composer-authored rich content */
.nlt .nl-rich p { margin: 0 0 8px; font-family: Arial; }
.nlt .nl-rich > :last-child { margin-bottom: 0; }
.nlt .nl-rich ul, .nlt .nl-rich ol { margin: 0 0 8px; padding-left: 20px; }
.nlt .nl-rich ul { list-style: disc; }
.nlt .nl-rich ul ul { list-style: circle; margin: 2px 0 2px; }
.nlt .nl-rich ol { list-style: decimal; }
.nlt .nl-rich li { margin: 0 0 4px; font-family: Arial; }
.nlt .nl-rich li p { margin: 0; }
.nlt .nl-rich a { color: ${NAVY}; text-decoration: underline; }
.nlt .nl-rich img { display: block; max-width: 100%; margin: 8px auto; }
.nlt .nl-rich hr { border: 0; border-top: 1px solid ${GREY}; margin: 12px 0; }
.nlt .nl-rich table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 8px 0; }
.nlt .nl-rich th, .nlt .nl-rich td { border: 1px solid ${GREY}; padding: 4px 8px; vertical-align: top; text-align: left; }
.nlt .nl-rich th { background: ${NAVY}; color: #fff; font-weight: bold; }
.nlt-daily .nl-rich p, .nlt-daily .nl-rich li { font-size: 11pt; }
.nlt-weekly .nl-rich p, .nlt-weekly .nl-rich li { font-size: 10pt; }
.nlt-monthly .nl-rich p, .nlt-monthly .nl-rich li { font-size: 10pt; }

/* The literal +++ story separator, spaced like the legacy blank lines */
.nlt .nl-sep { margin: 14px 0; font-family: Arial; }
.nlt-daily .nl-sep { font-size: 11pt; }
.nlt-weekly .nl-sep, .nlt-monthly .nl-sep { font-size: 10pt; }
`;

/** The letterhead prints the date day-first, zero-padded: "02 September 2026". */
function bannerDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${d.toLocaleDateString('en-PH', { month: 'long' })} ${d.getFullYear()}`;
}

/** Composer output is HTML; issues filed before the rich editor keep
    the plain-text convention and are upgraded on the way in. */
function Rich({ text }: { text: string }) {
  return <div className="nl-rich" dangerouslySetInnerHTML={{ __html: plainToHtml(text) }} />;
}

/** A paragraph holding only +++ — the mailer's story separator. */
const HTML_SEPARATOR = /<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*\+{3}(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/i;

function splitIntro(intro: string): string[] {
  const parts = looksLikeHtml(intro)
    ? intro.split(new RegExp(HTML_SEPARATOR.source, 'gi'))
    : intro.split(/\n\s*\+\+\+\s*\n/);
  return parts.map((b) => b.trim()).filter(Boolean);
}

/** Intro stories joined back with the literal +++ line, as printed. */
function IntroFlow({ intro }: { intro: string }) {
  const blocks = splitIntro(intro);
  return (
    <>
      {blocks.map((block, i) => (
        <Fragment key={i}>
          {i > 0 && <p className="nl-sep">+++</p>}
          <Rich text={block} />
        </Fragment>
      ))}
    </>
  );
}

/* Consecutive sections that share a badge print under one banner;
   an unbadged section continues the group above it. */
type BadgeGroup = { badge: string; items: NewsletterSection[] };

function groupSections(sections: NewsletterSection[]): BadgeGroup[] {
  const groups: BadgeGroup[] = [];
  for (const s of sections) {
    const badge = s.badge.trim();
    const last = groups[groups.length - 1];
    if (last && (badge === '' || badge === last.badge)) last.items.push(s);
    else groups.push({ badge, items: [s] });
  }
  return groups;
}

/* ── Shared chrome ───────────────────────────────────────────── */

/** Outer centering table + the 800px sheet, as every legacy issue opens. */
function Sheet({ email, bg, children }: { email: boolean; bg: string; children: React.ReactNode }) {
  return (
    <table cellSpacing={0} cellPadding={0} width="100%" style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td align="center">
            <table
              cellSpacing={0}
              cellPadding={0}
              border={0}
              style={{ width: email ? 800 : '100%', maxWidth: 800, backgroundColor: bg, color: '#000' }}
            >
              <tbody>{children}</tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** The daily/weekly masthead: lockup left, REGIS REPORT + date right,
    closed by the 4px navy rule. */
function MastheadRows({ date }: { date: string }) {
  return (
    <>
      <tr>
        <td className="container-pad left" style={{ width: '50%', verticalAlign: 'top', height: 73 }}>
          <img src={LOGO_SRC} alt="Regis Partners" />
        </td>
        <td className="container-pad right" style={{ width: '50%', textAlign: 'right', verticalAlign: 'top', height: 73 }}>
          <div className="newsletter-title" style={{ fontSize: '1.5em', color: '#555' }}>REGIS REPORT</div>
          <br />
          <div className="newsletter-date">{bannerDate(date)}</div>
        </td>
      </tr>
      <tr>
        <td colSpan={2} style={{ height: 1, borderBottom: `4px solid ${NAVY}` }} />
      </tr>
    </>
  );
}

/** The navy section banner ("CORPORATE NEWS", "MACRO NEWS", …). */
function BannerRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} style={{ backgroundColor: '#fff' }}>
        <div style={{ display: 'inline-block', color: 'white', backgroundColor: NAVY, fontSize: '0.8em', padding: '1% 1% 1% 3%' }}>
          {label}&nbsp;
        </div>
      </td>
    </tr>
  );
}

/** The LEARN MORE footer, identical across all three mailers. */
function FooterRow({ padTop }: { padTop: number }) {
  return (
    <tr>
      <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff', paddingTop: padTop }}>
        <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', paddingRight: '2%', verticalAlign: 'top' }}>
                <div style={{ fontSize: '0.7em', fontWeight: 'bold', color: NAVY }}>LEARN MORE</div>
              </td>
              <td style={{ width: '80%', paddingRight: '2%', verticalAlign: 'top', color: GREY, fontSize: '0.6em' }}>
                You may view the published articles and their contributors on the Regis website, via{' '}
                <a href="http://www.regis.ph" target="_blank" rel="noreferrer" style={{ color: NAVY }}>www.regis.ph</a>.
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

/* ── Daily ───────────────────────────────────────────────────── */

function DailyTemplate({ email, date, intro, sections }: {
  email: boolean; date: string; intro: string; sections: NewsletterSection[];
}) {
  const indexed = sections.filter((s) => s.badge.trim() && s.title.trim());
  return (
    <Sheet email={email} bg="#fff">
      <MastheadRows date={date} />

      {/* Top of the issue — the grey commentary panel */}
      {intro.trim() !== '' && (
        <tr>
          <td colSpan={2} className="container-pad" style={{ backgroundColor: PANEL }}>
            <div className="font-common">
              <IntroFlow intro={intro} />
              <div style={{ display: 'inline-block', width: '100%', backgroundColor: GREY, height: 1, margin: '10px 0 0.5%' }} />
            </div>
          </td>
        </tr>
      )}

      {/* "In the news" index — the navy-framed box */}
      {indexed.length > 0 && (
        <tr>
          <td colSpan={2} className="container-pad">
            <table cellPadding={0} cellSpacing={0} style={{ width: '100%', border: `4px solid ${NAVY}`, backgroundColor: NAVY, marginTop: '3%' }}>
              <tbody>
                <tr>
                  <td className="header-content">
                    <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: 'black', marginBottom: '1%' }}>In the news</div>
                    <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                      <tbody>
                        <tr><td colSpan={2} style={{ height: 1, borderBottom: `2px solid ${NAVY}` }} /></tr>
                        <tr><td colSpan={2} style={{ height: 8 }}>&nbsp;</td></tr>
                        {indexed.map((s, i) => (
                          <tr key={i}>
                            <td className="header-item-title"><div className="font-common">{s.badge}&nbsp;&nbsp;</div></td>
                            <td className="header-item-description">
                              <div className="font-common" style={{ paddingBottom: '5%' }}>{s.title}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* Story sections: navy category line, 35/65 headline-body rows */}
      {sections.map((s, i) => {
        const newBadge = s.badge.trim() !== '' && s.badge !== sections[i - 1]?.badge;
        return (
          <Fragment key={i}>
            <tr>
              <td colSpan={2} className="container-pad">
                <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                  <tbody>
                    {newBadge && (
                      <tr>
                        <td colSpan={2} style={{ color: 'black', verticalAlign: 'top' }}>
                          <div className="content-item-title"><div className="font-common">{s.badge}</div></div>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="font-common" style={{ width: '35%', color: 'black', verticalAlign: 'top' }}>
                        <div className="font-common" style={{ display: 'block' }}>{s.title}</div>
                      </td>
                      <td className="font-common" style={{ width: '65%', color: 'black', verticalAlign: 'top' }}>
                        <div className="font-common" style={{ display: 'block' }}>
                          {s.body.trim() !== '' && <Rich text={s.body} />}
                          {s.aside.trim() !== '' && <Rich text={s.aside} />}
                        </div>
                      </td>
                    </tr>
                    {s.images.length > 0 && (
                      <tr>
                        <td colSpan={2} style={{ paddingTop: '2%', textAlign: 'center' }}>
                          {s.images.map((src) => (
                            <img key={src} src={src} alt="" width="100%" style={{ display: 'block', width: '100%', marginBottom: 8 }} />
                          ))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
            <tr><td className="content-item-border" colSpan={2} /></tr>
          </Fragment>
        );
      })}

      <FooterRow padTop={15} />
    </Sheet>
  );
}

/* ── Weekly ──────────────────────────────────────────────────── */

function WeeklyTemplate({ email, date, intro, sections, rail }: {
  email: boolean; date: string; intro: string; sections: NewsletterSection[];
  rail: NewsletterRailBlock[];
}) {
  const groups = groupSections(sections);
  const runs = railRuns(filledRail(rail));
  return (
    <Sheet email={email} bg="#fff">
      <MastheadRows date={date} />

      {/* Week recap — the grey commentary panel */}
      {intro.trim() !== '' && (
        <>
          <tr>
            <td colSpan={2} className="container-pad" style={{ backgroundColor: PANEL }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '100%', verticalAlign: 'top' }}>
                      <div className="font-common" style={{ color: 'black' }}>
                        <IntroFlow intro={intro} />
                      </div>
                    </td>
                  </tr>
                  <tr><td>&nbsp;</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr><td colSpan={2}>&nbsp;</td></tr>
        </>
      )}

      {/* The week's charts — the strip under the recap, and any wide
          block that follows it on its own full-width row */}
      {runs.map((run, ri) => (
        <Fragment key={ri}>
          <tr>
            <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff', paddingTop: 0, paddingBottom: 0 }}>
              {run.wide ? <RailWide block={run.block} /> : <RailStrip blocks={run.blocks} />}
            </td>
          </tr>
          <tr><td colSpan={2}>&nbsp;</td></tr>
        </Fragment>
      ))}

      {/* News groups: navy banner, then 40/60 headline-body rows */}
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {g.badge !== '' && (
            <>
              <BannerRow label={g.badge} />
              <tr>
                <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff', paddingTop: 0, paddingBottom: 0 }}>
                  <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                    <tbody>
                      <tr><td style={{ borderBottom: `2px solid ${NAVY}`, fontSize: '0.1em', paddingTop: '1%' }}>&nbsp;</td></tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </>
          )}
          <tr>
            <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff', paddingTop: 0, paddingBottom: 0 }}>
              <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%' }}>
                <tbody>
                  {g.items.map((s, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          borderLeft: '1px solid white',
                          borderRight: '1px solid white',
                          borderBottom: i === g.items.length - 1 ? '0px solid ' + GREY : `1px solid ${GREY}`,
                          paddingTop: '2%',
                          paddingBottom: '2%',
                        }}
                      >
                        <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '40%', verticalAlign: 'top', paddingLeft: '2%', paddingRight: '2%' }}>
                                <div className="font-common" style={{ color: '#000' }}>{s.title}</div>
                              </td>
                              <td style={{ width: '60%', verticalAlign: 'top', paddingLeft: '2%', paddingRight: '2%' }}>
                                <div className="font-common" style={{ color: '#000' }}>
                                  {s.body.trim() !== '' && <Rich text={s.body} />}
                                  {s.aside.trim() !== '' && <Rich text={s.aside} />}
                                </div>
                              </td>
                            </tr>
                            {s.images.length > 0 && (
                              <tr>
                                <td colSpan={2} style={{ paddingTop: '2%', textAlign: 'center' }}>
                                  {s.images.map((src) => (
                                    <img key={src} src={src} alt="" width="100%" style={{ display: 'block', width: '100%', marginBottom: 8 }} />
                                  ))}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr><td colSpan={2}>&nbsp;</td></tr>
        </Fragment>
      ))}

      <tr><td colSpan={2} style={{ borderBottom: `1px solid ${GREY}` }}>&nbsp;</td></tr>
      <FooterRow padTop={15} />
    </Sheet>
  );
}

/* ── Monthly ─────────────────────────────────────────────────── */

/** The monthly right-hand rail: stacked heading-and-graphic cards
    printed beside the month commentary. Tables and inline styles only —
    the rail has to survive Outlook's Word engine like the rest of the
    mailer. */
function RailColumn({ blocks }: { blocks: NewsletterRailBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <table
          key={i}
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ width: '100%', backgroundColor: PANEL, marginBottom: i === blocks.length - 1 ? 0 : 14 }}
        >
          <tbody>
            {b.title.trim() !== '' && (
              <tr>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${RULE}`, color: '#8b8b8b', fontFamily: 'Arial', fontSize: '0.75em' }}>
                  {b.title}
                </td>
              </tr>
            )}
            {b.image.trim() !== '' && (
              <tr>
                <td style={{ padding: '10px' }}>
                  <img src={b.image} alt={b.title} width="100%" style={{ display: 'block', width: '100%' }} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ))}
    </>
  );
}

/** A wide block: the full-width graphic that rides under the strip —
    the market table the weekly closes its charts with. */
function RailWide({ block }: { block: NewsletterRailBlock }) {
  return (
    <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', backgroundColor: '#fff' }}>
      <tbody>
        {block.title.trim() !== '' && (
          <tr>
            <td style={{ padding: '6px 2px', borderBottom: `1px solid ${RULE}`, color: '#8b8b8b', fontFamily: 'Arial', fontSize: '0.75em', textAlign: 'center' }}>
              {block.title}
            </td>
          </tr>
        )}
        {block.image.trim() !== '' && (
          <tr>
            <td style={{ padding: '10px 0 0' }}>
              <img src={block.image} alt={block.title} width="100%" style={{ display: 'block', width: '100%' }} />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Blocks split into printable runs, in the order the analyst filed
    them: consecutive strip blocks share a row, a wide one breaks out. */
type RailRun = { wide: true; block: NewsletterRailBlock } | { wide: false; blocks: NewsletterRailBlock[] };

function railRuns(blocks: NewsletterRailBlock[]): RailRun[] {
  const runs: RailRun[] = [];
  for (const b of blocks) {
    if (b.wide) { runs.push({ wide: true, block: b }); continue; }
    const last = runs[runs.length - 1];
    if (last && !last.wide) last.blocks.push(b);
    else runs.push({ wide: false, blocks: [b] });
  }
  return runs;
}

/** The weekly's take on the same blocks: a strip printed across the
    sheet under the week recap rather than a column beside it. Three to
    a row, the way the desk lays out the index chart, the flow chart and
    the Key data table. */
const STRIP_PER_ROW = 3;

function RailStrip({ blocks }: { blocks: NewsletterRailBlock[] }) {
  const perRow = Math.min(blocks.length, STRIP_PER_ROW);
  const rows: NewsletterRailBlock[][] = [];
  for (let i = 0; i < blocks.length; i += perRow) rows.push(blocks.slice(i, i + perRow));
  const width = `${(100 / perRow).toFixed(4)}%`;

  return (
    <>
      {rows.map((row, ri) => (
        <table
          key={ri}
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ width: '100%', backgroundColor: '#fff', marginBottom: ri === rows.length - 1 ? 0 : 18 }}
        >
          <tbody>
            <tr>
              {/* A short last row keeps the others' column width by
                  padding out with empty cells. */}
              {Array.from({ length: perRow }, (_, ci) => {
                const b = row[ci];
                return (
                  <td key={ci} style={{ width, verticalAlign: 'top', padding: '0 1.5%' }}>
                    {b && (
                      <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%' }}>
                        <tbody>
                          {b.title.trim() !== '' && (
                            <tr>
                              <td style={{ padding: '6px 2px', borderBottom: `1px solid ${RULE}`, color: '#8b8b8b', fontFamily: 'Arial', fontSize: '0.75em', textAlign: 'center' }}>
                                {b.title}
                              </td>
                            </tr>
                          )}
                          {b.image.trim() !== '' && (
                            <tr>
                              <td style={{ padding: '10px 0 0' }}>
                                <img src={b.image} alt={b.title} width="100%" style={{ display: 'block', width: '100%' }} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      ))}
    </>
  );
}

function MonthlyTemplate({ email, date, intro, sections, rail }: {
  email: boolean; date: string; intro: string; sections: NewsletterSection[];
  rail: NewsletterRailBlock[];
}) {
  const groups = groupSections(sections);
  const filed = filledRail(rail);
  const blocks = filed.filter((b) => !b.wide);
  const wides = filed.filter((b) => b.wide);
  return (
    <Sheet email={email} bg={PANEL}>
      {/* The REGIS Report letterhead: 75px navy band + the 25px curve */}
      <tr>
        <td style={{ height: 100, backgroundColor: PANEL }}>
          <table cellSpacing={0} cellPadding={0} border={0} style={{ height: 100, width: '100%', border: 'none', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '100%', height: 75, backgroundColor: NAVY }}>
                  <table cellSpacing={0} cellPadding={0} border={0} style={{ height: 75, width: '100%', border: 'none', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td className="container-pad left" style={{ width: '50%' }}>
                          <img src={LOGO_BLUE_BG_SRC} alt="Regis Partners" />
                        </td>
                        <td className="container-pad right" style={{ width: '50%', textAlign: 'right' }}>
                          <div className="newsletter-title" style={{ fontSize: '1.5em', color: '#fff' }}>REGIS REPORT</div>
                          <br />
                          <div className="newsletter-date">{bannerDate(date)}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td style={{ width: '100%', height: 25, lineHeight: '1px', verticalAlign: 'top' }}>
                  <img src={HEADER_CURVE_SRC} alt="" width="100%" height={25} style={{ width: '100%', height: 25 }} />
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* The month's commentary — the grey panel under the letterhead */}
      {(intro.trim() !== '' || blocks.length > 0) && (
        <tr>
          <td colSpan={2} className="container-pad" style={{ backgroundColor: PANEL }}>
            <div className="header-title" />
            <div style={{ display: 'inline-block', width: '100%', height: 1 }}>&nbsp;</div>
            <table cellSpacing={0} cellPadding={0} border={0} style={{ width: '100%', marginTop: '3%' }}>
              <tbody>
                <tr>
                  <td style={{ width: blocks.length > 0 ? '62%' : '100%', verticalAlign: 'top', backgroundColor: PANEL }}>
                    <div className="font-common" style={{ color: 'black' }}>
                      <IntroFlow intro={intro} />
                    </div>
                  </td>
                  {blocks.length > 0 && (
                    <td style={{ width: '38%', paddingLeft: '4%', verticalAlign: 'top', backgroundColor: PANEL }}>
                      <RailColumn blocks={blocks} />
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* Wide blocks print across the sheet, under the commentary */}
      {wides.map((b, i) => (
        <tr key={i}>
          <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff' }}>
            <RailWide block={b} />
          </td>
        </tr>
      ))}

      {/* Sections: white blocks; a badge prints as the navy banner; an
          aside makes the 50/50 two-column macro-news row. Unbadged blocks
          close on the 2px navy rule, banner groups on the 1px grey. */}
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {g.badge !== '' && <BannerRow label={g.badge} />}
          {g.items.map((s, i) => (
            <tr key={i}>
              <td colSpan={2} className="container-pad" style={{ backgroundColor: '#fff' }}>
                <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                  <tbody>
                    {s.images.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={2} style={{ width: '100%', verticalAlign: 'top', textAlign: 'center' }}>
                            {s.images.map((src) => (
                              <img key={src} src={src} alt="" width="100%" style={{ display: 'block', width: '100%', backgroundColor: 'white', marginBottom: 8 }} />
                            ))}
                          </td>
                        </tr>
                        <tr><td colSpan={2} style={{ width: '100%', height: 25, fontSize: '1em' }}>&nbsp;</td></tr>
                      </>
                    )}
                    <tr>
                      {s.aside.trim() !== '' ? (
                        <>
                          <td style={{ width: '50%', paddingRight: '2%', verticalAlign: 'top' }}>
                            <div className="font-common" style={{ color: 'black' }}>
                              {s.title.trim() !== '' && (
                                <p style={{ margin: 0, fontFamily: 'Arial', fontSize: '10.0pt', fontWeight: 'bold' }}>{s.title}</p>
                              )}
                              {s.body.trim() !== '' && <Rich text={s.body} />}
                            </div>
                          </td>
                          <td style={{ width: '50%', paddingRight: '1.5%', verticalAlign: 'top' }}>
                            <div className="font-common" style={{ color: 'black' }}>
                              <Rich text={s.aside} />
                            </div>
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} style={{ width: '100%', paddingRight: 0, verticalAlign: 'top' }}>
                          <div className="font-common" style={{ color: 'black' }}>
                            {s.title.trim() !== '' && (
                              <p style={{ margin: '0 0 2px', fontFamily: 'Arial', fontSize: '10.0pt', fontWeight: 'bold' }}>{s.title}</p>
                            )}
                            {s.body.trim() !== '' && <Rich text={s.body} />}
                          </div>
                        </td>
                      )}
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ borderBottom: g.badge === '' ? `2px solid ${NAVY}` : `1px solid ${GREY}` }}>&nbsp;</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
        </Fragment>
      ))}

      <FooterRow padTop={0} />
    </Sheet>
  );
}

/* ── Entry ───────────────────────────────────────────────────── */

export default function TemplatePreview({
  cadence, date, subject: _subject, intro, sections, rail = [], mode = 'screen',
}: {
  cadence: NewsletterCadence;
  date: string;
  /** Kept as the mail's subject line only — the legacy templates print
      the fixed REGIS REPORT letterhead, never the subject, in the body. */
  subject: string;
  intro: string;
  sections: NewsletterSection[];
  /** Heading-and-graphic blocks: the monthly prints them as the
      right-hand rail beside the commentary, the weekly as a strip
      underneath it. The daily has neither and ignores them. */
  rail?: NewsletterRailBlock[];
  /** 'email' pins the sheet at the legacy 800px so Outlook desktop
      (the Word rendering engine, which ignores max-width) prints the
      exact template width; 'screen' lets it fill the preview column. */
  mode?: 'screen' | 'email';
}) {
  const email = mode === 'email';
  const body = { email, date, intro, sections };
  return (
    <div
      className={`nlt nlt-${cadence}`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', color: '#000', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
    >
      {/* dangerouslySetInnerHTML keeps the CSS raw: renderToStaticMarkup
          would otherwise escape the ">" combinator inside a text child. */}
      <style dangerouslySetInnerHTML={{ __html: TEMPLATE_CSS }} />
      {cadence === 'daily' && <DailyTemplate {...body} />}
      {cadence === 'weekly' && <WeeklyTemplate {...body} rail={rail} />}
      {cadence === 'monthly' && <MonthlyTemplate {...body} rail={rail} />}
    </div>
  );
}
