<?php

namespace App\Services;

use App\Models\BreakGlassAccess;
use App\Models\TenantMembership;
use App\Models\User;
use App\Support\TenantPermissionMap;
use Illuminate\Support\Carbon;

class TenantAccessService
{
    public function hasTenantAccess(User $user, string $tenantId, ?string $breakGlassToken = null): bool
    {
        if ($user->is_global_superadmin) {
            return $this->hasValidBreakGlass($user, $tenantId, $breakGlassToken);
        }

        return TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->exists();
    }

    public function hasPermission(User $user, string $tenantId, string $permission, ?string $breakGlassToken = null): bool
    {
        if (! $this->hasTenantAccess($user, $tenantId, $breakGlassToken)) {
            return false;
        }

        $membership = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership && ! $user->is_global_superadmin) {
            return false;
        }

        if ($user->is_global_superadmin) {
            return true;
        }

        if ($permission === TenantPermissionMap::EDIT_EXISTING && ! $membership->can_edit) {
            return false;
        }

        $matrix = TenantPermissionMap::matrix();

        return in_array($permission, $matrix[$membership->role] ?? [], true);
    }

    public function hasValidBreakGlass(User $user, string $tenantId, ?string $token): bool
    {
        if (! $token) {
            return false;
        }

        return BreakGlassAccess::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->where('token', $token)
            ->whereNull('ended_at')
            ->where('expires_at', '>', Carbon::now())
            ->exists();
    }
}
