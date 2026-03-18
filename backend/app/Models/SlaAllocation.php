<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SlaAllocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'sla_item_id',
        'client_id',
        'department_id',
        'quantity',
        'unit_price',
        'notes',
        'status',
        'allocated_by',
        'cancelled_by',
        'cancelled_at',
    ];

    protected $casts = [
        'cancelled_at' => 'datetime',
        'unit_price' => 'decimal:2',
    ];

    /** @return BelongsTo<SlaItem, $this> */
    public function slaItem(): BelongsTo
    {
        return $this->belongsTo(SlaItem::class);
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
