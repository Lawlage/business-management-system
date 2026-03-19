<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Department;
use App\Models\InventoryItem;
use App\Models\Renewable;
use App\Models\SlaAllocation;
use App\Models\StockAllocation;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    /**
     * Summary of renewables grouped by status.
     */
    public function renewalStatusSummary(): array
    {
        $renewables = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name'])
            ->orderByRaw("FIELD(status, 'Urgent', 'Action Required', 'Upcoming', 'No action needed', 'Expired')")
            ->orderByRaw('ISNULL(next_due_date), next_due_date ASC')
            ->get();

        $grouped = $renewables->groupBy(fn ($r) => $r->status ?? 'No status');

        return $grouped->map(fn (Collection $items, string $status) => [
            'status'     => $status,
            'count'      => $items->count(),
            'renewables' => $items->values(),
        ])->values()->toArray();
    }

    /**
     * Renewables grouped by client.
     */
    public function renewalsByClient(?int $clientId = null): array
    {
        $query = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name'])
            ->orderByRaw('ISNULL(next_due_date), next_due_date ASC');

        if ($clientId !== null) {
            $query->where('client_id', $clientId);
        }

        $renewables = $query->get();

        $grouped = $renewables->groupBy(fn ($r) => $r->client_id ?? 0);

        return $grouped->map(function (Collection $items, int $clientId) {
            $client = $clientId ? $items->first()->client : null;
            return [
                'client_id'   => $clientId ?: null,
                'client_name' => $client?->name ?? '(No Client)',
                'count'       => $items->count(),
                'renewables'  => $items->values(),
            ];
        })->sortBy('client_name')->values()->toArray();
    }

    /**
     * Renewables with a next_due_date within the given date range.
     */
    public function renewalsExpiring(Carbon $from, Carbon $to): array
    {
        return Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name'])
            ->whereBetween('next_due_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('next_due_date')
            ->get()
            ->toArray();
    }

    /**
     * All inventory items with allocation totals.
     */
    public function inventorySummary(): array
    {
        $items = InventoryItem::query()->get();

        $allocatedQtys = StockAllocation::query()
            ->where('status', 'allocated')
            ->selectRaw('inventory_item_id, SUM(quantity) as total_allocated')
            ->groupBy('inventory_item_id')
            ->pluck('total_allocated', 'inventory_item_id');

        return $items->map(function (InventoryItem $item) use ($allocatedQtys) {
            $allocated = (int) ($allocatedQtys[$item->id] ?? 0);
            return [
                'id' => $item->id,
                'name' => $item->name,
                'sku' => $item->sku,
                'quantity_on_hand' => $item->quantity_on_hand,
                'minimum_on_hand' => $item->minimum_on_hand,
                'allocated_quantity' => $allocated,
                'is_low_stock' => $item->quantity_on_hand < $item->minimum_on_hand,
                'location' => $item->location,
                'vendor' => $item->vendor,
            ];
        })->sortBy('name')->values()->toArray();
    }

    /**
     * Stock movement (transaction) history for a date range.
     */
    public function stockMovementHistory(Carbon $from, Carbon $to, ?int $itemId = null): array
    {
        $query = StockTransaction::query()
            ->with('inventoryItem:id,name,sku')
            ->whereBetween('created_at', [$from->startOfDay(), $to->endOfDay()])
            ->orderByDesc('created_at');

        if ($itemId !== null) {
            $query->where('inventory_item_id', $itemId);
        }

        return $query->get()->toArray();
    }

    /**
     * Stock allocation history, optionally filtered by client or item.
     */
    public function stockAllocationReport(?int $clientId = null, ?int $itemId = null, ?string $status = null): array
    {
        $query = StockAllocation::query()
            ->with(['inventoryItem:id,name,sku', 'client:id,name'])
            ->orderByDesc('created_at');

        if ($clientId !== null) {
            $query->where('client_id', $clientId);
        }

        if ($itemId !== null) {
            $query->where('inventory_item_id', $itemId);
        }

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->get()->toArray();
    }

    /**
     * Full portfolio for a single client: their renewables + allocations.
     */
    public function clientPortfolio(int $clientId): array
    {
        $client = Client::query()->findOrFail($clientId);

        $renewables = Renewable::query()
            ->with('renewableProduct:id,name,category')
            ->where('client_id', $clientId)
            ->orderByRaw('ISNULL(next_due_date), next_due_date ASC')
            ->get();

        $allocations = StockAllocation::query()
            ->with('inventoryItem:id,name,sku')
            ->where('client_id', $clientId)
            ->orderByDesc('created_at')
            ->get();

        $activeAllocatedQty = $allocations->where('status', 'allocated')->sum('quantity');

        return [
            'client'                   => $client,
            'renewables'               => $renewables->toArray(),
            'allocations'              => $allocations->toArray(),
            'renewable_count'          => $renewables->count(),
            'allocation_count'         => $allocations->count(),
            'active_allocated_quantity' => (int) $activeAllocatedQty,
        ];
    }

    /**
     * SLA allocations report — optionally filtered by client or status.
     */
    public function slaAllocationReport(?int $clientId = null, ?string $status = null): array
    {
        $query = SlaAllocation::query()
            ->with([
                'slaItem:id,name,sku,sla_group_id',
                'slaItem.slaGroup:id,name',
                'client:id,name',
                'department:id,name',
            ])
            ->orderByDesc('created_at');

        if ($clientId !== null) {
            $query->where('client_id', $clientId);
        }

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->get()->toArray();
    }

    /**
     * Departments report — lists departments with manager and renewable counts.
     */
    public function departmentsReport(): array
    {
        return Department::query()
            ->with('manager:id,first_name,last_name')
            ->withCount('renewables')
            ->orderBy('name')
            ->get()
            ->toArray();
    }

    /**
     * Convert data to CSV string.
     *
     * @param list<string> $headers
     * @param list<list<string|int|float|null>> $rows
     */
    public function toCsv(array $headers, array $rows): string
    {
        $output = fopen('php://temp', 'r+');
        fputcsv($output, $headers);
        foreach ($rows as $row) {
            // Sanitise cells to prevent CSV formula injection
            $safe = array_map(function ($cell): string {
                $str = (string) ($cell ?? '');
                if ($str !== '' && in_array($str[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
                    $str = "'" . $str;
                }
                return $str;
            }, $row);
            fputcsv($output, $safe);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);
        return $csv !== false ? $csv : '';
    }
}
