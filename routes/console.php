<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Offline sync retries only need their idempotency keys for a short window.
Schedule::call(function () {
    DB::table('idempotency_keys')->where('created_at', '<', now()->subDays(14))->delete();
})->daily()->name('prune-idempotency-keys');
