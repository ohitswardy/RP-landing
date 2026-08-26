<?php

use App\Support\PeopleDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staff profiles grow from a name-and-title stub into the full card the
 * About page renders: stacked titles, bio paragraphs, sector chips, and
 * contact details. `role_title` becomes the first entry in `roles`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_members', function (Blueprint $table) {
            // Guarded so a retry after a failed backfill still runs.
            if (! Schema::hasColumn('staff_members', 'roles')) {
                $table->json('roles')->nullable()->after('name');
                $table->json('bio')->nullable()->after('roles');
                $table->json('sectors')->nullable()->after('bio');
                $table->string('phone')->default('')->after('sectors');
                $table->string('email')->default('')->after('phone');
            }
        });

        $this->backfill();

        Schema::table('staff_members', function (Blueprint $table) {
            $table->dropColumn('role_title');
        });
    }

    /**
     * Match seeded rows by name and team and give them their full card.
     * Anything the CMS added since is carried over on its existing title.
     */
    private function backfill(): void
    {
        $defaults = collect(PeopleDefaults::all());

        foreach (DB::table('staff_members')->get() as $row) {
            $match = $defaults->first(fn ($d) => $d['name'] === $row->name && $d['team'] === $row->team);

            DB::table('staff_members')->where('id', $row->id)->update([
                'roles' => json_encode($match['roles'] ?? array_filter([$row->role_title])),
                'bio' => json_encode($match['bio'] ?? []),
                'sectors' => json_encode($match['sectors'] ?? []),
                'phone' => $match['phone'] ?? '',
                'email' => $match['email'] ?? '',
                'img' => $match['img'] ?? $row->img,
                'updated_at' => now(),
            ]);
        }

        // The three partners who also sit on a second team were never seeded
        // under it — the About page rendered those cards from hard-coded copy.
        $position = (int) DB::table('staff_members')->max('position');

        foreach (PeopleDefaults::all() as $d) {
            $exists = DB::table('staff_members')
                ->where('name', $d['name'])->where('team', $d['team'])->exists();
            if ($exists) {
                continue;
            }

            DB::table('staff_members')->insert([
                'name' => $d['name'],
                'team' => $d['team'],
                // Still present and NOT NULL until the column drop below.
                'role_title' => $d['roles'][0] ?? '',
                'roles' => json_encode($d['roles']),
                'bio' => json_encode($d['bio']),
                'sectors' => json_encode($d['sectors']),
                'phone' => $d['phone'],
                'email' => $d['email'],
                'img' => $d['img'],
                'visible' => true,
                'position' => ++$position,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->applyDefaultOrder();
    }

    /** Put every profile back into the order the About page listed them. */
    private function applyDefaultOrder(): void
    {
        foreach (PeopleDefaults::all() as $i => $d) {
            DB::table('staff_members')
                ->where('name', $d['name'])->where('team', $d['team'])
                ->update(['position' => $i]);
        }
    }

    public function down(): void
    {
        Schema::table('staff_members', function (Blueprint $table) {
            $table->string('role_title')->default('');
        });

        foreach (DB::table('staff_members')->get() as $row) {
            $roles = json_decode((string) $row->roles, true) ?: [];
            DB::table('staff_members')->where('id', $row->id)
                ->update(['role_title' => $roles[0] ?? '']);
        }

        Schema::table('staff_members', function (Blueprint $table) {
            $table->dropColumn(['roles', 'bio', 'sectors', 'phone', 'email']);
        });
    }
};
