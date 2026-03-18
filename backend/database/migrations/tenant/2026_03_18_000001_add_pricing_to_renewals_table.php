<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewals', function (Blueprint $table): void {
            $table->decimal('cost_price', 10, 2)->default(0.00)->after('notes');
            $table->decimal('sale_price', 10, 2)->default(0.00)->after('cost_price');
        });
    }

    public function down(): void
    {
        Schema::table('renewals', function (Blueprint $table): void {
            $table->dropColumn(['cost_price', 'sale_price']);
        });
    }
};
