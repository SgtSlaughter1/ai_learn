<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Http\Resources\QuestionOptionResource;
use App\Http\Resources\QuestionResource;
use App\Models\ContentPackage;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizAnswer;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class DomainModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_models_and_relationships_work_correctly(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $subject = Subject::factory()->create(['name' => 'Math', 'slug' => 'math']);
        
        $topic = Topic::factory()->create([
            'subject_id' => $subject->id,
            'name' => 'Algebra',
            'slug' => 'algebra'
        ]);

        $question = Question::factory()->create([
            'topic_id' => $topic->id,
            'question_text' => 'What is 1+1?'
        ]);

        $option1 = QuestionOption::factory()->create([
            'question_id' => $question->id,
            'option_text' => '2',
            'is_correct' => true
        ]);

        $option2 = QuestionOption::factory()->create([
            'question_id' => $question->id,
            'option_text' => '3',
            'is_correct' => false
        ]);

        $quiz = Quiz::factory()->create(['title' => 'Algebra Quiz']);
        $quiz->questions()->attach($question->id, ['sort_order' => 1, 'marks' => 2]);

        $attempt = QuizAttempt::create([
            'user_id' => $user->id,
            'quiz_id' => $quiz->id,
            'status' => 'started',
            'started_at' => now(),
        ]);

        $answer = QuizAnswer::create([
            'quiz_attempt_id' => $attempt->id,
            'question_id' => $question->id,
            'selected_option_id' => $option1->id,
            'is_correct' => true,
            'marks_awarded' => 2,
        ]);

        $progress = LearnerProgress::create([
            'user_id' => $user->id,
            'topic_id' => $topic->id,
            'questions_attempted' => 1,
            'questions_correct' => 1,
            'mastery_score' => 100,
            'last_attempted_at' => now(),
        ]);

        $contentPackage = ContentPackage::create([
            'subject_id' => $subject->id,
            'level' => 'ss1',
            'version' => '1.0.0',
            'status' => 'published'
        ]);

        // Asserts
        $this->assertEquals(UserRole::LEARNER, $user->role);
        $this->assertCount(1, $subject->topics);
        $this->assertEquals('Algebra', $subject->topics->first()->name);
        $this->assertCount(1, $topic->questions);
        $this->assertCount(2, $question->options);
        $this->assertCount(1, $quiz->questions);
        $this->assertEquals(2, $quiz->questions->first()->pivot->marks);
        $this->assertCount(1, $attempt->answers);
        $this->assertEquals($attempt->id, $answer->attempt->id);
        $this->assertEquals($user->id, $progress->user->id);
        $this->assertEquals($subject->id, $contentPackage->subject->id);
    }

    public function test_cascade_delete_constraints(): void
    {
        $subject = Subject::factory()->create();
        $topic = Topic::factory()->create(['subject_id' => $subject->id]);
        $question = Question::factory()->create(['topic_id' => $topic->id]);
        $option = QuestionOption::factory()->create(['question_id' => $question->id]);

        // Deleting a question must cascade and delete its options
        $question->delete();
        $this->assertDatabaseMissing('question_options', ['id' => $option->id]);

        // Deleting a subject must cascade and delete its topics
        $subject->forceDelete();
        $this->assertDatabaseMissing('topics', ['id' => $topic->id]);
    }

    public function test_restrict_delete_on_attempts_to_protect_history(): void
    {
        $user = User::factory()->create();
        $quiz = Quiz::factory()->create();
        
        $attempt = QuizAttempt::create([
            'user_id' => $user->id,
            'quiz_id' => $quiz->id,
            'status' => 'started',
            'started_at' => now(),
        ]);

        // Deleting the user must throw a restrict database exception to protect attempt history
        $this->expectException(\PDOException::class);
        $user->delete();
    }

    public function test_api_resources_securely_serialize_correct_answer(): void
    {
        $question = Question::factory()->create();
        $option = QuestionOption::factory()->create([
            'question_id' => $question->id,
            'option_text' => 'Correct Option',
            'is_correct' => true
        ]);

        $request = Request::create('/', 'GET');
        
        // Load relationship
        $question->setRelation('options', collect([$option]));

        $serializedOption = (new QuestionOptionResource($option))->toArray($request);
        $serializedQuestion = (new QuestionResource($question))->toArray($request);

        // Assert is_correct is not leaked
        $this->assertArrayNotHasKey('is_correct', $serializedOption);
        
        // Assert question explanation is not leaked (for student consumption)
        $this->assertArrayNotHasKey('explanation', $serializedQuestion);
    }

    public function test_subject_policies_authorize_actions(): void
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);

        $subject = Subject::factory()->create(['status' => 'inactive']);

        // Inactive subjects cannot be viewed by learners
        $this->assertFalse($learner->can('view', $subject));
        // Inactive subjects can be viewed by teachers and admins
        $this->assertTrue($teacher->can('view', $subject));
        $this->assertTrue($admin->can('view', $subject));

        // Learners cannot create subjects
        $this->assertFalse($learner->can('create', Subject::class));
        // Teachers and Admins can create subjects
        $this->assertTrue($teacher->can('create', Subject::class));
        $this->assertTrue($admin->can('create', Subject::class));

        // Only Admins can delete subjects
        $this->assertFalse($learner->can('delete', $subject));
        $this->assertFalse($teacher->can('delete', $subject));
        $this->assertTrue($admin->can('delete', $subject));
    }

    public function test_ai_endpoints_explain_and_chat(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $subject = Subject::factory()->create(['name' => 'Biology', 'slug' => 'biology']);
        $topic = Topic::factory()->create(['subject_id' => $subject->id, 'name' => 'Cells', 'slug' => 'cells']);
        $question = Question::factory()->create(['topic_id' => $topic->id, 'question_text' => 'What is mitochondria?']);
        $option = QuestionOption::factory()->create(['question_id' => $question->id, 'option_text' => 'Powerhouse', 'is_correct' => true]);

        $this->actingAs($user);

        // 1. Test AI Explain endpoint
        $explainResponse = $this->postJson('/api/v1/ai/explain', [
            'question_id' => $question->id,
            'selected_option_id' => $option->id,
        ]);
        $explainResponse->assertStatus(200);
        $explainResponse->assertJsonStructure(['explanation']);

        // 2. Test AI Chat endpoint
        $chatResponse = $this->postJson('/api/v1/ai/chat', [
            'message' => 'hello',
            'history' => [],
        ]);
        $chatResponse->assertStatus(200);
        $chatResponse->assertJsonStructure(['response']);
    }

    public function test_flashcard_endpoints(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        // Test shell index render
        $response = $this->get('/flashcards');
        $response->assertStatus(200);

        // Test deck API endpoint
        $apiResponse = $this->getJson('/api/v1/flashcards/deck');
        $apiResponse->assertStatus(200);
        $apiResponse->assertJsonStructure(['deck']);

        // Test complete API endpoint
        $completeResponse = $this->postJson('/api/v1/flashcards/complete', [
            'ratings' => ['easy', 'good', 'again', 'easy']
        ]);
        $completeResponse->assertStatus(200);
        $completeResponse->assertJsonStructure([
            'success',
            'xp_earned',
            'new_level',
            'new_rank',
            'new_achievements'
        ]);
        // Calculate: easy (2) + good (1) + again (0) + easy (2) = 5 XP. Deck complete bonus = 5 XP. Total = 10 XP.
        $completeResponse->assertJsonFragment(['xp_earned' => 10]);
    }

    public function test_teacher_dashboard_access_and_stats(): void
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $teacher = User::factory()->create(['role' => UserRole::TEACHER]);

        // 1. Learner gets 403 trying to access teacher dashboard or stats
        $this->actingAs($learner);
        $this->get('/teacher/dashboard')->assertStatus(403);
        $this->getJson('/api/v1/teacher/stats')->assertStatus(403);

        // 2. Learner gets default /dashboard view (loads Inertia page, status 200)
        $this->get('/dashboard')->assertStatus(200);

        // 3. Teacher can access dashboard and stats
        $this->actingAs($teacher);
        $this->get('/teacher/dashboard')->assertStatus(200);
        $this->getJson('/api/v1/teacher/stats')->assertStatus(200)
            ->assertJsonStructure([
                'stats' => ['totalStudents', 'classAverageMastery', 'activeStudents'],
                'recentActivities'
            ]);

        // 4. Teacher gets redirected from /dashboard to /teacher/dashboard
        $this->get('/dashboard')->assertRedirect('/teacher/dashboard');
    }
}
