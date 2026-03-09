<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class BreakGlassAccess extends Model
{
    use HasFactory;
    use CentralConnection;

    protected $fillable = [
        'token',
        'tenant_id',
        'user_id',
        'reason',
        'permission_confirmed',
        'expires_at',
        'ended_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'permission_confirmed' => 'boolean',
        'expires_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
