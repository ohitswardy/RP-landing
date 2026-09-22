<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;

/**
 * The client templates that ship with the CRMS, exactly as the clients sent
 * them, in resources/report-templates:
 *
 *  - jefferies.xlsx — Jefferies' bulk-upload workbook ("Aug 2026 - Regis
 *    Interactions.xlsx" with last month's rows removed): Instructions, Data
 *    (A–N, header on row 1, the Errors validator formula per row, dropdowns
 *    on Meeting Type / Method / Duration), Lookup.
 *  - schroders-commcise.xlsx / jpm-commcise.xlsx — the Commcise upload
 *    templates downloaded from each client's Commcise site on 2026-09-21,
 *    untouched: Data (28 columns, seven header rows, data from A8),
 *    BuysideContacts, ClientInteractionType, CompanyIdentifierType,
 *    LocationType, Region, Roles, Client Data Quality Rules.
 *
 * Each has the same layout map an imported template carries (see
 * ReportLayoutController), so LayoutRenderer fills them the same way: the
 * workbook is the client's, only the rows come from the system. Reports →
 * Jefferies upload uses the first; a client bound to the `commcise` code
 * gets the Schroders or JPM file by name. An administrator can still import
 * a fresher download from the Form builder, which then takes over.
 */
class BundledTemplates
{
    public const JEFFERIES = 'jefferies';

    public const SCHRODERS = 'schroders-commcise';

    public const JPM = 'jpm-commcise';

    /** The original file names, for the UI and the download. */
    public const FILES = [
        self::JEFFERIES => 'Aug 2026 - Regis Interactions.xlsx',
        self::SCHRODERS => '2026-09-21-Schroders-Commcise Template_20260921051916.xlsx',
        self::JPM => '2026-09-21-JPM-Commcise Template_20260921051555.xlsx',
    ];

    public static function path(string $key): string
    {
        return resource_path('report-templates/'.$key.'.xlsx');
    }

    /** Which Commcise workbook a client bound to `commcise` gets. */
    public static function forCommcise(?Client $client): string
    {
        return $client && (new UploadLayouts)->isJpm($client) ? self::JPM : self::SCHRODERS;
    }

    /** The bundled workbook a binding code fills, or null for a hand-written layout / an import. */
    public static function forCode(string $code, ?Client $client): ?string
    {
        return match ($code) {
            'commcise' => self::forCommcise($client),
            'jefferies' => self::JEFFERIES,
            default => null,
        };
    }

