<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * How a CRMS interaction reads in the vocabularies of the third-party upload
 * files Regis hands over — the Jefferies bulk-upload workbook and the
 * Commcise templates of Schroders and JPMAM (analysed 2026-09-22 from the
 * clients' own files, which are bundled as-is in resources/report-templates
 * and filled in place; see App\Services\Crms\BundledTemplates).
 *
 * Values are derived, never invented: what the CRMS does not capture (mode,
 * location type, corporate roles beyond a title match) is left blank for
 * the desk to complete, and the templates' own validators flag it.
 */
class UploadLayouts
{
    /** Jefferies Lookup!A — Meeting Type. */
    public const JEFFERIES_TYPES = [
        'Incoming Call', 'Outgoing Call', 'One-Off Client Meeting', 'IB/Email Ideas', 'Model Request', 'Bespoke Client Request',
        'Testing The Waters', 'Corporate Access One Off', 'Social Meeting', 'Internal Note/Account Review', 'ECM Deal Call/Meeting',
    ];

    /** Jefferies Lookup!C — Meeting Method. */
    public const JEFFERIES_METHODS = ['In Person', 'Virtual', 'Email', 'N/A'];

    /** Commcise ClientInteractionType, as both templates list it. */
    public const COMMCISE_TYPES = [
        'Analyst Call - 2x1', 'Analyst Call - Group', 'Analyst Call (Initiated by provider)', 'Analyst Call (Initiated by Asset Mgr.)',
        'Analyst Meeting - 1x1', 'Analyst Meeting - 2x1', 'Analyst Meeting - Group', 'Bespoke Access - 1x1', 'Bespoke Access - 2x1',
        'Bespoke Access - Group', 'Conference - 1x1', 'Conference - 2x1', 'Conference - Group', 'Email', 'Expert Meeting - 1x1',
        'Expert Meeting - 2x1', 'Expert Meeting - Group', 'Field Trip - 1x1', 'Field Trip - 2x1', 'Field Trip - Group', 'Instant Message',
        'Macro Meeting - 1x1', 'Macro Meeting - 2x1', 'Macro Meeting - Group', 'Model (Bespoke)', 'Model (Generic)', 'Relationship Meeting',
        'Roadshow: Deal - 1x1', 'Roadshow: Deal - 2x1', 'Roadshow: Deal - Group', 'Roadshow: Non-Deal - 1x1', 'Roadshow: Non-Deal - 2x1',
        'Roadshow: Non-Deal - Group', 'Sales Call', 'Sales Meeting - 1x1', 'Sales Meeting - 2x1', 'Sales Meeting - Group',
        'Sales Spec. Meeting - 1x1', 'Sales Spec. Meeting - 2x1', 'Sales Spec. Meeting - Group', 'Written Report', 'Custom Work (Complex)',
        'Custom Work (General)', 'Voicemail', 'Sales Spec. Call', 'Macro Call', 'Conference - Attendance',
    ];

    public const COMMCISE_LOCATION_TYPES = ['ConsumerSite', 'IssuerSite', 'NotApplicable', 'OtherSite', 'ProviderSite'];

    public const COMMCISE_IDENTIFIER_TYPES = ['Cusip', 'ISIN', 'Other', 'RIC', 'Sedol', 'Ticker'];

    public const COMMCISE_CORPORATE_ROLES = [
        'BoardMember', 'BoardSecretary', 'BusinessDevelopment', 'CEO', 'CFO', 'Chairman', 'CIO-Information', 'CIO-Investment', 'CLevelOther',
        'CMO', 'COO', 'CorporateFinance', 'CorporateGovernance', 'CorporateSustainability', 'CRO', 'CSO', 'CTO', 'Director', 'Executive',
        'ExecVicePresident', 'Founder', 'GeneralCounsel', 'HeadOfBusiness', 'HeadOfDiversityAndInclusion', 'HeadOfGovernace', 'HeadOfIR',
        'HeadOfLegal', 'HeadOfRegulatoryAffairs', 'HeadOfSustainability', 'InvestorRelations', 'ManagingDirector', 'ManagingPartner',
        'Other', 'Partner', 'President', 'RegionalHead', 'SeniorVicePresident', 'Treasurer', 'ViceChairman', 'VicePresident',
    ];

