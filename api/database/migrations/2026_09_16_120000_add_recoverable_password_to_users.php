<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A copy of each password, encrypted under APP_KEY, written whenever a
     * password is set through the system so the super admin can read it back
     * from Users & access. Null for anything that arrived already hashed (the
     * legacy import) until that account's password is next reset.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('password_recoverable')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_recoverable');
        });
    }
};
