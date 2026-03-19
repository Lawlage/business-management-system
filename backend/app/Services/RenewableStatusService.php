<?php

namespace App\Services;

use App\Models\Renewable;
use Carbon\Carbon;

class RenewableStatusService
{
    /**
     * Compute the next occurrence date for a given frequency.
     *
     * For day_of_month: returns the next occurrence of that day in the current or next month.
     * For days/months/years: walks forward from $startDate in $value-unit steps until >= today.
     */
    public function computeNextDueDate(string $type, int $value, ?Carbon $startDate): ?Carbon
    {
        $today = Carbon::now()->startOfDay();

        if ($type === 'day_of_month') {
            // Clamp to last day of month if needed (e.g. day 31 in February).
            $candidate = $today->copy()->startOfMonth()->addDays($value - 1);
            if ($candidate->day !== $value) {
                // Overflowed — use last day of month.
                $candidate = $today->copy()->endOfMonth()->startOfDay();
            }
            if ($candidate->lt($today)) {
                // Move to next month.
                $candidate = $today->copy()->addMonth()->startOfMonth()->addDays($value - 1);
                if ($candidate->day !== $value) {
                    $candidate = $today->copy()->addMonth()->endOfMonth()->startOfDay();
                }
            }

            return $candidate;
        }

        if ($startDate === null) {
            return null;
        }

        $cursor = $startDate->copy()->startOfDay();

        // Advance cursor until it is >= today.
        while ($cursor->lt($today)) {
            $cursor = match ($type) {
                'days'   => $cursor->addDays($value),
                'months' => $cursor->addMonths($value),
                'years'  => $cursor->addYears($value),
                default  => $cursor->addMonths($value),
            };
        }

        return $cursor;
    }

    /**
     * Derive a status string from a computed next_due_date.
     * Returns null when no due date is set (non-recurring product).
     */
    public function statusFromNextDueDate(?Carbon $nextDue): ?string
    {
        if ($nextDue === null) {
            return null;
        }

        $days = Carbon::now()->startOfDay()->diffInDays($nextDue->startOfDay(), false);

        return match (true) {
            $days < 0  => 'Expired',
            $days <= 7  => 'Urgent',
            $days <= 30 => 'Action Required',
            $days <= 60 => 'Upcoming',
            default     => 'No action needed',
        };
    }

    /**
     * Resolve the effective frequency for a Renewable, falling back to the product defaults.
     * Returns an array with keys: type, value, start_date (Carbon|null).
     *
     * @return array{type: string|null, value: int|null, start_date: Carbon|null}
     */
    public function computeEffectiveFrequency(Renewable $renewable): array
    {
        if ($renewable->frequency_type !== null && $renewable->frequency_value !== null) {
            return [
                'type'       => $renewable->frequency_type,
                'value'      => (int) $renewable->frequency_value,
                'start_date' => $renewable->frequency_start_date
                    ? Carbon::parse($renewable->frequency_start_date)
                    : null,
            ];
        }

        // Fall back to the product's template duration.
        $product = $renewable->renewableProduct;

        if ($product === null || $product->frequency_type === null || $product->frequency_value === null) {
            return ['type' => null, 'value' => null, 'start_date' => null];
        }

        return [
            'type'       => $product->frequency_type,
            'value'      => (int) $product->frequency_value,
            // Product has no start date; use the renewable's own start date if available.
            'start_date' => $renewable->frequency_start_date
                ? Carbon::parse($renewable->frequency_start_date)
                : null,
        ];
    }

    /**
     * Compute and return [next_due_date, status] for a Renewable.
     * Handles product relationship loading automatically.
     *
     * @return array{next_due_date: string|null, status: string|null}
     */
    public function computeForRenewable(Renewable $renewable): array
    {
        if (! $renewable->relationLoaded('renewableProduct')) {
            $renewable->load('renewableProduct');
        }

        $freq = $this->computeEffectiveFrequency($renewable);

        if ($freq['type'] === null) {
            return ['next_due_date' => null, 'status' => null];
        }

        $nextDue = $this->computeNextDueDate($freq['type'], $freq['value'], $freq['start_date']);

        return [
            'next_due_date' => $nextDue?->toDateString(),
            'status'        => $this->statusFromNextDueDate($nextDue),
        ];
    }
}
