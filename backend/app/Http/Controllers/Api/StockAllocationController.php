<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\StockAllocation;
use App\Models\StockTransaction;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAllocationController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = StockAllocation::query()
            ->with(['inventoryItem:id,name,sku', 'client:id,name'])
            ->latest();

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->input('client_id'));
        }

        if ($request->filled('inventory_item_id')) {
            $query->where('inventory_item_id', (int) $request->input('inventory_item_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return new JsonResponse($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'inventory_item_id' => ['required', 'integer'],
            'client_id' => ['required', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $item = InventoryItem::query()->findOrFail((int) $payload['inventory_item_id']);
        $client = Client::query()->findOrFail((int) $payload['client_id']);
        $quantity = (int) $payload['quantity'];

        $allocation = DB::transaction(function () use ($request, $item, $client, $payload, $quantity): StockAllocation {
            // Re-fetch with lock to prevent race condition
            $item = InventoryItem::query()->lockForUpdate()->findOrFail($item->id);

            if ($item->quantity_on_hand < $quantity) {
                abort(422, 'Insufficient stock. Available: ' . $item->quantity_on_hand);
            }

            $item->update([
                'quantity_on_hand' => $item->quantity_on_hand - $quantity,
                'updated_by' => $request->user()->id,
            ]);

            StockTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'allocation',
                'quantity' => $quantity,
                'reason' => 'Allocated to client: ' . $client->name,
                'performed_by' => $request->user()->id,
            ]);

            return StockAllocation::query()->create([
                'inventory_item_id' => $item->id,
                'client_id' => $client->id,
                'department_id' => isset($payload['department_id']) ? (int) $payload['department_id'] : null,
                'quantity' => $quantity,
                'unit_price' => $payload['unit_price'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'status' => 'allocated',
                'allocated_by' => $request->user()->id,
            ]);
        });

        $this->auditLogger->tenant($request, 'stock_allocation.created', $request->user(), [
            'entity_type' => 'stock_allocation',
            'entity_id' => $allocation->id,
            'entity_title' => $item->name . ' → ' . $client->name,
            'quantity' => $quantity,
        ]);

        return new JsonResponse(
            $allocation->load(['inventoryItem:id,name,sku', 'client:id,name']),
            201,
        );
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $allocation = StockAllocation::query()->findOrFail($id);

        if ($allocation->status !== 'allocated') {
            return new JsonResponse(['message' => 'Allocation is not active.'], 422);
        }

        DB::transaction(function () use ($request, $allocation): void {
            $item = InventoryItem::query()->lockForUpdate()->findOrFail($allocation->inventory_item_id);

            $item->update([
                'quantity_on_hand' => $item->quantity_on_hand + $allocation->quantity,
                'updated_by' => $request->user()->id,
            ]);

            StockTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'allocation_cancelled',
                'quantity' => $allocation->quantity,
                'reason' => 'Allocation #' . $allocation->id . ' cancelled',
                'performed_by' => $request->user()->id,
            ]);

            $allocation->update([
                'status' => 'cancelled',
                'cancelled_by' => $request->user()->id,
                'cancelled_at' => now(),
            ]);
        });

        $this->auditLogger->tenant($request, 'stock_allocation.cancelled', $request->user(), [
            'entity_type' => 'stock_allocation',
            'entity_id' => $allocation->id,
        ]);

        return new JsonResponse(
            $allocation->fresh()->load(['inventoryItem:id,name,sku', 'client:id,name']),
        );
    }
}
