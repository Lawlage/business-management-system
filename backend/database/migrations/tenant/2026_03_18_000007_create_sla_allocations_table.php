<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_allocations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('sla_item_id');
            $table->unsignedBigInteger('client_id');
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'cancelled'])->default('active');
            $table->unsignedBigInteger('allocated_by');
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->foreign('sla_item_id')->references('id')->on('sla_items');
            $table->foreign('client_id')->references('id')->on('clients');
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->index(['sla_item_id', 'status']);
            $table->index('client_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_allocations');
    }
};
