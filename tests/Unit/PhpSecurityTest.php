<?php

namespace Tests\Unit;

use App\Support\PhpSecurity;
use PHPUnit\Framework\TestCase;

class PhpSecurityTest extends TestCase
{
    public function test_versions_before_the_october_2026_releases_are_unpatched(): void
    {
        foreach (['8.3.19', '8.3.35', '8.2.27', '8.4.26', '8.5.11'] as $version) {
            $this->assertFalse(PhpSecurity::isPatched($version), $version);
        }
    }

    public function test_the_fixed_releases_and_later_are_patched(): void
    {
        foreach (['8.3.36', '8.3.40', '8.2.35', '8.4.27', '8.5.12', '8.6.0'] as $version) {
            $this->assertTrue(PhpSecurity::isPatched($version), $version);
        }
    }

    public function test_unsupported_lines_are_told_to_move_on(): void
    {
        $report = PhpSecurity::report('8.1.31', 'fpm-fcgi');

        $this->assertFalse($report['patched']);
        $this->assertNull($report['required']);
        $this->assertStringContainsString('no longer gets security fixes', $report['advice']);
        $this->assertSame('Upgrade PHP to 8.3.36 or later.', PhpSecurity::report('8.3.19')['advice']);
    }
}
