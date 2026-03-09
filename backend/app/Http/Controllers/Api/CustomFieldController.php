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
        $entityType = (string) $request->query('entity_type', 'renewal');

        return new JsonResponse(CustomFieldDefinition::query()->where('entity_type', $entityType)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'entity_type' => ['required', 'in:renewal,inventory'],
            'name' => ['required', 'string', 'max:255'],
            'key' => ['required', 'string', 'max:255', 'alpha_dash'],
            'field_type' => ['required', 'in:text,number,date,boolean,json'],
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

    public function destroy(Request $request, int $id): JsonResponse
    {
        $field = CustomFieldDefinition::query()->findOrFail($id);
        $field->delete();

        $this->auditLogger->tenant($request, 'custom_field.deleted', $request->user(), [
            'entity_type' => 'custom_field',
            'entity_id' => $id,
        ]);

        return new JsonResponse(['message' => 'Custom field deleted.']);
    }
}
