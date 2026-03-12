<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reportService)
    {
    }

    public function renewalStatusSummary(Request $request): JsonResponse|Response
    {
        $data = $this->reportService->renewalStatusSummary();

        if ($request->input('format') === 'csv') {
            $rows = [];
            foreach ($data as $group) {
                foreach ($group['renewals'] as $r) {
                    $rows[] = [
                        $group['status'],
                        $r['title'],
                        $r['client']['name'] ?? '',
                        $r['category'],
                        substr((string) $r['expiration_date'], 0, 10),
                    ];
                }
            }
            return $this->csvResponse(
                ['Status', 'Title', 'Client', 'Category', 'Expiration Date'],
                $rows,
                'renewal-status-summary',
            );
        }

        return new JsonResponse($data);
    }

    public function renewalsByClient(Request $request): JsonResponse|Response
    {
        $clientId = $request->filled('client_id') ? (int) $request->input('client_id') : null;
        $data = $this->reportService->renewalsByClient($clientId);

        if ($request->input('format') === 'csv') {
            $rows = [];
            foreach ($data as $group) {
                foreach ($group['renewals'] as $r) {
                    $rows[] = [
                        $group['client_name'],
                        $r['title'],
                        $r['status'],
                        $r['category'],
                        substr((string) $r['expiration_date'], 0, 10),
                        $r['workflow_status'] ?? '',
                    ];
                }
            }
            return $this->csvResponse(
                ['Client', 'Title', 'Status', 'Category', 'Expiration Date', 'Workflow Status'],
                $rows,
                'renewals-by-client',
            );
        }

        return new JsonResponse($data);
    }

    public function renewalsExpiring(Request $request): JsonResponse|Response
    {
        $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));
        $data = $this->reportService->renewalsExpiring($from, $to);

        if ($request->input('format') === 'csv') {
            $rows = array_map(fn ($r) => [
                $r['title'],
                $r['client']['name'] ?? '',
                $r['status'],
                $r['category'],
                substr((string) $r['expiration_date'], 0, 10),
                $r['auto_renews'] ? 'Yes' : 'No',
            ], $data);
            return $this->csvResponse(
                ['Title', 'Client', 'Status', 'Category', 'Expiration Date', 'Auto Renews'],
                $rows,
                'renewals-expiring',
            );
        }

        return new JsonResponse($data);
    }

    public function inventorySummary(Request $request): JsonResponse|Response
    {
        $data = $this->reportService->inventorySummary();

        if ($request->input('format') === 'csv') {
            $rows = array_map(fn ($item) => [
                $item['name'],
                $item['sku'],
                $item['quantity_on_hand'],
                $item['minimum_on_hand'],
                $item['allocated_quantity'],
                $item['is_low_stock'] ? 'Yes' : 'No',
                $item['location'] ?? '',
                $item['vendor'] ?? '',
            ], $data);
            return $this->csvResponse(
                ['Name', 'SKU', 'On Hand', 'Minimum', 'Allocated', 'Low Stock', 'Location', 'Vendor'],
                $rows,
                'inventory-summary',
            );
        }

        return new JsonResponse($data);
    }

    public function stockMovements(Request $request): JsonResponse|Response
    {
        $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'item_id' => ['nullable', 'integer'],
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));
        $itemId = $request->filled('item_id') ? (int) $request->input('item_id') : null;
        $data = $this->reportService->stockMovementHistory($from, $to, $itemId);

        if ($request->input('format') === 'csv') {
            $rows = array_map(fn ($t) => [
                $t['inventory_item']['name'] ?? '',
                $t['inventory_item']['sku'] ?? '',
                $t['type'],
                $t['quantity'],
                $t['reason'] ?? '',
                substr((string) $t['created_at'], 0, 10),
            ], $data);
            return $this->csvResponse(
                ['Item', 'SKU', 'Type', 'Quantity', 'Reason', 'Date'],
                $rows,
                'stock-movements',
            );
        }

        return new JsonResponse($data);
    }

    public function stockAllocations(Request $request): JsonResponse|Response
    {
        $clientId = $request->filled('client_id') ? (int) $request->input('client_id') : null;
        $itemId = $request->filled('item_id') ? (int) $request->input('item_id') : null;
        $status = $request->filled('status') ? (string) $request->input('status') : null;
        $data = $this->reportService->stockAllocationReport($clientId, $itemId, $status);

        if ($request->input('format') === 'csv') {
            $rows = array_map(fn ($a) => [
                $a['inventory_item']['name'] ?? '',
                $a['inventory_item']['sku'] ?? '',
                $a['client']['name'] ?? '',
                $a['quantity'],
                $a['unit_price'] ?? '',
                $a['unit_price'] ? number_format($a['quantity'] * (float) $a['unit_price'], 2) : '',
                $a['status'],
                $a['notes'] ?? '',
                substr((string) $a['created_at'], 0, 10),
            ], $data);
            return $this->csvResponse(
                ['Item', 'SKU', 'Client', 'Quantity', 'Unit Price', 'Total', 'Status', 'Notes', 'Date'],
                $rows,
                'stock-allocations',
            );
        }

        return new JsonResponse($data);
    }

    public function clientPortfolio(Request $request): JsonResponse|Response
    {
        $request->validate([
            'client_id' => ['required', 'integer'],
        ]);

        $clientId = (int) $request->input('client_id');
        $data = $this->reportService->clientPortfolio($clientId);

        if ($request->input('format') === 'csv') {
            $rows = [];
            foreach ($data['renewals'] as $r) {
                $rows[] = ['renewal', $r['title'], $r['status'], substr((string) $r['expiration_date'], 0, 10), '', ''];
            }
            foreach ($data['allocations'] as $a) {
                $rows[] = ['allocation', $a['inventory_item']['name'] ?? '', $a['status'], substr((string) $a['created_at'], 0, 10), $a['quantity'], $a['unit_price'] ?? ''];
            }
            return $this->csvResponse(
                ['Type', 'Title / Item', 'Status', 'Date', 'Quantity', 'Unit Price'],
                $rows,
                'client-portfolio-' . $clientId,
            );
        }

        return new JsonResponse($data);
    }

    /** @param list<string> $headers @param list<list<mixed>> $rows */
    private function csvResponse(array $headers, array $rows, string $name): Response
    {
        $csv = $this->reportService->toCsv($headers, $rows);
        $filename = $name . '-' . now()->format('Y-m-d') . '.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
