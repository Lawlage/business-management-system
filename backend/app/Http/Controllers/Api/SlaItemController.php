<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SlaItem;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SlaItemController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = SlaItem::query()->with('slaGroup:id,name');

        if ($request->filled('search')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where(function ($q) use ($term): void {
                $q->where('name', 'like', '%' . $term . '%')
                    ->orWhere('sku', 'like', '%' . $term . '%');
            });
        }

        return new JsonResponse($query->orderBy('name')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:255', 'unique:sla_items,sku'],
            'tier' => ['nullable', 'string', 'max:100'],
            'response_time' => ['nullable', 'string', 'max:100'],
            'resolution_time' => ['nullable', 'string', 'max:100'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'sla_group_id' => ['nullable', 'integer'],
        ]);

        $payload['cost_price'] = $payload['cost_price'] ?? 0.00;
        $payload['sale_price'] = $payload['sale_price'] ?? 0.00;
        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $item = SlaItem::query()->create($payload);

        $this->auditLogger->tenant($request, 'sla_item.created', $request->user(), [
            'entity_type' => 'sla_item',
            'entity_id' => $item->id,
            'entity_title' => $item->name,
        ]);

        return new JsonResponse($item, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $item = SlaItem::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'tier' => ['nullable', 'string', 'max:100'],
            'response_time' => ['nullable', 'string', 'max:100'],
            'resolution_time' => ['nullable', 'string', 'max:100'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'sla_group_id' => ['nullable', 'integer'],
        ]);

        $payload['updated_by'] = $request->user()->id;
        $item->update($payload);

        $this->auditLogger->tenant($request, 'sla_item.updated', $request->user(), [
            'entity_type' => 'sla_item',
            'entity_id' => $item->id,
            'entity_title' => $item->name,
        ]);

        return new JsonResponse($item->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $item = SlaItem::query()->findOrFail($id);
        $item->delete();

        $this->auditLogger->tenant($request, 'sla_item.deleted', $request->user(), [
            'entity_type' => 'sla_item',
            'entity_id' => $id,
            'entity_title' => $item->name,
        ]);

        return new JsonResponse(['message' => 'SLA item moved to recycle bin.']);
    }
}
