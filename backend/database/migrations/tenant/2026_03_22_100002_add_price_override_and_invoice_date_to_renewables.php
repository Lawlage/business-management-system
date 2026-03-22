<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewables', function (Blueprint $table): void {
            $table->boolean('price_override')->default(false)->after('sale_price');
            $table->date('invoice_date')->nullable()->after('price_override');
        });
    }

    public function down(): void
    {
        Schema::table('renewables', function (Blueprint $table): void {
            $table->dropColumn(['price_override', 'invoice_date']);
        });
    }
};
