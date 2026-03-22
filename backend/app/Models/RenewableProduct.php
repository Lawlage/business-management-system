<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class RenewableProduct extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'vendor',
        'cost_price',
        'sale_price',
        'frequency_type',
        'frequency_value',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    /** @return HasMany<Renewable, $this> */
    public function renewables(): HasMany
    {
        return $this->hasMany(Renewable::class);
    }
}