    public const COMMCISE_EXPERT_ROLES = ['DataScientist', 'Economist', 'GovernmentExpert', 'IndustryExpert', 'MacroStrategist', 'MedicalExpert', 'Regulator', 'Other'];

    /** Region vocabularies: JPMAM's granular list (one value required) and Schroders' broad one. */
    public const REGIONS_JPM = [
        'APAC - Australia', 'APAC - Japan', 'APAC - Korea', 'APAC - Taiwan', 'APAC - Thailand', 'UK', 'North America', 'APAC - China',
        'APAC - Hong Kong', 'APAC - India', 'APAC - Indonesia', 'APAC - Malaysia', 'APAC - Philippines', 'APAC - Regional',
        'APAC - Singapore', 'APAC - Vietnam', 'LATAM', 'Europe', 'Middle East', 'Africa',
    ];

    public const REGIONS_SCHRODERS = ['UK', 'Pan Europe', 'Japan', 'US', 'Global', 'Asia'];

    /** Type or sub-type words that mean the interaction happened remotely. */
    private const VIRTUAL = '/video|call|virtual|zoom|teams|webex|phone/i';

    /** Interaction types delivered in writing rather than in a meeting. */
    private const WRITTEN = '/email|instantmessage|writtenreport|model|customwork|voicemail|^note$|ideapitch|dataset|distributionplatform/';

    /** ISO alpha-3 codes some forms store for Country, as Jefferies wants the name. */
    private const COUNTRIES = ['PHL' => 'Philippines', 'SGP' => 'Singapore', 'HKG' => 'Hong Kong', 'USA' => 'United States', 'GBR' => 'United Kingdom', 'JPN' => 'Japan', 'AUS' => 'Australia', 'MYS' => 'Malaysia', 'IDN' => 'Indonesia', 'THA' => 'Thailand', 'CHN' => 'China', 'IND' => 'India', 'KOR' => 'Korea', 'TWN' => 'Taiwan', 'VNM' => 'Vietnam'];

    /** Sector words → the GICS name Jefferies accepts when no ticker applies. First match wins. */
    private const GICS_HINTS = [
        '/macro|strateg|econom|politic/i' => 'Economics & Strategy',
        '/bank/i' => 'Banks',
        '/reit/i' => 'Diversified REITs',
        '/property|real estate|realestate/i' => 'Real Estate Management & Development',
        '/telco|telecom/i' => 'Diversified Telecommunication Services',
        '/insur/i' => 'Insurance',
        '/financ/i' => 'Financial Services',
        '/mining|metal/i' => 'Metals & Mining',
        '/oil|gas\b/i' => 'Oil, Gas & Consumable Fuels',
        '/power|utilit|electric|energy/i' => 'Electric Utilities',
        '/transport|logistic|port|airline/i' => 'Transportation Infrastructure',
        '/gaming|casino|leisure|hotel|restaurant/i' => 'Hotels, Restaurants & Leisure',
        '/conglomerate|holding/i' => 'Industrial Conglomerates',
        '/infra|construction|engineering/i' => 'Construction & Engineering',
        '/beverage/i' => 'Beverages',
        '/food/i' => 'Food Products',
        '/retail/i' => 'Broadline Retail',
        '/consumer/i' => 'Consumer Discretionary',
        '/media|entertain/i' => 'Media',
        '/software|tech|it serv/i' => 'Software',
        '/health|pharma|medic/i' => 'Pharmaceuticals',
        '/education|educ/i' => 'Diversified Consumer Services',
        '/chemical/i' => 'Chemicals',
        '/industrial/i' => 'Industrials',
    ];

