<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use App\Services\AIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * What the AI layer actually sends to providers (read from the recorded HTTP requests), and how
 * it behaves when providers fail. No real API calls are made.
 */
class AiPromptAndProviderTest extends TestCase
{
    use RefreshDatabase;

    private const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.api_key' => 'test-groq-key',
            'services.groq.model' => 'model-a',
            'services.groq.fallback_model' => 'model-b',
            'services.groq.base_url' => 'https://api.groq.com/openai/v1',
            'services.gemini.api_key' => 'test-gemini-key',
            'services.ai.provider' => 'groq',
        ]);
        Cache::flush();
    }

    private static function groqReply(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content]]]];
    }

    /** The system prompt of the first request sent to Groq. */
    private function sentSystemPrompt(): string
    {
        $request = collect(Http::recorded())->first()[0];

        return (string) collect($request['messages'])->firstWhere('role', 'system')['content'];
    }

    /** @return array{0: User, 1: User, 2: User} teacher, own learner, other school's learner */
    private function twoSchools(): array
    {
        $make = function (string $suffix) {
            $school = School::create(['name' => "School {$suffix}", 'slug' => "school-{$suffix}", 'is_active' => true]);
            $class = ClassModel::create(['school_id' => $school->id, 'name' => "SS1 {$suffix}", 'slug' => "ss1-{$suffix}", 'grade_level' => 'SS1', 'is_active' => true]);
            $subject = Subject::factory()->create(['school_id' => $school->id, 'class_id' => $class->id, 'slug' => "maths-{$suffix}", 'status' => 'active']);
            $topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS1', 'status' => 'active']);

            return [$school, $class, $topic];
        };
        [$schoolA, $classA, $topicA] = $make('a');
        [$schoolB, $classB, $topicB] = $make('b');

        $teacher = User::factory()->create(['role' => UserRole::TEACHER, 'name' => 'Amaka Teacher']);
        TeacherProfile::create(['user_id' => $teacher->id, 'school_id' => $schoolA->id]);
        ClassMembership::create(['class_id' => $classA->id, 'user_id' => $teacher->id, 'role' => 'teacher', 'is_active' => true]);

        $learner = function (string $name, School $school, ClassModel $class, Topic $topic) {
            $l = User::factory()->create(['role' => UserRole::LEARNER, 'name' => $name]);
            LearnerProfile::create(['user_id' => $l->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
            ClassMembership::create(['class_id' => $class->id, 'user_id' => $l->id, 'role' => 'learner', 'is_active' => true]);
            LearnerProgress::create(['user_id' => $l->id, 'topic_id' => $topic->id, 'questions_attempted' => 10, 'questions_correct' => 3, 'mastery_score' => 30]);

            return $l;
        };

        return [$teacher, $learner('Chidi Ownclass', $schoolA, $classA, $topicA), $learner('David Otherschool', $schoolB, $classB, $topicB)];
    }

    // A5

    public function test_teacher_prompt_names_only_their_own_learners_and_only_when_asked_about_students(): void
    {
        [$teacher] = $this->twoSchools();
        Http::fake([self::GROQ => Http::response(self::groqReply('ok'))]);

        app(AIService::class)->generateChatResponse($teacher, 'Which students need extra help?', []);
        $prompt = $this->sentSystemPrompt();
        $this->assertStringContainsString('Chidi Ownclass', $prompt);
        $this->assertStringNotContainsString('David Otherschool', $prompt);

        Http::fake([self::GROQ => Http::response(self::groqReply('ok'))]);
        app(AIService::class)->generateChatResponse($teacher, 'Draft a lesson plan on photosynthesis.', []);
        $this->assertStringNotContainsString('Chidi Ownclass', collect(Http::recorded())->last()[0]['messages'][0]['content']);
    }

    public function test_learner_prompt_uses_the_first_name_only(): void
    {
        [, $learner] = $this->twoSchools();
        Http::fake([self::GROQ => Http::response(self::groqReply('ok'))]);

        app(AIService::class)->generateChatResponse($learner, 'Help me revise.', []);

        $prompt = $this->sentSystemPrompt();
        $this->assertStringContainsString('Chidi', $prompt);
        $this->assertStringNotContainsString('Ownclass', $prompt);
    }

    // A1

    public function test_a_rate_limited_model_is_skipped_on_the_next_request(): void
    {
        Http::fake([
            self::GROQ => Http::sequence()
                ->push(['error' => 'rate limited'], 429, ['Retry-After' => '30'])
                ->push(self::groqReply('From B'))
                ->push(self::groqReply('From B again')),
        ]);
        $ai = new class extends AIService
        {
            public function ask(): ?string
            {
                return $this->generate([['role' => 'user', 'parts' => [['text' => 'Hi']]]]);
            }
        };

        $this->assertSame('From B', $ai->ask());
        $this->assertSame('From B again', $ai->ask());

        // model-a was tried once, then left alone while cooling down.
        $models = collect(Http::recorded())->map(fn ($pair) => $pair[0]['model'])->all();
        $this->assertSame(['model-a', 'model-b', 'model-b'], $models);
    }

    // A2

    public function test_the_gemini_key_is_sent_in_a_header_not_the_url(): void
    {
        config(['services.ai.provider' => 'gemini']);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => 'Hi']]]]]]),
        ]);
        $ai = new class extends AIService
        {
            public function ask(): ?string
            {
                return $this->generate([['role' => 'user', 'parts' => [['text' => 'Hi']]]]);
            }
        };

        $ai->ask();

        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'generativelanguage')
            && ! str_contains($r->url(), 'test-gemini-key')
            && $r->hasHeader('x-goog-api-key', 'test-gemini-key'));
    }

    // A9

    public function test_the_offline_tutor_grades_the_question_it_actually_showed(): void
    {
        config(['services.ai.provider' => 'local']);
        $learner = User::factory()->create(['role' => UserRole::LEARNER, 'name' => 'Ada Learner']);
        $subject = Subject::factory()->create(['school_id' => null, 'class_id' => null, 'status' => 'active']);
        $topic = Topic::factory()->create(['subject_id' => $subject->id, 'status' => 'active']);

        // A decoy that shares the word "practice" with the tutor's heading.
        $decoy = Question::factory()->create(['topic_id' => $topic->id, 'school_id' => null, 'status' => 'active', 'question_text' => 'Which practice improves recall?']);
        QuestionOption::factory()->create(['question_id' => $decoy->id, 'option_text' => 'Rereading', 'is_correct' => true]);
        QuestionOption::factory()->create(['question_id' => $decoy->id, 'option_text' => 'Testing', 'is_correct' => false]);

        $shown = Question::factory()->create(['topic_id' => $topic->id, 'school_id' => null, 'status' => 'active', 'question_text' => 'What is the capital of Nigeria?']);
        QuestionOption::factory()->create(['question_id' => $shown->id, 'option_text' => 'Lagos', 'is_correct' => false]);
        QuestionOption::factory()->create(['question_id' => $shown->id, 'option_text' => 'Abuja', 'is_correct' => true]);

        $history = [['role' => 'model', 'content' => "### Practice Problem\nWhat is the capital of Nigeria?\nA. Lagos\nB. Abuja"]];
        $reply = app(AIService::class)->generateChatResponse($learner, 'B', $history);

        $this->assertStringContainsString('correct', $reply);
        $this->assertStringNotContainsString('not quite right', $reply);
    }

    // A4 + A6

    public function test_explanations_handle_missing_or_double_answer_keys(): void
    {
        config(['services.ai.provider' => 'local']);
        $topic = Topic::factory()->create();
        $question = Question::factory()->create(['topic_id' => $topic->id]);
        $a = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);

        $this->assertSame(AIService::MISSING_ANSWER_KEY, app(AIService::class)->explainAnswer($question, $a->id));

        $b = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        $c = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        $question->unsetRelation('options');
        $explanation = app(AIService::class)->explainAnswer($question, $c->id);
        $this->assertStringNotContainsStringIgnoringCase('incorrect', $explanation);
    }

    public function test_offline_explanations_are_not_kept_for_30_days(): void
    {
        config(['services.ai.provider' => 'local']);
        $topic = Topic::factory()->create();
        $question = Question::factory()->create(['topic_id' => $topic->id]);
        $right = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);

        app(AIService::class)->explainAnswer($question, $right->id);

        $this->travel(11)->minutes();
        $key = 'ai_explain_q_'.$question->id.'_'.$question->updated_at->timestamp.'_'.$right->id;
        $this->assertNull(Cache::get($key));
    }
}