    /**
     * The layout map of a bundled template, in the shape report_templates.layout uses.
     *
     * @return array{title: string, sheet: string, sheets: list<string>, headerRow: int, dataStart: int, scope: string, columns: list<array>, cells: list<array>}
     */
    public static function layout(string $key): array
    {
        $col = fn (int $index, string $header, string $source, string $separator = ', ', ?string $format = null) => [
            'index' => $index, 'header' => $header, 'source' => $source, 'separator' => $separator, 'format' => $format, 'text' => null,
        ];

        return match ($key) {
            self::JEFFERIES => [
                'title' => 'Regis Interactions',
                'sheet' => 'Data',
                'sheets' => ['Instructions', 'Data', 'Lookup'],
                'headerRow' => 1,
                'dataStart' => 2,
                // The bulk upload covers the co-brand's whole foreign book, whatever client is on screen.
                'scope' => 'foreign',
                'columns' => [
                    $col(0, 'Meeting Type', 'derived.jefferies_type'),
                    $col(1, 'Meeting Method', 'derived.jefferies_method'),
                    // Date / time formats: null keeps the template's own cell formats (mm/dd/yyyy, h:mm).
                    $col(2, 'Date', 'interaction.date'),
                    $col(3, 'Start Time', 'interaction.time_start'),
                    $col(4, 'Duration (In mins)', 'derived.jefferies_minutes'),
                    $col(5, 'Interaction Owner', 'owner.email'),
                    $col(6, 'Internal Attendee', 'derived.jefferies_internal', ','),
                    $col(7, 'External Attendee', 'contacts.emails', ','),
                    $col(8, 'Address', 'derived.address'),
                    $col(9, 'Country', 'derived.country'),
                    $col(10, 'Tickers', 'corporates.bloomberg', ','),
                    $col(11, 'GICS Sectors & Industry', 'derived.gics'),
                    $col(12, 'Notes', 'interaction.description'),
                    $col(13, 'Errors', 'formula'),
                ],
                'cells' => [],
            ],
            self::SCHRODERS, self::JPM => [
                'title' => ($key === self::JPM ? 'JPM' : 'Schroders').'-Commcise Template',
                'sheet' => 'Data',
                'sheets' => ['Data', 'BuysideContacts', 'ClientInteractionType', 'CompanyIdentifierType', 'LocationType', 'Region', 'Roles', 'Client Data Quality Rules'],
                'headerRow' => 7,
                'dataStart' => 8,
                'scope' => 'client',
                'columns' => [
                    $col(0, 'Interaction Type', 'derived.commcise_type'),
                    $col(1, 'Description', 'interaction.description'),
                    $col(2, 'Interaction Id', 'interaction.reference'),
                    $col(3, 'Interaction Date', 'interaction.date_utc', ', ', 'yyyy-mm-dd'),
                    $col(4, 'Start Time', 'interaction.time_start_utc', ', ', 'hh:mm:ss'),
                    $col(5, 'Duration', 'interaction.minutes'),
                    $col(6, 'Mode', 'derived.mode'),
                    $col(7, 'Location', 'derived.location'),
                    $col(8, 'Location Type', 'derived.location_type'),
                    $col(9, 'Consumers', 'contacts.names', '|'),
                    $col(10, 'Consumer Emails', 'contacts.emails', '|'),
                    $col(11, 'Sellside Contacts', 'regis.names', '|'),
                    $col(12, 'Sellside Emails', 'regis.emails', '|'),
                    $col(13, 'Corporate Contacts', 'corporate_contacts.names', '|'),
                    $col(14, 'Corporate Emails', 'corporate_contacts.emails', '|'),
                    $col(15, 'Corporate Roles', 'corporate_contacts.roles', '|'),
                    $col(16, 'Company Names', 'corporates.names', '|'),
                    $col(17, 'Company Identifier Type', 'derived.identifier_type'),
                    $col(18, 'Company Identifiers', 'corporates.bloomberg', '|'),
                    $col(19, 'Issuer Sponsored', 'derived.issuer_sponsored'),
                    $col(20, 'Expert Contacts', 'derived.expert_contacts'),
                    $col(21, 'Expert Emails', 'derived.expert_emails'),
                    $col(22, 'Expert Roles', 'derived.expert_roles'),
                    $col(23, 'Asset Class', 'derived.asset_class'),
                    $col(24, 'Regions', 'derived.region'),
                    $col(25, 'Sectors', 'corporates.sectors', '|'),
                    $col(26, 'Parent Interaction Id', 'derived.parent_interaction'),
                    $col(27, 'Contract Id', 'derived.contract_id'),
                ],
                // The template's own title block, stamped like a fresh download.
                'cells' => [
                    ['ref' => 'F1', 'source' => 'meta.generated_at_utc', 'text' => null],
                    ['ref' => 'F2', 'source' => 'meta.generated_by', 'text' => null],
                ],
            ],
            default => throw new \InvalidArgumentException("Unknown bundled template \"$key\"."),
        };
    }

    /** The layout plus the file name, in the wire shape the UI shows for an imported template. */
    public static function describe(string $key): array
    {
        return self::layout($key) + ['key' => $key, 'file' => self::FILES[$key], 'importedAt' => null];
    }

    public static function isKey(string $key): bool
    {
        return isset(self::FILES[$key]);
    }
}
