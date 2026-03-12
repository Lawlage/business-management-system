<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomFieldDefinition;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomFieldController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = CustomFieldDefinition::query();

        if ($request->has('entity_type')) {
            $entityType = (string) $request->query('entity_type');
            $query->whereIn('entity_type', [$entityType, 'both']);
        }

        return new JsonResponse($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'entity_type' => ['required', 'in:renewal,inventory,both'],
            'name' => ['required', 'string', 'max:255'],
            'key' => ['required', 'string', 'max:255', 'alpha_dash'],
            'field_type' => ['required', 'in:text,number,date,boolean,json,currency'],
            'is_required' => ['required', 'boolean'],
            'validation_rules' => ['nullable', 'array'],
        ]);

        $field = CustomFieldDefinition::query()->create($payload);

        $this->auditLogger->tenant($request, 'custom_field.created', $request->user(), [
            'entity_type' => 'custom_field',
            'entity_id' => $field->id,
        ]);

        return new JsonResponse($field, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $field = CustomFieldDefinition::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'entity_type' => ['required', 'in:renewal,inventory,both'],
        ]);

        $field->update($payload);

        $this->auditLogger->tenant($request, 'custom_field.updated', $request->user(), [
            'entity_type' => 'custom_field',
            'entity_id' => $field->id,
            'entity_title' => $field->name,
        ]);

        return new JsonResponse($field->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $field = CustomFieldDefinition::query()->findOrFail($id);
        $field->delete();

        $this->auditLogger->tenant($request, 'custom_field.deleted', $request->user(), [
            'entity_type' => 'custom_field',
            'entity_id' => $id,
            'entity_title' => $field->name,
        ]);

        return new JsonResponse(['message' => 'Custom field moved to recycle bin.']);
    }
}
