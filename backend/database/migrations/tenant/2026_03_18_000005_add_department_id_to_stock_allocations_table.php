<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_allocations', function (Blueprint $table): void {
            $table->unsignedBigInteger('department_id')->nullable()->after('client_id');
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_allocations', function (Blueprint $table): void {
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
        });
    }
};
