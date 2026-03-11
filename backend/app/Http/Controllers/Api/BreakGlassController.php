<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BreakGlassAccess;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BreakGlassController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function start(Request $request, string $tenantId): JsonResponse
    {
        $payload = $request->validate([
            'reason' => ['required', 'string', 'min:10'],
            'permission_confirmed' => ['required', 'accepted'],
        ]);

        // Generate a cryptographically random token and store its hash.
        // The plaintext token is returned to the client once and never stored.
        $token = (string) Str::uuid();
        $tokenHash = hash('sha256', $token);

        $access = BreakGlassAccess::query()->create([
            'token' => $tokenHash,
            'tenant_id' => $tenantId,
            'user_id' => $request->user()->id,
            'reason' => $payload['reason'],
            'permission_confirmed' => (bool) $payload['permission_confirmed'],
            'expires_at' => now()->addMinutes(30),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $this->auditLogger->global($request, 'break_glass.started', $request->user(), $tenantId, [
            'entity_type' => 'break_glass',
            'entity_id' => (string) $access->id,
            'reason' => $access->reason,
            'permission_confirmed' => $access->permission_confirmed,
        ]);

        return new JsonResponse([
            'token' => $token,
            'expires_at' => $access->expires_at,
        ], 201);
    }

    public function stop(Request $request, string $tenantId, string $token): JsonResponse
    {
        $tokenHash = hash('sha256', $token);

        $access = BreakGlassAccess::query()
            ->where('tenant_id', $tenantId)
            ->where('token', $tokenHash)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $access->update(['ended_at' => now()]);

        $this->auditLogger->global($request, 'break_glass.ended', $request->user(), $tenantId, [
            'entity_type' => 'break_glass',
            'entity_id' => (string) $access->id,
        ]);

        return new JsonResponse(['message' => 'Break-glass session closed.']);
    }
}
