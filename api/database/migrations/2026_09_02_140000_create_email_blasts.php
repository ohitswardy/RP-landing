<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Email desk ledger. A blast is drafted, previewed, and edited in
     * the CMS; sending stays manual (copy into Outlook), so the row records
     * what went out, to whom, and from which Outlook account.
     */
    public function up(): void
    {
        Schema::create('email_blasts', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 12); // newsletter | report | adhoc
            $table->string('subject', 300);
            $table->longText('html_body')->nullable();
            $table->foreignId('report_id')->nullable()->constrained('reports')->nullOnDelete();
            $table->foreignId('newsletter_issue_id')->nullable()->constrained('newsletter_issues')->nullOnDelete();
            // Jefferies (or other external) link for foreign-client research.
            $table->string('external_link', 500)->nullable();
            $table->json('recipients'); // [{email, name?, userId?, source: client|subscriber|manual}]
            $table->string('status', 12)->default('draft'); // draft | ready | sent
            $table->text('notes')->nullable();
            $table->string('sender_outlook', 190)->nullable();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            // timestamps() first: MariaDB gives the first TIMESTAMP column an
            // implicit ON UPDATE CURRENT_TIMESTAMP, which must not land on sent_at.
            $table->timestamps();
            $table->timestamp('sent_at')->nullable();
            $table->index(['status', 'kind']);
        });

        // Live databases seeded before this release need the permission row;
        // RbacSeeder covers fresh installs. Editors inherit everything except
        // access.manage/logs.view, and Analysts blast their own research.
        $permissionId = DB::table('permissions')->where('key', 'email.manage')->value('id');
        if ($permissionId === null) {
            $permissionId = DB::table('permissions')->insertGetId([
                'key' => 'email.manage', 'label' => 'Email desk', 'group' => 'Systems',
            ]);
        }

        $roleIds = DB::table('roles')->whereIn('name', ['Administrator', 'Editor', 'Analyst'])->pluck('id');
        foreach ($roleIds as $roleId) {
            $exists = DB::table('permission_role')
                ->where('permission_id', $permissionId)
                ->where('role_id', $roleId)
                ->exists();
            if (! $exists) {
                DB::table('permission_role')->insert(['permission_id' => $permissionId, 'role_id' => $roleId]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('email_blasts');

        $permissionId = DB::table('permissions')->where('key', 'email.manage')->value('id');
        if ($permissionId !== null) {
            DB::table('permission_role')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
