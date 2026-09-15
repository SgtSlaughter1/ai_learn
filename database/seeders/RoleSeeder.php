<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'platform_admin',
                'description' => 'Platform Admin',
                'guard_name' => 'web',
            ],
            [
                'name' => 'school_admin',
                'description' => 'School Portal Administrator',
                'guard_name' => 'web',
            ],
            [
                'name' => 'learner',
                'description' => 'Learner',
                'guard_name' => 'web',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                [
                    'name' => $role['name'],
                    'guard_name' => $role['guard_name'] ?? 'web',
                ],
                $role
            );
        }

        $this->command?->info('Roles seeded successfully.');
    }
}
