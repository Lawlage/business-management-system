<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Carbon\Carbon;
use Closure;
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

        return $this->respondWithFormat($request, $data, 'renewable-status-summary',
            ['Status', 'Description', 'Product', 'Category', 'Client', 'Qty', 'Sale Price', 'Total', 'Next Due Date'],
            function (array $data): array {
                $rows = [];
                foreach ($data as $group) {
                    foreach ($group['renewables'] as $r) {
                        $qty = (int) ($r['quantity'] ?? 1);
                        $price = $r['sale_price'] ?? null;
                        $total = $price !== null ? number_format($qty * (float) $price, 2) : '';
                        $rows[] = [
                            $group['status'],
                            $r['description'],
                            $r['renewable_product']['name'] ?? '',
                            $r['renewable_product']['category'] ?? '',
                            $r['client']['name'] ?? '',
                            $qty,
                            $price ?? '',
                            $total,
                            substr((string) ($r['next_due_date'] ?? ''), 0, 10),
                        ];
                    }
                }
                return $rows;
            },
        );
    }

    public function renewalsByClient(Request $request): JsonResponse|Response
    {
        $clientId = $request->filled('client_id') ? (int) $request->input('client_id') : null;
        $data = $this->reportService->renewalsByClient($clientId);

        return $this->respondWithFormat($request, $data, 'renewables-by-client',
            ['Client', 'Description', 'Product', 'Status', 'Category', 'Qty', 'Sale Price', 'Total', 'Next Due Date', 'Workflow Status'],
            function (array $data): array {
                $rows = [];
                foreach ($data as $group) {
                    foreach ($group['renewables'] as $r) {
                        $qty = (int) ($r['quantity'] ?? 1);
                        $price = $r['sale_price'] ?? null;
                        $total = $price !== null ? number_format($qty * (float) $price, 2) : '';
                        $rows[] = [
                            $group['client_name'],
                            $r['description'],
                            $r['renewable_product']['name'] ?? '',
                            $r['status'] ?? '',
                            $r['renewable_product']['category'] ?? '',
                            $qty,
                            $price ?? '',
                            $total,
                            substr((string) ($r['next_due_date'] ?? ''), 0, 10),
                            $r['workflow_status'] ?? '',
                        ];
                    }
                }
                return $rows;
            },
        );
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

        return $this->respondWithFormat($request, $data, 'renewables-expiring',
            ['Description', 'Product', 'Client', 'Status', 'Category', 'Qty', 'Sale Price', 'Total', 'Next Due Date'],
            fn (array $data): array => array_map(function ($r) {
                $qty = (int) ($r['quantity'] ?? 1);
                $price = $r['sale_price'] ?? null;
                $total = $price !== null ? number_format($qty * (float) $price, 2) : '';
                return [
                    $r['description'],
                    $r['renewable_product']['name'] ?? '',
                    $r['client']['name'] ?? '',
                    $r['status'] ?? '',
                    $r['renewable_product']['category'] ?? '',
                    $qty,
                    $price ?? '',
                    $total,
                    substr((string) ($r['next_due_date'] ?? ''), 0, 10),
                ];
            }, $data),
        );
    }

    public function inventorySummary(Request $request): JsonResponse|Response
    {
        $data = $this->reportService->inventorySummary();

        return $this->respondWithFormat($request, $data, 'inventory-summary',
            ['Name', 'SKU', 'On Hand', 'Minimum', 'Allocated', 'Low Stock', 'Location', 'Vendor'],
            fn (array $data): array => array_map(fn ($item) => [
                $item['name'],
                $item['sku'],
                $item['quantity_on_hand'],
                $item['minimum_on_hand'],
                $item['allocated_quantity'],
                $item['is_low_stock'] ? 'Yes' : 'No',
                $item['location'] ?? '',
                $item['vendor'] ?? '',
            ], $data),
        );
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

        return $this->respondWithFormat($request, $data, 'stock-movements',
            ['Item', 'SKU', 'Type', 'Quantity', 'Reason', 'Date'],
            fn (array $data): array => array_map(fn ($t) => [
                $t['inventory_item']['name'] ?? '',
                $t['inventory_item']['sku'] ?? '',
                $t['type'],
                $t['quantity'],
                $t['reason'] ?? '',
                substr((string) $t['created_at'], 0, 10),
            ], $data),
        );
    }

    public function stockAllocations(Request $request): JsonResponse|Response
    {
        $clientId = $request->filled('client_id') ? (int) $request->input('client_id') : null;
        $itemId = $request->filled('item_id') ? (int) $request->input('item_id') : null;
        $status = $request->filled('status') ? (string) $request->input('status') : null;
        $data = $this->reportService->stockAllocationReport($clientId, $itemId, $status);

        return $this->respondWithFormat($request, $data, 'stock-allocations',
            ['Item', 'SKU', 'Client', 'Quantity', 'Unit Price', 'Total', 'Status', 'Notes', 'Date'],
            fn (array $data): array => array_map(fn ($a) => [
                $a['inventory_item']['name'] ?? '',
                $a['inventory_item']['sku'] ?? '',
                $a['client']['name'] ?? '',
                $a['quantity'],
                $a['unit_price'] ?? '',
                $a['unit_price'] ? number_format($a['quantity'] * (float) $a['unit_price'], 2) : '',
                $a['status'],
                $a['notes'] ?? '',
                substr((string) $a['created_at'], 0, 10),
            ], $data),
        );
    }

    public function clientPortfolio(Request $request): JsonResponse|Response
    {
        $request->validate([
            'client_id' => ['required', 'integer'],
        ]);

        $clientId = (int) $request->input('client_id');
        $data = $this->reportService->clientPortfolio($clientId);

        return $this->respondWithFormat($request, $data, 'client-portfolio-' . $clientId,
            ['Type', 'Description / Item', 'Status', 'Date', 'Quantity', 'Unit Price', 'Total'],
            function (array $data): array {
                $rows = [];
                foreach ($data['renewables'] as $r) {
                    $qty = (int) ($r['quantity'] ?? 1);
                    $price = $r['sale_price'] ?? null;
                    $total = $price !== null ? number_format($qty * (float) $price, 2) : '';
                    $rows[] = ['renewable', $r['description'], $r['status'] ?? '', substr((string) ($r['next_due_date'] ?? ''), 0, 10), $qty, $price ?? '', $total];
                }
                foreach ($data['allocations'] as $a) {
                    $total = $a['unit_price'] ? number_format($a['quantity'] * (float) $a['unit_price'], 2) : '';
                    $rows[] = ['allocation', $a['inventory_item']['name'] ?? '', $a['status'], substr((string) $a['created_at'], 0, 10), $a['quantity'], $a['unit_price'] ?? '', $total];
                }
                return $rows;
            },
        );
    }

    public function slaAllocations(Request $request): JsonResponse|Response
    {
        $clientId = $request->integer('client_id') ?: null;
        $status   = $request->input('status') ?: null;

        $data = $this->reportService->slaAllocationReport($clientId, $status);

        return $this->respondWithFormat($request, $data, 'sla-allocations',
            ['SLA Item', 'SLA Group', 'Client', 'Department', 'Quantity', 'Renewal Date', 'Status'],
            fn (array $data): array => array_map(fn ($a) => [
                $a['sla_item']['name'] ?? '',
                $a['sla_item']['sla_group']['name'] ?? '',
                $a['client']['name'] ?? '',
                $a['department']['name'] ?? '',
                $a['quantity'],
                $a['renewal_date'] ? substr((string) $a['renewal_date'], 0, 10) : '',
                $a['status'],
            ], $data),
        );
    }

    public function departmentsReport(Request $request): JsonResponse|Response
    {
        $data = $this->reportService->departmentsReport();

        return $this->respondWithFormat($request, $data, 'departments',
            ['Department', 'Manager', 'Renewal Count'],
            fn (array $data): array => array_map(fn ($d) => [
                $d['name'],
                isset($d['manager']) ? (($d['manager']['first_name'] ?? '') . ' ' . ($d['manager']['last_name'] ?? '')) : '',
                $d['renewables_count'] ?? 0,
            ], $data),
        );
    }

    /**
     * Return JSON or CSV based on the request's `format` parameter.
     *
     * @param list<string> $csvHeaders  Column headers for the CSV output.
     * @param Closure(array): list<list<mixed>> $rowMapper  Converts data into CSV rows.
     */
    private function respondWithFormat(
        Request $request,
        array $data,
        string $csvFilename,
        array $csvHeaders,
        Closure $rowMapper,
    ): JsonResponse|Response {
        if ($request->input('format') === 'csv') {
            $rows = $rowMapper($data);
            $csv = $this->reportService->toCsv($csvHeaders, $rows);
            $filename = $csvFilename . '-' . now()->format('Y-m-d') . '.csv';

            return response($csv, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        return new JsonResponse($data);
    }
}
