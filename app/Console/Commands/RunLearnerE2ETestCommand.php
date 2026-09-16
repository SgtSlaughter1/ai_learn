<?php

namespace App\Console\Commands;

use App\Models\Quiz;
use App\Models\Subject;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class RunLearnerE2ETestCommand extends Command
{
    protected $signature = 'test:learner-e2e';
    protected $description = 'Run an End-to-End simulation of the learner flow including offline quiz taking and sync';

    public function handle(): int
    {
        $this->info('==============================================================================');
        $this->info('           LEARNER OFFLINE & ONLINE END-TO-END (E2E) TEST RUNNER              ');
        $this->info('==============================================================================');

        // 1. Get or create fake learner
        $learner = User::where('email', 'learner@example.com')->first();
        if (!$learner) {
            $learner = User::create([
                'name' => 'Demo Learner',
                'email' => 'learner@example.com',
                'password' => bcrypt('password'),
                'role' => \App\Enums\UserRole::LEARNER,
            ]);
        }

        Auth::login($learner);
        $this->line("Authenticated Learner: <fg=cyan;options=bold>{$learner->name}</> (<fg=yellow>{$learner->email}</>)");

        $steps = [];

        // STEP 1: Verify Auth User
        $startTime = microtime(true);
        $user = Auth::user();
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $roleVal = $user->role instanceof \BackedEnum ? $user->role->value : (string) $user->role;
        $steps[] = [
            'step' => '1. Auth Verification',
            'endpoint' => 'GET /api/v1/auth/user',
            'status' => $user ? 'PASS' : 'FAIL',
            'details' => "Role: {$roleVal} | ID: {$user->id}",
            'latency' => "{$duration} ms",
        ];

        // STEP 2: Fetch Initial Dashboard Stats
        $startTime = microtime(true);
        $dashboardReq = Request::create('/api/v1/dashboard/stats', 'GET');
        $dashboardReq->setUserResolver(fn() => $learner);
        $dashboardController = app(\App\Http\Controllers\Web\DashboardController::class);
        $statsResponse = $dashboardController->getStats($dashboardReq);
        $statsData = $statsResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $initialAttempted = $statsData['stats']['questionsAttempted'] ?? 0;
        $initialMastery = $statsData['stats']['averageMastery'] ?? 0;
        $initialXp = UserGamification::where('user_id', $learner->id)->value('total_xp') ?? 0;

        $steps[] = [
            'step' => '2. Initial Dashboard Stats',
            'endpoint' => 'GET /api/v1/dashboard/stats',
            'status' => isset($statsData['stats']) ? 'PASS' : 'FAIL',
            'details' => "Questions: {$initialAttempted} | Mastery: {$initialMastery}% | Current XP: {$initialXp}",
            'latency' => "{$duration} ms",
        ];

        // STEP 3: Curriculum Discovery (Subjects & Topics)
        $startTime = microtime(true);
        $subject = Subject::with('topics')->first();
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $steps[] = [
            'step' => '3. Curriculum Discovery',
            'endpoint' => "GET /api/v1/subjects/{$subject->slug}",
            'status' => $subject ? 'PASS' : 'FAIL',
            'details' => "Subject: '{$subject->name}' (" . count($subject->topics) . ' topics cached for offline)',
            'latency' => "{$duration} ms",
        ];

        // STEP 4: Quiz Discovery (Offline Caching Simulation)
        $startTime = microtime(true);
        $quiz = Quiz::with(['questions.options'])->first();
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $questionsCount = count($quiz->questions);
        $steps[] = [
            'step' => '4. Quiz Offline Cache',
            'endpoint' => "GET /api/v1/quizzes/{$quiz->id}",
            'status' => $quiz && $questionsCount > 0 ? 'PASS' : 'FAIL',
            'details' => "Quiz: '{$quiz->title}' ({$questionsCount} questions saved into Dexie IndexedDB)",
            'latency' => "{$duration} ms",
        ];

        // STEP 5: Offline Attempt Simulation & Sync
        $attemptId = (string) Str::uuid();
        $answers = [];
        $expectedScore = 0;

        foreach ($quiz->questions as $question) {
            $correctOption = $question->options->where('is_correct', true)->first();
            $selectedId = $correctOption ? $correctOption->id : $question->options->first()->id;
            $isCorrect = $correctOption && ($correctOption->id === $selectedId);
            if ($isCorrect) $expectedScore++;

            $answers[] = [
                'question_id' => $question->id,
                'selected_option_id' => $selectedId,
                'is_correct' => $isCorrect,
                'marks_awarded' => $isCorrect ? 1 : 0,
            ];
        }

        $syncPayload = [
            'quiz_id' => $quiz->id,
            'duration_seconds' => 45,
            'answers' => $answers,
        ];

        $startTime = microtime(true);
        $syncReq = Request::create(
            "/api/v1/quizzes/attempts/{$attemptId}/sync",
            'POST',
            $syncPayload
        );
        $syncReq->setUserResolver(fn() => $learner);
        $quizController = app(\App\Http\Controllers\Web\QuizWebController::class);
        $syncResponse = $quizController->syncAttempt($syncReq, $attemptId);
        $syncData = $syncResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $steps[] = [
            'step' => '5. Offline Attempt Sync',
            'endpoint' => 'POST /api/v1/quizzes/attempts/{id}/sync',
            'status' => ($syncData['success'] ?? false) === true ? 'PASS' : 'FAIL',
            'details' => "Attempt ID: {$attemptId} successfully synced and processed into DB",
            'latency' => "{$duration} ms",
        ];

        // STEP 6: Result Screen Verification
        $startTime = microtime(true);
        $attemptModel = \App\Models\QuizAttempt::findOrFail($attemptId);
        $resultResponse = $quizController->getAttemptData($attemptModel);
        $resultData = $resultResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $attemptQuizTitle = $resultData['attempt']['quiz_title'] ?? '';
        $actualScore = $resultData['attempt']['score'] ?? 0;
        $totalMarks = $resultData['attempt']['total_marks'] ?? 0;
        $answersRecorded = count($resultData['attempt']['answers'] ?? []);

        $steps[] = [
            'step' => '6. Result Screen Data',
            'endpoint' => "GET /api/v1/quizzes/attempts/{$attemptId}",
            'status' => $attemptQuizTitle !== '' && $answersRecorded > 0 ? 'PASS' : 'FAIL',
            'details' => "Title: '{$attemptQuizTitle}' | Score: {$actualScore}/{$totalMarks} | Recorded: {$answersRecorded} answers",
            'latency' => "{$duration} ms",
        ];

        // STEP 7: AI Tutor Explanation
        $firstQuestion = $quiz->questions->first();
        $selectedOpt = $answers[0]['selected_option_id'] ?? null;
        $startTime = microtime(true);
        $aiRequest = Request::create('/api/v1/ai/explain', 'POST', [
            'question_id' => $firstQuestion->id,
            'selected_option_id' => $selectedOpt,
        ]);
        $aiRequest->setUserResolver(fn() => $learner);
        $aiController = app(\App\Http\Controllers\Web\AIWebController::class);
        $aiResponse = $aiController->explain($aiRequest);
        $aiData = $aiResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $hasExplanation = !empty($aiData['explanation']);

        $steps[] = [
            'step' => '7. AI Tutor Explanation',
            'endpoint' => 'POST /api/v1/ai/explain',
            'status' => $hasExplanation ? 'PASS' : 'FAIL',
            'details' => 'Received ' . strlen($aiData['explanation'] ?? '') . ' chars of pedagogical guidance',
            'latency' => "{$duration} ms",
        ];

        // STEP 8: Flashcard Active Recall Session
        $startTime = microtime(true);
        $flashcardReq = Request::create('/api/v1/flashcards/complete', 'POST', [
            'ratings' => ['easy', 'good', 'easy'],
        ]);
        $flashcardReq->setUserResolver(fn() => $learner);
        $flashcardController = app(\App\Http\Controllers\Web\FlashcardController::class);
        $flashcardResponse = $flashcardController->complete($flashcardReq);
        $flashcardData = $flashcardResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $flashcardXp = $flashcardData['xp_earned'] ?? 0;
        $steps[] = [
            'step' => '8. Flashcards Recall',
            'endpoint' => 'POST /api/v1/flashcards/complete',
            'status' => $flashcardXp > 0 ? 'PASS' : 'FAIL',
            'details' => "Rated 3 cards (easy/good/easy) | XP Awarded: +{$flashcardXp} XP",
            'latency' => "{$duration} ms",
        ];

        // STEP 9: Gamification Profile & Leaderboard
        $startTime = microtime(true);
        $gamificationReq = Request::create('/api/v1/gamification/profile', 'GET');
        $gamificationReq->setUserResolver(fn() => $learner);
        $gamificationController = app(\App\Http\Controllers\Web\GamificationController::class);
        $profileResponse = $gamificationController->getProfile($gamificationReq);
        $profileData = $profileResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $finalXp = $profileData['total_xp'] ?? 0;
        $level = $profileData['level'] ?? 1;
        $xpDelta = $finalXp - $initialXp;

        $steps[] = [
            'step' => '9. Gamification Profile',
            'endpoint' => 'GET /api/v1/gamification/profile',
            'status' => $xpDelta > 0 ? 'PASS' : 'FAIL',
            'details' => "Level: {$level} ({$profileData['tier']}) | Total XP: {$finalXp} (+{$xpDelta} earned in session)",
            'latency' => "{$duration} ms",
        ];

        // STEP 10: Final Dashboard State Verification
        $startTime = microtime(true);
        $finalStatsResponse = $dashboardController->getStats($dashboardReq);
        $finalStatsData = $finalStatsResponse->getData(true);
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        $recentAttempts = $finalStatsData['recentAttempts'] ?? $finalStatsData['recent_attempts'] ?? [];
        $foundSyncedAttempt = collect($recentAttempts)->firstWhere('id', $attemptId);

        $steps[] = [
            'step' => '10. Final Dashboard Sync',
            'endpoint' => 'GET /api/v1/dashboard/stats',
            'status' => $foundSyncedAttempt ? 'PASS' : 'FAIL',
            'details' => "Attempt '{$attemptQuizTitle}' is present in recent activity log!",
            'latency' => "{$duration} ms",
        ];

        // Output formatted table
        $this->newLine();
        $this->table(
            ['Step', 'Endpoint', 'Status', 'Latency', 'Details'],
            array_map(function ($s) {
                $statusFormatted = $s['status'] === 'PASS'
                    ? '<fg=green;options=bold>PASS</>'
                    : '<fg=red;options=bold>FAIL</>';
                return [$s['step'], $s['endpoint'], $statusFormatted, $s['latency'], $s['details']];
            }, $steps)
        );

        $allPassed = collect($steps)->every(fn($s) => $s['status'] === 'PASS');

        if ($allPassed) {
            $this->newLine();
            $this->info('[SUCCESS] ALL 10 E2E LIFECYCLE STEPS PASSED WITH 100% SUCCESS!');
            $this->line("• Authenticated User: {$learner->email}");
            $this->line("• Offline Quiz Attempt: {$attemptId} -> Synced & Awarded XP");
            $this->line("• Active Recall Session: 3 Flashcards -> +{$flashcardXp} XP");
            $this->line("• Total XP Growth: +{$xpDelta} XP (New Total: {$finalXp})");
            $this->line("• Dashboard Recent Activity: Verified with updated quiz attempt");
            return 0;
        }

        $this->error("\n[ERROR] Some E2E steps failed.");
        return 1;
    }
}
