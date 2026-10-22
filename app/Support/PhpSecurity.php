<?php

namespace App\Support;

/**
 * Whether the PHP running this app has the October 2026 critical security releases
 * (CVE-2026-109618 and CVE-2026-109619: unauthenticated remote code execution).
 * Only upgrading fixes them; ini-setting mitigations merely reduce exposure.
 */
class PhpSecurity
{
    public const ADVISORY = 'CVE-2026-109618, CVE-2026-109619';

    /** First patched release for each supported minor version. */
    public const PATCHED = [
        '8.2' => '8.2.35',
        '8.3' => '8.3.36',
        '8.4' => '8.4.27',
        '8.5' => '8.5.12',
    ];

    /** The patched release this version needs, or null when its line gets no fix (8.1 and older). */
    public static function requiredFor(string $version): ?string
    {
        $minor = implode('.', array_slice(explode('.', $version), 0, 2));

        return self::PATCHED[$minor] ?? (version_compare($minor, '8.5', '>') ? $minor.'.0' : null);
    }

    public static function isPatched(string $version = PHP_VERSION): bool
    {
        $required = self::requiredFor($version);

        return $required !== null && version_compare($version, $required, '>=');
    }

    /** @return array{php_version: string, sapi: string, patched: bool, required: string|null, advice: string} */
    public static function report(string $version = PHP_VERSION, string $sapi = PHP_SAPI): array
    {
        $required = self::requiredFor($version);
        $patched = self::isPatched($version);

        return [
            'php_version' => $version,
            'sapi' => $sapi,
            'patched' => $patched,
            'required' => $required,
            'advisory' => self::ADVISORY,
            'advice' => match (true) {
                $patched => 'Patched.',
                $required === null => "PHP {$version} no longer gets security fixes: move to PHP 8.3.36 or later.",
                default => "Upgrade PHP to {$required} or later.",
            },
        ];
    }
}
