<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
    ];

    public function renewals(): HasMany
    {
        return $this->hasMany(Renewal::class);
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
