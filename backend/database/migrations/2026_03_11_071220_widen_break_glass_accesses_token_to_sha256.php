<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('break_glass_accesses', function (Blueprint $table) {
            // SHA-256 hex digest is 64 characters; the original uuid() column (CHAR 36) is too narrow.
            $table->char('token', 64)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('break_glass_accesses', function (Blueprint $table) {
            $table->uuid('token')->change();
        });
    }
};
