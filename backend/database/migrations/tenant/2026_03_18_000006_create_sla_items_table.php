<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_items', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 255);
            $table->string('sku', 255)->unique();
            $table->string('tier', 100)->nullable();
            $table->string('response_time', 100)->nullable();
            $table->string('resolution_time', 100)->nullable();
            $table->decimal('cost_price', 10, 2)->default(0.00);
            $table->decimal('sale_price', 10, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_items');
    }
};
