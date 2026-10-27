<?php

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

class ProgramSeeder extends Seeder
{
    public function run(): void
    {
        $programs = [
            [
                'name' => 'Science',
                'slug' => 'science',
                'code' => 'SCI',
                'description' => 'Senior Secondary STEM track covering Physics, Chemistry, Biology, and Advanced Mathematics.',
                'is_active' => true,
            ],
            [
                'name' => 'Humanities',
                'slug' => 'humanities',
                'code' => 'HUM',
                'description' => 'Senior Secondary Arts & Humanities track covering Literature-in-English, Government, History, and Religious Studies.',
                'is_active' => true,
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'code' => 'BUS',
                'description' => 'Senior Secondary Commercial track covering Financial Accounting, Commerce, Economics, and Marketing.',
                'is_active' => true,
            ],
        ];

        foreach ($programs as $prog) {
            Program::updateOrCreate(
                ['slug' => $prog['slug']],
                $prog
            );
        }

        $this->command?->info('Academic Programs (Science, Humanities, Business) seeded successfully.');
    }
}
