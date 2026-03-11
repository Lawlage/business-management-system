<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GlobalAuditLog;
use App\Models\TenantAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $tenantId = (string) $request->attributes->get('tenant_id');

        return new JsonResponse([
            'tenant_logs' => TenantAuditLog::query()->latest()->paginate(10),
            'break_glass_logs' => GlobalAuditLog::query()
                ->where('tenant_id', $tenantId)
                ->where('event', 'like', 'break_glass.%')
                ->latest()
                ->paginate(10, ['*'], 'break_glass_page'),
        ]);
    }
}
