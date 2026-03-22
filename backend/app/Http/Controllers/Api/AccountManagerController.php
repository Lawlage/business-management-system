<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenantMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountManagerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        $memberships = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('is_account_manager', true)
            ->with('user:id,first_name,last_name')
            ->get();

        $accountManagers = $memberships->map(fn ($m) => [
            'id' => $m->user->id,
            'first_name' => $m->user->first_name,
            'last_name' => $m->user->last_name,
            'name' => trim($m->user->first_name . ' ' . $m->user->last_name),
        ]);

        return new JsonResponse($accountManagers);
    }
}
