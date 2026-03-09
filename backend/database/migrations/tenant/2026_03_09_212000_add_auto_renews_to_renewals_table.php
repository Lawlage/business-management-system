<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewals', function (Blueprint $table): void {
            $table->boolean('auto_renews')->default(false)->after('workflow_status');
        });
    }

    public function down(): void
    {
        Schema::table('renewals', function (Blueprint $table): void {
            $table->dropColumn('auto_renews');
        });
    }
};
