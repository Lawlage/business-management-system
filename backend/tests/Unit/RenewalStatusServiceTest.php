<?php

namespace Tests\Unit;

use App\Services\RenewalStatusService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class RenewalStatusServiceTest extends TestCase
{
    private RenewalStatusService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RenewalStatusService();
    }

    // ── Expired (any past date) ────────────────────────────────────────────────

    public function test_it_returns_expired_for_past_dates(): void
    {
        $this->assertSame('Expired', $this->service->fromExpiration(Carbon::now()->subDay()));
    }

    public function test_it_returns_expired_for_far_past(): void
    {
        $this->assertSame('Expired', $this->service->fromExpiration(Carbon::now()->subDays(365)));
    }

    public function test_it_returns_expired_regardless_of_workflow_status(): void
    {
        $this->assertSame('Expired', $this->service->fromExpiration(Carbon::now()->subDay(), 'In Progress'));
    }

    public function test_it_returns_expired_for_closed_workflow(): void
    {
        $this->assertSame('Expired', $this->service->fromExpiration(Carbon::now()->subDay(), 'Closed'));
    }

    // ── Urgent ─────────────────────────────────────────────────────────────────

    public function test_it_returns_urgent_for_today(): void
    {
        $this->assertSame('Urgent', $this->service->fromExpiration(Carbon::now()));
    }

    public function test_it_returns_urgent_for_one_day(): void
    {
        $this->assertSame('Urgent', $this->service->fromExpiration(Carbon::now()->addDay()));
    }

    public function test_it_returns_urgent_for_one_week_or_less(): void
    {
        $this->assertSame('Urgent', $this->service->fromExpiration(Carbon::now()->addDays(7)));
    }

    // ── Action Required ────────────────────────────────────────────────────────

    public function test_it_returns_action_required_for_eight_days(): void
    {
        $this->assertSame('Action Required', $this->service->fromExpiration(Carbon::now()->addDays(8)));
    }

    public function test_it_returns_action_required_for_fifteen_days(): void
    {
        $this->assertSame('Action Required', $this->service->fromExpiration(Carbon::now()->addDays(15)));
    }

    public function test_it_returns_action_required_for_exactly_thirty_days(): void
    {
        $this->assertSame('Action Required', $this->service->fromExpiration(Carbon::now()->addDays(30)));
    }

    // ── Auto-renews bypasses Action Required ───────────────────────────────────

    public function test_auto_renews_returns_upcoming_instead_of_action_required(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(15), null, true));
    }

    public function test_auto_renews_returns_upcoming_at_thirty_day_boundary(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(30), null, true));
    }

    public function test_auto_renews_returns_upcoming_instead_of_urgent(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(7), null, true));
    }

    public function test_auto_renews_returns_upcoming_for_one_day(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDay(), null, true));
    }

    // ── Upcoming ───────────────────────────────────────────────────────────────

    public function test_it_returns_upcoming_for_thirty_one_days(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(31)));
    }

    public function test_it_returns_upcoming_for_forty_five_days(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(45)));
    }

    public function test_it_returns_upcoming_for_exactly_sixty_days(): void
    {
        $this->assertSame('Upcoming', $this->service->fromExpiration(Carbon::now()->addDays(60)));
    }

    // ── No action needed ───────────────────────────────────────────────────────

    public function test_it_returns_no_action_needed_for_sixty_one_days(): void
    {
        $this->assertSame('No action needed', $this->service->fromExpiration(Carbon::now()->addDays(61)));
    }

    public function test_it_returns_no_action_needed_for_far_future(): void
    {
        $this->assertSame('No action needed', $this->service->fromExpiration(Carbon::now()->addDays(365)));
    }
}
