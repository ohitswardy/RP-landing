<?php

namespace App\Support;

use App\Models\Report;
use App\Models\StaffMember;

/**
 * Turns a blast into the HTML that actually goes out. Newsletter blasts
 * already carry a full document rendered from the house template, so they
 * pass through (with an unsubscribe footer spliced in per subscriber).
 * Report and ad-hoc blasts carry a fragment from the rich editor: it is
 * sanitized and set inside the mailer view — logo, ticker / sector / title
 * line, the desk's copy, the right "view report" link for the variant,
 * the analyst's signature block — with every field escaped on the way in.
 */
final class BlastRenderer
{
    /** The field set the renderer reads, for saved blasts and unsaved previews alike. */
    public static function fields(string $kind, string $subject, ?string $htmlBody, ?Report $report, ?string $externalLink): array
    {
        return [
            'kind' => $kind,
            'subject' => $subject,
            'html_body' => $htmlBody,
            'report' => $report,
            'external_link' => $externalLink,
        ];
    }

    public static function render(array $f, string $variant = 'local', ?string $unsubscribeUrl = null): string
    {
        $body = (string) ($f['html_body'] ?? '');

        if (self::isDocument($body)) {
            return $unsubscribeUrl ? self::withUnsubscribeFooter($body, $unsubscribeUrl) : $body;
        }

        /** @var Report|null $report */
        $report = $f['report'] ?? null;
        $link = null;
        if ($report) {
            $external = trim((string) ($f['external_link'] ?? ''));
            $link = $variant === 'foreign' ? ($external !== '' ? $external : null) : self::portalLink($report);
        }

        return view('email.blast', [
            'subject' => (string) ($f['subject'] ?? ''),
            'body' => Html::clean($body),
            'report' => $report,
            'variant' => $variant,
            'link' => $link,
            'linkLabel' => $variant === 'foreign' ? 'View the full report' : 'View the full report on the client portal',
            'analyst' => $report ? self::analyst($report->analyst) : null,
            'site' => self::frontend(),
            'logo' => self::frontend().'/newsletter/logo.png',
            'unsubscribeUrl' => $unsubscribeUrl,
        ])->render();
    }

    /** A full document (the newsletter mailer) rather than an editor fragment. */
    public static function isDocument(?string $html): bool
    {
        return (bool) preg_match('/^\s*<!doctype/i', (string) $html);
    }

    /** Login-gated deep link for Local clients; never a public tokenized URL. */
    public static function portalLink(Report $report): string
    {
        return self::frontend().'/portal?report='.$report->id;
    }

    private static function frontend(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }

    /** The byline's staff profile, for the signature block. */
    private static function analyst(?string $name): ?StaffMember
    {
        $needle = mb_strtolower(trim((string) $name));
        if ($needle === '') {
            return null;
        }

        return StaffMember::query()
            ->get()
            ->first(fn (StaffMember $s) => mb_strtolower(trim((string) $s->name)) === $needle);
    }

    private static function withUnsubscribeFooter(string $doc, string $url): string
    {
        $footer = view('email.unsubscribe-footer', ['url' => $url])->render();
        $at = stripos($doc, '</body>');

        return $at === false ? $doc.$footer : substr($doc, 0, $at).$footer.substr($doc, $at);
    }
}
