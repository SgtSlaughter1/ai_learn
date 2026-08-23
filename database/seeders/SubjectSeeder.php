<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Mathematics
        $math = Subject::updateOrCreate(
            ['slug' => 'mathematics'],
            [
                'name' => 'Mathematics',
                'description' => 'Core high school mathematics curriculum.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $algebra = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'algebraic-expressions'],
            [
                'name' => 'Algebraic Expressions',
                'level' => 'ss1',
                'description' => 'Introduction to algebraic terms, expressions, and linear equations.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $algebra,
            'What is the value of x if 2x + 5 = 15?',
            'Solve the simple linear equation by subtracting 5 and dividing by 2.',
            ['5' => true, '10' => false, '15' => false, '2' => false]
        );

        $this->createQuestion(
            $algebra,
            'Simplify: 3(x + 2) - 2x',
            'Distribute 3 to x and 2, then combine like terms: 3x + 6 - 2x = x + 6.',
            ['x + 6' => true, 'x + 2' => false, '5x + 6' => false, 'x + 5' => false]
        );

        $geometry = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'euclidean-geometry'],
            [
                'name' => 'Euclidean Geometry',
                'level' => 'ss1',
                'description' => 'Introduction to plane shapes, lines, angles, and proofs.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $this->createQuestion(
            $geometry,
            'What is the sum of angles in a triangle?',
            'By Euclidean theorem, the sum of internal angles of any triangle is always 180 degrees.',
            ['180°' => true, '90°' => false, '360°' => false, '270°' => false]
        );

        // 2. English
        $english = Subject::updateOrCreate(
            ['slug' => 'english'],
            [
                'name' => 'English Language',
                'description' => 'Grammar, comprehension, and vocabulary development.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $tenses = Topic::updateOrCreate(
            ['subject_id' => $english->id, 'slug' => 'verb-tenses'],
            [
                'name' => 'Verb Tenses',
                'level' => 'ss1',
                'description' => 'Mastery of present, past, and future tense structures.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $tenses,
            'Which sentence is in the present perfect tense?',
            'The present perfect tense is formed with subject + have/has + past participle.',
            ['She has written three essays.' => true, 'She wrote three essays.' => false, 'She is writing three essays.' => false, 'She will write three essays.' => false]
        );

        // 3. Biology
        $biology = Subject::updateOrCreate(
            ['slug' => 'biology'],
            [
                'name' => 'Biology',
                'description' => 'Study of life, cells, genetics, and ecology.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        $cells = Topic::updateOrCreate(
            ['subject_id' => $biology->id, 'slug' => 'cell-structure'],
            [
                'name' => 'Cell Structure & Function',
                'level' => 'ss1',
                'description' => 'Understanding plant and animal cells, organelles, and respiration.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $cells,
            'Which organelle is known as the powerhouse of the cell?',
            'Mitochondria perform cellular respiration to produce ATP, the cells energy currency.',
            ['Mitochondrion' => true, 'Nucleus' => false, 'Ribosome' => false, 'Chloroplast' => false]
        );
    }

    private function createQuestion(Topic $topic, string $text, string $explanation, array $optionsData): Question
    {
        $question = Question::updateOrCreate(
            ['topic_id' => $topic->id, 'question_text' => $text],
            [
                'type' => 'multiple_choice',
                'difficulty' => 'medium',
                'explanation' => $explanation,
                'status' => 'active',
            ]
        );

        $sortOrder = 1;
        foreach ($optionsData as $optionText => $isCorrect) {
            QuestionOption::updateOrCreate(
                ['question_id' => $question->id, 'option_text' => $optionText],
                [
                    'sort_order' => $sortOrder++,
                    'is_correct' => $isCorrect,
                ]
            );
        }

        return $question;
    }
}
