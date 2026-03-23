<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewables', function (Blueprint $table) {
            $table->string('service_type')->nullable()->default('recurring')->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('renewables', function (Blueprint $table) {
            $table->dropColumn('service_type');
        });
    }
};
