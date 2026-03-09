<?php

namespace App\Enums;

enum TenantRole: string
{
    case TenantAdmin = 'tenant_admin';
    case SubAdmin = 'sub_admin';
    case StandardUser = 'standard_user';
}
