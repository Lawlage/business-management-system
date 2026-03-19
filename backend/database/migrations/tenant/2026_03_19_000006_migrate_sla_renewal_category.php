<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('renewals')->where('category', 'sla_renewal')->update(['category' => 'other']);
    }

    public function down(): void
    {
        // Not reversible — data migration only.
    }
};
