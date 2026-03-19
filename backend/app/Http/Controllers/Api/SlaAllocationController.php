<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\SlaAllocation;
use App\Models\SlaItem;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SlaAllocationController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = SlaAllocation::query()
            ->with(['slaItem:id,name,sku', 'client:id,name', 'department:id,name'])
            ->latest();

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->input('client_id'));
        }

        if ($request->filled('sla_item_id')) {
            $query->where('sla_item_id', (int) $request->input('sla_item_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return new JsonResponse($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'sla_item_id' => ['required', 'integer'],
            'client_id' => ['required', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'renewal_date' => ['nullable', 'date'],
        ]);

        $slaItem = SlaItem::query()->findOrFail((int) $payload['sla_item_id']);
        $client = Client::query()->findOrFail((int) $payload['client_id']);

        $allocation = SlaAllocation::query()->create([
            'sla_item_id' => $slaItem->id,
            'client_id' => $client->id,
            'department_id' => isset($payload['department_id']) ? (int) $payload['department_id'] : null,
            'quantity' => (int) $payload['quantity'],
            'unit_price' => $payload['unit_price'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'renewal_date' => $payload['renewal_date'] ?? null,
            'status' => 'active',
            'allocated_by' => $request->user()->id,
        ]);

        $this->auditLogger->tenant($request, 'sla_allocation.created', $request->user(), [
            'entity_type' => 'sla_allocation',
            'entity_id' => $allocation->id,
            'entity_title' => $slaItem->name . ' → ' . $client->name,
            'quantity' => (int) $payload['quantity'],
        ]);

        return new JsonResponse(
            $allocation->load(['slaItem:id,name,sku', 'client:id,name', 'department:id,name']),
            201,
        );
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $allocation = SlaAllocation::query()->findOrFail($id);

        if ($allocation->status !== 'active') {
            return new JsonResponse(['message' => 'Allocation is not active.'], 422);
        }

        $allocation->update([
            'status' => 'cancelled',
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
        ]);

        $this->auditLogger->tenant($request, 'sla_allocation.cancelled', $request->user(), [
            'entity_type' => 'sla_allocation',
            'entity_id' => $allocation->id,
        ]);

        return new JsonResponse(
            $allocation->fresh()->load(['slaItem:id,name,sku', 'client:id,name', 'department:id,name']),
        );
    }
}
