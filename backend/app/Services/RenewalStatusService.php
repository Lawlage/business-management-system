<?php

namespace App\Services;

use Carbon\CarbonInterface;

class RenewalStatusService
{
    public function fromExpiration(CarbonInterface $expirationDate): string
    {
        $days = now()->startOfDay()->diffInDays($expirationDate->startOfDay(), false);

        if ($days < 0) {
            return 'Expired';
        }

        if ($days <= 7) {
            return 'Urgent';
        }

        if ($days <= 30) {
            return 'Action required';
        }

        if ($days <= 60) {
            return 'Upcoming';
        }

        return 'No action needed';
    }
}
