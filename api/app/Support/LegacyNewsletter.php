<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

/**
 * Reads one mailer exported from the old regis.ph CMS (the table-built
 * Daily / Weekly / Monthly .html files) into the issue document the
 * composer edits: the commentary, the story sections, and the chart rail.
 *
 * The three legacy layouts are fixed, so each is walked row by row rather
 * than guessed at:
 *
 *   Daily    grey commentary panel → "In the news" index (derived, skipped)
 *            → story tables: navy badge line, 35/65 headline-body row.
 *   Weekly   grey recap panel → three-up chart strip (+ a full-width
 *            movers table) → navy banners, each followed by research notes
 *            (title, byline, two columns) or 40/60 headline-body rows.
 *   Monthly  grey panel with the commentary beside a right-hand rail →
 *            white blocks: an optional navy banner, a centered graphic, a
 *            full-width body or a 50/50 two-column spread.
 *
 * Fragments come back as the sanitized HTML the API stores; image URLs are
 * left exactly as the old site served them so the importer can copy them.
 */
final class LegacyNewsletter
{
    /** @return array{intro:string, sections:array<int,array>, rail:array<int,array>, warnings:string[]} */
    public static function parse(string $html, string $cadence): array
    {
        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();
        $xp = new DOMXPath($doc);

        $sheet = $xp->query('//body/table/tr/td/table | //body/table/tbody/tr/td/table')->item(0);
        if (! $sheet instanceof DOMElement) {
            return ['intro' => '', 'sections' => [], 'rail' => [], 'warnings' => ['no sheet table found']];
        }

        $out = match ($cadence) {
            'daily' => self::daily($xp, $sheet),
            'weekly' => self::weekly($xp, $sheet),
            'monthly' => self::monthly($xp, $sheet),
        };

        // Sections with nothing in them are layout leftovers, not stories.
        $out['sections'] = array_values(array_filter(
            $out['sections'],
            static fn (array $s): bool => trim($s['title'].$s['body'].$s['aside']) !== '' || $s['images'] !== [],
        ));
        $out['rail'] = array_values(array_filter(
            $out['rail'],
            static fn (array $b): bool => trim($b['title'].$b['image']) !== '',
        ));

        if ($out['intro'] === '' && $out['sections'] === []) {
            $out['warnings'][] = 'empty issue';
        }

        return $out;
    }

    /* ── Daily ─────────────────────────────────────────────────── */

    private static function daily(DOMXPath $xp, DOMElement $sheet): array
    {
        $intro = '';
        $sections = [];
        $warnings = [];

        foreach (self::rows($xp, $sheet) as $tr) {
            $td = self::firstCell($xp, $tr);
            if (! $td || ! str_contains($td->getAttribute('class'), 'container-pad')) {
                continue;
            }

            if (str_contains($td->getAttribute('style'), '#ebebeb')) {
                $panel = $xp->query('./div[contains(@class,"font-common")]', $td)->item(0);
                if ($panel instanceof DOMElement) {
                    self::removeAll($xp, $panel, './div[contains(@style,"height:1px")] | ./span[not(normalize-space())]');
                    $intro = self::fragment(self::inner($panel));
                }
                continue;
            }

            $table = $xp->query('./table', $td)->item(0);
            if (! $table instanceof DOMElement) {
                continue;
            }
            if (self::has($xp, $table, './/td[contains(@class,"header-content")]') || str_contains($table->textContent, 'LEARN MORE')) {
                continue; // the derived "In the news" index, the footer
            }

            $badge = self::text($xp->query('.//div[contains(@class,"content-item-title")]', $table)->item(0));
            $title = self::text($xp->query('.//td[contains(@style,"width:35%")]', $table)->item(0));
            $bodyCell = $xp->query('.//td[contains(@style,"width:65%")]/div', $table)->item(0)
                ?? $xp->query('.//td[contains(@style,"width:65%")]', $table)->item(0);

            if ($bodyCell === null && $title === '' && $badge === '') {
                continue;
            }

            $sections[] = self::section(
                mb_strtoupper($badge),
                $title,
                $bodyCell ? self::fragment(self::inner($bodyCell)) : '',
                '',
                self::images($xp, $table, './tr/td[@colspan="2"]//img'),
            );
        }

        return ['intro' => $intro, 'sections' => $sections, 'rail' => [], 'warnings' => $warnings];
    }

    /* ── Weekly ────────────────────────────────────────────────── */

