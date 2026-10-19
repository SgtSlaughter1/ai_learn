<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureAccountIsActive;
use App\Enums\UserRole;
use App\Models\ClassModel;
use App\Models\ClassMembership;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizAnswer;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EndpointPerformanceBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    private static array $benchmarkResults = [];

    protected function setUp(): void
    {
        parent::setUp();
        DB::enableQueryLog();
    }

    private function benchmark(string $name, callable $requestFn, int $maxAllowedQueries = 6): mixed
    {
        // Measure the endpoint itself: the once-a-minute account check is covered by AccountStatusTest.
        $this->withSession([EnsureAccountIsActive::SESSION_KEY => now()->getTimestamp()]);
        DB::flushQueryLog();
        $startTime = hrtime(true);

        $response = $requestFn();

        $endTime = hrtime(true);
        $durationMs = round(($endTime - $startTime) / 1e6, 2);
        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        self::$benchmarkResults[] = [
            'endpoint' => $name,
            'status' => $response->status(),
            'duration_ms' => $durationMs,
            'query_count' => $queryCount,
        ];

        // Assert response time is fast (well under 500ms in SQLite in-memory test environment)
        $this->assertLessThan(500, $durationMs, "{$name} exceeded performance threshold ({$durationMs}ms)");

        // Assert query count is bounded (avoids N+1 regressions)
        $this->assertLessThanOrEqual(
            $maxAllowedQueries,
            $queryCount,
            "{$name} executed {$queryCount} queries, exceeding maximum allowed {$maxAllowedQueries}"
        );

        return $response;
    }

    public static function tearDownAfterClass(): void
    {
        parent::tearDownAfterClass();

        if (empty(self::$benchmarkResults)) {
            return;
        }

        echo "\n\n" . str_repeat('=', 78) . "\n";
        echo sprintf("%-38s | %-8s | %-12s | %-10s\n", "API Endpoint Function", "Status", "Latency", "Queries");
        echo str_repeat('-', 78) . "\n";

        foreach (self::$benchmarkResults as $res) {
            echo sprintf(
                "%-38s | %-8d | %-10s ms | %-10d\n",
                $res['endpoint'],
                $res['status'],
                number_format($res['duration_ms'], 2),
                $res['query_count']
            );
        }
        echo str_repeat('=', 78) . "\n\n";
    }

    // ── 1. Auth & Profile ──

    public function test_auth_user_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $response = $this->benchmark('GET /api/v1/auth/user', function () {
            return $this->getJson('/api/v1/auth/user');
        }, maxAllowedQueries: 1);

        $response->assertStatus(200)
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role']]);
    }

    // ── 2. Dashboard Stats ──

    public function test_dashboard_stats_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        // Seed subjects and progress
        $subject = Subject::factory()->create();
        $topic = Topic::factory()->create(['subject_id' => $subject->id]);
        LearnerProgress::create([
            'user_id' => $user->id,
            'topic_id' => $topic->id,
            'questions_attempted' => 20,
            'questions_correct' => 18,
            'mastery_score' => 90,
            'last_attempted_at' => now(),
        ]);

        $response = $this->benchmark('GET /api/v1/dashboard/stats', function () {
            return $this->getJson('/api/v1/dashboard/stats');
        }, maxAllowedQueries: 3);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'stats' => [
                    'totalSubjects',
                    'questionsAttempted',
                    'questionsCorrect',
                    'averageMastery',
                    'completedTopics',
                ],
                'recentAttempts',
            ]);
    }

    // ── 3. Subjects List & Details ──

    public function test_subjects_list_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        // Seed multiple subjects with topics
        for ($i = 1; $i <= 5; $i++) {
            $s = Subject::factory()->create(['name' => "Subject {$i}", 'slug' => "subject-{$i}", 'status' => 'active']);
            for ($j = 1; $j <= 3; $j++) {
                Topic::factory()->create(['subject_id' => $s->id, 'status' => 'active']);
            }
        }

        // With school curriculum filtering and aggregate summaries, executes in <= 4 queries
        $response = $this->benchmark('GET /api/v1/subjects', function () {
            return $this->getJson('/api/v1/subjects');
        }, maxAllowedQueries: 4);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'subjects' => [
                    '*' => ['id', 'name', 'slug', 'description', 'progress_percent', 'topics_count']
                ]
            ]);
    }

    public function test_subject_details_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $subject = Subject::factory()->create(['slug' => 'biology-101', 'status' => 'active']);
        Topic::factory()->create(['subject_id' => $subject->id, 'status' => 'active']);

        $response = $this->benchmark('GET /api/v1/subjects/{subject}', function () use ($subject) {
            return $this->getJson("/api/v1/subjects/{$subject->slug}");
        }, maxAllowedQueries: 5);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'subject' => ['id', 'name', 'slug', 'description'],
                'topics',
                'quizzes'
            ]);
    }

    public function test_subject_topics_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $subject = Subject::factory()->create(['slug' => 'chemistry-101', 'status' => 'active']);
        Topic::factory()->create(['subject_id' => $subject->id, 'status' => 'active']);

        $response = $this->benchmark('GET /api/v1/subjects/{id}/topics', function () use ($subject) {
            return $this->getJson("/api/v1/subjects/{$subject->id}/topics");
        }, maxAllowedQueries: 2);

        $response->assertStatus(200)
            ->assertJsonStructure(['topics']);
    }

    // ── 4. Quizzes & Submissions ──

    public function test_quiz_show_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $subject = Subject::factory()->create();
        $topic = Topic::factory()->create(['subject_id' => $subject->id]);
        $quiz = Quiz::factory()->create(['status' => 'active']);

        $question = Question::factory()->create(['topic_id' => $topic->id, 'status' => 'active']);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);
        $quiz->questions()->attach($question->id, ['sort_order' => 1, 'marks' => 1]);

        $response = $this->benchmark('GET /api/v1/quizzes/{quiz}', function () use ($quiz) {
            return $this->getJson("/api/v1/quizzes/{$quiz->id}");
        }, maxAllowedQueries: 3);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'quiz' => [
                    'id',
                    'title',
                    'questions' => [
                        '*' => ['id', 'topic_id', 'question_text', 'type', 'options']
                    ]
                ]
            ]);
    }

    public function test_quiz_submit_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $subject = Subject::factory()->create();
        $topic = Topic::factory()->create(['subject_id' => $subject->id]);
        $quiz = Quiz::factory()->create(['status' => 'active']);

        $q1 = Question::factory()->create(['topic_id' => $topic->id, 'status' => 'active']);
        $opt1 = QuestionOption::factory()->create(['question_id' => $q1->id, 'is_correct' => true]);
        $quiz->questions()->attach($q1->id, ['sort_order' => 1, 'marks' => 5]);

        $payload = [
            'answers' => [
                $q1->id => $opt1->id,
            ],
            'duration_seconds' => 60,
        ];

        // Should complete in a handful of queries without N+1 loops
        $response = $this->benchmark('POST /api/v1/quizzes/{quiz}/submit', function () use ($quiz, $payload) {
            return $this->postJson("/api/v1/quizzes/{$quiz->id}/submit", $payload);
        }, maxAllowedQueries: 40);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'attempt_id',
                'score',
                'total_marks',
                'percentage',
                'achievements',
            ]);
    }

    public function test_quiz_attempt_details_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $quiz = Quiz::factory()->create();
        $attempt = QuizAttempt::create([
            'user_id' => $user->id,
            'quiz_id' => $quiz->id,
            'status' => 'completed',
            'score' => 10,
            'total_marks' => 10,
            'started_at' => now()->subMinutes(5),
            'completed_at' => now(),
        ]);

        $response = $this->benchmark('GET /api/v1/quizzes/attempts/{id}', function () use ($attempt) {
            return $this->getJson("/api/v1/quizzes/attempts/{$attempt->id}");
        }, maxAllowedQueries: 5);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'attempt' => ['id', 'quiz_title', 'score', 'total_marks', 'answers']
            ]);
    }

    // ── 5. Flashcards ──

    public function test_flashcard_deck_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $subject = Subject::factory()->create();
        $topic = Topic::factory()->create(['subject_id' => $subject->id]);
        $question = Question::factory()->create(['topic_id' => $topic->id, 'status' => 'active']);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);

        $response = $this->benchmark('GET /api/v1/flashcards/deck', function () {
            return $this->getJson('/api/v1/flashcards/deck');
        }, maxAllowedQueries: 6);

        $response->assertStatus(200)
            ->assertJsonStructure(['deck']);
    }

    public function test_flashcard_complete_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $response = $this->benchmark('POST /api/v1/flashcards/complete', function () {
            return $this->postJson('/api/v1/flashcards/complete', [
                'ratings' => ['easy', 'good', 'easy']
            ]);
        }, maxAllowedQueries: 15);

        $response->assertStatus(200)
            ->assertJsonStructure(['success', 'xp_earned', 'new_level', 'new_tier']);
    }

    // ── 6. Gamification ──

    public function test_gamification_profile_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        $response = $this->benchmark('GET /api/v1/gamification/profile', function () {
            return $this->getJson('/api/v1/gamification/profile');
        }, maxAllowedQueries: 6);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'total_xp',
                'level',
                'tier',
                'current_streak',
                'achievements',
            ]);
    }

    public function test_gamification_leaderboard_endpoint_performance(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($user);

        // Seed a few gamification rows
        for ($i = 0; $i < 3; $i++) {
            $other = User::factory()->create(['role' => UserRole::LEARNER]);
            UserGamification::create([
                'user_id' => $other->id,
                'total_xp' => 100 * ($i + 1),
                'level' => 1,
                'tier' => 'Newcomer',
            ]);
        }

        $response = $this->benchmark('GET /api/v1/gamification/leaderboard', function () {
            return $this->getJson('/api/v1/gamification/leaderboard');
        }, maxAllowedQueries: 6);

        $response->assertStatus(200)
            ->assertJsonStructure(['top_users', 'current_user', 'current_user_in_top']);
    }

    // ── 7. Teacher Dashboard ──

    public function test_teacher_stats_endpoint_performance(): void
    {
        $school = School::create([
            'name' => 'Demo High School',
            'slug' => 'demo-high-school',
            'is_active' => true,
        ]);

        $teacher = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        TeacherProfile::create([
            'user_id' => $teacher->id,
            'school_id' => $school->id,
            'is_active' => true,
        ]);

        $class = ClassModel::create([
            'school_id' => $school->id,
            'name' => 'Grade 10 Science',
            'slug' => 'grade-10-science',
            'is_active' => true,
        ]);

        ClassMembership::create([
            'class_id' => $class->id,
            'user_id' => $teacher->id,
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $this->actingAs($teacher);

        $response = $this->benchmark('GET /api/v1/teacher/stats', function () {
            return $this->getJson('/api/v1/teacher/stats');
        }, maxAllowedQueries: 10);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'overview' => [
                    'total_learners',
                    'total_attempted',
                    'total_correct',
                    'avg_mastery',
                    'total_attempts',
                    'avg_score',
                ],
                'top_performers',
                'struggling_learners',
                'classes',
            ]);
    }

    public function test_teacher_class_learners_endpoint_performance(): void
    {
        $school = School::create([
            'name' => 'Science Academy',
            'slug' => 'science-academy',
            'is_active' => true,
        ]);

        $teacher = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        // The admin runs this school (admins may only read their own school's classes).
        $school->update(['admin_user_id' => $teacher->id]);
        $class = ClassModel::create([
            'school_id' => $school->id,
            'name' => 'Biology AP',
            'slug' => 'biology-ap',
            'is_active' => true,
        ]);

        ClassMembership::create([
            'class_id' => $class->id,
            'user_id' => $teacher->id,
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        ClassMembership::create([
            'class_id' => $class->id,
            'user_id' => $learner->id,
            'role' => 'learner',
            'is_active' => true,
        ]);

        $this->actingAs($teacher);

        $response = $this->benchmark('GET /api/v1/teacher/classes/{id}/learners', function () use ($class) {
            return $this->getJson("/api/v1/teacher/classes/{$class->id}/learners");
        }, maxAllowedQueries: 4);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'class' => ['id', 'name', 'learner_count'],
                'learners',
            ]);
    }

    // ── 8. Admin Dashboard ──

    public function test_admin_stats_endpoint_performance(): void
    {
        $admin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $this->actingAs($admin);

        $response = $this->benchmark('GET /api/v1/admin/stats', function () {
            return $this->getJson('/api/v1/admin/stats');
        }, maxAllowedQueries: 16);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'overview' => [
                    'total_schools',
                    'total_school_admins',
                    'total_learners',
                    'total_classes',
                    'total_subjects',
                    'total_quizzes',
                    'total_attempts',
                    'total_questions_answered',
                    'avg_mastery',
                    'struggling_learners',
                ],
                'top_learners',
                'grade_distribution',
            ]);
    }
}
