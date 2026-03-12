<?php

namespace App\Services;

use Carbon\CarbonInterface;

class RenewalStatusService
{
    public function fromExpiration(CarbonInterface $expirationDate, ?string $workflowStatus = null): string
    {
        $days = now()->startOfDay()->diffInDays($expirationDate->startOfDay(), false);

        if ($days < 0) {
            return $workflowStatus === 'Closed' ? 'Expired' : 'Critical';
        }

        if ($days <= 7) {
            return 'Urgent';
        }

        if ($days <= 30) {
            return 'Action Required';
        }

        if ($days <= 60) {
            return 'Upcoming';
        }

        return 'No action needed';
    }
}
