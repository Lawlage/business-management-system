<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class TenantMembership extends Model
{
    use HasFactory;
    use CentralConnection;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'role',
        'can_edit',
        'is_account_manager',
    ];

    protected $casts = [
        'can_edit' => 'boolean',
        'is_account_manager' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'id');
    }
}