    /**
     * Jefferies' Meeting Type and the Meeting Method its validator demands
     * for it, from the CRMS interaction type and sub-type.
     *
     * @return array{0: string, 1: string}
     */
    public function jefferiesKind(Interaction $i): array
    {
        $type = self::normalise((string) $i->type?->type);
        $sub = self::normalise((string) $i->meeting_type);
        $remote = $this->remote($i);
        $meeting = fn (string $label) => [$label, $remote ? 'Virtual' : 'In Person'];

        return match (true) {
            str_contains($sub, 'testingofwaters') || str_contains($sub, 'wallcross') => ['Testing The Waters', 'N/A'],
            str_contains($type, 'internalnote') || str_contains($type, 'accountreview') => ['Internal Note/Account Review', 'Email'],
            str_contains($type, 'ideadinner') || str_contains($type, 'social') => ['Social Meeting', 'In Person'],
            str_contains($type, 'bespoke') && ! str_contains($type, 'bespokeaccess'), str_contains($type, 'customwork') => ['Bespoke Client Request', 'Email'],
            str_contains($type, 'model') => ['Model Request', 'Email'],
            (bool) preg_match(self::WRITTEN, $type), (bool) preg_match('/^(email|blastemail|im|electroniccommunication|voicemail|blastvoicemail)$/', $sub) => ['IB/Email Ideas', 'Email'],
            (str_contains($type, 'deal') && ! str_contains($type, 'nondeal')) || str_contains($type, 'ecm') => $meeting('ECM Deal Call/Meeting'),
            (bool) preg_match('/roadshow|corporatebroking|fieldtrip|conference|bespokeaccess|expert|corporateaccess/', $type) => $meeting('Corporate Access One Off'),
            (bool) preg_match('/meeting/', $type) && ! $remote => ['One-Off Client Meeting', 'In Person'],
            default => [strcasecmp((string) $i->formValue('initiated_by'), 'Broker') === 0 ? 'Outgoing Call' : 'Incoming Call', 'N/A'],
        };
    }

    /** The Commcise interaction type: CRMS type joined with its sub-type in whichever spelling the list has. */
    public function commciseType(Interaction $i): string
    {
        $type = trim((string) $i->type?->type);
        $sub = trim((string) $i->meeting_type);
        // A bare "Analyst Call" is one of Commcise's two initiated-by variants; the form says which.
        if ($sub === '' && self::normalise($type) === 'analystcall' && ($by = (string) $i->formValue('initiated_by')) !== '') {
            $sub = strcasecmp($by, 'Broker') === 0 ? '(Initiated by provider)' : '(Initiated by Asset Mgr.)';
        }
        $wanted = array_flip(array_map([self::class, 'normalise'], self::COMMCISE_TYPES));
        foreach ($sub === '' ? [$type] : ["$type - $sub", "$type $sub", "$type ($sub)", $type] as $candidate) {
            if (isset($wanted[self::normalise($candidate)])) {
                return self::COMMCISE_TYPES[$wanted[self::normalise($candidate)]];
            }
        }

        return $sub !== '' ? "$type - $sub" : $type;
    }

    /** Remote when the type or its sub-type says call / video / virtual. */
    public function remote(Interaction $i): bool
    {
        return (bool) preg_match(self::VIRTUAL, (string) $i->type?->type.' '.(string) $i->meeting_type);
    }

    public function isJpm(Client $client): bool
    {
        return (bool) preg_match('/jp\s*morgan|jpmam|jpm\b/i', (string) $client->name);
    }

    /** The co-brand's own client row, which holds the Jefferies upload binding (see ReportTemplate::jefferies). */
    public function isJefferies(Client $client): bool
    {
        return (bool) preg_match('/jefferies/i', (string) $client->name);
    }

    /** The form's Asset Class in Commcise's words: legacy "LI" is fixed income, and JPM accepts only Equity or FI. */
    public function assetClass(Interaction $i, bool $jpm): string
    {
        $v = strtoupper(trim((string) $i->formValue('asset_class')));

        return match (true) {
            $v === '' || $v === 'EQUITY' => 'Equity',
            in_array($v, ['LI', 'FI', 'FIXED INCOME'], true) => 'FI',
            default => $jpm ? 'Equity' : $v,
        };
    }

    /** Local start time is PH (UTC+8); Commcise wants UTC, so an early meeting moves to the previous day. */
    public function utc(Interaction $i): array
    {
        if (! $i->interaction_date) {
            return [null, null];
        }
        if (! $i->time_start || ! preg_match('/^\d{1,2}:\d{2}/', $i->time_start)) {
            return [$i->interaction_date->format('Y-m-d'), null];
        }
        $local = CarbonImmutable::parse($i->interaction_date->format('Y-m-d').' '.$i->time_start, ReportGenerator::TIME_ZONE_IANA);
        $at = $local->utc();

        return [$at->format('Y-m-d'), $at->format('H:i:s')];
    }

