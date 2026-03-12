<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewal;
use App\Services\AuditLogger;
use App\Services\RenewalStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RenewalController extends Controller
{
    public function __construct(
        private readonly RenewalStatusService $statusService,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Renewal::query();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            // Escape LIKE metacharacters so users searching for '%' or '_' are treated literally.
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where('title', 'like', '%' . $term . '%');
        }

        return new JsonResponse($query->orderBy('expiration_date')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:255'],
            'owner' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'renewal_date' => ['nullable', 'date'],
            'expiration_date' => ['required', 'date'],
            'workflow_status' => ['nullable', 'string', 'max:255'],
            'auto_renews' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        $payload['auto_renews'] = (bool) ($payload['auto_renews'] ?? false);

        $payload['status'] = $this->statusService->fromExpiration(
            Carbon::parse($payload['expiration_date']),
            $payload['workflow_status'] ?? null,
        );
        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $renewal = Renewal::query()->create($payload);

        $this->auditLogger->tenant($request, 'renewal.created', $request->user(), [
            'entity_type' => 'renewal',
            'entity_id' => $renewal->id,
            'entity_title' => $renewal->title,
        ]);

        return new JsonResponse($renewal, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $renewal = Renewal::query()->findOrFail($id);

        $payload = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'string', 'max:255'],
            'owner' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'renewal_date' => ['nullable', 'date'],
            'expiration_date' => ['sometimes', 'date'],
            'workflow_status' => ['nullable', 'string', 'max:255'],
            'auto_renews' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        if (isset($payload['expiration_date']) || array_key_exists('workflow_status', $payload)) {
            $expirationDate = Carbon::parse($payload['expiration_date'] ?? $renewal->expiration_date);
            $workflowStatus = array_key_exists('workflow_status', $payload)
                ? $payload['workflow_status']
                : $renewal->workflow_status;
            $payload['status'] = $this->statusService->fromExpiration($expirationDate, $workflowStatus);
        }

        $payload['updated_by'] = $request->user()->id;

        $renewal->update($payload);

        $this->auditLogger->tenant($request, 'renewal.updated', $request->user(), [
            'entity_type' => 'renewal',
            'entity_id' => $renewal->id,
            'entity_title' => $renewal->title,
        ]);

        return new JsonResponse($renewal->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $renewal = Renewal::query()->findOrFail($id);
        $renewal->delete();

        $this->auditLogger->tenant($request, 'renewal.deleted', $request->user(), [
            'entity_type' => 'renewal',
            'entity_id' => $renewal->id,
            'entity_title' => $renewal->title,
        ]);

        return new JsonResponse(['message' => 'Renewal moved to recycle bin.']);
    }
}
