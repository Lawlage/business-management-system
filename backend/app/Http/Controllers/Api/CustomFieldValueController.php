<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomFieldDefinition;
use App\Models\CustomFieldValue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomFieldValueController extends Controller
{
    public function index(Request $request, string $entityType, int $entityId): JsonResponse
    {
        if (!in_array($entityType, ['renewal', 'inventory'])) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

        $values = CustomFieldValue::query()
            ->with('definition')
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->get();

        $result = $values->map(fn ($v) => [
            'definition_id' => $v->custom_field_definition_id,
            'value' => $this->resolveValue($v),
        ]);

        return new JsonResponse($result);
    }

    public function upsert(Request $request, string $entityType, int $entityId): JsonResponse
    {
        if (!in_array($entityType, ['renewal', 'inventory'])) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

        $payload = $request->validate([
            'values' => ['required', 'array'],
            'values.*' => ['nullable'],
        ]);

        $definitions = CustomFieldDefinition::query()
            ->whereIn('entity_type', [$entityType, 'both'])
            ->get()
            ->keyBy('id');

        foreach ($payload['values'] as $definitionId => $value) {
            $definitionId = (int) $definitionId;

            if (!$definitions->has($definitionId)) {
                continue;
            }

            $definition = $definitions->get($definitionId);
            $column = $this->columnForType($definition->field_type);

            if ($value === null || $value === '') {
                CustomFieldValue::query()
                    ->where('custom_field_definition_id', $definitionId)
                    ->where('entity_type', $entityType)
                    ->where('entity_id', $entityId)
                    ->delete();
            } else {
                CustomFieldValue::query()->updateOrCreate(
                    [
                        'custom_field_definition_id' => $definitionId,
                        'entity_type' => $entityType,
                        'entity_id' => $entityId,
                    ],
                    [$column => $value],
                );
            }
        }

        return new JsonResponse(['message' => 'Values saved.']);
    }

    private function resolveValue(CustomFieldValue $cfv): mixed
    {
        $type = $cfv->definition->field_type;

        return match ($type) {
            'number', 'currency' => $cfv->value_number !== null ? (float) $cfv->value_number : null,
            'boolean' => $cfv->value_boolean,
            'date' => $cfv->value_date?->toDateString(),
            'json' => $cfv->value_json,
            default => $cfv->value_string,
        };
    }

    private function columnForType(string $fieldType): string
    {
        return match ($fieldType) {
            'number', 'currency' => 'value_number',
            'boolean' => 'value_boolean',
            'date' => 'value_date',
            'json' => 'value_json',
            default => 'value_string',
        };
    }
}
