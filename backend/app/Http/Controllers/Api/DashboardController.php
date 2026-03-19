<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Renewable;
use App\Models\SlaAllocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'renewal_threshold_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'client_id'              => ['sometimes', 'nullable', 'integer'],
        ]);

        $thresholdDays = (int) $request->integer('renewal_threshold_days', 30);
        $clientId = $request->input('client_id');

        $upcomingQuery = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name', 'department:id,name'])
            ->whereNotNull('next_due_date')
            ->whereDate('next_due_date', '<=', now()->addDays($thresholdDays))
            ->orderBy('next_due_date')
            ->limit(10);

        if ($clientId) {
            $upcomingQuery->where('client_id', (int) $clientId);
        }

        $upcomingRenewals = $upcomingQuery->get();

        $criticalQuery = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name', 'department:id,name'])
            ->whereNotNull('next_due_date')
            ->whereDate('next_due_date', '<=', now()->addDays(7))
            ->whereDate('next_due_date', '>=', now()->subDay())
            ->orderBy('next_due_date')
            ->limit(10);

        if ($clientId) {
            $criticalQuery->where('client_id', (int) $clientId);
        }

        $criticalRenewals = $criticalQuery->get();

        $lowStockItems = InventoryItem::query()
            ->whereColumn('quantity_on_hand', '<', 'minimum_on_hand')
            ->orderByRaw('(minimum_on_hand - quantity_on_hand) desc')
            ->limit(10)
            ->get();

        $slaAllocationQuery = SlaAllocation::query()
            ->with(['slaItem:id,name,sku', 'client:id,name', 'department:id,name'])
            ->where('status', 'active')
            ->whereNotNull('renewal_date')
            ->whereDate('renewal_date', '<=', now()->addDays($thresholdDays))
            ->orderBy('renewal_date')
            ->limit(10);

        if ($clientId) {
            $slaAllocationQuery->where('client_id', (int) $clientId);
        }

        $upcomingSlaAllocations = $slaAllocationQuery->get();

        return new JsonResponse([
            'upcoming_renewals'       => $upcomingRenewals,
            'critical_renewals'       => $criticalRenewals,
            'low_stock_items'         => $lowStockItems,
            'upcoming_sla_allocations' => $upcomingSlaAllocations,
        ]);
    }
}
