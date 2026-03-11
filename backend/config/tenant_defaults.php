<?php

/**
 * Default values applied to every new tenant.
 * Used by SuperAdminTenantController, TenantSettingsController, and the frontend (uiSettings.ts).
 * Keep in sync with frontend/src/uiSettings.ts defaultTenantUiSettings.
 */
return [
    'timezone' => 'Pacific/Auckland',

    'ui_settings' => [
        'theme_preset' => 'default',
        'density' => 'comfortable',
        'font_family' => 'modern_sans',
        'primary_colour' => '#0f172a',
        'secondary_colour' => '#1e293b',
        'tertiary_colour' => '#4b5563',
        'accent_colour' => '#4b5563',
        'border_colour' => '#5f738a',
    ],
];
