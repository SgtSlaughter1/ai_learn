<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Services\AIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AIQuestionImportAndBulkSaveTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected Subject $subject;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::factory()->create([
            'role' => UserRole::PLATFORM_ADMIN,
        ]);

        $this->subject = Subject::factory()->create([
            'name' => 'Integrated Science',
            'slug' => 'integrated-science',
        ]);

        $this->topic = Topic::factory()->create([
            'subject_id' => $this->subject->id,
            'name' => 'Cell Biology & Photosynthesis',
            'slug' => 'cell-biology',
            'level' => 'JSS 1',
        ]);
    }

    public function test_ai_service_extracts_and_solves_questions_from_raw_text(): void
    {
        $aiService = app(AIService::class);

        $rawText = <<<TEXT
1. What is the process by which green plants manufacture food using sunlight?
A) Respiration
B) Photosynthesis
C) Transpiration
D) Fermentation
Answer: B
Explanation: Photosynthesis uses chlorophyll, carbon dioxide, water, and sunlight to produce glucose.

2. Which organelle is known as the powerhouse of the cell?
A) Ribosome
B) Nucleus
C) Mitochondria
D) Endoplasmic reticulum

3. What is the value of x if 2x + 6 = 18?
A) 4
B) 6
C) 8
D) 12
Ans: B
TEXT;

        $extracted = $aiService->extractAndSolveQuestions(
            $rawText,
            $this->subject->name,
            $this->topic->name
        );

        $this->assertIsArray($extracted);
        $this->assertCount(3, $extracted);

        // Check question 1
        $q1 = $extracted[0];
        $this->assertStringContainsString('process by which green plants', $q1['question_text']);
        $this->assertCount(4, $q1['options']);
        $correctOpts1 = array_filter($q1['options'], fn($o) => $o['is_correct'] === true);
        $this->assertCount(1, $correctOpts1);
        $this->assertEquals('Photosynthesis', array_values($correctOpts1)[0]['option_text']);

        // Check question 2 (auto-solved / guessed)
        $q2 = $extracted[1];
        $this->assertStringContainsString('powerhouse of the cell', $q2['question_text']);
        $this->assertCount(4, $q2['options']);
        $correctOpts2 = array_filter($q2['options'], fn($o) => $o['is_correct'] === true);
        $this->assertCount(1, $correctOpts2);

        // Check question 3
        $q3 = $extracted[2];
        $this->assertStringContainsString('2x + 6 = 18', $q3['question_text']);
        $correctOpts3 = array_filter($q3['options'], fn($o) => $o['is_correct'] === true);
        $this->assertCount(1, $correctOpts3);
        $this->assertEquals('6', array_values($correctOpts3)[0]['option_text']);
    }

    public function test_ai_extract_endpoint_returns_structured_questions(): void
    {
        $rawText = <<<TEXT
1. What organ pumps blood through the human body?
A) Brain
B) Heart
C) Lungs
D) Kidney
Answer: B
Explanation: The heart is a muscular organ that pumps blood through the circulatory system.
TEXT;

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/questions/ai-extract', [
                'raw_text' => $rawText,
                'subject_id' => $this->subject->id,
                'topic_id' => $this->topic->id,
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'questions' => [
                    '*' => [
                        'question_text',
                        'type',
                        'difficulty',
                        'explanation',
                        'options' => [
                            '*' => [
                                'option_text',
                                'is_correct',
                            ]
                        ]
                    ]
                ]
            ]);

        $questions = $response->json('questions');
        $this->assertCount(1, $questions);
        $this->assertStringContainsString('pumps blood', $questions[0]['question_text']);
        $this->assertTrue($questions[0]['options'][1]['is_correct']);
        $this->assertEquals('Heart', $questions[0]['options'][1]['option_text']);
    }

    public function test_bulk_store_questions_saves_to_database_atomically(): void
    {
        $payload = [
            'topic_id' => $this->topic->id,
            'questions' => [
                [
                    'question_text' => 'What is the primary gas absorbed by plants during photosynthesis?',
                    'type' => 'multiple_choice',
                    'difficulty' => 'easy',
                    'explanation' => 'Plants absorb Carbon Dioxide from the atmosphere.',
                    'status' => 'active',
                    'options' => [
                        ['option_text' => 'Oxygen', 'is_correct' => false],
                        ['option_text' => 'Carbon Dioxide', 'is_correct' => true],
                        ['option_text' => 'Nitrogen', 'is_correct' => false],
                        ['option_text' => 'Hydrogen', 'is_correct' => false],
                    ],
                ],
                [
                    'question_text' => 'Which of the following is an example of an involuntary action?',
                    'type' => 'multiple_choice',
                    'difficulty' => 'medium',
                    'explanation' => 'Heartbeat and digestion occur automatically without conscious control.',
                    'status' => 'active',
                    'options' => [
                        ['option_text' => 'Running', 'is_correct' => false],
                        ['option_text' => 'Singing', 'is_correct' => false],
                        ['option_text' => 'Heartbeat', 'is_correct' => true],
                        ['option_text' => 'Writing', 'is_correct' => false],
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/questions/bulk', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'count' => 2,
            ]);

        // Verify Database Records
        $this->assertDatabaseCount('questions', 2);
        $this->assertDatabaseCount('question_options', 8);

        // Verify Question 1 in DB
        $q1 = Question::where('question_text', 'like', '%photosynthesis%')->first();
        $this->assertNotNull($q1);
        $this->assertEquals($this->topic->id, $q1->topic_id);
        $this->assertEquals('easy', $q1->difficulty);
        $this->assertCount(4, $q1->options);
        
        $correctOption1 = $q1->options()->where('is_correct', true)->first();
        $this->assertNotNull($correctOption1);
        $this->assertEquals('Carbon Dioxide', $correctOption1->option_text);

        // Verify Question 2 in DB
        $q2 = Question::where('question_text', 'like', '%involuntary action%')->first();
        $this->assertNotNull($q2);
        $this->assertEquals('medium', $q2->difficulty);
        $this->assertCount(4, $q2->options);

        $correctOption2 = $q2->options()->where('is_correct', true)->first();
        $this->assertNotNull($correctOption2);
        $this->assertEquals('Heartbeat', $correctOption2->option_text);

        // Verify that topic assessment quiz has linked these questions
        $quiz = Quiz::where('topic_id', $this->topic->id)->first();
        if ($quiz) {
            $this->assertGreaterThanOrEqual(2, $quiz->questions()->count());
        }
    }

    public function test_ai_service_dynamically_learns_and_drafts_from_uploaded_questions(): void
    {
        // 1. Create custom uploaded questions in General Knowledge / Subject
        $mathSubject = Subject::factory()->create(['name' => 'Mathematics', 'slug' => 'mathematics']);
        $mathTopic = Topic::factory()->create([
            'subject_id' => $mathSubject->id,
            'name' => 'Polynomials & Factoring',
            'slug' => 'polynomials',
        ]);

        $customQuestion = Question::factory()->create([
            'topic_id' => $mathTopic->id,
            'question_text' => 'Custom Uploaded: What is the factored form of 2x^2 + 4x?',
            'explanation' => 'Factor out 2x to get 2x(x + 2).',
            'status' => 'active',
            'school_id' => null, // General Knowledge
        ]);

        QuestionOption::factory()->create([
            'question_id' => $customQuestion->id,
            'option_text' => '2x(x + 2)',
            'is_correct' => true,
        ]);
        QuestionOption::factory()->create([
            'question_id' => $customQuestion->id,
            'option_text' => '2(x + 4)',
            'is_correct' => false,
        ]);

        $prevProvider = $_ENV['AI_PROVIDER'] ?? getenv('AI_PROVIDER');
        $prevGeminiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY');
        $prevGoogleKey = $_ENV['GOOGLE_API_KEY'] ?? getenv('GOOGLE_API_KEY');

        putenv('AI_PROVIDER=local');
        putenv('GEMINI_API_KEY=');
        putenv('GOOGLE_API_KEY=');
        $_ENV['AI_PROVIDER'] = 'local';
        $_ENV['GEMINI_API_KEY'] = '';
        $_ENV['GOOGLE_API_KEY'] = '';

        try {
            $aiService = new AIService('local', '');
            $response = $aiService->generateChatResponse(
                $this->adminUser,
                'Draft 5 WAEC exam questions for Mathematics',
                []
            );

            // Verify that the custom uploaded question is dynamically included in the response
            $this->assertStringContainsString('Custom Uploaded: What is the factored form of 2x^2 + 4x?', $response);
            $this->assertStringContainsString('2x(x + 2)', $response);
            $this->assertStringContainsString('Factor out 2x to get 2x(x + 2)', $response);
        } finally {
            putenv('AI_PROVIDER=' . ($prevProvider !== false && $prevProvider !== null ? $prevProvider : ''));
            putenv('GEMINI_API_KEY=' . ($prevGeminiKey !== false && $prevGeminiKey !== null ? $prevGeminiKey : ''));
            putenv('GOOGLE_API_KEY=' . ($prevGoogleKey !== false && $prevGoogleKey !== null ? $prevGoogleKey : ''));
            if ($prevProvider !== null && $prevProvider !== false) $_ENV['AI_PROVIDER'] = $prevProvider; else unset($_ENV['AI_PROVIDER']);
            if ($prevGeminiKey !== null && $prevGeminiKey !== false) $_ENV['GEMINI_API_KEY'] = $prevGeminiKey; else unset($_ENV['GEMINI_API_KEY']);
            if ($prevGoogleKey !== null && $prevGoogleKey !== false) $_ENV['GOOGLE_API_KEY'] = $prevGoogleKey; else unset($_ENV['GOOGLE_API_KEY']);
        }
    }

    public function test_ai_service_generates_questions_for_topic(): void
    {
        $aiService = app(AIService::class);
        $questions = $aiService->generateQuestionsForTopic(
            topicName: $this->topic->name,
            subjectName: $this->subject->name,
            count: 10
        );

        $this->assertCount(10, $questions);
        foreach ($questions as $q) {
            $this->assertArrayHasKey('question_text', $q);
            $this->assertNotEmpty($q['question_text']);
            $this->assertArrayHasKey('type', $q);
            $this->assertArrayHasKey('difficulty', $q);
            $this->assertArrayHasKey('explanation', $q);
            $this->assertArrayHasKey('options', $q);
            $this->assertCount(4, $q['options']);

            $correctOpts = array_filter($q['options'], fn($o) => !empty($o['is_correct']));
            $this->assertCount(1, $correctOpts, 'Each generated question must have exactly one correct option.');
        }
    }

    public function test_ai_generate_endpoint_returns_questions_successfully(): void
    {
        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/questions/ai-generate', [
                'topic_id' => $this->topic->id,
                'subject_id' => $this->subject->id,
                'count' => 10,
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'count',
                'questions' => [
                    '*' => [
                        'question_text',
                        'type',
                        'difficulty',
                        'explanation',
                        'options' => [
                            '*' => [
                                'option_text',
                                'is_correct',
                            ]
                        ]
                    ]
                ],
                'topic' => [
                    'id',
                    'name',
                    'subject_id',
                ]
            ]);

        $data = $response->json();
        $this->assertEquals(10, $data['count']);
        $this->assertCount(10, $data['questions']);
    }
}
