<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sla_items', function (Blueprint $table) {
            $table->foreignId('sla_group_id')->nullable()->after('id')->constrained('sla_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sla_items', function (Blueprint $table) {
            $table->dropForeignId('sla_group_id');
        });
    }
};
