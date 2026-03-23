<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewables', function (Blueprint $table) {
            $table->unsignedInteger('quantity')->default(1)->after('sale_price');
        });
    }

    public function down(): void
    {
        Schema::table('renewables', function (Blueprint $table) {
            $table->dropColumn('quantity');
        });
    }
};
