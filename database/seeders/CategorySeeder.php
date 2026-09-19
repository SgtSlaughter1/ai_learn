<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'id' => 1,
                'name' => 'Primary School',
                'code' => 'primary',
                'description' => 'Early Childhood & Primary Basic Education (Creche, Nursery, Primary 1 - 6)',
            ],
            [
                'id' => 2,
                'name' => 'Junior Secondary',
                'code' => 'junior',
                'description' => 'Junior Secondary Education (JSS 1 - 3 / Basic 7 - 9)',
            ],
            [
                'id' => 3,
                'name' => 'Senior Secondary',
                'code' => 'senior',
                'description' => 'Senior Secondary Education (SS 1 - 3)',
            ],
        ];

        foreach ($categories as $cat) {
            Category::updateOrCreate(
                ['id' => $cat['id']],
                [
                    'name' => $cat['name'],
                    'code' => $cat['code'],
                    'description' => $cat['description'],
                ]
            );
        }

        $this->command?->info("Education categories (Primary, Junior, Senior) seeded successfully.");
    }
}
