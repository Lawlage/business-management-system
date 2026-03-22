<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\AttachmentLink;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    private const ALLOWED_ENTITY_TYPES = ['client_service', 'product', 'inventory', 'client', 'sla_item'];

    private const MAX_FILE_SIZE_KB = 20480; // 20 MB

    private const ALLOWED_MIMES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/zip',
        'application/x-zip-compressed',
    ];

    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request, string $entityType, int $entityId): JsonResponse
    {
        if (! in_array($entityType, self::ALLOWED_ENTITY_TYPES, true)) {
            return new JsonResponse(['message' => 'Invalid entity type.'], 422);
        }

        $links = AttachmentLink::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->with('attachment')
            ->latest()
            ->get();

        $data = $links->map(fn ($link) => [
            'id' => $link->id,
            'attachment_id' => $link->attachment_id,
            'original_name' => $link->attachment->original_name,
            'mime_type' => $link->attachment->mime_type,
            'size' => $link->attachment->size,
            'uploaded_by' => $link->attachment->uploaded_by,
            'created_at' => $link->attachment->created_at,
        ]);

        return new JsonResponse($data);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'max:' . self::MAX_FILE_SIZE_KB,
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,webp,svg,zip',
            ],
            'entity_type' => ['required', 'in:' . implode(',', self::ALLOWED_ENTITY_TYPES)],
            'entity_id' => ['required', 'integer'],
        ]);

        $file = $request->file('file');
        $tenantId = tenancy()->tenant->id;
        $uuid = (string) Str::uuid();
        $extension = $file->getClientOriginalExtension();
        $storagePath = "tenants/{$tenantId}/attachments/{$uuid}.{$extension}";

        Storage::disk('local')->put($storagePath, file_get_contents($file->getRealPath()));

        $attachment = Attachment::query()->create([
            'disk' => 'local',
            'path' => $storagePath,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        $link = AttachmentLink::query()->create([
            'attachment_id' => $attachment->id,
            'entity_type' => $request->input('entity_type'),
            'entity_id' => (int) $request->input('entity_id'),
        ]);

        $this->auditLogger->tenant($request, 'attachment.uploaded', $request->user(), [
            'entity_type' => $request->input('entity_type'),
            'entity_id' => (int) $request->input('entity_id'),
            'file_name' => $attachment->original_name,
        ]);

        return new JsonResponse([
            'id' => $link->id,
            'attachment_id' => $attachment->id,
            'original_name' => $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'size' => $attachment->size,
            'uploaded_by' => $attachment->uploaded_by,
            'created_at' => $attachment->created_at,
        ], 201);
    }

    public function download(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $link = AttachmentLink::query()->with('attachment')->findOrFail($id);
        $attachment = $link->attachment;

        if (! Storage::disk($attachment->disk)->exists($attachment->path)) {
            return new JsonResponse(['message' => 'File not found.'], 404);
        }

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->original_name,
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $link = AttachmentLink::query()->with('attachment')->findOrFail($id);
        $attachment = $link->attachment;
        $fileName = $attachment->original_name;
        $entityType = $link->entity_type;
        $entityId = $link->entity_id;

        // Delete the physical file
        if (Storage::disk($attachment->disk)->exists($attachment->path)) {
            Storage::disk($attachment->disk)->delete($attachment->path);
        }

        // Remove link and attachment record
        $link->delete();
        $attachment->delete();

        $this->auditLogger->tenant($request, 'attachment.deleted', $request->user(), [
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'file_name' => $fileName,
        ]);

        return new JsonResponse(['message' => 'Attachment deleted.']);
    }
}
