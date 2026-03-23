<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse(
            Department::query()->with('manager:id,first_name,last_name')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name'       => ['required', 'string', 'max:150', 'unique:departments,name'],
            'manager_id' => ['nullable', 'integer'],
        ]);

        $department = Department::query()->create($payload);

        $this->auditLogger->tenant($request, 'department.created', $request->user(), [
            'entity_type' => 'department',
            'entity_id' => $department->id,
            'entity_title' => $department->name,
        ]);

        return new JsonResponse($department->fresh()->load('manager:id,first_name,last_name'), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $department = Department::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:departments,name,' . $id],
            'manager_id' => ['nullable', 'integer'],
        ]);

        $department->update($payload);

        $this->auditLogger->tenant($request, 'department.updated', $request->user(), [
            'entity_type' => 'department',
            'entity_id' => $department->id,
            'entity_title' => $department->name,
        ]);

        return new JsonResponse($department->fresh()->load('manager:id,first_name,last_name'));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $department = Department::query()->findOrFail($id);
        $department->delete();

        $this->auditLogger->tenant($request, 'department.deleted', $request->user(), [
            'entity_type' => 'department',
            'entity_id' => $id,
            'entity_title' => $department->name,
        ]);

        return new JsonResponse(['message' => 'Department deleted.']);
    }
}
