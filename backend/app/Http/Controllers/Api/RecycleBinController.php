<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Renewal;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecycleBinController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse([
            'renewals' => Renewal::onlyTrashed()->orderByDesc('deleted_at')->get(),
            'inventory_items' => InventoryItem::onlyTrashed()->orderByDesc('deleted_at')->get(),
        ]);
    }

    public function restore(Request $request, string $entityType, int $id): JsonResponse
    {
        $model = $entityType === 'renewal' ? Renewal::onlyTrashed() : InventoryItem::onlyTrashed();
        $entity = $model->findOrFail($id);
        $entity->restore();

        $this->auditLogger->tenant($request, 'recycle_bin.restored', $request->user(), [
            'entity_type' => $entityType,
            'entity_id' => $id,
        ]);

        return new JsonResponse(['message' => 'Record restored.']);
    }
}
