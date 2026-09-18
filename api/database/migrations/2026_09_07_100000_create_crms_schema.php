<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Facades\Schema;

/**
 * The CRMS runs on the legacy schema, on its own connection. Against the
 * production database every legacy table already exists and this migration
 * only adds what CRMSmasterplan.md §11.5 allows: nullable columns, indexes
 * and new tables. On a fresh machine it also lays the legacy tables down so
 * the app can start — each one guarded by hasTable, so nothing is ever
 * altered or re-shaped.
 */
return new class extends Migration
{
    protected $connection = 'crms';

    public function up(): void
    {
        $s = Schema::connection('crms');

        /* ── Legacy tables, created only where missing ───────────── */

        $this->table($s, 'client', function (Blueprint $t) {
            $t->string('name');
            $t->string('region')->nullable();
            $t->string('monikers')->nullable();
            $t->text('client_type')->nullable();
        });

        $this->table($s, 'client_address', function (Blueprint $t) {
            $t->text('name')->nullable();
            $t->unsignedInteger('client_id')->nullable()->index();
        });

        $this->table($s, 'client_contact', function (Blueprint $t) {
            $t->string('firstname')->nullable();
            $t->string('lastname')->nullable();
            $t->string('email')->nullable();
            $t->string('contact_no')->nullable();
            $t->string('mobile_no')->nullable();
            $t->string('position')->nullable();
            $t->string('country')->nullable();
            $t->text('own')->nullable();
            $t->text('watchlist')->nullable();
            $t->text('coverage_team')->nullable();
            $t->text('sales')->nullable();
            $t->string('distribution_list')->nullable();
            $t->string('assistant')->nullable();
            $t->string('assistant_email')->nullable();
            $t->string('assistant_contact_no')->nullable();
            $t->unsignedInteger('client_id')->index();
            $t->unsignedInteger('client_address_id')->nullable();
        });

        $this->table($s, 'sellside_contact', function (Blueprint $t) {
            $t->string('name');
            $t->string('email');
            $t->string('type')->nullable();
            $t->string('position')->nullable();
            $t->string('office_no')->nullable();
            $t->string('mobile_no')->nullable();
        });

        $this->table($s, 'corporate', function (Blueprint $t) {
            $t->string('name');
            $t->string('ticker')->nullable();
            $t->string('identifiers1')->nullable();
            $t->string('identifiers2')->nullable();
            $t->text('address')->nullable();
            $t->text('corporate_contacts')->nullable();
            $t->string('sector_generic')->nullable();
            $t->string('sector_gmo')->nullable();
            $t->string('sector_jpmorgan')->nullable();
            $t->string('sector_schroders')->nullable();
            $t->string('sector_trowe')->nullable();
        });

        $this->table($s, 'corporate_contact', function (Blueprint $t) {
            $t->string('name');
            $t->string('position')->nullable();
            $t->string('address')->nullable();
            $t->string('email')->nullable();
            $t->string('mobile')->nullable();
            $t->string('phone')->nullable();
            $t->string('assistant')->nullable();
            $t->string('assistant_email')->nullable();
            $t->text('analyst')->nullable();
        });

        $this->table($s, 'interactionsType', function (Blueprint $t) {
            $t->text('type');
            $t->text('meeting_type')->nullable();
            $t->unsignedInteger('client_id')->nullable()->index();
        });

        $this->table($s, 'form', function (Blueprint $t) {
            $t->text('fields');
            $t->unsignedInteger('client_id')->nullable()->index();
        });

        $this->table($s, 'interactions', function (Blueprint $t) {
            $t->dateTime('interaction_date');
            $t->string('time_start')->nullable();
            $t->string('time_end')->nullable();
            $t->string('duration')->nullable();
            $t->string('meeting_type')->nullable();
            $t->text('description')->nullable();
            $t->text('internal_notes')->nullable();
            $t->text('action_point')->nullable();
            $t->text('recipients')->nullable();
            $t->text('client_contact')->nullable();
            $t->text('sellside_contact')->nullable();
            $t->string('client_contact_status')->nullable();
            $t->text('form')->nullable();
            $t->unsignedInteger('client_id');
            $t->unsignedInteger('user_id')->nullable();
            $t->unsignedInteger('interactions_type_id')->nullable();
        });

        $this->table($s, 'event_category', function (Blueprint $t) {
            $t->string('name');
        }, timestamps: false);

        // One-off meetings (OneOffMeeting model) — a standalone client meeting that feeds the calendar.
        $this->table($s, 'event', function (Blueprint $t) {
            $t->dateTime('start_date');
            $t->dateTime('end_date')->nullable();
            $t->string('time_start')->nullable();
            $t->string('time_end')->nullable();
            $t->string('timezone')->nullable();
            $t->text('location')->nullable();
            $t->string('meeting_type')->nullable();
            $t->string('classification')->nullable();
            $t->text('description')->nullable();
            $t->text('note')->nullable();
            $t->text('corporate_address')->nullable();
            $t->text('client_contact')->nullable();
            $t->text('corporate_contact')->nullable();
            $t->unsignedInteger('client_id')->nullable()->index();
            $t->unsignedInteger('corporate_id')->nullable()->index();
            $t->unsignedInteger('interaction_id')->nullable();
            $t->unsignedInteger('user_id')->nullable();
        });

        $this->table($s, 'roadshow', function (Blueprint $t) {
            $t->unsignedInteger('category');
            $t->string('classification')->nullable();
            $t->dateTime('start_date');
            $t->dateTime('end_date')->nullable();
            $t->string('coordinator')->nullable();
            $t->string('tel_no')->nullable();
            $t->string('mobile_no')->nullable();
            $t->string('email')->nullable();
            $t->unsignedInteger('corporate_id')->nullable();
            $t->unsignedInteger('client_id')->nullable();
            $t->text('client_contact')->nullable();
            $t->text('sellside_contact')->nullable();
        });

        $this->table($s, 'meeting', function (Blueprint $t) {
            $t->dateTime('date');
            $t->string('time_start');
            $t->string('time_end');
            $t->string('timezone')->nullable();
            $t->string('location');
            $t->string('meeting_type');
            $t->string('corporate_type')->nullable();
            $t->text('description')->nullable();
            $t->text('contact')->nullable();
            $t->text('booked_by')->nullable();
            $t->text('note')->nullable();
            $t->text('corporate_address')->nullable();
            $t->text('client_contact')->nullable();
            $t->text('corporate_contact')->nullable();
            $t->unsignedInteger('roadshow_id');
            $t->unsignedInteger('client_id')->nullable();
            $t->unsignedInteger('corporate_id')->nullable();
            $t->unsignedInteger('interaction_id')->nullable();
        });

        $this->table($s, 'investor', function (Blueprint $t) {
            $t->text('client_contact')->nullable();
            $t->unsignedInteger('client_id')->nullable();
            $t->unsignedInteger('roadshow_id')->index();
        });

        $this->table($s, 'flight', function (Blueprint $t) {
            $t->dateTime('date');
            $t->string('time');
            $t->string('location');
            $t->text('description')->nullable();
            $t->string('timezone')->nullable();
            $t->dateTime('date_arrival')->nullable();
            $t->string('time_arrival')->nullable();
            $t->string('timezone_arrival')->nullable();
            $t->string('location_arrival')->nullable();
            $t->text('description_arrival')->nullable();
            $t->text('passenger')->nullable();
            $t->text('note')->nullable();
            $t->unsignedInteger('roadshow_id')->index();
        });

        $this->table($s, 'transpo', function (Blueprint $t) {
            $t->dateTime('date');
            $t->string('start_time');
            $t->string('end_time');
            $t->string('timezone')->nullable();
            $t->string('location');
            $t->text('description')->nullable();
            $t->string('driver_name');
            $t->string('driver_mobile');
            $t->string('vehicle_type');
            $t->string('confirm_no');
            $t->text('remarks')->nullable();
            $t->text('passenger')->nullable();
            $t->text('note')->nullable();
            $t->unsignedInteger('roadshow_id')->index();
        });

        $this->table($s, 'accommodation', function (Blueprint $t) {
            $t->dateTime('date');
            $t->text('time_in')->nullable();
            $t->dateTime('date_out')->nullable();
            $t->text('time_out')->nullable();
            $t->string('location')->nullable();
            $t->text('description')->nullable();
            $t->text('accommodator')->nullable();
            $t->text('note')->nullable();
            $t->unsignedInteger('roadshow_id')->index();
        });

        $this->table($s, 'bank', function (Blueprint $t) {
            $t->string('position')->nullable();
            $t->string('office_no')->nullable();
            $t->string('mobile_no')->nullable();
            $t->string('email')->nullable();
            $t->unsignedInteger('roadshow_id')->index();
            $t->unsignedInteger('sellside_contact_id');
        });

        $this->table($s, 'log', function (Blueprint $t) {
            $t->string('activity');
            $t->text('payload')->nullable();
            $t->unsignedInteger('user_id')->nullable();
        });

        // Legacy staff directory (read-only): interactions.user_id points here and
        // the Call Report groups its Sales / Analysts sheets by `type`.
        $this->table($s, 'user', function (Blueprint $t) {
            $t->string('first_name')->nullable();
            $t->string('last_name')->nullable();
            $t->string('email')->nullable();
            $t->string('password')->nullable();
            $t->string('type')->nullable();
            $t->text('roles')->nullable();
            $t->text('reset_link')->nullable();
            $t->string('status')->nullable();
        });

        /* ── Additive columns (§11.5) ────────────────────────────── */

        $this->column($s, 'client_contact', 'portal_user_id', fn (Blueprint $t) => $t->unsignedInteger('portal_user_id')->nullable()->index());
        $this->column($s, 'interactions', 'disposition', fn (Blueprint $t) => $t->string('disposition', 12)->nullable());
        $this->column($s, 'interactions', 'actioned_at', fn (Blueprint $t) => $t->dateTime('actioned_at')->nullable());
        $this->column($s, 'corporate_contact', 'corporate_id', fn (Blueprint $t) => $t->unsignedInteger('corporate_id')->nullable()->index());

        /* ── Indexes on the hot paths ────────────────────────────── */

        $this->index($s, 'interactions', 'interactions_client_date_idx', ['client_id', 'interaction_date']);
        $this->index($s, 'meeting', 'meeting_roadshow_date_idx', ['roadshow_id', 'date']);
        $this->index($s, 'client_contact', 'client_contact_email_idx', ['email']);
        $this->index($s, 'corporate', 'corporate_ticker_idx', ['ticker']);
        $this->index($s, 'roadshow', 'roadshow_category_start_idx', ['category', 'start_date']);

        /* ── New CRMS-owned tables ───────────────────────────────── */

        if (! $s->hasTable('sector_group')) {
            $s->create('sector_group', function (Blueprint $t) {
                $t->increments('id');
                $t->string('name');
                $t->string('scope', 20); // domestic | foreign
                $t->unsignedInteger('position')->default(0);
                $t->timestamps();
            });
        }

        if (! $s->hasTable('sector_group_corporate')) {
            $s->create('sector_group_corporate', function (Blueprint $t) {
                $t->unsignedInteger('sector_group_id');
                $t->unsignedInteger('corporate_id');
                $t->primary(['sector_group_id', 'corporate_id']);
            });
        }

        if (! $s->hasTable('client_contact_sector_group')) {
            $s->create('client_contact_sector_group', function (Blueprint $t) {
                $t->unsignedInteger('client_contact_id');
                $t->unsignedInteger('sector_group_id');
                $t->primary(['client_contact_id', 'sector_group_id']);
            });
        }

        if (! $s->hasTable('report_templates')) {
            $s->create('report_templates', function (Blueprint $t) {
                $t->increments('id');
                $t->unsignedInteger('client_id')->unique();
                $t->string('code', 40); // corpaxe | gmo | jpmorgan | schroders | trowe
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }
    }

    /** Only the tables this migration owns are dropped; legacy tables stay. */
    public function down(): void
    {
        $s = Schema::connection('crms');
        $s->dropIfExists('report_templates');
        $s->dropIfExists('client_contact_sector_group');
        $s->dropIfExists('sector_group_corporate');
        $s->dropIfExists('sector_group');
    }

    private function table(Builder $s, string $name, callable $columns, bool $timestamps = true): void
    {
        if ($s->hasTable($name)) {
            return;
        }
        $s->create($name, function (Blueprint $t) use ($columns, $timestamps) {
            $t->increments('id');
            $columns($t);
            if ($timestamps) {
                $t->dateTime('created')->nullable();
                $t->dateTime('created_at')->nullable();
                $t->dateTime('updated_at')->nullable();
            }
        });
    }

    private function column(Builder $s, string $table, string $column, callable $add): void
    {
        if (! $s->hasColumn($table, $column)) {
            $s->table($table, $add);
        }
    }

    private function index(Builder $s, string $table, string $name, array $columns): void
    {
        if (! $s->hasIndex($table, $name)) {
            $s->table($table, fn (Blueprint $t) => $t->index($columns, $name));
        }
    }
};