    private static function weekly(DOMXPath $xp, DOMElement $sheet): array
    {
        $intro = '';
        $sections = [];
        $rail = [];
        $warnings = [];
        $badge = '';

        foreach (self::rows($xp, $sheet) as $tr) {
            $td = self::firstCell($xp, $tr);
            if (! $td) {
                continue;
            }

            if (($label = self::banner($xp, $td)) !== '') {
                $badge = self::normalizeBadge($label);
                continue;
            }

            $style = $td->getAttribute('style');
            $isPad = str_contains($td->getAttribute('class'), 'container-pad');

            if ($isPad && str_contains($style, '#ebebeb')) {
                $panel = $xp->query('.//div[contains(@class,"font-common")]', $td)->item(0);
                $intro = $panel ? self::fragment(self::inner($panel)) : '';
                continue;
            }

            $table = $xp->query('./table', $td)->item(0);
            if (! $table instanceof DOMElement || str_contains($table->textContent, 'LEARN MORE')) {
                continue;
            }

            if (self::has($xp, $table, './/td[contains(@style,"33.33%")]')) {
                $rail = array_merge($rail, self::strip($xp, $table));
                continue;
            }

            if (self::has($xp, $table, './tr/td[@colspan="2"][contains(@style,"font-size:1em")]')) {
                $sections = array_merge($sections, self::researchNote($xp, $table, $badge));
                continue;
            }

            if (self::has($xp, $table, './/td[contains(@style,"width:40%")]')) {
                $sections = array_merge($sections, self::headlineRows($xp, $table, $badge));
                continue;
            }
        }

        return ['intro' => $intro, 'sections' => $sections, 'rail' => $rail, 'warnings' => $warnings];
    }

    /** The three-up chart strip and the full-width table under it. */
    private static function strip(DOMXPath $xp, DOMElement $table): array
    {
        $titles = [];
        $images = [];
        $wide = [];

        foreach (self::rows($xp, $table) as $tr) {
            $cells = [];
            foreach ($xp->query('./td', $tr) as $c) {
                if ($c instanceof DOMElement) {
                    $cells[] = $c;
                }
            }
            if ($cells === []) {
                continue;
            }
            $texts = array_map(fn (DOMElement $c) => self::text($c), $cells);
            $imgs = array_map(fn (DOMElement $c) => self::images($xp, $c, './/img'), $cells);

            if (count($cells) === 1 && (int) $cells[0]->getAttribute('colspan') >= 2) {
                foreach ($imgs[0] as $src) {
                    $wide[] = ['title' => '', 'image' => $src, 'wide' => true];
                }
                continue;
            }
            if (array_filter(array_map('count', $imgs))) {
                foreach ($imgs as $i => $srcs) {
                    if ($srcs !== [] && ! isset($images[$i])) {
                        $images[$i] = $srcs[0];
                    }
                }
                continue;
            }
            if (array_filter($texts) && $titles === []) {
                $titles = $texts;
            }
        }

        $blocks = [];
        for ($i = 0, $n = max(count($titles), count($images)); $i < $n; $i++) {
            $blocks[] = ['title' => $titles[$i] ?? '', 'image' => $images[$i] ?? '', 'wide' => false];
        }

        return array_merge($blocks, $wide);
    }

    /** A published research note: title, byline, and two text columns. */
    private static function researchNote(DOMXPath $xp, DOMElement $table, string $badge): array
    {
        $title = self::text($xp->query('./tr/td[@colspan="2"][contains(@style,"font-size:1em")]', $table)->item(0));
        $byline = self::text($xp->query('./tr/td[@colspan="2"][contains(@style,"font-size:.8em")]', $table)->item(0));
        $left = $xp->query('.//td[contains(@style,"width:50%") and contains(@style,"padding-right:2%")]/div', $table)->item(0);
        $right = $xp->query('.//td[contains(@style,"width:50%") and contains(@style,"padding-right:1.5%")]/div', $table)->item(0);

        $body = $left ? self::fragment(self::inner($left)) : '';
        $aside = $right ? self::fragment(self::inner($right)) : '';
        if ($title === '' && $body === '' && $aside === '') {
            return [];
        }
        if ($byline !== '') {
            $body = '<p><em>'.htmlspecialchars($byline, ENT_QUOTES, 'UTF-8').'</em></p>'.$body;
        }

        return [self::section($badge, $title, $body, $aside, [])];
    }

