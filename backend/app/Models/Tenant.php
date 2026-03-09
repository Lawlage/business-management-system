<?php

namespace App\Models;

use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase;
    use HasDomains;

    /**
     * Persist these attributes as SQL columns instead of JSON `data`.
     *
     * stancl/tenancy v3 reads this list from getCustomColumns().
     *
     * @return array<int, string>
     */
    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'slug',
            'status',
            'suspended_at',
            'created_by',
        ];
    }

    protected $fillable = [
        'id',
        'name',
        'slug',
        'status',
        'suspended_at',
        'created_by',
        'data',
    ];

    protected $casts = [
        'suspended_at' => 'datetime',
        'data' => 'array',
    ];
}
