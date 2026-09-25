<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class QuizSeeder extends Seeder
{
    public function run(): void
    {
        $school1 = School::where('slug', 'passpoint-academy')->first();
        $school2 = School::where('slug', 'greenwood-high-school')->first();

        // 1. Mathematics Quiz (School 1: PassPoint Academy)
        $mathQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 Mathematics Diagnostic Assessment'],
            [
                'school_id' => $school1?->id,
                'description' => 'A diagnostic quiz covering fundamental Algebra, Geometry, and Trigonometric concepts with LaTeX math notation.',
                'time_limit_minutes' => 30,
                'status' => 'active',
            ]
        );

        $mathTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'mathematics');
        })->pluck('id');

        $mathQuestions = Question::whereIn('topic_id', $mathTopicIds)->get();

        $mathQuiz->questions()->sync(
            $mathQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 2]];
            })->toArray()
        );

        // 2. English Language Placement Quiz (School 1: PassPoint Academy)
        $englishQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 English Language Placement Quiz'],
            [
                'school_id' => $school1?->id,
                'description' => 'Verify your command of verb tenses, aspect, and advanced concord rules.',
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

        // 3. Biology Quiz (School 1: PassPoint Academy)
        $biologyQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 Biology Foundations Quiz'],
            [
                'school_id' => $school1?->id,
                'description' => 'Evaluation of cell organelles, membrane transport, and Mendelian genetics.',
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

        // 4. SS1 Government Assessment (School 1: PassPoint Academy)
        $govQuiz = Quiz::updateOrCreate(
            ['title' => 'SS1 Government Foundations Assessment'],
            [
                'school_id' => $school1?->id,
                'description' => 'Senior secondary assessment covering arms of government, separation of powers, and civic structures.',
                'time_limit_minutes' => 15,
                'status' => 'active',
            ]
        );

        $govTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'ss1-government');
        })->pluck('id');

        $govQuestions = Question::whereIn('topic_id', $govTopicIds)->get();

        $govQuiz->questions()->sync(
            $govQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 5]];
            })->toArray()
        );

        // 5. Chemistry & Physics Assessment (School 2: Greenwood High School)
        $school2Quiz = Quiz::updateOrCreate(
            ['title' => 'Greenwood Senior Science Diagnostic Exam'],
            [
                'school_id' => $school2?->id,
                'description' => 'Chemistry stoichiometry, chemical bonding, and Newton\'s laws of motion evaluation.',
                'time_limit_minutes' => 25,
                'status' => 'active',
            ]
        );

        $scienceTopicIds = Topic::whereHas('subject', function ($query) {
            $query->whereIn('slug', ['chemistry', 'physics']);
        })->pluck('id');

        $scienceQuestions = Question::whereIn('topic_id', $scienceTopicIds)->get();

        $school2Quiz->questions()->sync(
            $scienceQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 5]];
            })->toArray()
        );

        // 6. Global General Knowledge Tech Quiz (Cross-school / Platform-wide)
        $techQuiz = Quiz::updateOrCreate(
            ['title' => 'Global AI & Digital Skills Bowl'],
            [
                'school_id' => null, // General Knowledge platform-wide
                'description' => 'Open assessment testing fundamentals of computing, algorithm complexity, and AI paradigms.',
                'time_limit_minutes' => 15,
                'status' => 'active',
            ]
        );

        $techTopicIds = Topic::whereHas('subject', function ($query) {
            $query->where('slug', 'computer-studies');
        })->pluck('id');

        $techQuestions = Question::whereIn('topic_id', $techTopicIds)->get();

        $techQuiz->questions()->sync(
            $techQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                return [$id => ['sort_order' => $index + 1, 'marks' => 5]];
            })->toArray()
        );

        $this->command?->info("Quizzes seeded and linked with questions successfully.");
    }
}
