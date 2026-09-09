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
        // 1. Super Admin Accounts
        User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Platform Super Admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::SUPER_ADMIN,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::SUPER_ADMIN,
                'email_verified_at' => now(),
            ]
        );

        // 2. School Admin Accounts
        User::updateOrCreate(
            ['email' => 'schooladmin@example.com'],
            [
                'name' => 'AILEARN School Admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::SCHOOL_ADMIN,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'greenwood.admin@example.com'],
            [
                'name' => 'Greenwood Admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::SCHOOL_ADMIN,
                'email_verified_at' => now(),
            ]
        );

        // 3. Learner Accounts
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
            ['email' => 'ada.learner@example.com'],
            [
                'name' => 'Ada Lovelace',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'chidi.learner@example.com'],
            [
                'name' => 'Chidi Anagonye',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ]
        );

        // Call modular seeders
        $this->call([
            SchoolSeeder::class,
            SubjectSeeder::class,
            QuizSeeder::class,
            AchievementSeeder::class,
        ]);
    }
}
