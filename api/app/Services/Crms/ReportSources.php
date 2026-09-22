<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientAddress;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Everything the CRMS can put in a column of an imported report template.
 * The catalog is what the Form builder's import screen offers per column
 * (with the header aliases it auto-matches on, and per-flavour overrides
 * for the Commcise and Jefferies vocabularies); resolve() produces the
 * value for one interaction. Values are derived from captured data, never
 * invented — the same derivations the hand-written upload layouts use.
 *
 * Source keys: a catalog key, `form.{internalName}` for any form-builder
 * field, `meta.*` for run facts (generated at / by, range), `const` (the
 * column's own text), `blank`, and `formula` (keep the template's formula).
 */
class ReportSources
{
    public const SCOPES = ['client', 'foreign', 'all'];

    public const KINDS = ['text', 'date', 'time', 'number'];

    private ?Client $client = null;

    private bool $jpm = false;

    private string $generatedBy = '';

    private string $from = '';

    private string $to = '';

    public function __construct(private UploadLayouts $uploads = new UploadLayouts) {}

    /** Facts about the run every row may cite. */
    public function begin(?Client $client, string $generatedBy, string $from, string $to): void
    {
        $this->client = $client;
        $this->jpm = $client ? $this->uploads->isJpm($client) : false;
        $this->generatedBy = $generatedBy;
        $this->from = $from;
        $this->to = $to;
    }

