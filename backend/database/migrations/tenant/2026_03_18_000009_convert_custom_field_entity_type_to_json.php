<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add a temporary JSON column alongside the existing string column.
        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->json('entity_type_json')->nullable()->after('entity_type');
        });

        // Migrate existing string values to JSON arrays.
        DB::table('custom_field_definitions')->get()->each(function ($row) {
            $types = match ($row->entity_type) {
                'both'      => ['renewal', 'inventory'],
                'renewal'   => ['renewal'],
                'inventory' => ['inventory'],
                default     => [$row->entity_type],
            };
            DB::table('custom_field_definitions')
                ->where('id', $row->id)
                ->update(['entity_type_json' => json_encode($types)]);
        });

        // Drop old string column and rename the JSON column.
        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->dropColumn('entity_type');
        });

        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->renameColumn('entity_type_json', 'entity_type');
        });
    }

    public function down(): void
    {
        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->string('entity_type_str')->nullable()->after('entity_type');
        });

        DB::table('custom_field_definitions')->get()->each(function ($row) {
            $types = json_decode((string) $row->entity_type, true) ?? [];
            $value = match (true) {
                in_array('renewal', $types) && in_array('inventory', $types) => 'both',
                in_array('renewal', $types)   => 'renewal',
                in_array('inventory', $types) => 'inventory',
                default                       => 'renewal',
            };
            DB::table('custom_field_definitions')
                ->where('id', $row->id)
                ->update(['entity_type_str' => $value]);
        });

        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->dropColumn('entity_type');
        });

        Schema::table('custom_field_definitions', function (Blueprint $table) {
            $table->renameColumn('entity_type_str', 'entity_type');
        });
    }
};
