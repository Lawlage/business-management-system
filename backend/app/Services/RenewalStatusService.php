<?php

namespace App\Services;

use Carbon\CarbonInterface;

class RenewalStatusService
{
    public function fromExpiration(CarbonInterface $expirationDate, ?string $workflowStatus = null, bool $autoRenews = false): string
    {
        $days = now()->startOfDay()->diffInDays($expirationDate->startOfDay(), false);

        if ($days < 0) {
            return 'Expired';
        }

        if ($days <= 7) {
            return $autoRenews ? 'Upcoming' : 'Urgent';
        }

        if ($days <= 30) {
            return $autoRenews ? 'Upcoming' : 'Action Required';
        }

        if ($days <= 60) {
            return 'Upcoming';
        }

        return 'No action needed';
    }
}