    /**
     * The catalog: key, label, group, kind, multi (a list joined with the
     * column's separator), the normalised header aliases it auto-matches,
     * and flavour overrides that win when the workbook is a Commcise or
     * Jefferies template.
     *
     * @return list<array{key: string, label: string, group: string, kind: string, multi: bool, aliases: list<string>, flavors?: array<string, list<string>>}>
     */
    public static function catalog(): array
    {
        $s = fn (string $key, string $label, string $group, string $kind, bool $multi, array $aliases, array $flavors = []) => [
            'key' => $key, 'label' => $label, 'group' => $group, 'kind' => $kind, 'multi' => $multi, 'aliases' => $aliases,
        ] + ($flavors ? ['flavors' => $flavors] : []);

        return [
            // Interaction
            $s('interaction.reference', 'Interaction id (REGIS-{id})', 'Interaction', 'text', false, ['interactionid', 'uniqueid', 'reference', 'id', 'uniqueinteractionid']),
            $s('interaction.id', 'CRMS record number', 'Interaction', 'number', false, ['interactionnumber', 'crmsid', 'recordid']),
            $s('interaction.type', 'Interaction type', 'Interaction', 'text', false, ['interactiontype', 'type', 'eventtype', 'meetingcategory']),
            $s('interaction.type_full', 'Type – sub-type', 'Interaction', 'text', false, ['typec', 'typesubtype', 'interactiontypesubtype', 'fulltype']),
            $s('interaction.subtype', 'Sub-type (meeting type)', 'Interaction', 'text', false, ['subtype', 'meetingtype', 'format', 'meetingformat']),
            $s('interaction.date', 'Date', 'Interaction', 'date', false, ['date', 'interactiondate', 'meetingdate', 't1cbasemeetingdatec', 'dateofinteraction', 'eventdate']),
            $s('interaction.date_utc', 'Date (UTC)', 'Interaction', 'date', false, ['dateutc', 'interactiondateutc'], ['commcise' => ['interactiondate']]),
            $s('interaction.time_start', 'Start time', 'Interaction', 'time', false, ['starttime', 'time', 'timestart', 'start', 'meetingtime']),
            $s('interaction.time_start_utc', 'Start time (UTC)', 'Interaction', 'time', false, ['starttimeutc', 'utcstarttime'], ['commcise' => ['starttime']]),
            $s('interaction.time_end', 'End time', 'Interaction', 'time', false, ['endtime', 'timeend', 'end']),
            $s('interaction.minutes', 'Duration (minutes)', 'Interaction', 'number', false, ['duration', 'durationinmins', 'durationmin', 'durationmins', 'minutes', 'length', 'lengthmin', 't1cbasetimespentminc', 'durationminutes', 'timespent', 'contacttime']),
            $s('interaction.description', 'Description / notes', 'Interaction', 'text', false, ['description', 'notes', 'descriptionofinteraction', 'summary', 't1cbasenotesc', 'comments', 'subject', 'note', 'details', 't1cbasesubjectmeetingobjectivesc']),
            $s('interaction.disposition', 'Status (closed / flagged)', 'Interaction', 'text', false, ['status', 'disposition']),

            // Client
            $s('client.name', 'Client firm', 'Client', 'text', false, ['firm', 'client', 'clientfirm', 'clientname', 'assetmanager', 'account', 'institution']),
            $s('client.region', 'Client region', 'Client', 'text', false, ['region', 'regions', 'clientregion']),
            $s('client.type', 'Client type (Local / Foreign)', 'Client', 'text', false, ['clienttype']),

            // Client contacts
            $s('contacts.names', 'Client contacts – names', 'Client contacts', 'text', true, ['consumers', 'contacts', 'contact', 'investor', 'investors', 'attendees', 'clientcontacts', 'clientattendees', 'gmocontact', 'schroderscontact', 'jpmattendees', 'troweattendees', 'contactpersonswhoattendedfromtheclient', 'clientattendee', 'participants', 'buysidecontacts', 'consumer']),
            $s('contacts.emails', 'Client contacts – emails', 'Client contacts', 'text', true, ['consumeremails', 'contactemails', 'externalattendee', 'externalattendees', 'clientemails', 'email', 'emails', 'contactemail', 'consumeremail']),
            $s('contacts.positions', 'Client contacts – positions', 'Client contacts', 'text', true, ['consumerroles', 'contactpositions', 'positions', 'contactroles']),

            // Regis
            $s('regis.names', 'Regis attendees – names', 'Regis', 'text', true, ['broker', 'sellsidecontacts', 'sellside', 'analystsales', 'brokercontact', 'brokerattendees', 'regiscontact', 'internalattendees', 'internalattendeejefferies', 'analyst', 'analysts', 'sellsidecontact', 'regisattendees', 'brokerattendee', 'providercontacts'], ['jefferies' => []]),
            $s('regis.emails', 'Regis attendees – emails', 'Regis', 'text', true, ['sellsideemails', 'brokeremails', 'regisemails', 'sellsideemail']),
            $s('owner.email', 'Owner – email (who logged it)', 'Regis', 'text', false, ['interactionowner', 'owner', 'ownerc', 'owneremail', 'loggedbyemail']),
            $s('owner.name', 'Owner – name (who logged it)', 'Regis', 'text', false, ['ownername', 'loggedby', 'author', 'createdby', 'enteredby']),

            // Corporates
            $s('corporates.names', 'Companies – names', 'Companies', 'text', true, ['companynames', 'company', 'companies', 'issuers', 'issuer', 'corporates', 'companiesdiscussed', 'corporate', 'companyname', 'issuername', 'stocksdiscussed']),
            $s('corporates.tickers', 'Companies – PSE tickers', 'Companies', 'text', true, ['ticker', 'tickers', 'stocks', 'stock', 'symbols', 'symbol', 'topicstickers', 'companyticker', 'psetickers', 'companyticker', 'tickersymbol']),
            $s('corporates.bloomberg', 'Companies – Bloomberg tickers (ALI PM)', 'Companies', 'text', true, ['bloombergtickers', 'bloombergticker', 'identifiers1', 'bbgticker', 'bbgtickers'], ['jefferies' => ['tickers', 'ticker'], 'commcise' => ['companyidentifiers', 'companyidentifier']]),
            $s('corporates.ric', 'Companies – Reuters (RIC)', 'Companies', 'text', true, ['ric', 'rics', 'reuters', 'identifiers2', 'reuterscode']),
            $s('corporates.sectors', 'Sectors (form, else the companies\' sectors)', 'Companies', 'text', true, ['sectors', 'sector', 'industry', 'industries', 'industrysector']),
            $s('corporates.sector_generic', 'Company sector – generic', 'Companies', 'text', true, ['genericsector', 'sectorgeneric']),
            $s('corporates.sector_gmo', 'Company sector – GMO', 'Companies', 'text', true, ['gmosector', 'sectorgmo']),
            $s('corporates.sector_jpmorgan', 'Company sector – JPMorgan', 'Companies', 'text', true, ['jpmsector', 'jpmorgansector', 'sectorjpmorgan']),
            $s('corporates.sector_schroders', 'Company sector – Schroders', 'Companies', 'text', true, ['schroderssector', 'sectorschroders']),
            $s('corporates.sector_trowe', 'Company sector – T. Rowe', 'Companies', 'text', true, ['trowesector', 'sectortrowe', 'trowepricesector']),
            $s('corporate_contacts.names', 'Issuer contacts – names', 'Companies', 'text', true, ['corporatecontacts', 'issuercontacts', 'companymanagement', 'management', 'corporatecontact', 'corporateattendees', 'issuerattendees']),
            $s('corporate_contacts.emails', 'Issuer contacts – emails', 'Companies', 'text', true, ['corporateemails', 'issuercontactemails', 'corporateemail']),
            $s('corporate_contacts.roles', 'Issuer contacts – roles (Commcise vocabulary)', 'Companies', 'text', true, ['corporateroles', 'corporaterole', 'issuerroles']),
            $s('corporate_contacts.positions', 'Issuer contacts – titles', 'Companies', 'text', true, ['corporatepositions', 'corporatetitles', 'issuertitles']),

            // Derived for third-party vocabularies
            $s('derived.jefferies_type', 'Jefferies – Meeting Type', 'Derived', 'text', false, ['jefferiesmeetingtype'], ['jefferies' => ['meetingtype']]),
            $s('derived.jefferies_method', 'Jefferies – Meeting Method', 'Derived', 'text', false, ['meetingmethod', 'jefferiesmeetingmethod']),
            $s('derived.jefferies_minutes', 'Jefferies – Duration (15 to 480 minutes)', 'Derived', 'number', false, ['jefferiesduration'], ['jefferies' => ['durationinmins', 'duration']]),
            $s('derived.jefferies_internal', 'Jefferies – Internal attendees (owner + Regis emails)', 'Derived', 'text', true, ['jefferiesinternalattendee'], ['jefferies' => ['internalattendee', 'internalattendees', 'otherinternalattendeesemails']]),
            $s('derived.commcise_type', 'Commcise – ClientInteractionType', 'Derived', 'text', false, ['clientinteractiontype', 'commcisetype', 'commciseinteractiontype'], ['commcise' => ['interactiontype']]),
            $s('derived.mode', 'Mode (Virtual / InPerson)', 'Derived', 'text', false, ['mode', 'deliverymethod', 'method', 'delivery', 'medium', 'channel']),
            $s('derived.location', 'Location (form)', 'Derived', 'text', false, ['location', 'venue', 'place', 'meetinglocation']),
            $s('derived.city', 'City (form)', 'Derived', 'text', false, ['city', 't1cbasecityc', 'town']),
            $s('derived.client_location', 'Client office address(es)', 'Derived', 'text', false, ['t1cbaselocationc', 'clientlocation', 'office', 'clientoffice', 'clientaddress']),
            $s('derived.location_type', 'Location type (Commcise)', 'Derived', 'text', false, ['locationtype']),
            $s('derived.address', 'Address (in-person only)', 'Derived', 'text', false, ['address', 'addressdetails', 'streetaddress']),
            $s('derived.country', 'Country (in-person only)', 'Derived', 'text', false, ['country']),
            $s('derived.gics', 'GICS sector (when no ticker)', 'Derived', 'text', false, ['gicssectorsindustry', 'gics', 'gicssector', 'gicsindustry', 'gicssectorindustry']),
            $s('derived.asset_class', 'Asset class', 'Derived', 'text', false, ['assetclass', 'lineofbusinessc', 'lineofbusiness']),
            $s('derived.identifier_type', 'Company identifier type ("Ticker")', 'Derived', 'text', false, ['companyidentifiertype', 'identifiertype']),
            $s('derived.issuer_sponsored', 'Issuer sponsored (Y/N)', 'Derived', 'text', false, ['issuersponsored', 'sponsored']),
            $s('derived.region', 'Region (Commcise vocabulary)', 'Derived', 'text', false, ['commciseregion'], ['commcise' => ['regions', 'region']]),
            $s('derived.initiated_by', 'Initiated by (Broker / Investor)', 'Derived', 'text', false, ['initiatedby', 'initiated', 'initiator', 'whoinitiated']),
            $s('derived.client_initiated', 'Client initiated (Yes / No)', 'Derived', 'text', false, ['clientinitiated', 'solicitedc', 'solicited']),
            $s('derived.corporate_access', 'Corporate access (Yes / No)', 'Derived', 'text', false, ['corporateaccess', 'iscorporateaccess']),
            $s('derived.expert_contacts', 'Expert contacts (form)', 'Derived', 'text', false, ['expertcontacts', 'expertcontact', 'industryexpert', 'expert', 'experts', 'expertname']),
            $s('derived.expert_emails', 'Expert emails (left blank)', 'Derived', 'text', false, ['expertemails', 'expertemail']),
            $s('derived.expert_roles', 'Expert roles (left blank)', 'Derived', 'text', false, ['expertroles', 'expertrole']),
            $s('derived.parent_interaction', 'Parent interaction id (form)', 'Derived', 'text', false, ['parentinteractionid', 'parentinteraction', 'parentid', 'eventid']),
            $s('derived.contract_id', 'Contract id (form)', 'Derived', 'text', false, ['contractid', 'contract', 'invoiceid']),
            $s('derived.meeting_name', 'Meeting name (form)', 'Derived', 'text', false, ['meetingname', 'eventname', 'name']),

            // Run facts
            $s('meta.generated_at', 'Generated on (local)', 'Run', 'text', false, ['generatedon', 'generated', 'reportdate', 'rundate']),
            $s('meta.generated_at_utc', 'Generated on (UTC)', 'Run', 'text', false, ['templatedate', 'generatedutc', 'downloaddate']),
            $s('meta.generated_by', 'Generated by', 'Run', 'text', false, ['downloadedby', 'generatedby', 'preparedby', 'runby']),
            $s('meta.range', 'Date range', 'Run', 'text', false, ['range', 'period', 'daterange', 'reportingperiod']),
            $s('meta.client_name', 'Report client', 'Run', 'text', false, ['reportclient']),

            // Column controls
            $s('const', 'Fixed text', 'Other', 'text', false, []),
            $s('blank', 'Leave empty', 'Other', 'text', false, []),
            $s('formula', 'Keep the template\'s formula', 'Other', 'text', false, ['errors', 'error', 'validation', 'check']),
        ];
    }

