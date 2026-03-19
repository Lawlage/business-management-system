<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SlaItem extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'sku',
        'tier',
        'response_time',
        'resolution_time',
        'cost_price',
        'sale_price',
        'notes',
        'sla_group_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    /** @return BelongsTo<SlaGroup, $this> */
    public function slaGroup(): BelongsTo
    {
        return $this->belongsTo(SlaGroup::class);
    }

    public function slaAllocations(): HasMany
    {
        return $this->hasMany(SlaAllocation::class);
    }
}
