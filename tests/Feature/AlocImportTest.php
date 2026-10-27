<?php

namespace Tests\Feature;

use App\Models\PastQuestion;
use App\Models\School;
use App\Models\Subject;
use App\Services\PastQuestions\AlocImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlocImportTest extends TestCase
{
    use RefreshDatabase;

    private function row(string $text, ?string $answer = 'b'): array
    {
        return [
            'id' => 101, 'question' => $text, 'year' => 2019,
            'option' => ['a' => 'Two', 'b' => 'Four', 'c' => 'Six', 'd' => 'Eight'],
            'answer' => $answer,
        ];
    }

    public function test_reimporting_finds_the_same_question_and_keeps_option_ids(): void
    {
        $service = app(AlocImportService::class);

        $first = $service->importQuestions([$this->row('What is 2 + 2?')], 'jamb', 'mathematics');
        $optionIds = PastQuestion::first()->options()->orderBy('option_key')->pluck('id')->all();

        // Same question with different spacing and markup.
        $second = $service->importQuestions([$this->row("  What is <b>2 + 2</b>?\n")], 'jamb', 'mathematics');

        $this->assertSame(1, $first['imported']);
        $this->assertSame(1, $second['updated']);
        $this->assertSame(1, PastQuestion::count());
        $this->assertSame($optionIds, PastQuestion::first()->options()->orderBy('option_key')->pluck('id')->all());
    }

    public function test_a_question_without_a_correct_answer_is_imported_as_a_draft(): void
    {
        app(AlocImportService::class)->importQuestions([$this->row('Pick one', null)], 'waec', 'physics');

        $this->assertSame('draft', PastQuestion::first()->status);
    }

    public function test_an_import_never_attaches_to_another_schools_private_subject(): void
    {
        $school = School::create(['name' => 'B', 'slug' => 'b', 'is_active' => true]);
        $private = Subject::factory()->create(['school_id' => $school->id, 'name' => 'Chemistry', 'slug' => 'chemistry']);

        app(AlocImportService::class)->importQuestions([$this->row('H2O is?')], 'neco', 'chemistry');

        $subject = PastQuestion::first()->subject;
        $this->assertNotSame($private->id, $subject->id);
        $this->assertNull($subject->school_id);
    }
}
