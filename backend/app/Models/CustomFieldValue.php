<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomFieldValue extends Model
{
    use HasFactory;

    protected $fillable = [
        'custom_field_definition_id',
        'entity_type',
        'entity_id',
        'value_string',
        'value_number',
        'value_boolean',
        'value_date',
        'value_json',
    ];

    protected $casts = [
        'value_boolean' => 'boolean',
        'value_date' => 'date',
        'value_json' => 'array',
    ];

    public function definition(): BelongsTo
    {
        return $this->belongsTo(CustomFieldDefinition::class, 'custom_field_definition_id');
    }
}
