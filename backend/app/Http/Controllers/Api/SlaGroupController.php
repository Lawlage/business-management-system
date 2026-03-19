<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SlaGroup;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SlaGroupController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse(
            SlaGroup::query()->with('slaItems:id,sla_group_id,name,sku')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:sla_groups,name'],
        ]);

        $group = SlaGroup::query()->create($payload);

        $this->auditLogger->tenant($request, 'sla_group.created', $request->user(), [
            'entity_type' => 'sla_group',
            'entity_id' => $group->id,
            'entity_title' => $group->name,
        ]);

        return new JsonResponse($group, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $group = SlaGroup::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:sla_groups,name,' . $id],
        ]);

        $group->update($payload);

        $this->auditLogger->tenant($request, 'sla_group.updated', $request->user(), [
            'entity_type' => 'sla_group',
            'entity_id' => $group->id,
            'entity_title' => $group->name,
        ]);

        return new JsonResponse($group);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $group = SlaGroup::query()->findOrFail($id);
        $group->delete();

        $this->auditLogger->tenant($request, 'sla_group.deleted', $request->user(), [
            'entity_type' => 'sla_group',
            'entity_id' => $id,
            'entity_title' => $group->name,
        ]);

        return new JsonResponse(['message' => 'SLA group deleted.']);
    }
}
