<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Renewal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'renewal_threshold_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
        ]);

        $thresholdDays = (int) $request->integer('renewal_threshold_days', 30);

        $importantRenewals = Renewal::query()
            ->whereDate('expiration_date', '<=', now()->addDays($thresholdDays))
            ->orderBy('expiration_date')
            ->limit(10)
            ->get();

        $criticalRenewals = Renewal::query()
            ->whereDate('expiration_date', '<=', now()->addDays(7))
            ->whereDate('expiration_date', '>=', now()->subDay())
            ->orderBy('expiration_date')
            ->limit(10)
            ->get();

        $lowStockItems = InventoryItem::query()
            ->whereColumn('quantity_on_hand', '<', 'minimum_on_hand')
            ->orderByRaw('(minimum_on_hand - quantity_on_hand) desc')
            ->limit(10)
            ->get();

        return new JsonResponse([
            'important_renewals' => $importantRenewals,
            'critical_renewals' => $criticalRenewals,
            'low_stock_items' => $lowStockItems,
        ]);
    }
}
