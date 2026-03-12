<?php

namespace App\Services;

use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\Renewal;
use App\Models\StockAllocation;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    /**
     * Summary of renewals grouped by status.
     */
    public function renewalStatusSummary(): array
    {
        $renewals = Renewal::query()
            ->with('client:id,name')
            ->orderByRaw("FIELD(status, 'Urgent', 'Action Required', 'Upcoming', 'No action needed', 'Expired')")
            ->orderBy('expiration_date')
            ->get();

        $grouped = $renewals->groupBy('status');

        return $grouped->map(fn (Collection $items, string $status) => [
            'status' => $status,
            'count' => $items->count(),
            'renewals' => $items->values(),
        ])->values()->toArray();
    }

    /**
     * Renewals grouped by client.
     */
    public function renewalsByClient(?int $clientId = null): array
    {
        $query = Renewal::query()
            ->with('client:id,name')
            ->orderBy('expiration_date');

        if ($clientId !== null) {
            $query->where('client_id', $clientId);
        }

        $renewals = $query->get();

        $grouped = $renewals->groupBy(fn ($r) => $r->client_id ?? 0);

        return $grouped->map(function (Collection $items, int $clientId) {
            $client = $clientId ? $items->first()->client : null;
            return [
                'client_id' => $clientId ?: null,
                'client_name' => $client?->name ?? '(No Client)',
                'count' => $items->count(),
                'renewals' => $items->values(),
            ];
        })->sortBy('client_name')->values()->toArray();
    }

    /**
     * Renewals expiring within the given date range.
     */
    public function renewalsExpiring(Carbon $from, Carbon $to): array
    {
        return Renewal::query()
            ->with('client:id,name')
            ->whereBetween('expiration_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('expiration_date')
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
     * Full portfolio for a single client: their renewals + allocations.
     */
    public function clientPortfolio(int $clientId): array
    {
        $client = Client::query()->findOrFail($clientId);

        $renewals = Renewal::query()
            ->where('client_id', $clientId)
            ->orderBy('expiration_date')
            ->get();

        $allocations = StockAllocation::query()
            ->with('inventoryItem:id,name,sku')
            ->where('client_id', $clientId)
            ->orderByDesc('created_at')
            ->get();

        $activeAllocatedQty = $allocations->where('status', 'allocated')->sum('quantity');

        return [
            'client' => $client,
            'renewals' => $renewals->toArray(),
            'allocations' => $allocations->toArray(),
            'renewal_count' => $renewals->count(),
            'allocation_count' => $allocations->count(),
            'active_allocated_quantity' => (int) $activeAllocatedQty,
        ];
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
