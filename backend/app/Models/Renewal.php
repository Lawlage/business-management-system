<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Renewal extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    protected $fillable = [
        'title',
        'client_id',
        'department_id',
        'category',
        'owner',
        'vendor',
        'start_date',
        'renewal_date',
        'expiration_date',
        'status',
        'workflow_status',
        'auto_renews',
        'notes',
        'cost_price',
        'sale_price',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'renewal_date' => 'date',
        'expiration_date' => 'date',
        'auto_renews' => 'boolean',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];
}
