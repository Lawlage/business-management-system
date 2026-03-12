<?php

namespace App\Support;

use App\Enums\TenantRole;

class TenantPermissionMap
{
    public const ADJUST_STOCK = 'adjust_stock';
    public const EDIT_EXISTING = 'edit_existing';
    public const CREATE_RENEWAL = 'create_renewal';
    public const CREATE_INVENTORY = 'create_inventory';
    public const DELETE_RECORD = 'delete_record';
    public const MANAGE_USERS = 'manage_users';
    public const MANAGE_CUSTOM_FIELDS = 'manage_custom_fields';
    public const VIEW_AUDIT_LOGS = 'view_audit_logs';

    /**
     * @return array<string, list<string>>
     */
    public static function matrix(): array
    {
        return [
            TenantRole::StandardUser->value => [
                self::ADJUST_STOCK,
            ],
            TenantRole::SubAdmin->value => [
                self::ADJUST_STOCK,
                self::EDIT_EXISTING,
                self::CREATE_RENEWAL,
                self::CREATE_INVENTORY,
            ],
            TenantRole::TenantAdmin->value => [
                self::ADJUST_STOCK,
                self::EDIT_EXISTING,
                self::CREATE_RENEWAL,
                self::CREATE_INVENTORY,
                self::DELETE_RECORD,
                self::MANAGE_USERS,
                self::MANAGE_CUSTOM_FIELDS,
                self::VIEW_AUDIT_LOGS,
            ],
        ];
    }
}
