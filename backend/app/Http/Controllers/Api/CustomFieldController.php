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
            $query->whereJsonContains('entity_type', $entityType);
        }

        return new JsonResponse($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'entity_type'     => ['required', 'array', 'min:1'],
            'entity_type.*'   => ['required', 'string', 'in:renewal,inventory,sla_item'],
            'name'            => ['required', 'string', 'max:255'],
            'key'             => ['required', 'string', 'max:255', 'alpha_dash'],
            'field_type'      => ['required', 'in:text,number,date,boolean,json,currency,dropdown'],
            'is_required'     => ['required', 'boolean'],
            'validation_rules' => ['nullable', 'array'],
            'dropdown_options' => ['nullable', 'array'],
            'dropdown_options.*' => ['string', 'max:255'],
        ]);

        if (($payload['field_type'] ?? '') === 'dropdown' && empty($payload['dropdown_options'])) {
            return new JsonResponse(['message' => 'Dropdown fields require at least one option.'], 422);
        }

        if (($payload['field_type'] ?? '') !== 'dropdown') {
            $payload['dropdown_options'] = null;
        }

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
            'name'            => ['required', 'string', 'max:255'],
            'entity_type'     => ['required', 'array', 'min:1'],
            'entity_type.*'   => ['required', 'string', 'in:renewal,inventory,sla_item'],
            'dropdown_options' => ['nullable', 'array'],
            'dropdown_options.*' => ['string', 'max:255'],
        ]);

        if ($field->field_type === 'dropdown' && array_key_exists('dropdown_options', $payload) && empty($payload['dropdown_options'])) {
            return new JsonResponse(['message' => 'Dropdown fields require at least one option.'], 422);
        }

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
