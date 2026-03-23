<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewable;
use App\Models\RenewableProduct;
use App\Services\AuditLogger;
use App\Services\RenewableStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RenewableController extends Controller
{
    public function __construct(
        private readonly RenewableStatusService $statusService,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Renewable::query()
            ->with([
                'renewableProduct:id,name,category,cost_price,sale_price',
                'client:id,name',
                'department:id,name',
            ]);

        if ($request->filled('search')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where(function ($q) use ($term): void {
                $q->where('description', 'like', '%' . $term . '%')
                    ->orWhereHas('client', function ($cq) use ($term): void {
                        $cq->where('name', 'like', '%' . $term . '%');
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('workflow_status')) {
            $query->where('workflow_status', $request->string('workflow_status'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->input('client_id'));
        }

        if ($request->filled('renewable_product_id')) {
            $query->where('renewable_product_id', (int) $request->input('renewable_product_id'));
        }

        if ($request->filled('expiry_preset')) {
            $preset = (string) $request->string('expiry_preset');
            $today = Carbon::today();

            $end = match ($preset) {
                'next_30_days'   => $today->copy()->addDays(30),
                'next_3_months'  => $today->copy()->addMonths(3),
                'next_6_months'  => $today->copy()->addMonths(6),
                'next_12_months' => $today->copy()->addMonths(12),
                'custom'         => $today->copy()->addMonths(max(1, min(60, (int) $request->input('expiry_months', 1)))),
                default          => null,
            };

            if ($end !== null) {
                $query->whereBetween('next_due_date', [$today, $end]);
            }
        }

        // Nulls last so renewables without a schedule appear at the bottom.
        return new JsonResponse(
            $query->orderByRaw('ISNULL(next_due_date), next_due_date ASC')->paginate(20)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'renewable_product_id'   => ['required', 'integer', 'exists:renewable_products,id'],
            'description'            => ['nullable', 'string', 'max:255'],
            'client_id'              => ['required', 'integer'],
            'department_id'          => ['nullable', 'integer'],
            'workflow_status'        => ['nullable', 'string', 'max:100'],
            'sale_price'             => ['nullable', 'numeric', 'min:0'],
            'quantity'               => ['nullable', 'integer', 'min:1', 'max:999999'],
            'price_override'         => ['nullable', 'boolean'],
            'invoice_date'           => ['nullable', 'date'],
            'frequency_type'         => ['nullable', 'string', 'in:days,months,years,day_of_month'],
            'frequency_value'        => ['nullable', 'integer', 'min:1'],
            'frequency_start_date'   => ['nullable', 'date'],
            'service_type'           => ['nullable', 'string', 'in:recurring,one_off'],
            'notes'                  => ['nullable', 'string'],
        ]);

        $product = RenewableProduct::query()->findOrFail($payload['renewable_product_id']);

        // Apply defaults from the product when not explicitly set.
        if (empty($payload['description'])) {
            $payload['description'] = $product->name;
        }

        if (! isset($payload['sale_price'])) {
            $payload['sale_price'] = $product->sale_price !== null ? (float) $product->sale_price : null;
            $payload['price_override'] = false;
        }

        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $renewable = Renewable::query()->create($payload);
        $renewable->setRelation('renewableProduct', $product);

        // Compute and store next_due_date + status.
        $computed = $this->statusService->computeForRenewable($renewable);
        $renewable->update($computed);

        $this->auditLogger->tenant($request, 'renewable.created', $request->user(), [
            'entity_type'  => 'renewable',
            'entity_id'    => $renewable->id,
            'entity_title' => $renewable->description,
        ]);

        return new JsonResponse($renewable->fresh()->load(['renewableProduct:id,name,category,cost_price,sale_price', 'client:id,name', 'department:id,name']), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $renewable = Renewable::query()->with('renewableProduct')->findOrFail($id);

        $payload = $request->validate([
            'renewable_product_id'   => ['sometimes', 'integer', 'exists:renewable_products,id'],
            'description'            => ['nullable', 'string', 'max:255'],
            'client_id'              => ['sometimes', 'integer'],
            'department_id'          => ['nullable', 'integer'],
            'workflow_status'        => ['nullable', 'string', 'max:100'],
            'sale_price'             => ['nullable', 'numeric', 'min:0'],
            'quantity'               => ['sometimes', 'integer', 'min:1', 'max:999999'],
            'price_override'         => ['nullable', 'boolean'],
            'invoice_date'           => ['nullable', 'date'],
            'frequency_type'         => ['nullable', 'string', 'in:days,months,years,day_of_month'],
            'frequency_value'        => ['nullable', 'integer', 'min:1'],
            'frequency_start_date'   => ['nullable', 'date'],
            'service_type'           => ['sometimes', 'nullable', 'string', 'in:recurring,one_off'],
            'notes'                  => ['nullable', 'string'],
        ]);

        $payload['updated_by'] = $request->user()->id;
        $renewable->update($payload);
        $renewable->refresh()->load('renewableProduct');

        // Recompute whenever anything that affects the schedule changes.
        $scheduleFields = ['renewable_product_id', 'frequency_type', 'frequency_value', 'frequency_start_date'];
        if (array_intersect(array_keys($payload), $scheduleFields)) {
            $computed = $this->statusService->computeForRenewable($renewable);
            $renewable->update($computed);
        }

        $this->auditLogger->tenant($request, 'renewable.updated', $request->user(), [
            'entity_type'  => 'renewable',
            'entity_id'    => $renewable->id,
            'entity_title' => $renewable->description,
        ]);

        return new JsonResponse($renewable->fresh()->load(['renewableProduct:id,name,category,cost_price,sale_price', 'client:id,name', 'department:id,name']));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $renewable = Renewable::query()->findOrFail($id);
        $renewable->delete();

        $this->auditLogger->tenant($request, 'renewable.deleted', $request->user(), [
            'entity_type'  => 'renewable',
            'entity_id'    => $id,
            'entity_title' => $renewable->description,
        ]);

        return new JsonResponse(['message' => 'Renewable moved to recycle bin.']);
    }
}
