<?php

namespace App\Console\Commands;

use App\Support\PhpSecurity;
use Illuminate\Console\Command;

/** `php artisan php:security-check`: fails when this PHP lacks the October 2026 critical fixes. */
class PhpSecurityCheckCommand extends Command
{
    protected $signature = 'php:security-check';

    protected $description = 'Check that PHP has the critical security releases ('.PhpSecurity::ADVISORY.')';

    public function handle(): int
    {
        $report = PhpSecurity::report();
        $this->line("PHP {$report['php_version']} ({$report['sapi']}) · {$report['advisory']}");

        if ($report['patched']) {
            $this->info($report['advice']);

            return self::SUCCESS;
        }

        $this->error($report['advice']);

        return self::FAILURE;
    }
}
