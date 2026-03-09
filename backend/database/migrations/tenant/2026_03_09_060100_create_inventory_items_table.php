<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('classification')->nullable();
            $table->integer('quantity_on_hand')->default(0);
            $table->integer('minimum_on_hand')->default(0);
            $table->string('location')->nullable();
            $table->string('vendor')->nullable();
            $table->date('purchase_date')->nullable();
            $table->unsignedBigInteger('linked_renewal_id')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['quantity_on_hand', 'minimum_on_hand']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
