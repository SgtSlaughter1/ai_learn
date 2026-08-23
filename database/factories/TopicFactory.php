<?php

namespace Database\Factories;

use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TopicFactory extends Factory
{
    protected $model = Topic::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->sentence(3);
        return [
            'subject_id' => Subject::factory(),
            'name' => $name,
            'slug' => Str::slug($name),
            'level' => 'ss1',
            'description' => $this->faker->paragraph(),
            'status' => 'active',
            'sort_order' => 0,
        ];
    }
}
