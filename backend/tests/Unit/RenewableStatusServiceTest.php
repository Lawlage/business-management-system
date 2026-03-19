<?php

namespace Tests\Unit;

use App\Models\Renewable;
use App\Models\RenewableProduct;
use App\Services\RenewableStatusService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class RenewableStatusServiceTest extends TestCase
{
    private RenewableStatusService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RenewableStatusService();
    }

    // ── computeNextDueDate — days/months/years ─────────────────────────────────

    public function test_compute_next_due_date_days_future_start(): void
    {
        // Start date 10 days ago, every 7 days → next due is 4 days from now.
        $start = Carbon::now()->subDays(10)->startOfDay();
        $result = $this->service->computeNextDueDate('days', 7, $start);

        // 10 days ago + 14 days (2 iterations) = 4 days from now.
        $this->assertNotNull($result);
        $this->assertEquals(Carbon::now()->addDays(4)->toDateString(), $result->toDateString());
    }

    public function test_compute_next_due_date_months_past_start(): void
    {
        // Start 13 months ago, every 12 months → next due is ~11 months from now.
        $start = Carbon::now()->subMonths(13)->startOfDay();
        $result = $this->service->computeNextDueDate('months', 12, $start);

        $expected = $start->copy()->addMonths(24);
        $this->assertNotNull($result);
        $this->assertEquals($expected->toDateString(), $result->toDateString());
    }

    public function test_compute_next_due_date_years_past_start(): void
    {
        // Start 2.5 years ago, every 1 year → next due ~6 months from now.
        $start = Carbon::now()->subMonths(30)->startOfDay();
        $result = $this->service->computeNextDueDate('years', 1, $start);

        $expected = $start->copy()->addYears(3);
        $this->assertNotNull($result);
        $this->assertEquals($expected->toDateString(), $result->toDateString());
    }

    public function test_compute_next_due_date_returns_null_when_no_start_date_for_days(): void
    {
        $result = $this->service->computeNextDueDate('days', 30, null);
        $this->assertNull($result);
    }

    public function test_compute_next_due_date_returns_null_when_no_start_date_for_months(): void
    {
        $result = $this->service->computeNextDueDate('months', 6, null);
        $this->assertNull($result);
    }

    public function test_compute_next_due_date_start_date_today_returns_one_period_ahead(): void
    {
        $start = Carbon::now()->startOfDay();
        // Start date is today — the current period is already paid for,
        // so the first due date is today + one cycle.
        $result = $this->service->computeNextDueDate('days', 30, $start);

        $this->assertNotNull($result);
        $this->assertEquals(Carbon::now()->addDays(30)->toDateString(), $result->toDateString());
    }

    // ── computeNextDueDate — day_of_month ─────────────────────────────────────

    public function test_compute_next_due_date_day_of_month_future_this_month(): void
    {
        // If today is before day 28, day_of_month=28 returns this month's 28th.
        $today = Carbon::now()->startOfDay();
        $targetDay = $today->day < 28 ? 28 : 1;
        $result = $this->service->computeNextDueDate('day_of_month', $targetDay, null);

        $this->assertNotNull($result);
        $this->assertGreaterThanOrEqual($today, $result);
    }

    public function test_compute_next_due_date_day_of_month_past_rolls_to_next_month(): void
    {
        // Day 1 is always in the past (unless today is day 1).
        $today = Carbon::now()->startOfDay();

        if ($today->day === 1) {
            // Can't test "past" for day 1 on the 1st of the month — skip.
            $this->markTestSkipped('Cannot test day_of_month=1 roll on the 1st of the month.');
        }

        $result = $this->service->computeNextDueDate('day_of_month', 1, null);

        $this->assertNotNull($result);
        // Must be in next month.
        $this->assertEquals(1, $result->day);
        $this->assertGreaterThan($today->month === 12 ? 0 : $today->month, $result->month === 1 ? 13 : $result->month);
    }

    public function test_compute_next_due_date_day_of_month_31_in_short_month(): void
    {
        // Day 31 — in a month with fewer days it should clamp to end of month.
        Carbon::setTestNow(Carbon::create(2025, 2, 1)); // February — has 28 days in 2025.

        $result = $this->service->computeNextDueDate('day_of_month', 31, null);

        $this->assertNotNull($result);
        // Should return end of February (28th in 2025).
        $this->assertEquals(28, $result->day);
        $this->assertEquals(2, $result->month);

        Carbon::setTestNow();
    }

    public function test_compute_next_due_date_day_of_month_31_past_in_short_month(): void
    {
        // Feb 15: day 31 is "in the past" (28 < today on Feb 15 is false, but after clamping to 28, 28 > 15).
        // Actually Feb 15, day 31 → clamp to Feb 28, which is in the future → return Feb 28.
        Carbon::setTestNow(Carbon::create(2025, 2, 15));

        $result = $this->service->computeNextDueDate('day_of_month', 31, null);

        $this->assertNotNull($result);
        $this->assertEquals(28, $result->day);
        $this->assertEquals(2, $result->month);

        Carbon::setTestNow();
    }

    // ── statusFromNextDueDate ─────────────────────────────────────────────────

    public function test_status_is_null_for_null_date(): void
    {
        $this->assertNull($this->service->statusFromNextDueDate(null));
    }

    public function test_status_expired_for_past_date(): void
    {
        $this->assertSame('Expired', $this->service->statusFromNextDueDate(Carbon::now()->subDay()));
    }

    public function test_status_urgent_for_today(): void
    {
        $this->assertSame('Urgent', $this->service->statusFromNextDueDate(Carbon::now()));
    }

    public function test_status_urgent_for_seven_days(): void
    {
        $this->assertSame('Urgent', $this->service->statusFromNextDueDate(Carbon::now()->addDays(7)));
    }

    public function test_status_action_required_for_eight_days(): void
    {
        $this->assertSame('Action Required', $this->service->statusFromNextDueDate(Carbon::now()->addDays(8)));
    }

    public function test_status_action_required_for_thirty_days(): void
    {
        $this->assertSame('Action Required', $this->service->statusFromNextDueDate(Carbon::now()->addDays(30)));
    }

    public function test_status_upcoming_for_thirty_one_days(): void
    {
        $this->assertSame('Upcoming', $this->service->statusFromNextDueDate(Carbon::now()->addDays(31)));
    }

    public function test_status_upcoming_for_sixty_days(): void
    {
        $this->assertSame('Upcoming', $this->service->statusFromNextDueDate(Carbon::now()->addDays(60)));
    }

    public function test_status_no_action_needed_for_sixty_one_days(): void
    {
        $this->assertSame('No action needed', $this->service->statusFromNextDueDate(Carbon::now()->addDays(61)));
    }

    public function test_status_no_action_needed_for_far_future(): void
    {
        $this->assertSame('No action needed', $this->service->statusFromNextDueDate(Carbon::now()->addDays(365)));
    }

    // ── computeEffectiveFrequency ─────────────────────────────────────────────

    public function test_effective_frequency_uses_renewable_override(): void
    {
        // Renewable has its own frequency → should use renewable's values, not product's.
        $product = new RenewableProduct([
            'frequency_type'  => 'years',
            'frequency_value' => 1,
        ]);

        $renewable = new Renewable([
            'frequency_type'       => 'months',
            'frequency_value'      => 6,
            'frequency_start_date' => '2024-01-01',
        ]);
        $renewable->setRelation('renewableProduct', $product);

        $result = $this->service->computeEffectiveFrequency($renewable);

        $this->assertSame('months', $result['type']);
        $this->assertSame(6, $result['value']);
        $this->assertNotNull($result['start_date']);
        $this->assertEquals('2024-01-01', $result['start_date']->toDateString());
    }

    public function test_effective_frequency_falls_back_to_product(): void
    {
        // Renewable has no frequency → should use product's type/value.
        $product = new RenewableProduct([
            'frequency_type'  => 'years',
            'frequency_value' => 2,
        ]);

        $renewable = new Renewable([
            'frequency_type'       => null,
            'frequency_value'      => null,
            'frequency_start_date' => '2023-06-15',
        ]);
        $renewable->setRelation('renewableProduct', $product);

        $result = $this->service->computeEffectiveFrequency($renewable);

        $this->assertSame('years', $result['type']);
        $this->assertSame(2, $result['value']);
        // Start date comes from the renewable even when type is from the product.
        $this->assertEquals('2023-06-15', $result['start_date']->toDateString());
    }

    public function test_effective_frequency_returns_null_when_no_product_or_frequency(): void
    {
        $product = new RenewableProduct([
            'frequency_type'  => null,
            'frequency_value' => null,
        ]);

        $renewable = new Renewable([
            'frequency_type'  => null,
            'frequency_value' => null,
        ]);
        $renewable->setRelation('renewableProduct', $product);

        $result = $this->service->computeEffectiveFrequency($renewable);

        $this->assertNull($result['type']);
        $this->assertNull($result['value']);
        $this->assertNull($result['start_date']);
    }

    public function test_effective_frequency_returns_null_when_renewable_product_not_set(): void
    {
        $renewable = new Renewable([
            'frequency_type'  => null,
            'frequency_value' => null,
        ]);
        $renewable->setRelation('renewableProduct', null);

        $result = $this->service->computeEffectiveFrequency($renewable);

        $this->assertNull($result['type']);
        $this->assertNull($result['value']);
        $this->assertNull($result['start_date']);
    }
}
