<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomFieldDefinition extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'entity_type',
        'name',
        'key',
        'field_type',
        'is_required',
        'validation_rules',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'validation_rules' => 'array',
    ];

    public function values(): HasMany
    {
        return $this->hasMany(CustomFieldValue::class);
    }
}
