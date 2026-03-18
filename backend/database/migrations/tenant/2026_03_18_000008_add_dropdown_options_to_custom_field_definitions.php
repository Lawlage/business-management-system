<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custom_field_definitions', function (Blueprint $table): void {
            $table->json('dropdown_options')->nullable()->after('validation_rules');
        });
    }

    public function down(): void
    {
        Schema::table('custom_field_definitions', function (Blueprint $table): void {
            $table->dropColumn('dropdown_options');
        });
    }
};
