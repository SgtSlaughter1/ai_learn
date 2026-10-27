<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Api\FeedbackController;
use App\Http\Controllers\Api\PastQuestionController;
use App\Http\Controllers\Api\SpacedRepetitionController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\Web\AccountController;
use App\Http\Controllers\Web\AdaptiveQuizController;
use App\Http\Controllers\Web\AIWebController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\FlashcardController;
use App\Http\Controllers\Web\GamificationController;
use App\Http\Controllers\Web\QuizWebController;
use App\Http\Controllers\Web\RecessController;
use App\Http\Controllers\Web\SubjectWebController;
use App\Http\Controllers\Web\SyncController;
use App\Http\Controllers\Web\TeacherDashboardController;
use App\Http\Middleware\EnsureMaintenanceToken;
use App\Support\Seo;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'show']);
Route::get('/api/stats', [HomeController::class, 'stats']);

// National Past Questions & Timed CBT Simulation Hub (Open to guests & learners)
Route::get('/past-questions', fn () => Inertia::render('ExamPrep/PastQuestionsIndex'));

// SEO & AEO machine discovery: built from App\Support\Seo so every URL uses APP_URL.
Route::get('/robots.txt', fn () => response(Seo::robotsTxt(), 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']));
Route::get('/sitemap.xml', fn () => response(Seo::sitemapXml(), 200, ['Content-Type' => 'application/xml; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']));
Route::get('/llms.txt', fn () => response(Seo::llmsTxt(), 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']));
Route::get('/llms-full.txt', function () {
    $path = resource_path('seo/llms-full.txt');
    abort_unless(file_exists($path), 404);

    return response(file_get_contents($path), 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']);
});

// Authentication & Password Reset Routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:login');
    Route::get('/register', [RegisterController::class, 'show'])->name('register');
    Route::post('/register', [RegisterController::class, 'store'])->middleware('throttle:login');
    Route::get('/signup', [RegisterController::class, 'show'])->name('signup');
    Route::post('/signup', [RegisterController::class, 'store'])->middleware('throttle:login');
    Route::get('/forgot-password', [PasswordResetLinkController::class, 'show'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('password.email')->middleware('throttle:login');
    Route::get('/reset-password/{token}', [NewPasswordController::class, 'show'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.update')->middleware('throttle:login');
});
Route::post('/logout', [LoginController::class, 'destroy']);

// Standalone API Auth Endpoints
Route::prefix('api/v1/auth')->middleware('throttle:login')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::post('/register', [RegisterController::class, 'store']);
    Route::get('/user', [LoginController::class, 'getUser']);
    Route::post('/logout', [LoginController::class, 'logout']);
    Route::post('/refresh', [LoginController::class, 'refresh']);
});

// Protected Core Learning Routes
Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'showLearnerDashboard']);
    Route::get('/learner/dashboard', fn () => Inertia::render('learner/Dashboard'));
    Route::middleware('can:access-admin')->group(function () {
        Route::get('/admin/dashboard', [Admin\DashboardController::class, 'show']);
        Route::get('/super-admin/dashboard', [Admin\DashboardController::class, 'show']);
        Route::get('/school-admin/dashboard', [Admin\DashboardController::class, 'show']);
    });
    Route::get('/teacher/dashboard', [TeacherDashboardController::class, 'showTeacherDashboard'])->middleware('can:access-teaching');
    Route::get('/subjects', [SubjectWebController::class, 'showSubjectsPage']);
    Route::get('/general-knowledge', [SubjectWebController::class, 'showGeneralKnowledgePage']);
    Route::get('/subjects/{subject}', [SubjectWebController::class, 'showSubject']);

    // Quiz Exercises & Attempts
    Route::get('/quizzes/{quiz}', [QuizWebController::class, 'showQuiz']);
    Route::post('/quizzes/{quiz}/attempt', [QuizWebController::class, 'submitQuizAttempt']);
    Route::get('/quizzes/attempts/{attempt}', [QuizWebController::class, 'showQuizResult']);

    // Active Recall Flashcards
    Route::get('/flashcards', [FlashcardController::class, 'showFlashcardsPage']);
    Route::get('/recess', [RecessController::class, 'show']);
    Route::get('/profile', [AccountController::class, 'show']);

    // Separate JSON Data Routes
    Route::prefix('api/v1')->middleware('throttle:api')->group(function () {
        Route::get('/dashboard/stats', [DashboardController::class, 'getLearnerStats']);
        Route::get('/teacher/stats', [TeacherDashboardController::class, 'getTeacherStats'])->middleware('can:access-teaching');
        Route::get('/classes', [SubjectWebController::class, 'getClasses']);
        Route::get('/subjects', [SubjectWebController::class, 'getSubjects']);
        Route::get('/subjects/{subject}', [SubjectWebController::class, 'getSubjectDetails']);
        Route::get('/subjects/{subject}/topics', [SubjectWebController::class, 'getTopics']);
        Route::get('/quizzes/{quiz}', [QuizWebController::class, 'getQuizData']);
        Route::post('/quizzes/{quiz}/submit', [QuizWebController::class, 'submitQuizAttempt']);
        Route::get('/quizzes/attempts/{attempt}', [QuizWebController::class, 'getQuizAttemptData']);
        Route::post('/quizzes/attempts/{attemptId}/sync', [QuizWebController::class, 'syncQuizAttempt']);

        // Adaptive Quiz Engine
        Route::post('/quizzes/{quiz}/adaptive/start', [AdaptiveQuizController::class, 'start']);
        Route::post('/quizzes/{quiz}/adaptive/answer', [AdaptiveQuizController::class, 'answer']);

        // AI Tutoring & Assistance
        Route::middleware('throttle:ai')->group(function () {
            Route::post('/ai/explain', [AIWebController::class, 'explain']);
            Route::get('/ai/similar-question', [AIWebController::class, 'similarQuestion']);
            Route::post('/ai/chat', [AIWebController::class, 'chat']);
            // Paths the quiz drawer and Daily Revision call; signed-in only, like the ones above.
            Route::get('/questions/similar', [AIWebController::class, 'similarQuestion']);
            Route::post('/questions/explain', [AIWebController::class, 'explain']);
        });

        // Spaced Repetition (Daily 5-Min Smart Revision)
        Route::get('/revision/today', [SpacedRepetitionController::class, 'getTodayQueue']);
        Route::post('/revision/submit', [SpacedRepetitionController::class, 'submitReview']);
        Route::post('/revision/complete-session', [SpacedRepetitionController::class, 'completeSession']);
        Route::get('/revision/stats', [SpacedRepetitionController::class, 'getStats']);

        // Flashcards Deck API
        Route::get('/flashcards/deck', [FlashcardController::class, 'getFlashcardDeck']);
        Route::post('/flashcards/complete', [FlashcardController::class, 'completeFlashcardReview']);

        // Recess: earned game breaks; a win can add a little capped XP
        Route::post('/recess/wins', [RecessController::class, 'recordWin']);

        // Gamification & XP System
        Route::get('/gamification/profile', [GamificationController::class, 'profile']);
        Route::get('/gamification/leaderboard', [GamificationController::class, 'leaderboard']);

        // Offline Sync Endpoints (called by SyncService.ts when coming back online)
        Route::post('/sync/batch', [SyncController::class, 'batch'])->middleware('throttle:sync-batch');

        Route::post('/progress/sync', [SyncController::class, 'syncProgress']);

        // The user's own account (profile page Danger Zone); password-checked, so rate limited.
        Route::middleware('throttle:10,1')->group(function () {
            Route::post('/account/deactivate', [AccountController::class, 'deactivate']);
            Route::delete('/account', [AccountController::class, 'destroy']);
        });
        Route::post('/gamification/sync', [SyncController::class, 'syncGamification']);

        // ── Teaching tools (teachers and admins) ──
        // Role gates guard each group; policies decide per record (see AppServiceProvider).
        Route::middleware('can:access-teaching')->group(function () {
            Route::get('/teacher/classes/{classId}/learners', [TeacherDashboardController::class, 'getClassLearners']);
            Route::get('/teacher/classes/{classId}/diagnostics', [TeacherDashboardController::class, 'getClassDiagnostics']);
            Route::post('/teacher/interventions/assign', [TeacherDashboardController::class, 'assignIntervention']);
            Route::post('/teacher/classes', [TeacherDashboardController::class, 'createClass']);
            Route::post('/teacher/classes/{classId}/enroll', [TeacherDashboardController::class, 'enrollLearner']);
            Route::post('/teacher/learners', [TeacherDashboardController::class, 'saveLearner']);
            Route::delete('/teacher/classes/{classId}/learners/{learnerId}', [TeacherDashboardController::class, 'removeLearner']);

            // Edits are PATCH; PUT is still accepted so edits queued offline before the
            // switch can sync. Both verbs run the same policy and validation.
            // Curriculum and question bank (writes to subjects/topics are admin-only via policies)
            Route::get('/admin/programs', [Admin\LookupController::class, 'programs']);
            Route::get('/admin/classes', [Admin\ClassController::class, 'index']);
            Route::get('/admin/subjects', [Admin\SubjectController::class, 'index']);
            Route::get('/admin/topics', [Admin\TopicController::class, 'index']);

            Route::get('/admin/questions', [Admin\QuestionController::class, 'index']);
            Route::post('/admin/questions', [Admin\QuestionController::class, 'store']);
            Route::post('/admin/questions/bulk', [Admin\QuestionController::class, 'bulkStore']);
            Route::match(['patch', 'put'], '/admin/questions/{id}', [Admin\QuestionController::class, 'update']);
            Route::delete('/admin/questions/{id}', [Admin\QuestionController::class, 'destroy']);
            Route::post('/admin/questions/upload-image', [Admin\QuestionToolsController::class, 'uploadImage']);
            // Shared passages, poems, diagrams and tables (created through the question form)
            Route::get('/admin/question-contexts', [Admin\QuestionContextController::class, 'index']);
            Route::match(['patch', 'put'], '/admin/question-contexts/{id}', [Admin\QuestionContextController::class, 'update']);
            Route::patch('/admin/question-contexts/{id}/order', [Admin\QuestionContextController::class, 'reorder']);
            Route::delete('/admin/question-contexts/{id}', [Admin\QuestionContextController::class, 'destroy']);
            Route::post('/admin/questions/ai-extract', [Admin\QuestionToolsController::class, 'extract'])->middleware('throttle:ai');
            Route::post('/admin/questions/ai-generate', [Admin\QuestionToolsController::class, 'generate'])->middleware('throttle:ai');
        });

        // ── Administration (school admins: their own school; platform admins: everything) ──
        Route::middleware('can:access-admin')->group(function () {
            Route::get('/admin/stats', [Admin\DashboardController::class, 'stats']);
            Route::get('/admin/categories', [Admin\LookupController::class, 'categories']);
            Route::get('/admin/schools', [Admin\SchoolController::class, 'index']);
            Route::patch('/admin/schools/{id}/recess', [Admin\SchoolController::class, 'updateRecess']);

            Route::get('/admin/teachers', [Admin\TeacherController::class, 'index']);
            Route::post('/admin/teachers', [Admin\TeacherController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/teachers/{id}', [Admin\TeacherController::class, 'update']);
            Route::delete('/admin/teachers/{id}', [Admin\TeacherController::class, 'destroy']);

            Route::patch('/admin/users/{id}/status', [Admin\AccountStatusController::class, 'updateUser']);

            Route::get('/admin/learners', [Admin\LearnerController::class, 'index']);
            Route::post('/admin/learners', [Admin\LearnerController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/learners/{id}', [Admin\LearnerController::class, 'update']);
            Route::delete('/admin/learners/{id}', [Admin\LearnerController::class, 'destroy']);

            Route::post('/admin/classes', [Admin\ClassController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/classes/{id}', [Admin\ClassController::class, 'update']);
            Route::delete('/admin/classes/{id}', [Admin\ClassController::class, 'destroy']);
            Route::get('/admin/classes/{classId}/learners', [Admin\ClassLearnerController::class, 'index']);
            Route::post('/admin/classes/{classId}/enroll', [Admin\ClassLearnerController::class, 'store']);
            Route::delete('/admin/classes/{classId}/learners/{learnerId}', [Admin\ClassLearnerController::class, 'destroy']);

            Route::post('/admin/subjects', [Admin\SubjectController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/subjects/{id}', [Admin\SubjectController::class, 'update']);
            Route::delete('/admin/subjects/{id}', [Admin\SubjectController::class, 'destroy']);

            Route::post('/admin/topics', [Admin\TopicController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/topics/{id}', [Admin\TopicController::class, 'update']);
            Route::delete('/admin/topics/{id}', [Admin\TopicController::class, 'destroy']);
        });

        // ── Platform administration (platform admins only) ──
        Route::middleware('can:manage-platform')->group(function () {
            Route::post('/admin/schools', [Admin\SchoolController::class, 'store']);
            Route::patch('/admin/schools/{id}/status', [Admin\AccountStatusController::class, 'updateSchool']);
            Route::match(['patch', 'put'], '/admin/schools/{id}', [Admin\SchoolController::class, 'update']);
            Route::delete('/admin/schools/{id}', [Admin\SchoolController::class, 'destroy']);

            Route::get('/admin/school-admins', [Admin\SchoolAdminController::class, 'index']);
            Route::post('/admin/school-admins', [Admin\SchoolAdminController::class, 'store']);
            Route::match(['patch', 'put'], '/admin/school-admins/{id}', [Admin\SchoolAdminController::class, 'update']);
            Route::delete('/admin/school-admins/{id}', [Admin\SchoolAdminController::class, 'destroy']);

            Route::get('/admin/feedbacks', [FeedbackController::class, 'index']);
            Route::match(['patch', 'put'], '/admin/feedbacks/{id}/status', [FeedbackController::class, 'updateStatus']);
        });
    });
});

// Past questions API, open to guests (CBT practice). The controller checks the session itself
// where a signed-in learner gets more (history, saved simulations, higher limits).
Route::prefix('api/v1/past-questions')->middleware('throttle:api')->group(function () {
    Route::get('/meta', [PastQuestionController::class, 'getMeta']);
    Route::get('/questions', [PastQuestionController::class, 'getQuestions']);
    Route::post('/verify-answer', [PastQuestionController::class, 'verifyAnswer']);
    Route::get('/similar', [PastQuestionController::class, 'getSimilar']);
    Route::post('/simulation/start', [PastQuestionController::class, 'startSimulation']);
    Route::post('/simulation/submit', [PastQuestionController::class, 'submitSimulation']);
    Route::get('/history', [PastQuestionController::class, 'getHistory']);
    Route::post('/explain', [PastQuestionController::class, 'explain'])->middleware('throttle:ai');
});

Route::get('/api/health', function () {
    return response()->json('OK');
});

// ── Shared Hosting & Maintenance Utilities ──
//
// InfinityFree has no SSH, so Artisan commands are triggered over HTTP (MaintenanceController).
// Opening a URL shows a confirmation page; the action runs only when that page posts back
// MAINTENANCE_TOKEN (at least 32 characters; generate with: openssl rand -hex 32). Everything
// answers 404 while no token is configured.
foreach ([
    'php-check' => 'phpCheck',
    'clear-cache' => 'clearCache',
    'run-migrations' => 'runMigrations',
    'run-migrate-fresh-seed' => 'migrateFreshSeed',
    'run-seed' => 'runSeed',
    'run-past-questions-seed' => 'runPastQuestionsSeed',
] as $path => $action) {
    Route::get("/{$path}", [MaintenanceController::class, 'confirm']);
    Route::post("/{$path}", [MaintenanceController::class, $action])
        ->middleware([EnsureMaintenanceToken::class, 'throttle:maintenance']);
}

// Feedback Submission Web Endpoint
Route::post('/api/v1/feedback', [FeedbackController::class, 'store'])->middleware('throttle:public-feedback');

// Who is signed in (null for guests). Public so the sync engine can ask on any page
// without the browser logging a 401 for signed-out visitors.
Route::get('/api/v1/sync/session', [SyncController::class, 'session'])->middleware('throttle:api');
