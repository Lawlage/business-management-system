<?php

namespace Tests\Unit;

use App\Services\RenewableStatusService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class RenewalStatusServiceTest extends TestCase
{
    private RenewableStatusService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RenewableStatusService();
    }

    // ── Expired (any past date) ────────────────────────────────────────────────

    public function test_it_returns_expired_for_past_dates(): void
    {
        $this->assertSame('Expired', $this->service->statusFromNextDueDate(Carbon::now()->subDay()));
    }

    public function test_it_returns_expired_for_far_past(): void
    {
        $this->assertSame('Expired', $this->service->statusFromNextDueDate(Carbon::now()->subDays(365)));
    }

    // ── Urgent ─────────────────────────────────────────────────────────────────

    public function test_it_returns_urgent_for_today(): void
    {
        $this->assertSame('Urgent', $this->service->statusFromNextDueDate(Carbon::now()));
    }

    public function test_it_returns_urgent_for_one_day(): void
    {
        $this->assertSame('Urgent', $this->service->statusFromNextDueDate(Carbon::now()->addDay()));
    }

    public function test_it_returns_urgent_for_one_week_or_less(): void
    {
        $this->assertSame('Urgent', $this->service->statusFromNextDueDate(Carbon::now()->addDays(7)));
    }

    // ── Action Required ────────────────────────────────────────────────────────

    public function test_it_returns_action_required_for_eight_days(): void
    {
        $this->assertSame('Action Required', $this->service->statusFromNextDueDate(Carbon::now()->addDays(8)));
    }

    public function test_it_returns_action_required_for_fifteen_days(): void
    {
        $this->assertSame('Action Required', $this->service->statusFromNextDueDate(Carbon::now()->addDays(15)));
    }

    public function test_it_returns_action_required_for_exactly_thirty_days(): void
    {
        $this->assertSame('Action Required', $this->service->statusFromNextDueDate(Carbon::now()->addDays(30)));
    }

    // ── Upcoming ───────────────────────────────────────────────────────────────

    public function test_it_returns_upcoming_for_thirty_one_days(): void
    {
        $this->assertSame('Upcoming', $this->service->statusFromNextDueDate(Carbon::now()->addDays(31)));
    }

    public function test_it_returns_upcoming_for_forty_five_days(): void
    {
        $this->assertSame('Upcoming', $this->service->statusFromNextDueDate(Carbon::now()->addDays(45)));
    }

    public function test_it_returns_upcoming_for_exactly_sixty_days(): void
    {
        $this->assertSame('Upcoming', $this->service->statusFromNextDueDate(Carbon::now()->addDays(60)));
    }

    // ── No action needed ───────────────────────────────────────────────────────

    public function test_it_returns_no_action_needed_for_sixty_one_days(): void
    {
        $this->assertSame('No action needed', $this->service->statusFromNextDueDate(Carbon::now()->addDays(61)));
    }

    public function test_it_returns_no_action_needed_for_far_future(): void
    {
        $this->assertSame('No action needed', $this->service->statusFromNextDueDate(Carbon::now()->addDays(365)));
    }

    // ── Null (no due date) ─────────────────────────────────────────────────────

    public function test_it_returns_null_for_no_due_date(): void
    {
        $this->assertNull($this->service->statusFromNextDueDate(null));
    }
}
