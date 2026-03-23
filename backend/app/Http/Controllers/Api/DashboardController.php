<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Renewable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'client_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        $clientId = $request->input('client_id');

        $upcomingQuery = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name', 'department:id,name'])
            ->whereIn('status', ['Upcoming', 'Action Required'])
            ->orderBy('next_due_date')
            ->limit(10);

        if ($clientId) {
            $upcomingQuery->where('client_id', (int) $clientId);
        }

        $upcomingRenewals = $upcomingQuery->get();

        $criticalQuery = Renewable::query()
            ->with(['renewableProduct:id,name,category', 'client:id,name', 'department:id,name'])
            ->whereIn('status', ['Urgent', 'Expired'])
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

        return new JsonResponse([
            'upcoming_renewals' => $upcomingRenewals,
            'critical_renewals' => $criticalRenewals,
            'low_stock_items'   => $lowStockItems,
        ]);
    }
}