    /** Headline-body rows (40/60). A row's own heading overrides the banner. */
    private static function headlineRows(DOMXPath $xp, DOMElement $table, string $badge): array
    {
        $sections = [];
        foreach ($xp->query('./tr/td', $table) as $cell) {
            $heading = self::text($xp->query('./h4', $cell)->item(0));
            if ($heading !== '') {
                $badge = self::normalizeBadge($heading);
            }
            $inner = $xp->query('./table', $cell)->item(0);
            if (! $inner instanceof DOMElement) {
                continue;
            }
            $title = self::text($xp->query('.//td[contains(@style,"width:40%")]', $inner)->item(0));
            $bodyCell = $xp->query('.//td[contains(@style,"width:60%")]/div', $inner)->item(0)
                ?? $xp->query('.//td[contains(@style,"width:60%")]', $inner)->item(0);
            $body = $bodyCell ? self::fragment(self::inner($bodyCell)) : '';
            if ($title === '' && $body === '') {
                continue;
            }
            $sections[] = self::section($badge, $title, $body, '', self::images($xp, $inner, './tr/td[@colspan="2"]//img'));
        }

        return $sections;
    }

    /* ── Monthly ───────────────────────────────────────────────── */

    private static function monthly(DOMXPath $xp, DOMElement $sheet): array
    {
        $intro = '';
        $sections = [];
        $rail = [];
        $warnings = [];
        $badge = '';
        $panelSeen = false;

        foreach (self::rows($xp, $sheet) as $tr) {
            $td = self::firstCell($xp, $tr);
            if (! $td) {
                continue;
            }

            if (($label = self::banner($xp, $td)) !== '') {
                $badge = self::normalizeBadge($label);
                continue;
            }

            if (! str_contains($td->getAttribute('class'), 'container-pad')) {
                continue;
            }
            $style = $td->getAttribute('style');

            if (! $panelSeen && str_contains($style, '#ebebeb')) {
                $panelSeen = true;
                $commentary = $xp->query('.//td[contains(@style,"width:64%")]//div[contains(@class,"font-common")]', $td)->item(0)
                    ?? $xp->query('.//div[contains(@class,"font-common")]', $td)->item(0);
                $intro = $commentary ? self::fragment(self::inner($commentary)) : '';

                foreach ($xp->query('.//td[contains(@style,"width:30%")]/div', $td) as $block) {
                    $rail[] = [
                        'title' => self::text($xp->query('./div[contains(@class,"font-common")]', $block)->item(0)),
                        'image' => self::images($xp, $block, './/img')[0] ?? '',
                        'wide' => false,
                    ];
                }
                continue;
            }

            if (str_contains($td->textContent, 'LEARN MORE')) {
                continue;
            }
            $table = $xp->query('./table', $td)->item(0);
            if (! $table instanceof DOMElement) {
                continue;
            }

            $images = self::images($xp, $table, './tr/td[contains(@style,"text-align:center")]//img');
            $left = $xp->query('.//td[contains(@style,"width:50%") and contains(@style,"padding-right:2%")]/div', $table)->item(0);
            $right = $xp->query('.//td[contains(@style,"width:50%") and contains(@style,"padding-right:1.5%")]/div', $table)->item(0);

            if ($left || $right) {
                $title = self::text($xp->query('.//td[contains(@style,"width:50%")]/h4', $table)->item(0));
                $sections[] = self::section(
                    $badge,
                    $title,
                    $left ? self::fragment(self::inner($left)) : '',
                    $right ? self::fragment(self::inner($right)) : '',
                    $images,
                );
                continue;
            }

            $body = '';
            foreach ($xp->query('.//td[contains(@style,"width:100%")]/div[contains(@class,"font-common")]', $table) as $div) {
                $body .= self::fragment(self::inner($div));
            }
            $sections[] = self::section($badge, '', $body, '', $images);
        }

        return ['intro' => $intro, 'sections' => $sections, 'rail' => $rail, 'warnings' => $warnings];
    }

    /* ── Shared ────────────────────────────────────────────────── */

    private static function section(string $badge, string $title, string $body, string $aside, array $images): array
    {
        return [
            'badge' => $badge,
            'title' => $title,
            'body' => $body,
            'aside' => $aside,
            'images' => array_values(array_unique($images)),
        ];
    }

    /** The navy label div that opens a group ("CORPORATE NEWS", …). */
    private static function banner(DOMXPath $xp, DOMElement $td): string
    {
        $div = $xp->query('./div[contains(@style,"background-color:#005096")]', $td)->item(0);

        return $div ? self::text($div) : '';
    }

