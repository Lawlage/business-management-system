<?php

namespace Tests\Unit;

use App\Services\RenewalStatusService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class RenewalStatusServiceTest extends TestCase
{
    public function test_it_returns_urgent_for_one_week_or_less(): void
    {
        $service = new RenewalStatusService();

        $status = $service->fromExpiration(Carbon::now()->addDays(7));

        $this->assertSame('Urgent', $status);
    }

    public function test_it_returns_expired_for_past_dates(): void
    {
        $service = new RenewalStatusService();

        $status = $service->fromExpiration(Carbon::now()->subDay());

        $this->assertSame('Expired', $status);
    }
}
