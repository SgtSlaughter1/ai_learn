<?php

namespace Database\Factories;

use App\Models\Question;
use App\Models\Topic;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionFactory extends Factory
{
    protected $model = Question::class;

    public function definition(): array
    {
        return [
            'topic_id' => Topic::factory(),
            'question_text' => $this->faker->sentence().'?',
            'type' => 'multiple_choice',
            'difficulty' => 'medium',
            'explanation' => $this->faker->sentence(),
            'status' => 'active',
        ];
    }
}
