<?php

namespace App\Services;

use App\Models\GlobalAuditLog;
use App\Models\TenantAuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public function global(Request $request, string $event, ?User $user = null, ?string $tenantId = null, array $meta = []): void
    {
        GlobalAuditLog::query()->create([
            'user_id' => $user?->id,
            'triggered_by_name' => $user?->name,
            'tenant_id' => $tenantId,
            'event' => $event,
            'entity_type' => $meta['entity_type'] ?? null,
            'entity_id' => isset($meta['entity_id']) ? (string) $meta['entity_id'] : null,
            'metadata' => $meta,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    public function tenant(Request $request, string $event, ?User $user = null, array $meta = []): void
    {
        TenantAuditLog::query()->create([
            'user_id' => $user?->id,
            'triggered_by_name' => $user?->name,
            'event' => $event,
            'entity_type' => $meta['entity_type'] ?? null,
            'entity_id' => isset($meta['entity_id']) ? (string) $meta['entity_id'] : null,
            'metadata' => $meta,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
