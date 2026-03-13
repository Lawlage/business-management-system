<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GlobalAuditLog;
use App\Models\TenantAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function export(Request $request): StreamedResponse
    {
        $request->validate([
            'type'               => ['sometimes', 'in:tenant,break_glass'],
            'event'              => ['sometimes', 'nullable', 'string', 'max:100'],
            'triggered_by_name'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'date_from'          => ['sometimes', 'nullable', 'date'],
            'date_to'            => ['sometimes', 'nullable', 'date'],
        ]);

        $tenantId = (string) $request->attributes->get('tenant_id');
        $type = $request->input('type', 'tenant');

        if ($type === 'break_glass') {
            $query = GlobalAuditLog::query()
                ->where('tenant_id', $tenantId)
                ->where('event', 'like', 'break_glass.%');
        } else {
            $query = TenantAuditLog::query();
        }

        if ($event = $request->input('event')) {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $event);
            $query->where('event', 'like', '%' . $escaped . '%');
        }

        if ($triggeredBy = $request->input('triggered_by_name')) {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $triggeredBy);
            $query->where('triggered_by_name', 'like', '%' . $escaped . '%');
        }

        if ($dateFrom = $request->input('date_from')) {
            $query->where('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->where('created_at', '<=', $dateTo);
        }

        $logs = $query->latest()->get();
        $filename = 'audit-log-' . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($logs): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, ['Timestamp', 'Event', 'Triggered By', 'Entity Type', 'Entity', 'IP Address', 'Details']);

            foreach ($logs as $log) {
                $metadata = is_array($log->metadata) ? $log->metadata : [];
                $entityTitle = $metadata['entity_title'] ?? $log->entity_id ?? '';
                unset($metadata['entity_type'], $metadata['entity_id'], $metadata['entity_title']);
                $details = empty($metadata) ? '' : json_encode($metadata);

                fputcsv($handle, [
                    $log->created_at,
                    $log->event,
                    $log->triggered_by_name ?? '',
                    $log->entity_type ?? '',
                    $entityTitle,
                    $log->ip_address ?? '',
                    $details,
                ]);
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
