<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\StockTransaction;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse(InventoryItem::query()->orderBy('name')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:255', 'unique:inventory_items,sku'],
            'classification' => ['nullable', 'string', 'max:255'],
            'quantity_on_hand' => ['required', 'integer', 'min:0'],
            'minimum_on_hand' => ['required', 'integer', 'min:0'],
            'location' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'linked_renewal_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $item = InventoryItem::query()->create($payload);

        $this->auditLogger->tenant($request, 'inventory.created', $request->user(), [
            'entity_type' => 'inventory',
            'entity_id' => $item->id,
        ]);

        return new JsonResponse($item, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'classification' => ['nullable', 'string', 'max:255'],
            'quantity_on_hand' => ['sometimes', 'integer', 'min:0'],
            'minimum_on_hand' => ['sometimes', 'integer', 'min:0'],
            'location' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'linked_renewal_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        $payload['updated_by'] = $request->user()->id;
        $item->update($payload);

        $this->auditLogger->tenant($request, 'inventory.updated', $request->user(), [
            'entity_type' => 'inventory',
            'entity_id' => $item->id,
        ]);

        return new JsonResponse($item->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);
        $item->delete();

        $this->auditLogger->tenant($request, 'inventory.deleted', $request->user(), [
            'entity_type' => 'inventory',
            'entity_id' => $item->id,
        ]);

        return new JsonResponse(['message' => 'Inventory item moved to recycle bin.']);
    }

    public function adjustStock(Request $request, int $id): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);

        $payload = $request->validate([
            'type' => ['required', 'in:check_in,check_out'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        $quantity = (int) $payload['quantity'];
        $delta = $payload['type'] === 'check_out' ? -1 * $quantity : $quantity;
        $nextQuantity = $item->quantity_on_hand + $delta;

        if ($nextQuantity < 0) {
            return new JsonResponse(['message' => 'Insufficient stock.'], 422);
        }

        $item->update([
            'quantity_on_hand' => $nextQuantity,
            'updated_by' => $request->user()->id,
        ]);

        StockTransaction::query()->create([
            'inventory_item_id' => $item->id,
            'type' => $payload['type'],
            'quantity' => $quantity,
            'reason' => $payload['reason'] ?? null,
            'performed_by' => $request->user()->id,
        ]);

        $this->auditLogger->tenant($request, 'inventory.stock_adjusted', $request->user(), [
            'entity_type' => 'inventory',
            'entity_id' => $item->id,
            'type' => $payload['type'],
            'quantity' => $quantity,
        ]);

        return new JsonResponse($item->fresh());
    }
}
