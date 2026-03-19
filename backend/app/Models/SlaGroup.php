<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SlaGroup extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = ['name'];

    /** @return HasMany<SlaItem, $this> */
    public function slaItems(): HasMany
    {
        return $this->hasMany(SlaItem::class);
    }
}
