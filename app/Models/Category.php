<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $guarded = [];

    /**
     * Map of standard categories to grade levels.
     */
    public static function gradeLevelsForCode(?string $code): array
    {
        return match (strtolower($code ?? '')) {
            'primary' => [
                'CRECHE', 'KG1', 'KG2', 'NUR1', 'NUR2',
                'PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6',
            ],
            'junior' => [
                'JSS1', 'JSS2', 'JSS3',
            ],
            'senior' => [
                'SS1', 'SS2', 'SS3',
            ],
            default => [],
        };
    }

    /**
     * Map of category ID to standard grade levels.
     */
    public static function gradeLevelsForId(int|string|null $id): array
    {
        return match ((int) $id) {
            1 => self::gradeLevelsForCode('primary'),
            2 => self::gradeLevelsForCode('junior'),
            3 => self::gradeLevelsForCode('senior'),
            default => [],
        };
    }

    /**
     * Get array of grade levels supported by this category instance.
     */
    public function getGradeLevelsAttribute(): array
    {
        return self::gradeLevelsForCode($this->code);
    }
}
