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
    private const ALLOWED_ENTITY_TYPES = ['renewal', 'inventory'];

    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return new JsonResponse([
            'renewals' => Renewal::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'renewals_page'),
            'inventory_items' => InventoryItem::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'inventory_page'),
        ]);
    }

    public function restore(Request $request, string $entityType, int $id): JsonResponse
    {
        if (! in_array($entityType, self::ALLOWED_ENTITY_TYPES, true)) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

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
