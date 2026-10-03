<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Call modular seeders
        $this->call([
            UserSeeder::class,
            CategorySeeder::class,
            SchoolSeeder::class,
            ProgramSeeder::class,
            ClassSeeder::class,
            SubjectSeeder::class,
            QuizSeeder::class,
            AchievementSeeder::class,
            PastQuestionSeeder::class,
        ]);
    }
}
