<?php

namespace App\Console\Commands;

use App\Models\Renewable;
use App\Models\Tenant;
use App\Services\RenewableStatusService;
use Illuminate\Console\Command;
use function tenancy;

class RefreshRenewableDueDates extends Command
{
    protected $signature = 'app:refresh-renewable-due-dates';

    protected $description = 'Recompute next_due_date and status for all recurring Renewables across all tenants';

    public function __construct(private readonly RenewableStatusService $statusService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        Tenant::query()->cursor()->each(function (Tenant $tenant): void {
            tenancy()->initialize($tenant);
            try {
                Renewable::query()
                    ->with('renewableProduct')
                    ->where(function ($q): void {
                        $q->where('service_type', 'recurring')->orWhereNull('service_type');
                    })
                    ->chunk(200, function ($renewables): void {
                        foreach ($renewables as $renewable) {
                            $computed = $this->statusService->computeForRenewable($renewable);
                            $renewable->update($computed);
                        }
                    });
            } finally {
                tenancy()->end();
            }
        });

        $this->info('Renewable due dates and statuses refreshed.');

        return self::SUCCESS;
    }
}
