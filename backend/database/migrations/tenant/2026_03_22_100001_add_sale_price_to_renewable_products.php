<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Make cost_price nullable (was NOT NULL DEFAULT 0.00)
        DB::statement('ALTER TABLE renewable_products MODIFY cost_price DECIMAL(10,2) NULL DEFAULT NULL');

        Schema::table('renewable_products', function (Blueprint $table): void {
            $table->decimal('sale_price', 10, 2)->nullable()->after('cost_price');
        });
    }

    public function down(): void
    {
        Schema::table('renewable_products', function (Blueprint $table): void {
            $table->dropColumn('sale_price');
        });

        // Restore cost_price as NOT NULL DEFAULT 0.00
        DB::statement('ALTER TABLE renewable_products MODIFY cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    }
};
