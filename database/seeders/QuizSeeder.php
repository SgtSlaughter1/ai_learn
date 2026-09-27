<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class QuizSeeder extends Seeder
{
    public function run(): void
    {
        $school1 = School::where('slug', 'acedrill-academy')->first() ?? School::first();
        $school2 = School::where('slug', 'greenwood-high-school')->first();

        // 1. Seed Dedicated 15-Question Topic Quizzes for all 15 Curriculum Topics
        $topics = Topic::with(['subject', 'questions'])->get();

        foreach ($topics as $topic) {
            $subjectName = $topic->subject?->name ?? 'General';
            $quizTitle = "{$topic->name} - {$subjectName} Quiz";

            $topicQuiz = Quiz::updateOrCreate(
                ['title' => $quizTitle],
                [
                    'school_id' => $topic->subject?->school_id ?? $school1?->id,
                    'description' => "Topic practice quiz for {$topic->name} in {$subjectName}.",
                    'time_limit_minutes' => 20,
                    'status' => 'active',
                ]
            );

            $questions = $topic->questions;
            if ($questions->isNotEmpty()) {
                $topicQuiz->questions()->sync(
                    $questions->take(15)->pluck('id')->mapWithKeys(function ($id, $index) {
                        return [$id => ['sort_order' => $index + 1, 'marks' => 2]];
                    })->toArray()
                );
            }
        }

        // 2. Comprehensive 15-Question Subject Diagnostic Quizzes (SS1, SS2, SS3)
        $subjectSlugs = [
            'ss1-mathematics' => [
                'title' => 'SS1 Mathematics Comprehensive Assessment',
                'description' => 'Comprehensive 15-question diagnostic assessment across Algebra, Euclidean Geometry, Quadratics, Trigonometry, and Statistics.',
                'time_limit_minutes' => 30,
            ],
            'ss1-physics' => [
                'title' => 'SS1 Physics Diagnostic Assessment',
                'description' => 'Comprehensive 15-question physics evaluation spanning Kinematics, Dynamics, Energy, Waves, and Electric Circuits.',
                'time_limit_minutes' => 30,
            ],
            'ss1-english' => [
                'title' => 'SS1 English Language Placement Assessment',
                'description' => 'Comprehensive 15-question evaluation testing Concord, Tenses, Phrasal Verbs, Punctuation, and Lexis in Context.',
                'time_limit_minutes' => 25,
            ],
            'ss2-mathematics' => [
                'title' => 'SS2 Mathematics Comprehensive Assessment',
                'description' => 'Comprehensive evaluation across Logarithms, Sequences (AP/GP), Coordinate Geometry, and Circle Theorems.',
                'time_limit_minutes' => 30,
            ],
            'ss2-physics' => [
                'title' => 'SS2 Physics Diagnostic Assessment',
                'description' => 'Advanced physics assessment spanning Projectiles, Circular Motion, Heat Expansion, and Magnetism.',
                'time_limit_minutes' => 30,
            ],
            'ss2-english' => [
                'title' => 'SS2 English Language Diagnostic Assessment',
                'description' => 'Evaluation of advanced concord, modal auxiliaries, clause analysis, and vocabulary precision.',
                'time_limit_minutes' => 25,
            ],
            'ss3-mathematics' => [
                'title' => 'SS3 Mathematics Mastery Exam',
                'description' => 'Senior secondary national exam preparation covering Calculus, Matrices, Permutations, and Probability.',
                'time_limit_minutes' => 35,
            ],
            'ss3-physics' => [
                'title' => 'SS3 Physics Mastery Exam',
                'description' => 'Senior secondary physics exam covering Atomic physics, Nuclear reactions, Electronics, and AC circuits.',
                'time_limit_minutes' => 35,
            ],
            'ss3-english' => [
                'title' => 'SS3 English Language Mastery Exam',
                'description' => 'Senior exam preparation testing syntactic transformations, stylistic analysis, and comprehension.',
                'time_limit_minutes' => 30,
            ],
        ];

        foreach ($subjectSlugs as $slug => $meta) {
            $subject = Subject::where('slug', $slug)->first();
            if (!$subject) {
                continue;
            }

            $subjectQuiz = Quiz::updateOrCreate(
                ['title' => $meta['title']],
                [
                    'school_id' => $subject->school_id ?? $school1?->id,
                    'description' => $meta['description'],
                    'time_limit_minutes' => $meta['time_limit_minutes'],
                    'status' => 'active',
                ]
            );

            // Fetch questions from all topics in this subject (up to 15 questions)
            $subjectTopicIds = Topic::where('subject_id', $subject->id)->pluck('id');
            $subjectQuestions = Question::whereIn('topic_id', $subjectTopicIds)
                ->inRandomOrder(42) // Deterministic seed for reproducible 15 questions
                ->take(15)
                ->get();

            if ($subjectQuestions->isEmpty()) {
                $subjectQuestions = Question::whereIn('topic_id', $subjectTopicIds)->take(15)->get();
            }

            $subjectQuiz->questions()->sync(
                $subjectQuestions->pluck('id')->mapWithKeys(function ($id, $index) {
                    return [$id => ['sort_order' => $index + 1, 'marks' => 3]];
                })->toArray()
            );
        }

        $this->command?->info("Successfully seeded dedicated 15-question topic quizzes and comprehensive subject assessments.");
    }
}
