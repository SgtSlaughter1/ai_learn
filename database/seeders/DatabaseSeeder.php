<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
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
        // Seed users for different roles with explicit password 'password' using updateOrCreate for idempotency
        User::updateOrCreate(
            ['email' => 'learner@example.com'],
            [
                'name' => 'John Learner',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'teacher@example.com'],
            [
                'name' => 'Jane Teacher',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::TEACHER,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::ADMIN,
                'email_verified_at' => now(),
            ]
        );

        // Call modular seeders
        $this->call([
            AchievementSeeder::class,
            SubjectSeeder::class,
            QuizSeeder::class,
            SchoolSeeder::class,
        ]);
    }
}
