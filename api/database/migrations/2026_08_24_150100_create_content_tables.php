<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('tag');
            $table->string('title', 500);
            $table->string('author');
            $table->date('date');
            $table->string('status', 12)->default('draft'); // published | review | draft
            $table->unsignedInteger('reads')->default(0);
            $table->text('excerpt');
            $table->timestamps();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->string('title', 500);
            $table->string('category');
            $table->string('analyst');
            $table->date('date');
            $table->unsignedSmallInteger('pages')->default(0);
            $table->text('summary');
            $table->string('file_name');
            $table->unsignedBigInteger('file_size')->default(0);
            // Seed catalog PDFs live on the public site; uploads live on the storage disk.
            $table->string('file_url')->nullable();
            $table->string('file_path')->nullable();
            $table->timestamps();
        });

        Schema::create('staff_members', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('role_title');
            $table->string('team');
            $table->string('img')->default('');
            $table->boolean('visible')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('service_lines', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('dek');
            $table->unsignedTinyInteger('pillars')->default(4);
            $table->string('img')->default('');
            $table->boolean('live')->default(true);
            $table->timestamps();
        });

        Schema::create('career_posts', function (Blueprint $table) {
            $table->id();
            $table->string('title', 500);
            $table->string('dept');
            $table->string('type', 20);
            $table->string('location');
            $table->date('posted');
            $table->string('status', 12)->default('open');
            $table->unsignedInteger('applicants')->default(0);
            $table->timestamps();
        });

        Schema::create('watch_symbols', function (Blueprint $table) {
            $table->id();
            $table->string('sym', 8)->unique();
            $table->string('name');
            $table->boolean('pinned')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('subscribers', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('firm')->default('');
            $table->date('joined');
            $table->string('source')->default('Footer');
            $table->boolean('verified')->default(false);
            $table->timestamps();
        });

        Schema::create('page_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('page');
            $table->string('field');
            $table->text('value');
            $table->date('updated');
            $table->string('editor')->default('');
            $table->timestamps();
        });

        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();
            $table->string('path');
            $table->string('label');
            $table->string('kind', 12)->default('photo');
            $table->string('used_by')->default('');
            $table->timestamps();
        });

        Schema::create('audit_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor');
            $table->string('action');
            $table->string('target', 500);
            $table->timestamp('at');
        });

        Schema::create('bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->timestamp('saved_at');
            $table->unique(['user_id', 'report_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookmarks');
        Schema::dropIfExists('audit_entries');
        Schema::dropIfExists('media_assets');
        Schema::dropIfExists('page_blocks');
        Schema::dropIfExists('subscribers');
        Schema::dropIfExists('watch_symbols');
        Schema::dropIfExists('career_posts');
        Schema::dropIfExists('service_lines');
        Schema::dropIfExists('staff_members');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('articles');
    }
};
