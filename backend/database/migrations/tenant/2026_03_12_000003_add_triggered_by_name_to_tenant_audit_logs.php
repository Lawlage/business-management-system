<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant_audit_logs', function (Blueprint $table) {
            $table->string('triggered_by_name')->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('tenant_audit_logs', function (Blueprint $table) {
            $table->dropColumn('triggered_by_name');
        });
    }
};