    /** The desk typed the banners by hand; fold the common slips together. */
    private static function normalizeBadge(string $label): string
    {
        $label = mb_strtoupper(trim(preg_replace('/\s+/u', ' ', $label) ?? ''));
        if (preg_match('/^PUB\w* ?RE[AS]\w*$/', $label) || $label === 'PUBLIC RESEARCH' || $label === 'RESEARCH PUBLISHED') {
            return 'PUBLISHED RESEARCH';
        }
        if (preg_match('/^RE[AS][ASERCH]*H$/', $label)) {
            return 'RESEARCH';
        }
        if (in_array($label, ['MACROS NEWS', 'MARCO NEWS'], true)) {
            return 'MACRO NEWS';
        }
        if (in_array($label, ['CORP NEWS', 'CORP. NEWS'], true)) {
            return 'CORPORATE NEWS';
        }

        return $label;
    }

    /** @return iterable<DOMElement> */
    private static function rows(DOMXPath $xp, DOMElement $table): iterable
    {
        foreach ($xp->query('./tr | ./tbody/tr', $table) as $tr) {
            if ($tr instanceof DOMElement) {
                yield $tr;
            }
        }
    }

    private static function firstCell(DOMXPath $xp, DOMElement $tr): ?DOMElement
    {
        $td = $xp->query('./td', $tr)->item(0);

        return $td instanceof DOMElement ? $td : null;
    }

    private static function has(DOMXPath $xp, DOMNode $ctx, string $query): bool
    {
        return $xp->query($query, $ctx)->length > 0;
    }

    private static function removeAll(DOMXPath $xp, DOMNode $ctx, string $query): void
    {
        foreach (iterator_to_array($xp->query($query, $ctx)) as $node) {
            $node->parentNode?->removeChild($node);
        }
    }

    /** @return string[] */
    private static function images(DOMXPath $xp, DOMNode $ctx, string $query): array
    {
        $out = [];
        foreach ($xp->query($query, $ctx) as $img) {
            $src = trim($img instanceof DOMElement ? $img->getAttribute('src') : '');
            if ($src !== '' && ! str_starts_with($src, 'data:')) {
                $out[] = $src;
            }
        }

        return $out;
    }

    private static function text(?DOMNode $node): string
    {
        if ($node === null) {
            return '';
        }
        $t = str_replace("\u{A0}", ' ', $node->textContent);

        return trim(preg_replace('/\s+/u', ' ', $t) ?? '');
    }

    private static function inner(DOMNode $node): string
    {
        $out = '';
        foreach ($node->childNodes as $child) {
            $out .= $node->ownerDocument->saveHTML($child);
        }

        return $out;
    }

    /**
     * A block of legacy markup, made into what the composer would have
     * saved: the letterhead logo and Word's wrappers dropped, headings
     * folded into bold paragraphs, mis-nested bullet lists repaired, the
     * spacer paragraphs removed, then the API's own sanitizer applied.
     */
    public static function fragment(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div>'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        $xp = new DOMXPath($doc);
        $root = $doc->getElementsByTagName('div')->item(0);
        if (! $root) {
            return '';
        }

        // Inline logos and other base64 artwork never belong in a body.
        self::removeAll($xp, $root, './/img[starts-with(@src,"data:")]');

        // <h4>Heading</h4> → <p><strong>Heading</strong></p>
        foreach (iterator_to_array($xp->query('.//h1|.//h2|.//h3|.//h4|.//h5|.//h6', $root)) as $h) {
            $p = $doc->createElement('p');
            $strong = $doc->createElement('strong');
            while ($h->firstChild) {
                $strong->appendChild($h->firstChild);
            }
            $p->appendChild($strong);
            $h->parentNode?->replaceChild($p, $h);
        }

        // <ul><li>a</li><ul>…</ul></ul> → the nested list rides inside the li.
        foreach (iterator_to_array($xp->query('.//ul/ul | .//ol/ul | .//ul/ol | .//ol/ol', $root)) as $nested) {
            $prev = $nested->previousSibling;
            while ($prev && ! ($prev instanceof DOMElement && $prev->nodeName === 'li')) {
                $prev = $prev->previousSibling;
            }
            if ($prev) {
                $prev->appendChild($nested);
            }
        }

        // Paragraphs holding only whitespace, &nbsp; or empty emphasis.
        foreach (iterator_to_array($xp->query('.//p', $root)) as $p) {
            if (self::text($p) === '' && ! self::has($xp, $p, './/img')) {
                $p->parentNode?->removeChild($p);
            }
        }

        return Html::clean(self::inner($root));
    }
}