    /** @var array<string, array>|null */
    private static ?array $byKey = null;

    private static function entry(string $source): ?array
    {
        self::$byKey ??= array_column(self::catalog(), null, 'key');

        return self::$byKey[$source] ?? null;
    }

    public static function isValid(string $source): bool
    {
        return self::entry($source) !== null || (bool) preg_match('/^form\.[a-z][a-z0-9_]{0,79}$/', $source);
    }

    public static function kind(string $source): string
    {
        return self::entry($source)['kind'] ?? 'text';
    }

    public static function multi(string $source): bool
    {
        return (bool) (self::entry($source)['multi'] ?? false);
    }

    /* ── Values ──────────────────────────────────────────────────── */

    /**
     * The value of one source for one interaction: a scalar (string, int,
     * float, null) or, for a multi source, a list of strings.
     *
     * @return string|int|float|list<string>|null
     */
    public function resolve(string $source, Interaction $i, ?string $text = null): string|int|float|array|null
    {
        if (str_starts_with($source, 'form.')) {
            return $i->formValue(substr($source, 5));
        }
        if (str_starts_with($source, 'meta.')) {
            return $this->meta($source);
        }
        $u = $this->uploads;

        return match ($source) {
            'const' => $text ?? '',
            'blank', 'formula' => null,

            'interaction.reference' => 'REGIS-'.$i->id,
            'interaction.id' => (int) $i->id,
            'interaction.type' => trim((string) $i->type?->type),
            'interaction.type_full' => $this->typeLabel($i),
            'interaction.subtype' => trim((string) $i->meeting_type),
            'interaction.date' => $i->interaction_date?->format('Y-m-d'),
            'interaction.date_utc' => $u->utc($i)[0],
            'interaction.time_start' => $i->time_start ?: null,
            'interaction.time_start_utc' => $u->utc($i)[1],
            'interaction.time_end' => $i->time_end ?: null,
            'interaction.minutes' => $i->minutes(),
            'interaction.description' => $u->plain($i->description),
            'interaction.disposition' => (string) ($i->disposition ?? ''),

            'client.name' => trim((string) $i->client?->name),
            'client.region' => trim((string) $i->client?->region),
            'client.type' => trim((string) $i->client?->client_type),

            'contacts.names' => $this->nameList($i->client_contact),
            'contacts.emails' => $u->emails($i->client_contact),
            'contacts.positions' => $this->field($i->client_contact, 'position'),

            'regis.names' => array_values(array_filter(array_column($u->regisPeople($i->sellside_contact), 'name'))),
            'regis.emails' => $u->regisEmails($i->sellside_contact),
            'owner.email' => $u->ownerEmail($i),
            'owner.name' => $this->users()[(int) ($i->user_id ?? 0)]['name'] ?? '',

            'corporates.names' => $u->corporates($i),
            'corporates.tickers' => $this->tickerList($i, 'ticker'),
            'corporates.bloomberg' => $u->bloombergTickers($i),
            'corporates.ric' => $this->tickerList($i, 'identifiers2'),
            'corporates.sectors' => $u->sectors($i),
            'corporates.sector_generic' => $this->sectorList($i, 'sector_generic'),
            'corporates.sector_gmo' => $this->sectorList($i, 'sector_gmo'),
            'corporates.sector_jpmorgan' => $this->sectorList($i, 'sector_jpmorgan'),
            'corporates.sector_schroders' => $this->sectorList($i, 'sector_schroders'),
            'corporates.sector_trowe' => $this->sectorList($i, 'sector_trowe'),
            'corporate_contacts.names' => array_values(array_filter(array_column($u->corporatePeople($i), 'name'))),
            'corporate_contacts.emails' => array_values(array_filter(array_column($u->corporatePeople($i), 'email'))),
            'corporate_contacts.roles' => array_values(array_filter(array_column($u->corporatePeople($i), 'role'))),
            'corporate_contacts.positions' => $this->corporatePositions($i),

            'derived.jefferies_type' => $u->jefferiesKind($i)[0],
            'derived.jefferies_method' => $u->jefferiesKind($i)[1],
            // Jefferies' validator accepts 15–480 minutes; a shorter call is reported at the floor, as the desk always did.
            'derived.jefferies_minutes' => max(15, min(480, $i->minutes())),
            'derived.jefferies_internal' => array_values(array_unique(array_filter([$u->ownerEmail($i), ...$u->regisEmails($i->sellside_contact)]))),
            'derived.commcise_type' => $u->commciseType($i),
            'derived.mode' => $this->mode($i),
            'derived.location' => $i->formValue('location') ?? $i->formValue('venue') ?? '',
            'derived.city' => $i->formValue('city') ?? '',
            'derived.client_location' => $this->clientLocation($i),
            'derived.location_type' => $this->mode($i) === 'InPerson' ? '' : ($this->mode($i) === '' ? '' : 'NotApplicable'),
            'derived.address' => $u->jefferiesKind($i)[1] === 'In Person' ? $u->address($i) : '',
            'derived.country' => $u->jefferiesKind($i)[1] === 'In Person' ? $u->country($i) : '',
            'derived.gics' => $u->bloombergTickers($i) === [] ? $u->gics($i) : '',
            'derived.asset_class' => $u->assetClass($i, $this->jpm),
            'derived.identifier_type' => $u->bloombergTickers($i) !== [] ? 'Ticker' : '',
            'derived.issuer_sponsored' => $u->corporates($i) === [] ? '' : (str_contains(self::normalise((string) $i->type?->type), 'deal') ? 'Y' : 'N'),
            'derived.region' => $this->jpm ? 'APAC - Philippines' : 'Asia',
            'derived.initiated_by' => $this->initiatedBy($i) ?? '',
            'derived.client_initiated' => match ($this->initiatedBy($i)) {
                'Investor' => 'Yes',
                'Broker' => 'No',
                default => '',
            },
            'derived.corporate_access' => $this->isCorporateAccess($i) ? 'Yes' : 'No',
            'derived.expert_contacts' => $i->formValue('expert_contact') ?? $i->formValue('industry_expert') ?? $i->formValue('industry_expert_name') ?? $i->formValue('expert') ?? '',
            'derived.expert_emails', 'derived.expert_roles' => '',
            'derived.parent_interaction' => $i->formValue('parent_interaction_id') ?? '',
            'derived.contract_id' => $i->formValue('contract_id') ?? '',
            'derived.meeting_name' => $i->formValue('meeting_name') ?? '',

            default => null,
        };
    }