    /* ── Shared derivations ──────────────────────────────────────── */

    /** Bloomberg-style tickers ("ALI PM") for every corporate on the form; a bare PSE ticker gets the PM suffix. */
    public function bloombergTickers(Interaction $i): array
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            $corp = $this->corporate($c);
            $code = trim((string) ($corp?->identifiers1 ?: ''));
            if ($code === '') {
                $ticker = trim((string) ($corp?->ticker ?: $c['ticker'] ?: ''));
                $code = $ticker !== '' && ! str_contains($ticker, ' ') ? strtoupper($ticker).' PM' : $ticker;
            }
            if ($code !== '') {
                $out[] = $code;
            }
        }

        return array_values(array_unique($out));
    }

    /** Company names for every corporate on the form, resolved through the directory when only a ticker was stored. */
    public function corporates(Interaction $i): array
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            $name = trim((string) ($c['name'] ?: $this->corporate($c)?->name ?: $c['ticker'] ?: ''));
            if ($name !== '') {
                $out[] = $name;
            }
        }

        return array_values(array_unique($out));
    }

    /** Sectors from the form (already the client's own taxonomy) or, failing that, the corporates' sector columns. */
    public function sectors(Interaction $i): array
    {
        $out = [];
        foreach ($i->form as $field) {
            if (($field['internalName'] ?? '') === 'sector') {
                foreach (Interaction::valueList($field['value'] ?? null) as $v) {
                    $out[] = trim(is_array($v) ? (string) ($v['name'] ?? '') : (string) $v);
                }
            }
        }
        if (array_filter($out) === []) {
            foreach ($i->corporatesDiscussed() as $c) {
                $corp = $this->corporate($c);
                $out[] = trim((string) ($corp?->sector_schroders ?: $corp?->sector_jpmorgan ?: $corp?->sector_generic ?: ''));
            }
        }

        return array_values(array_unique(array_filter($out)));
    }

    /** A GICS name for a row with no ticker, from whatever sector words the form or the corporates carry. */
    public function gics(Interaction $i): string
    {
        $text = implode(' ', [...$this->sectors($i), (string) $i->formValue('sector1'), (string) $i->formValue('tag')]);
        if (trim($text) === '') {
            $text = (string) $i->description;
        }
        foreach (self::GICS_HINTS as $pattern => $name) {
            if (preg_match($pattern, $text)) {
                return $name;
            }
        }

        return '';
    }

    public function address(Interaction $i): string
    {
        $parts = array_filter([$i->formValue('address') ?? $i->formValue('location'), $i->formValue('city'), $i->formValue('state')]);

        return implode(', ', array_map('trim', $parts));
    }

    public function country(Interaction $i): string
    {
        $v = trim((string) $i->formValue('country'));

        return self::COUNTRIES[strtoupper($v)] ?? $v;
    }

    /** Corporate attendees from every issuer-contact lookup on the form, with a Commcise role guessed from the title. */
    public function corporatePeople(Interaction $i): array
    {
        $out = [];
        foreach ($i->form as $field) {
            if (($field['options']['value'] ?? null) !== 'CorporateContact') {
                continue;
            }
            foreach (Interaction::valueList($field['value'] ?? null) as $v) {
                if (! is_array($v)) {
                    continue;
                }
                $name = trim((string) ($v['name'] ?? ''));
                if ($name !== '') {
                    $out[$name] = ['name' => $name, 'email' => trim((string) ($v['email'] ?? '')), 'role' => $this->corporateRole((string) ($v['position'] ?? ''))];
                }
            }
        }

        return array_values($out);
    }

    /** Title words → the Roles tab value; anything unrecognised is "Other", as Commcise allows. */
    public function corporateRole(string $position): string
    {
        $p = strtolower($position);

        return match (true) {
            $p === '' => '',
            (bool) preg_match('/\bceo\b|chief executive/', $p) => 'CEO',
            (bool) preg_match('/\bcfo\b|chief finance|chief financial/', $p) => 'CFO',
            (bool) preg_match('/\bcoo\b|chief operating/', $p) => 'COO',
            (bool) preg_match('/\bcio\b|chief investment/', $p) => 'CIO-Investment',
            (bool) preg_match('/\bcto\b|chief technology/', $p) => 'CTO',
            (bool) preg_match('/chairman|chairperson|chair\b/', $p) => 'Chairman',
            (bool) preg_match('/investor relations|\bir\b/', $p) => str_contains($p, 'head') ? 'HeadOfIR' : 'InvestorRelations',
            (bool) preg_match('/treasur/', $p) => 'Treasurer',
            (bool) preg_match('/general counsel/', $p) => 'GeneralCounsel',
            (bool) preg_match('/president/', $p) => str_contains($p, 'vice') ? 'VicePresident' : 'President',
            (bool) preg_match('/managing director/', $p) => 'ManagingDirector',
            (bool) preg_match('/director/', $p) => 'Director',
            (bool) preg_match('/founder/', $p) => 'Founder',
            (bool) preg_match('/partner/', $p) => 'Partner',
            (bool) preg_match('/corporate finance/', $p) => 'CorporateFinance',
            (bool) preg_match('/sustainab|esg/', $p) => 'CorporateSustainability',
            (bool) preg_match('/chief/', $p) => 'CLevelOther',
            default => 'Other',
        };
    }

    /** The Regis people on the row (Jefferies and other co-brand staff are stored in the same list). */
    public function regisPeople(array $people): array
    {
        $regis = array_values(array_filter($people, fn ($p) => str_ends_with(strtolower(trim((string) ($p['email'] ?? ''))), '@regis.ph')));
        $list = $regis !== [] ? $regis : $people;

        return array_values(array_filter(array_map(fn ($p) => ['name' => trim((string) ($p['name'] ?? '')), 'email' => trim((string) ($p['email'] ?? ''))], $list), fn ($p) => $p['name'] !== '' || $p['email'] !== ''));
    }

    public function regisEmails(array $people): array
    {
        return array_values(array_filter(array_column($this->regisPeople($people), 'email')));
    }

    public function names(array $people): array
    {
        return array_values(array_filter(array_map(fn ($p) => trim((string) ($p['name'] ?? trim(($p['firstname'] ?? '').' '.($p['lastname'] ?? '')))), $people)));
    }

    public function emails(array $people): array
    {
        return array_values(array_unique(array_filter(array_map(fn ($p) => trim((string) ($p['email'] ?? '')), $people))));
    }

    /** @var array<int, string>|null legacy user id → email */
    private ?array $userEmails = null;

    /** The interaction owner's email: who logged it, else the first Regis attendee. */
    public function ownerEmail(Interaction $i): string
    {
        if ($this->userEmails === null) {
            $this->userEmails = [];
            try {
                foreach (DB::connection('crms')->table('user')->get(['id', 'email']) as $u) {
                    $this->userEmails[(int) $u->id] = trim((string) $u->email);
                }
            } catch (\Throwable) {
                // No legacy user table on this install.
            }
        }
        $email = $this->userEmails[(int) ($i->user_id ?? 0)] ?? '';

        return $email !== '' ? $email : ($this->regisEmails($i->sellside_contact)[0] ?? '');
    }

    /** Rich-text descriptions as the single line a cell wants. */
    public function plain(?string $html): string
    {
        $text = html_entity_decode(strip_tags(preg_replace('/<\/(p|div|li|h\d|br)\s*>|<br\s*\/?>/i', "\n", (string) $html) ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace('/[ \t]*\n[ \t\n]*/', "\n", $text) ?? $text);
    }

    /** @var array<string, Corporate|null> */
    private array $corporates = [];

    private function corporate(array $c): ?Corporate
    {
        $key = ! empty($c['id']) ? 'id:'.$c['id'] : mb_strtolower((string) ($c['ticker'] ?: $c['name']));
        if (! array_key_exists($key, $this->corporates)) {
            $this->corporates[$key] = ! empty($c['id'])
                ? Corporate::find($c['id'])
                : ($key === '' ? null : Corporate::whereRaw('LOWER(ticker) = ?', [$key])->orWhereRaw('LOWER(name) = ?', [$key])->first());
        }

        return $this->corporates[$key];
    }

    private static function normalise(string $name): string
    {
        return strtolower(preg_replace('/[^a-z0-9]+/i', '', $name) ?? '');
    }
}
