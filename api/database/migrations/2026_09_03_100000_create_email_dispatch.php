<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Server-side sending for the Email desk. Blasts now leave through
     * Microsoft Graph from the staff member's own mailbox; this adds the
     * pieces that flow needs — reusable distribution lists, a per-batch
     * delivery log, the Local/Foreign split on a blast, and a per-subscriber
     * unsubscribe token so newsletter mail carries a working opt-out.
     */
    public function up(): void
    {
        Schema::create('distribution_lists', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('description', 300)->nullable();
            $table->json('contacts'); // [{email, name?, userId?, source: client|subscriber|manual}]
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('email_blasts', function (Blueprint $table) {
            // The Foreign leg: same subject and body, Jefferies link instead of
            // the portal deep link. NULL = the blast has no foreign leg.
            $table->json('recipients_foreign')->nullable()->after('recipients');
            $table->boolean('attach_report')->default(false)->after('external_link');
            // How it went out: graph (server-side) | outlook (copied by hand).
            $table->string('channel', 12)->nullable()->after('sender_outlook');
            $table->unsignedInteger('sent_count')->default(0)->after('channel');
            $table->unsignedInteger('failed_count')->default(0)->after('sent_count');
            $table->text('send_error')->nullable()->after('failed_count');
            $table->timestamp('queued_at')->nullable()->after('sent_at');
        });

        Schema::create('email_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_blast_id')->constrained('email_blasts')->cascadeOnDelete();
            $table->string('variant', 8);   // local | foreign
            $table->unsignedSmallInteger('batch');
            $table->string('envelope', 8);  // bcc (clients, up to 500 a message) | direct (one subscriber, personal unsubscribe)
            $table->json('recipients');     // [{email, name?, source}]
            $table->unsignedSmallInteger('recipient_count');
            $table->string('status', 10)->default('pending'); // pending | sent | failed
            $table->text('error')->nullable();
            $table->string('graph_request_id', 64)->nullable();
            // timestamps() first: MariaDB hands the first TIMESTAMP column an
            // implicit ON UPDATE, which must land on updated_at, not sent_at.
            $table->timestamps();
            $table->timestamp('sent_at')->nullable();
            $table->index(['email_blast_id', 'status']);
        });

        Schema::table('subscribers', function (Blueprint $table) {
            $table->string('unsubscribe_token', 64)->nullable()->unique()->after('verified');
            $table->timestamp('unsubscribed_at')->nullable()->after('unsubscribe_token');
        });
    }

    public function down(): void
    {
        Schema::table('subscribers', function (Blueprint $table) {
            $table->dropUnique(['unsubscribe_token']);
            $table->dropColumn(['unsubscribe_token', 'unsubscribed_at']);
        });
        Schema::dropIfExists('email_deliveries');
        Schema::table('email_blasts', function (Blueprint $table) {
            $table->dropColumn([
                'recipients_foreign', 'attach_report', 'channel', 'sent_count',
                'failed_count', 'send_error', 'queued_at',
            ]);
        });
        Schema::dropIfExists('distribution_lists');
    }
};