    /** Run facts, for title-block cells as much as columns. */
    public function meta(string $source, ?string $text = null): string
    {
        return match ($source) {
            'const' => $text ?? '',
            'meta.generated_at' => CarbonImmutable::now()->format('j M Y H:i'),
            'meta.generated_at_utc' => CarbonImmutable::now('UTC')->format('j M Y H:i:s').' UTC',
            'meta.generated_by' => $this->generatedBy,
            'meta.range' => $this->from !== '' ? CarbonImmutable::parse($this->from)->format('j M Y').' to '.CarbonImmutable::parse($this->to)->format('j M Y') : '',
            'meta.client_name' => trim((string) $this->client?->name),
            default => '',
        };
    }

    /** One source as the text a preview shows (lists joined with the column's separator). */
    public function display(string $source, Interaction $i, string $separator = ', ', ?string $text = null): string
    {
        if ($source === 'formula') {
            return '(template formula)';
        }
        if (! self::isValid($source)) {
            return '';
        }
        $v = $this->resolve($source, $i, $text);
        if (is_array($v)) {
            return implode($separator, array_filter(array_map('strval', $v), fn ($x) => $x !== ''));
        }

        return $v === null ? '' : (string) $v;
    }

    /* ── Derivations shared with the built-in layouts ────────────── */

