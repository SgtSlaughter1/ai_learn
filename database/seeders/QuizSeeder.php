<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\Quiz;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class QuizSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Mathematics Quiz
        $mathQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 Mathematics Diagnostic Assessment'],
            [
                'description' => 'A diagnostic quiz covering basic Algebra and Geometry principles.',
                'time_limit_minutes' => 30,
                'status' => 'active',
            ]
        );

        $mathTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'mathematics');
        })->pluck('id');

        $mathQuestions = Question::whereIn('topic_id', $mathTopicIds)->get();

        // Use sync to idempotent-sync questions to pivot table
        $mathQuiz->questions()->sync(
            $mathQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 2]];
            })->toArray()
        );

        // 2. English Quiz
        $englishQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 English Language Placement Quiz'],
            [
                'description' => 'Verify your command of basic grammar tenses and structural verbs.',
                'time_limit_minutes' => 20,
                'status' => 'active',
            ]
        );

        $englishTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'english');
        })->pluck('id');

        $englishQuestions = Question::whereIn('topic_id', $englishTopicIds)->get();

        $englishQuiz->questions()->sync(
            $englishQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 5]];
            })->toArray()
        );

        // 3. Biology Quiz
        $biologyQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 Biology Intro Quiz'],
            [
                'description' => 'A test mapping cell structures and mitochondria operations.',
                'time_limit_minutes' => 15,
                'status' => 'active',
            ]
        );

        $biologyTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'biology');
        })->pluck('id');

        $biologyQuestions = Question::whereIn('topic_id', $biologyTopicIds)->get();

        $biologyQuiz->questions()->sync(
            $biologyQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 5]];
            })->toArray()
        );
    }
}
