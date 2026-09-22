<?php

namespace Tests\Feature\Crms;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * CRMSmasterplan.md §11.6 schema-drift guard. The CRMS shares its database
 * with the legacy Angular app, so the column list of every legacy table is
 * frozen here as literal arrays. The lists are derived from the two CRMS
 * migration files (2026_09_07 create_crms_schema and 2026_09_18
 * add_important_to_crms_interactions); any further migration that adds,
 * drops, renames or reorders a column fails this test and has to be
 * justified by updating the frozen list in the same change.
 *
 * Order matters: SQLite reports columns in creation order, and the
 * additive columns (§11.5) land after the timestamp trio exactly because
 * they were ALTERed on afterwards.
 */
class SchemaDriftTest extends TestCase
{
    use RefreshDatabase;

    private const TIMESTAMPS = ['created', 'created_at', 'updated_at'];

    /** Legacy tables laid down by create_crms_schema (id first, timestamp trio last unless noted). */
    private const LEGACY = [
        'client' => ['id', 'name', 'region', 'monikers', 'client_type', ...self::TIMESTAMPS],
        'client_address' => ['id', 'name', 'client_id', ...self::TIMESTAMPS],
        'client_contact' => [
            'id', 'firstname', 'lastname', 'email', 'contact_no', 'mobile_no', 'position', 'country', 'own', 'watchlist',
            'coverage_team', 'sales', 'distribution_list', 'assistant', 'assistant_email', 'assistant_contact_no', 'client_id',
            'client_address_id', ...self::TIMESTAMPS,
            'portal_user_id', // additive, §11.5
        ],
        'sellside_contact' => ['id', 'name', 'email', 'type', 'position', 'office_no', 'mobile_no', ...self::TIMESTAMPS],
        'corporate' => [
            'id', 'name', 'ticker', 'identifiers1', 'identifiers2', 'address', 'corporate_contacts', 'sector_generic', 'sector_gmo',
            'sector_jpmorgan', 'sector_schroders', 'sector_trowe', ...self::TIMESTAMPS,
        ],
        'corporate_contact' => [
            'id', 'name', 'position', 'address', 'email', 'mobile', 'phone', 'assistant', 'assistant_email', 'analyst', ...self::TIMESTAMPS,
            'corporate_id', // additive, §11.5
        ],
        'interactionsType' => ['id', 'type', 'meeting_type', 'client_id', ...self::TIMESTAMPS],
        'form' => ['id', 'fields', 'client_id', ...self::TIMESTAMPS],
        'interactions' => [
            'id', 'interaction_date', 'time_start', 'time_end', 'duration', 'meeting_type', 'description', 'internal_notes', 'action_point',
            'recipients', 'client_contact', 'sellside_contact', 'client_contact_status', 'form', 'client_id', 'user_id', 'interactions_type_id',
            ...self::TIMESTAMPS,
            'disposition', 'actioned_at', // additive, create_crms_schema
            'important', 'important_note', 'important_at', // additive, add_important_to_crms_interactions
        ],
        'event_category' => ['id', 'name'], // no timestamps
        'event' => [
            'id', 'start_date', 'end_date', 'time_start', 'time_end', 'timezone', 'location', 'meeting_type', 'classification', 'description',
            'note', 'corporate_address', 'client_contact', 'corporate_contact', 'client_id', 'corporate_id', 'interaction_id', 'user_id',
            ...self::TIMESTAMPS,
        ],
        'roadshow' => [
            'id', 'category', 'classification', 'start_date', 'end_date', 'coordinator', 'tel_no', 'mobile_no', 'email', 'corporate_id',
            'client_id', 'client_contact', 'sellside_contact', ...self::TIMESTAMPS,
        ],
        'meeting' => [
            'id', 'date', 'time_start', 'time_end', 'timezone', 'location', 'meeting_type', 'corporate_type', 'description', 'contact',
            'booked_by', 'note', 'corporate_address', 'client_contact', 'corporate_contact', 'roadshow_id', 'client_id', 'corporate_id',
            'interaction_id', ...self::TIMESTAMPS,
        ],
        'investor' => ['id', 'client_contact', 'client_id', 'roadshow_id', ...self::TIMESTAMPS],
        'flight' => [
            'id', 'date', 'time', 'location', 'description', 'timezone', 'date_arrival', 'time_arrival', 'timezone_arrival', 'location_arrival',
            'description_arrival', 'passenger', 'note', 'roadshow_id', ...self::TIMESTAMPS,
        ],
        'transpo' => [
            'id', 'date', 'start_time', 'end_time', 'timezone', 'location', 'description', 'driver_name', 'driver_mobile', 'vehicle_type',
            'confirm_no', 'remarks', 'passenger', 'note', 'roadshow_id', ...self::TIMESTAMPS,
        ],
        'accommodation' => ['id', 'date', 'time_in', 'date_out', 'time_out', 'location', 'description', 'accommodator', 'note', 'roadshow_id', ...self::TIMESTAMPS],
        'bank' => ['id', 'position', 'office_no', 'mobile_no', 'email', 'roadshow_id', 'sellside_contact_id', ...self::TIMESTAMPS],
        'log' => ['id', 'activity', 'payload', 'user_id', ...self::TIMESTAMPS],
        'user' => ['id', 'first_name', 'last_name', 'email', 'password', 'type', 'roles', 'reset_link', 'status', ...self::TIMESTAMPS],
    ];