    private function typeLabel(Interaction $i): string
    {
        $type = trim((string) $i->type?->type);
        $sub = trim((string) $i->meeting_type);

        return $sub !== '' ? "$type - $sub" : $type;
    }

    /** Virtual / InPerson, blank for written deliveries (email, model, report). */
    private function mode(Interaction $i): string
    {
        $type = self::normalise((string) $i->type?->type);
        if (preg_match('/email|instantmessage|writtenreport|model|customwork|voicemail|^note$|ideapitch|dataset|distributionplatform/', $type)) {
            return '';
        }

        return $this->uploads->remote($i) ? 'Virtual' : 'InPerson';
    }

    private function initiatedBy(Interaction $i): ?string
    {
        if ($v = $i->formValue('initiated_by')) {
            return $v;
        }

        return match (strtoupper((string) $i->formValue('client_initiated'))) {
            'TRUE', 'YES' => 'Investor',
            'FALSE', 'NO' => 'Broker',
            default => null,
        };
    }

    private function isCorporateAccess(Interaction $i): bool
    {
        static $set = null;
        $set ??= array_flip(array_map([self::class, 'normalise'], ReportGenerator::CORPORATE_ACCESS));

        return isset($set[self::normalise((string) $i->type?->type)]);
    }

    /** @return list<string> */
    private function nameList(array $people): array
    {
        return array_values(array_filter(array_map(fn ($p) => trim((string) ($p['name'] ?? trim(($p['firstname'] ?? '').' '.($p['lastname'] ?? '')))), $people)));
    }

