<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasOne;

class InventoryItem extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'sku',
        'classification',
        'quantity_on_hand',
        'minimum_on_hand',
        'location',
        'vendor',
        'purchase_date',
        'linked_renewal_id',
        'notes',
        'cost_price',
        'sale_price',
        'barcode',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    public function stockTransactions(): HasMany
    {
        return $this->hasMany(StockTransaction::class);
    }

    public function stockAllocations(): HasMany
    {
        return $this->hasMany(StockAllocation::class);
    }
}
