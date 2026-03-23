<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Renewable extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'renewable_product_id',
        'description',
        'client_id',
        'department_id',
        'workflow_status',
        'sale_price',
        'price_override',
        'invoice_date',
        'frequency_type',
        'frequency_value',
        'frequency_start_date',
        'next_due_date',
        'status',
        'service_type',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'sale_price'           => 'decimal:2',
        'price_override'       => 'boolean',
        'invoice_date'         => 'date',
        'next_due_date'        => 'date',
        'frequency_start_date' => 'date',
    ];

    /** @return BelongsTo<RenewableProduct, $this> */
    public function renewableProduct(): BelongsTo
    {
        return $this->belongsTo(RenewableProduct::class);
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
