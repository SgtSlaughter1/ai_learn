<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // No test may reach a real AI provider or other outside service: a request that no
        // Http::fake() answers fails the test instead of spending quota or depending on the network.
        Http::preventStrayRequests();

        // Tests fake provider failures and bad tokens on purpose; keep those warnings out of
        // storage/logs/laravel.log. Set here: env('LOG_CHANNEL') would read "null" as no value.
        config(['logging.default' => 'null']);
    }
}