    /** @return list<string> */
    private function field(array $people, string $key): array
    {
        return array_values(array_filter(array_map(fn ($p) => trim((string) ($p[$key] ?? '')), $people)));
    }

    /** @return list<string> */
    private function corporatePositions(Interaction $i): array
    {
        $out = [];
        foreach ($i->form as $field) {
            if (($field['options']['value'] ?? null) !== 'CorporateContact') {
                continue;
            }
            foreach (Interaction::valueList($field['value'] ?? null) as $v) {
                if (is_array($v) && trim((string) ($v['position'] ?? '')) !== '') {
                    $out[] = trim((string) $v['position']);
                }
            }
        }

        return array_values(array_unique($out));
    }

    /** @return list<string> */
    private function tickerList(Interaction $i, string $identifier): array
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            $corp = $this->corporate($c);
            $out[] = trim((string) ($corp ? $corp->{$identifier} : ($c['ticker'] ?: $c['name'])));
        }

        return array_values(array_unique(array_filter($out)));
    }

    /** @return list<string> */
    private function sectorList(Interaction $i, string $column): array
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            if (($corp = $this->corporate($c)) && $corp->{$column}) {
                $out[] = trim((string) $corp->{$column});
            }
        }

        return array_values(array_unique(array_filter($out)));
    }

    /** @var array<int, array{name: string, type: ?string}>|null */
    private ?array $users = null;

    private function users(): array
    {
        if ($this->users === null) {
            $this->users = [];
            try {
                foreach (DB::connection('crms')->table('user')->get(['id', 'first_name', 'last_name', 'type']) as $u) {
                    $name = trim(($u->first_name ?? '').' '.($u->last_name ?? ''));
                    $this->users[(int) $u->id] = ['name' => $name !== '' ? $name : "User #{$u->id}", 'type' => $u->type];
                }
            } catch (\Throwable) {
                // No legacy user table on this install.
            }
        }

        return $this->users;
    }

    /** @var array<int, string>|null */
    private ?array $contactAddresses = null;

    private function clientLocation(Interaction $i): string
    {
        if ($this->contactAddresses === null) {
            $this->contactAddresses = [];
            try {
                $addresses = ClientAddress::query()->pluck('name', 'id')->map(fn ($n) => trim((string) $n))->all();
                foreach (ClientContact::query()->whereNotNull('client_address_id')->get(['id', 'client_address_id']) as $c) {
                    $this->contactAddresses[(int) $c->id] = $addresses[(int) $c->client_address_id] ?? '';
                }
            } catch (\Throwable) {
                // No contact directory on this install.
            }
        }
        $out = [];
        foreach ($i->client_contact as $c) {
            $out[] = $this->contactAddresses[(int) ($c['id'] ?? 0)] ?? '';
        }

        return implode(' | ', array_values(array_unique(array_filter($out))));
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
