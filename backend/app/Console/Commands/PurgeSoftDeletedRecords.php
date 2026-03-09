<?php

namespace App\Console\Commands;

use App\Models\InventoryItem;
use App\Models\Renewal;
use App\Models\Tenant;
use Illuminate\Console\Command;
use function tenancy;

class PurgeSoftDeletedRecords extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:purge-soft-deleted-records';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Purge soft-deleted tenant records older than 30 days';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $cutoff = now()->subDays(30);

        Tenant::query()->cursor()->each(function (Tenant $tenant) use ($cutoff): void {
            tenancy()->initialize($tenant);
            try {
                Renewal::onlyTrashed()->where('deleted_at', '<=', $cutoff)->forceDelete();
                InventoryItem::onlyTrashed()->where('deleted_at', '<=', $cutoff)->forceDelete();
            } finally {
                tenancy()->end();
            }
        });

        $this->info('Soft-deleted records older than 30 days were purged.');

        return self::SUCCESS;
    }
}
