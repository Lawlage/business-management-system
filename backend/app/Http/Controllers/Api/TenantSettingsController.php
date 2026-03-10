<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TenantSettingsController extends Controller
{
    /**
     * @return array{theme_preset: string, density: string, font_family: string, primary_colour: string, secondary_colour: string, tertiary_colour: string, accent_colour: string, border_colour: string}
     */
    private function defaultUiSettings(): array
    {
        return [
            'theme_preset' => 'default',
            'density' => 'comfortable',
            'font_family' => 'modern_sans',
            'primary_colour' => '#0f2747',
            'secondary_colour' => '#2f3d50',
            'tertiary_colour' => '#002c42',
            'accent_colour' => '#002c42',
            'border_colour' => '#6b7f93',
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function normalizeUiSettings(array $settings): array
    {
        $normalized = $settings;

        if (! array_key_exists('primary_colour', $normalized) && array_key_exists('primary_color', $normalized)) {
            $normalized['primary_colour'] = $normalized['primary_color'];
        }
        if (! array_key_exists('secondary_colour', $normalized) && array_key_exists('secondary_color', $normalized)) {
            $normalized['secondary_colour'] = $normalized['secondary_color'];
        }
        if (! array_key_exists('secondary_colour', $normalized) && array_key_exists('neutral_color', $normalized)) {
            $normalized['secondary_colour'] = $normalized['neutral_color'];
        }
        if (! array_key_exists('tertiary_colour', $normalized) && array_key_exists('tertiary_color', $normalized)) {
            $normalized['tertiary_colour'] = $normalized['tertiary_color'];
        }
        if (! array_key_exists('tertiary_colour', $normalized) && array_key_exists('primary_color', $normalized)) {
            $normalized['tertiary_colour'] = $normalized['primary_color'];
        }
        if (! array_key_exists('accent_colour', $normalized) && array_key_exists('accent_color', $normalized)) {
            $normalized['accent_colour'] = $normalized['accent_color'];
        }
        if (! array_key_exists('border_colour', $normalized) && array_key_exists('border_color', $normalized)) {
            $normalized['border_colour'] = $normalized['border_color'];
        }
        if (array_key_exists('tertiary_colour', $normalized)) {
            $normalized['accent_colour'] = $normalized['tertiary_colour'];
        }

        unset(
            $normalized['primary_color'],
            $normalized['secondary_color'],
            $normalized['tertiary_color'],
            $normalized['accent_color'],
            $normalized['border_color'],
            $normalized['neutral_color'],
            $normalized['neutral_colour']
        );

        return $normalized;
    }

    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $tenant = Tenant::query()->findOrFail($tenantId);
        $uiSettings = $tenant->ui_settings;
        if (! is_array($uiSettings)) {
            $uiSettings = data_get($tenant->data ?? [], 'ui_settings', []);
        }
        $uiSettings = $this->normalizeUiSettings($uiSettings);

        $timezone = $tenant->timezone;
        if (! is_string($timezone) || $timezone === '') {
            $timezone = data_get($tenant->data ?? [], 'timezone', 'Pacific/Auckland');
        }

        return new JsonResponse([
            'timezone' => $timezone,
            'ui_settings' => [
                ...$this->defaultUiSettings(),
                ...$uiSettings,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $tenant = Tenant::query()->findOrFail($tenantId);

        $payload = $request->validate([
            'timezone' => ['required', 'string', Rule::in(timezone_identifiers_list())],
            'ui_settings' => ['sometimes', 'array'],
            'ui_settings.theme_preset' => ['sometimes', 'string', Rule::in(['default', 'high_contrast', 'colour_blind_safe'])],
            'ui_settings.density' => ['sometimes', 'string', Rule::in(['comfortable', 'compact'])],
            'ui_settings.font_family' => ['sometimes', 'string', Rule::in(['serif_system', 'modern_sans', 'humanist'])],
            'ui_settings.primary_colour' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.secondary_colour' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.tertiary_colour' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.accent_colour' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.border_colour' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            // Backwards compatibility with previous API keys.
            'ui_settings.primary_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.secondary_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.tertiary_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.accent_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.border_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'ui_settings.neutral_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        $existingUiSettings = $tenant->ui_settings;
        if (! is_array($existingUiSettings)) {
            $existingUiSettings = data_get($tenant->data ?? [], 'ui_settings', []);
        }
        $existingUiSettings = $this->normalizeUiSettings($existingUiSettings);
        $incomingUiSettings = $this->normalizeUiSettings((array) ($payload['ui_settings'] ?? []));

        $computedUiSettings = [
            ...$this->defaultUiSettings(),
            ...$existingUiSettings,
            ...$incomingUiSettings,
        ];
        $computedUiSettings['accent_colour'] = $computedUiSettings['tertiary_colour'];
        $tenant->timezone = $payload['timezone'];
        $tenant->ui_settings = $computedUiSettings;
        $tenant->save();

        $this->auditLogger->global($request, 'tenant.settings_updated', $request->user(), $tenantId, [
            'entity_type' => 'tenant',
            'entity_id' => $tenantId,
            'timezone' => $payload['timezone'],
            'ui_settings' => $computedUiSettings,
        ]);

        return new JsonResponse([
            'timezone' => $payload['timezone'],
            'ui_settings' => $computedUiSettings,
        ]);
    }
}
