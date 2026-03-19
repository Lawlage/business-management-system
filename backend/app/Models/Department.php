<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'manager_id',
    ];

    /** @return BelongsTo<\App\Models\User, $this> */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'manager_id');
    }

    public function renewables(): HasMany
    {
        return $this->hasMany(Renewable::class);
    }

    public function stockAllocations(): HasMany
    {
        return $this->hasMany(StockAllocation::class);
    }

    public function slaAllocations(): HasMany
    {
        return $this->hasMany(SlaAllocation::class);
    }
}
