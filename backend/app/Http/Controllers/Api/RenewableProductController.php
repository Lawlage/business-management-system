<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewable;
use App\Models\RenewableProduct;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RenewableProductController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = RenewableProduct::query()->withCount('renewables');

        if ($request->filled('search')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where(function ($q) use ($term): void {
                $q->where('name', 'like', '%' . $term . '%')
                    ->orWhere('vendor', 'like', '%' . $term . '%');
            });
        }

        return new JsonResponse($query->with('department:id,name')->orderBy('name')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'category'        => ['nullable', 'string', 'max:100'],
            'vendor'          => ['nullable', 'string', 'max:255'],
            'department_id'   => ['nullable', 'integer', 'exists:departments,id'],
            'cost_price'      => ['nullable', 'numeric', 'min:0'],
            'sale_price'      => ['nullable', 'numeric', 'min:0'],
            'frequency_type'  => ['nullable', 'string', 'in:days,months,years'],
            'frequency_value' => ['nullable', 'integer', 'min:1'],
            'notes'           => ['nullable', 'string'],
        ]);

        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $product = RenewableProduct::query()->create($payload);

        $this->auditLogger->tenant($request, 'renewable_product.created', $request->user(), [
            'entity_type'  => 'renewable_product',
            'entity_id'    => $product->id,
            'entity_title' => $product->name,
        ]);

        return new JsonResponse($product->fresh()->load('department:id,name'), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = RenewableProduct::query()->findOrFail($id);

        $payload = $request->validate([
            'name'            => ['sometimes', 'string', 'max:255'],
            'category'        => ['nullable', 'string', 'max:100'],
            'vendor'          => ['nullable', 'string', 'max:255'],
            'department_id'   => ['nullable', 'integer', 'exists:departments,id'],
            'cost_price'      => ['nullable', 'numeric', 'min:0'],
            'sale_price'      => ['nullable', 'numeric', 'min:0'],
            'frequency_type'  => ['nullable', 'string', 'in:days,months,years'],
            'frequency_value' => ['nullable', 'integer', 'min:1'],
            'notes'           => ['nullable', 'string'],
        ]);

        $salePriceChanged = array_key_exists('sale_price', $payload)
            && (string) $payload['sale_price'] !== (string) $product->sale_price;

        $payload['updated_by'] = $request->user()->id;
        $product->update($payload);

        $this->auditLogger->tenant($request, 'renewable_product.updated', $request->user(), [
            'entity_type'  => 'renewable_product',
            'entity_id'    => $product->id,
            'entity_title' => $product->name,
        ]);

        $skippedCount = 0;
        if ($salePriceChanged) {
            $skippedCount = Renewable::query()
                ->where('renewable_product_id', $product->id)
                ->where('price_override', true)
                ->count();

            Renewable::query()
                ->where('renewable_product_id', $product->id)
                ->where('price_override', false)
                ->update(['sale_price' => $payload['sale_price']]);
        }

        return new JsonResponse(array_merge(
            $product->fresh()->load('department:id,name')->toArray(),
            ['skipped_count' => $skippedCount]
        ));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = RenewableProduct::query()->findOrFail($id);
        $product->delete();

        $this->auditLogger->tenant($request, 'renewable_product.deleted', $request->user(), [
            'entity_type'  => 'renewable_product',
            'entity_id'    => $id,
            'entity_title' => $product->name,
        ]);

        return new JsonResponse(['message' => 'Renewable product moved to recycle bin.']);
    }
}
