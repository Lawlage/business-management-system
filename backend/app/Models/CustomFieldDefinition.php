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
        'dropdown_options',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'entity_type' => 'array',
        'validation_rules' => 'array',
        'dropdown_options' => 'array',
    ];

    public function values(): HasMany
    {
        return $this->hasMany(CustomFieldValue::class);
    }
}
