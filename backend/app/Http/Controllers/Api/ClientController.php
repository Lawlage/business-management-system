<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\TenantMembership;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Client::query();

        if ($request->filled('search')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->string('search'));
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', '%' . $term . '%')
                    ->orWhere('contact_name', 'like', '%' . $term . '%')
                    ->orWhere('email', 'like', '%' . $term . '%');
            });
        }

        if ($request->boolean('all')) {
            return new JsonResponse($query->orderBy('name')->get(['id', 'name']));
        }

        return new JsonResponse(
            $query->with('accountManager:id,first_name,last_name')->orderBy('name')->paginate(20)
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $client = Client::query()->with('accountManager:id,first_name,last_name')->findOrFail($id);

        return new JsonResponse($client);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'website' => ['nullable', 'url', 'max:255'],
            'notes' => ['nullable', 'string'],
            'account_manager_id' => ['nullable', 'integer'],
        ]);

        if (! empty($payload['account_manager_id'])) {
            $this->validateAccountManager($request, (int) $payload['account_manager_id']);
        }

        $payload['created_by'] = $request->user()->id;
        $payload['updated_by'] = $request->user()->id;

        $client = Client::query()->create($payload);

        $this->auditLogger->tenant($request, 'client.created', $request->user(), [
            'entity_type' => 'client',
            'entity_id' => $client->id,
            'entity_title' => $client->name,
        ]);

        return new JsonResponse($client->load('accountManager:id,first_name,last_name'), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $client = Client::query()->findOrFail($id);

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'website' => ['nullable', 'url', 'max:255'],
            'notes' => ['nullable', 'string'],
            'account_manager_id' => ['nullable', 'integer'],
        ]);

        if (! empty($payload['account_manager_id'])) {
            $this->validateAccountManager($request, (int) $payload['account_manager_id']);
        }

        $payload['updated_by'] = $request->user()->id;

        $client->update($payload);

        $this->auditLogger->tenant($request, 'client.updated', $request->user(), [
            'entity_type' => 'client',
            'entity_id' => $client->id,
            'entity_title' => $client->name,
        ]);

        return new JsonResponse($client->fresh()->load('accountManager:id,first_name,last_name'));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $client = Client::query()->findOrFail($id);
        $client->delete();

        $this->auditLogger->tenant($request, 'client.deleted', $request->user(), [
            'entity_type' => 'client',
            'entity_id' => $client->id,
            'entity_title' => $client->name,
        ]);

        return new JsonResponse(['message' => 'Client moved to recycle bin.']);
    }

    private function validateAccountManager(Request $request, int $userId): void
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        $valid = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('is_account_manager', true)
            ->exists();

        if (! $valid) {
            abort(422, 'Selected account manager is not valid for this tenant.');
        }
    }
}
