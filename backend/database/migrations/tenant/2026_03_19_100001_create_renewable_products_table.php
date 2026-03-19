<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('renewable_products', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 255);
            $table->string('category', 100)->nullable();
            $table->string('vendor', 255)->nullable();
            $table->decimal('cost_price', 10, 2)->default(0.00);
            // Template duration: "this is a 1-year license". null = non-expiring.
            // No start_date — the product is a template, not a concrete schedule.
            $table->enum('frequency_type', ['days', 'months', 'years'])->nullable();
            $table->unsignedInteger('frequency_value')->nullable();
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
        Schema::dropIfExists('renewable_products');
    }
};
