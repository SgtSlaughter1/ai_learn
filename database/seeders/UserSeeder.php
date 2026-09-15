<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $users = [
            [
                'email' => 'platformadmin@example.com',
                'name' => 'Platform Admin',
                'password' => Hash::make('password'),
                'role' => UserRole::PLATFORM_ADMIN,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'schooladmin@example.com',
                'name' => 'AILEARN School Admin',
                'password' => Hash::make('password'),
                'role' => UserRole::SCHOOL_ADMIN,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'greenwood.admin@example.com',
                'name' => 'Greenwood Admin',
                'password' => Hash::make('password'),
                'role' => UserRole::SCHOOL_ADMIN,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'learner@example.com',
                'name' => 'John Learner',
                'password' => Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'ada.learner@example.com',
                'name' => 'Ada Lovelace',
                'password' => Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'kemi.learner@example.com',
                'name' => 'Kemi Adeleke',
                'password' => Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'chidi.learner@example.com',
                'name' => 'Chidi Anagonye',
                'password' => Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ],
            [
                'email' => 'amina.learner@example.com',
                'name' => 'Amina Bello',
                'password' => Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }

        $this->command?->info('Users seeded successfully.');
    }
}
