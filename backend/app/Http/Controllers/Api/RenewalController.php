<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewal;
use App\Services\AuditLogger;
use App\Services\RenewableStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RenewalController extends Controller
{
    public function __construct(
        private readonly RenewableStatusService $statusService,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Renewal::query()->with('client:id,name');

        if ($request->filled('search')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', '%' . $term . '%')
                    ->orWhereHas('client', function ($cq) use ($term) {
                        $cq->where('name', 'like', '%' . $term . '%');
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('workflow_status')) {
            $query->where('workflow_status', $request->string('workflow_status'));
        }

        if ($request->has('auto_renews') && $request->input('auto_renews') !== '' && $request->input('auto_renews') !== null) {
            $query->where('auto_renews', $request->input('auto_renews') === '1');
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->input('client_id'));
        }

        if ($request->filled('expiry_preset')) {
            $preset = (string) $request->string('expiry_preset');
            $today = Carbon::today();

            $end = match ($preset) {
                'next_30_days' => $today->copy()->addDays(30),
                'next_3_months' => $today->copy()->addMonths(3),
                'next_6_months' => $today->copy()->addMonths(6),
                'next_12_months' => $today->copy()->addMonths(12),
                'custom' => $today->copy()->addMonths(max(1, min(60, (int) $request->input('expiry_months', 1)))),
                default => null,
            };

            if ($end !== null) {
                $query->whereBetween('expiration_date', [$today, $end]);
            }
        }

        return new JsonResponse($query->orderBy('expiration_date')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'client_id' => ['required', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'category' => ['required', 'string', 'max:255'],
            'owner' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'renewal_date' => ['nullable', 'date'],
            'expiration_date' => ['required', 'date'],
            'workflow_status' => ['nullable', 'string', 'max:255'],
            'auto_renews' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $payload['auto_renews'] = (bool) ($payload['auto_renews'] ?? false);

        $payload['status'] = $this->statusService->statusFromNextDueDate(
            Carbon::parse($payload['expiration_date']),
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
            'client_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'category' => ['sometimes', 'string', 'max:255'],
            'owner' => ['nullable', 'string', 'max:255'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'renewal_date' => ['nullable', 'date'],
            'expiration_date' => ['sometimes', 'date'],
            'workflow_status' => ['nullable', 'string', 'max:255'],
            'auto_renews' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (isset($payload['expiration_date']) || array_key_exists('workflow_status', $payload) || array_key_exists('auto_renews', $payload)) {
            $expirationDate = Carbon::parse($payload['expiration_date'] ?? $renewal->expiration_date);
            $payload['status'] = $this->statusService->statusFromNextDueDate($expirationDate);
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
