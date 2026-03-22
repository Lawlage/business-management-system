<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\CustomFieldDefinition;
use App\Models\InventoryItem;
use App\Models\Renewable;
use App\Models\RenewableProduct;
use App\Models\SlaItem;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecycleBinController extends Controller
{
    private const ALLOWED_ENTITY_TYPES = ['client_service', 'product', 'inventory', 'custom_field', 'client', 'sla_item'];

    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return new JsonResponse([
            'renewables' => Renewable::onlyTrashed()->with('renewableProduct:id,name', 'client:id,name')->orderByDesc('deleted_at')->paginate(20, ['*'], 'renewables_page'),
            'renewable_products' => RenewableProduct::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'renewable_products_page'),
            'inventory_items' => InventoryItem::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'inventory_page'),
            'custom_fields' => CustomFieldDefinition::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'custom_fields_page'),
            'clients' => Client::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'clients_page'),
            'sla_items' => SlaItem::onlyTrashed()->orderByDesc('deleted_at')->paginate(20, ['*'], 'sla_items_page'),
        ]);
    }

    public function restore(Request $request, string $entityType, int $id): JsonResponse
    {
        if (! in_array($entityType, self::ALLOWED_ENTITY_TYPES, true)) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

        $entity = match ($entityType) {
            'client_service' => Renewable::onlyTrashed()->findOrFail($id),
            'product'        => RenewableProduct::onlyTrashed()->findOrFail($id),
            'inventory'      => InventoryItem::onlyTrashed()->findOrFail($id),
            'custom_field'   => CustomFieldDefinition::onlyTrashed()->findOrFail($id),
            'client'         => Client::onlyTrashed()->findOrFail($id),
            'sla_item'       => SlaItem::onlyTrashed()->findOrFail($id),
        };

        $entity->restore();

        $this->auditLogger->tenant($request, 'recycle_bin.restored', $request->user(), [
            'entity_type' => $entityType,
            'entity_id' => $id,
        ]);

        return new JsonResponse(['message' => 'Record restored.']);
    }

    public function forceDelete(Request $request, string $entityType, int $id): JsonResponse
    {
        if (! in_array($entityType, self::ALLOWED_ENTITY_TYPES, true)) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

        $entity = match ($entityType) {
            'client_service' => Renewable::onlyTrashed()->findOrFail($id),
            'product'        => RenewableProduct::onlyTrashed()->findOrFail($id),
            'inventory'      => InventoryItem::onlyTrashed()->findOrFail($id),
            'custom_field'   => CustomFieldDefinition::onlyTrashed()->findOrFail($id),
            'client'         => Client::onlyTrashed()->findOrFail($id),
            'sla_item'       => SlaItem::onlyTrashed()->findOrFail($id),
        };

        $entity->forceDelete();

        $this->auditLogger->tenant($request, 'recycle_bin.permanently_deleted', $request->user(), [
            'entity_type' => $entityType,
            'entity_id' => $id,
        ]);

        return new JsonResponse(['message' => 'Record permanently deleted.']);
    }
}