    /** Tables the CRMS owns outright (§11.5), still frozen so a stray change is visible. */
    private const OWNED = [
        'sector_group' => ['id', 'name', 'scope', 'position', 'created_at', 'updated_at'],
        'sector_group_corporate' => ['sector_group_id', 'corporate_id'],
        'client_contact_sector_group' => ['client_contact_id', 'sector_group_id'],
        'report_templates' => ['id', 'client_id', 'code', 'is_active', 'created_at', 'updated_at', 'layout', 'layout_file', 'layout_name', 'layout_imported_at'],
    ];

    /** Named indexes the migrations add; the hot paths the desk lists depend on. */
    private const INDEXES = [
        'interactions' => ['interactions_client_date_idx', 'interactions_important_date_idx'],
        'meeting' => ['meeting_roadshow_date_idx'],
        'client_contact' => ['client_contact_email_idx'],
        'corporate' => ['corporate_ticker_idx'],
        'roadshow' => ['roadshow_category_start_idx'],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
    }

    public function test_every_legacy_table_keeps_its_exact_column_list(): void
    {
        $schema = Schema::connection('crms');
        foreach (self::LEGACY as $table => $columns) {
            $this->assertTrue($schema->hasTable($table), "legacy table `$table` is missing");
            $this->assertSame($columns, $schema->getColumnListing($table), "column list of legacy table `$table` drifted");
        }
    }

    public function test_crms_owned_tables_keep_their_exact_column_list(): void
    {
        $schema = Schema::connection('crms');
        foreach (self::OWNED as $table => $columns) {
            $this->assertTrue($schema->hasTable($table), "CRMS table `$table` is missing");
            $this->assertSame($columns, $schema->getColumnListing($table), "column list of `$table` drifted");
        }
    }

    public function test_no_table_is_added_or_removed_on_the_crms_connection(): void
    {
        $expected = array_keys(self::LEGACY + self::OWNED);
        sort($expected);

        $actual = array_values(array_filter(
            // SQLite reports tables as schema.table ("main.client"); only the name matters here.
            array_map(fn (string $t) => str_contains($t, '.') ? substr($t, strrpos($t, '.') + 1) : $t, Schema::connection('crms')->getTableListing()),
            // The migration repository and SQLite's own bookkeeping are not schema.
            fn (string $t) => $t !== 'migrations' && ! str_starts_with($t, 'sqlite_'),
        ));
        sort($actual);

        $this->assertSame($expected, $actual, 'the set of tables on the crms connection changed');
    }

    public function test_hot_path_indexes_are_present(): void
    {
        $schema = Schema::connection('crms');
        foreach (self::INDEXES as $table => $indexes) {
            foreach ($indexes as $index) {
                $this->assertTrue($schema->hasIndex($table, $index), "index `$index` on `$table` is missing");
            }
        }
    }

    public function test_the_migrations_are_idempotent_against_an_existing_schema(): void
    {
        // Against production every legacy table already exists; a second run must change nothing.
        $before = [];
        foreach (array_keys(self::LEGACY + self::OWNED) as $table) {
            $before[$table] = Schema::connection('crms')->getColumnListing($table);
        }

        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);

        foreach ($before as $table => $columns) {
            $this->assertSame($columns, Schema::connection('crms')->getColumnListing($table), "`$table` changed on a re-run");
        }
    }
}
