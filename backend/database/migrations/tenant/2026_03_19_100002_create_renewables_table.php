<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('renewables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('renewable_product_id')->constrained('renewable_products');
            $table->string('description', 255)->nullable();
            $table->unsignedBigInteger('client_id');
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('workflow_status', 100)->nullable();
            $table->decimal('sale_price', 10, 2)->nullable();
            // Concrete recurrence schedule. null = inherit from renewable_product.
            $table->enum('frequency_type', ['days', 'months', 'years', 'day_of_month'])->nullable();
            $table->unsignedInteger('frequency_value')->nullable();
            // Only relevant when frequency_type ∈ {days, months, years}.
            $table->date('frequency_start_date')->nullable();
            // Computed and stored; refreshed on save and by daily scheduled command.
            $table->date('next_due_date')->nullable();
            $table->string('status', 50)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('client_id')->references('id')->on('clients');
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->index('renewable_product_id');
            $table->index(['client_id', 'deleted_at']);
            $table->index(['next_due_date', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('renewables');
    }
};
