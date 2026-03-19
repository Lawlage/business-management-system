<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $now = now()->toDateTimeString();

        // Build map: old renewal_id => new renewable_id
        $idMap = [];

        $renewals = DB::table('renewals')->whereNull('deleted_at')->get();
        $deletedRenewals = DB::table('renewals')->whereNotNull('deleted_at')->get();
        $allRenewals = $renewals->merge($deletedRenewals);

        foreach ($allRenewals as $renewal) {
            // Create a RenewableProduct for each renewal (name = title, keep metadata).
            $productId = DB::table('renewable_products')->insertGetId([
                'name'        => $renewal->title,
                'category'    => $renewal->category,
                'vendor'      => $renewal->vendor,
                'cost_price'  => $renewal->cost_price ?? 0.00,
                'notes'       => $renewal->notes,
                'created_by'  => $renewal->created_by,
                'updated_by'  => $renewal->updated_by,
                'created_at'  => $renewal->created_at ?? $now,
                'updated_at'  => $renewal->updated_at ?? $now,
                'deleted_at'  => $renewal->deleted_at,
            ]);

            // Compute status from expiration_date (inline logic; mirrors RenewalStatusService).
            $status = null;
            if ($renewal->expiration_date) {
                $days = Carbon::now()->startOfDay()->diffInDays(
                    Carbon::parse($renewal->expiration_date)->startOfDay(),
                    false
                );
                $status = match (true) {
                    $days < 0  => 'Expired',
                    $days <= 7  => 'Urgent',
                    $days <= 30 => 'Action Required',
                    $days <= 60 => 'Upcoming',
                    default     => 'No action needed',
                };
            }

            // Create the Renewable (client instance).
            $renewableId = DB::table('renewables')->insertGetId([
                'renewable_product_id' => $productId,
                'description'          => $renewal->title,
                'client_id'            => $renewal->client_id,
                'department_id'        => $renewal->department_id,
                'workflow_status'      => $renewal->workflow_status,
                'sale_price'           => $renewal->sale_price,
                'next_due_date'        => $renewal->expiration_date,
                'status'               => $status,
                'created_by'           => $renewal->created_by,
                'updated_by'           => $renewal->updated_by,
                'created_at'           => $renewal->created_at ?? $now,
                'updated_at'           => $renewal->updated_at ?? $now,
                'deleted_at'           => $renewal->deleted_at,
            ]);

            $idMap[$renewal->id] = $renewableId;
        }

        // Update attachment_links: renewal → renewable with new entity_id.
        foreach ($idMap as $oldId => $newId) {
            DB::table('attachment_links')
                ->where('entity_type', 'renewal')
                ->where('entity_id', $oldId)
                ->update(['entity_type' => 'renewable', 'entity_id' => $newId]);
        }

        // Update custom_field_values: renewal → renewable with new entity_id.
        foreach ($idMap as $oldId => $newId) {
            DB::table('custom_field_values')
                ->where('entity_type', 'renewal')
                ->where('entity_id', $oldId)
                ->update(['entity_type' => 'renewable', 'entity_id' => $newId]);
        }

        // Update custom_field_definitions: replace 'renewal' with 'renewable' in JSON arrays.
        DB::table('custom_field_definitions')->get()->each(function ($row) {
            $types = json_decode((string) $row->entity_type, true) ?? [];
            if (in_array('renewal', $types)) {
                $types = array_map(
                    fn ($t) => $t === 'renewal' ? 'renewable' : $t,
                    $types
                );
                DB::table('custom_field_definitions')
                    ->where('id', $row->id)
                    ->update(['entity_type' => json_encode(array_values($types))]);
            }
        });

        // Rename renewals table to renewals_legacy as a safety net.
        Schema::rename('renewals', 'renewals_legacy');
    }

    public function down(): void
    {
        // Restore the renewals table name (data restoration is not attempted).
        if (Schema::hasTable('renewals_legacy') && ! Schema::hasTable('renewals')) {
            Schema::rename('renewals_legacy', 'renewals');
        }
    }
};
