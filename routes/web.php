<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\SubjectWebController;
use App\Http\Controllers\Web\QuizWebController;
use App\Http\Controllers\Web\AdaptiveQuizController;
use App\Http\Controllers\Web\AIWebController;
use App\Http\Controllers\Web\FlashcardController;
use App\Http\Controllers\Web\GamificationController;
use App\Http\Controllers\Web\SyncController;
use App\Http\Controllers\Web\TeacherDashboardController;
use App\Http\Controllers\Web\AdminDashboardController;
use App\Http\Controllers\Api\PastQuestionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $subjects = \App\Models\Subject::where('status', 'active')
        ->withCount('topics')
        ->orderBy('sort_order')
        ->get(['id', 'name', 'code', 'slug', 'description', 'icon', 'school_id']);

    $totalSubjects = \App\Models\Subject::where('status', 'active')->count();
    $totalPastQuestions = \App\Models\PastQuestion::count();
    $examCounts = \App\Models\PastQuestion::select('exam_code', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
        ->groupBy('exam_code')
        ->pluck('count', 'exam_code')
        ->toArray();

    return Inertia::render('Welcome', [
        'subjects' => $subjects,
        'stats' => [
            'total_subjects' => $totalSubjects,
            'total_past_questions' => $totalPastQuestions,
            'exam_counts' => $examCounts,
        ],
    ]);
});

Route::get('/api/stats', function () {
    $totalSubjects = \App\Models\Subject::where('status', 'active')->count();
    $totalPastQuestions = \App\Models\PastQuestion::count();
    $examCounts = \App\Models\PastQuestion::select('exam_code', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
        ->groupBy('exam_code')
        ->pluck('count', 'exam_code')
        ->toArray();

    return response()->json([
        'total_subjects' => $totalSubjects,
        'total_past_questions' => $totalPastQuestions,
        'exam_counts' => $examCounts,
    ]);
});

// National Past Questions & Timed CBT Simulation Hub (Open to guests & learners)
Route::get('/past-questions', fn() => Inertia::render('ExamPrep/PastQuestionsIndex'));

// SEO & AEO Machine Discovery Routes
Route::get('/sitemap.xml', function () {
    $path = public_path('sitemap.xml');
    if (file_exists($path)) {
        return response(file_get_contents($path), 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }
    abort(404);
});

Route::get('/robots.txt', function () {
    $path = public_path('robots.txt');
    if (file_exists($path)) {
        return response(file_get_contents($path), 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }
    abort(404);
});

Route::get('/llms.txt', function () {
    $path = public_path('llms.txt');
    if (file_exists($path)) {
        return response(file_get_contents($path), 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }
    abort(404);
});

Route::get('/llms-full.txt', function () {
    $path = public_path('llms-full.txt');
    if (file_exists($path)) {
        return response(file_get_contents($path), 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }
    abort(404);
});

// Authentication & Password Reset Routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
    Route::get('/forgot-password', [PasswordResetLinkController::class, 'show'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('password.email');
    Route::get('/reset-password/{token}', [NewPasswordController::class, 'show'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.update');
});
Route::post('/logout', [LoginController::class, 'destroy']);

// Standalone API Auth Endpoints
Route::prefix('api/v1/auth')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::get('/user', [LoginController::class, 'getUser']);
    Route::post('/logout', [LoginController::class, 'logout']);
    Route::post('/refresh', [LoginController::class, 'refresh']);
});

// Protected Core Learning Routes
Route::middleware('auth')->group(function () {
    // Shell Pages Renders
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);
    Route::get('/teacher/dashboard', [TeacherDashboardController::class, 'index']);
    Route::get('/subjects', [SubjectWebController::class, 'index']);
    Route::get('/general-knowledge', [SubjectWebController::class, 'generalKnowledge']);
    Route::get('/subjects/{subject}', [SubjectWebController::class, 'show']);
    
    // Quiz Exercises & Attempts
    Route::get('/quizzes/{quiz}', [QuizWebController::class, 'show']);
    Route::post('/quizzes/{quiz}/attempt', [QuizWebController::class, 'submit']);
    Route::get('/quizzes/attempts/{attempt}', [QuizWebController::class, 'result']);

    // Active Recall Flashcards
    Route::get('/flashcards', [FlashcardController::class, 'index']);

    // Separate JSON Data Routes
    Route::prefix('api/v1')->group(function () {
        Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
        Route::get('/admin/stats', [AdminDashboardController::class, 'getStats']);
        Route::get('/teacher/stats', [TeacherDashboardController::class, 'getStats']);
        Route::get('/classes', [SubjectWebController::class, 'getClasses']);
        Route::get('/subjects', [SubjectWebController::class, 'getSubjects']);
        Route::get('/subjects/{subject}', [SubjectWebController::class, 'getSubjectDetails']);
        Route::get('/subjects/{subject}/topics', [SubjectWebController::class, 'getTopics']);
        Route::get('/quizzes/{quiz}', [QuizWebController::class, 'getQuizData']);
        Route::post('/quizzes/{quiz}/submit', [QuizWebController::class, 'submit']);
        Route::get('/quizzes/attempts/{attempt}', [QuizWebController::class, 'getAttemptData']);
        Route::post('/quizzes/attempts/{attemptId}/sync', [QuizWebController::class, 'syncAttempt']);

        // Adaptive Quiz Engine
        Route::post('/quizzes/{quiz}/adaptive/start', [AdaptiveQuizController::class, 'start']);
        Route::post('/quizzes/{quiz}/adaptive/answer', [AdaptiveQuizController::class, 'answer']);

        // AI Tutoring & Assistance
        Route::post('/ai/explain', [AIWebController::class, 'explain']);
        Route::get('/ai/similar-question', [AIWebController::class, 'similarQuestion']);
        Route::post('/ai/chat', [AIWebController::class, 'chat']);

        // Flashcards Deck API
        Route::get('/flashcards/deck', [FlashcardController::class, 'getDeck']);
        Route::post('/flashcards/complete', [FlashcardController::class, 'complete']);

        // Gamification & XP System
        Route::get('/gamification/profile', [GamificationController::class, 'profile']);
        Route::get('/gamification/leaderboard', [GamificationController::class, 'leaderboard']);

        // Offline Sync Endpoints (called by SyncService.ts when coming back online)
        Route::post('/progress/sync', [SyncController::class, 'syncProgress']);
        Route::post('/gamification/sync', [SyncController::class, 'syncGamification']);

        // Teacher Dashboard & Class Management (backward compatibility)
        Route::get('/teacher/classes/{classId}/learners', [TeacherDashboardController::class, 'getClassLearners']);
        Route::post('/teacher/classes', [TeacherDashboardController::class, 'createClass']);
        Route::post('/teacher/classes/{classId}/enroll', [TeacherDashboardController::class, 'enrollLearner']);
        Route::delete('/teacher/classes/{classId}/learners/{learnerId}', [TeacherDashboardController::class, 'removeLearner']);

        // Admin Management: Categories, Schools, School Admins, Classes, Learners, Subjects, Topics, Questions
        Route::get('/admin/categories', [AdminDashboardController::class, 'getCategories']);
        Route::get('/admin/schools', [AdminDashboardController::class, 'getSchools']);
        Route::post('/admin/schools', [AdminDashboardController::class, 'saveSchool']);
        Route::put('/admin/schools/{id}', [AdminDashboardController::class, 'updateSchool']);
        Route::delete('/admin/schools/{id}', [AdminDashboardController::class, 'deleteSchool']);

        Route::get('/admin/school-admins', [AdminDashboardController::class, 'getSchoolAdmins']);
        Route::post('/admin/school-admins', [AdminDashboardController::class, 'saveSchoolAdmin']);
        Route::put('/admin/school-admins/{id}', [AdminDashboardController::class, 'updateSchoolAdmin']);
        Route::delete('/admin/school-admins/{id}', [AdminDashboardController::class, 'deleteSchoolAdmin']);

        Route::get('/admin/programs', [AdminDashboardController::class, 'getPrograms']);
        Route::get('/admin/classes', [AdminDashboardController::class, 'getClasses']);
        Route::post('/admin/classes', [AdminDashboardController::class, 'saveClass']);
        Route::put('/admin/classes/{id}', [AdminDashboardController::class, 'updateClass']);
        Route::delete('/admin/classes/{id}', [AdminDashboardController::class, 'deleteClass']);
        Route::get('/admin/classes/{classId}/learners', [AdminDashboardController::class, 'getClassLearners']);
        Route::post('/admin/classes/{classId}/enroll', [AdminDashboardController::class, 'enrollClassLearner']);
        Route::delete('/admin/classes/{classId}/learners/{learnerId}', [AdminDashboardController::class, 'removeClassLearner']);

        Route::get('/admin/learners', [AdminDashboardController::class, 'getLearners']);
        Route::post('/admin/learners', [AdminDashboardController::class, 'saveLearner']);
        Route::put('/admin/learners/{id}', [AdminDashboardController::class, 'updateLearner']);
        Route::delete('/admin/learners/{id}', [AdminDashboardController::class, 'deleteLearner']);

        Route::get('/admin/subjects', [AdminDashboardController::class, 'getSubjects']);
        Route::post('/admin/subjects', [AdminDashboardController::class, 'saveSubject']);
        Route::put('/admin/subjects/{id}', [AdminDashboardController::class, 'updateSubject']);
        Route::delete('/admin/subjects/{id}', [AdminDashboardController::class, 'deleteSubject']);

        Route::get('/admin/topics', [AdminDashboardController::class, 'getTopics']);
        Route::post('/admin/topics', [AdminDashboardController::class, 'saveTopic']);
        Route::put('/admin/topics/{id}', [AdminDashboardController::class, 'updateTopic']);
        Route::delete('/admin/topics/{id}', [AdminDashboardController::class, 'deleteTopic']);

        Route::get('/admin/questions', [AdminDashboardController::class, 'getQuestions']);
        Route::post('/admin/questions', [AdminDashboardController::class, 'saveQuestion']);
        Route::post('/admin/questions/ai-extract', [AdminDashboardController::class, 'aiExtractQuestions']);
        Route::post('/admin/questions/bulk', [AdminDashboardController::class, 'bulkSaveQuestions']);
        // Past Questions & National Exam Simulation Hub
        Route::get('/past-questions/meta', [PastQuestionController::class, 'getMeta']);
        Route::get('/past-questions/questions', [PastQuestionController::class, 'getQuestions']);
        Route::post('/past-questions/simulation/start', [PastQuestionController::class, 'startSimulation']);
        Route::post('/past-questions/simulation/submit', [PastQuestionController::class, 'submitSimulation']);
        Route::get('/past-questions/history', [PastQuestionController::class, 'getHistory']);
        Route::post('/past-questions/explain', [PastQuestionController::class, 'explain']);
    });
});

// Past questions public API endpoints (accessible without strict session login for guest practice)
Route::prefix('api/v1/past-questions')->group(function () {
    Route::get('/meta', [PastQuestionController::class, 'getMeta']);
    Route::get('/questions', [PastQuestionController::class, 'getQuestions']);
    Route::post('/simulation/start', [PastQuestionController::class, 'startSimulation']);
    Route::post('/simulation/submit', [PastQuestionController::class, 'submitSimulation']);
    Route::get('/history', [PastQuestionController::class, 'getHistory']);
    Route::post('/explain', [PastQuestionController::class, 'explain']);
});

Route::get('/api/health', function () {
    return response()->json('OK');
});

// ── Shared Hosting & Maintenance Utilities ──
//
// InfinityFree has no SSH, so Artisan commands have to be triggered over HTTP.
// If you set MAINTENANCE_TOKEN in your .env, every route below requires
// ?token=YOUR_TOKEN before it will do anything.

// Optional shared-secret guard for the maintenance routes below
$guardMaintenance = function () {
    $token = env('MAINTENANCE_TOKEN');
    if ($token !== null && $token !== '' && ! hash_equals((string) $token, (string) request()->query('token', ''))) {
        abort(403, 'Invalid or missing maintenance token.');
    }
};

// Clear Cache utility
Route::get('/clear-cache', function () use ($guardMaintenance) {
    $guardMaintenance();

    \Illuminate\Support\Facades\Artisan::call('view:clear');
    \Illuminate\Support\Facades\Artisan::call('route:clear');
    \Illuminate\Support\Facades\Artisan::call('config:clear');
    \Illuminate\Support\Facades\Artisan::call('cache:clear');
    return 'All caches cleared successfully!';
});

// Run standard migrations
Route::get('/run-migrations', function () use ($guardMaintenance) {
    $guardMaintenance();

    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'status' => 'success',
            'message' => 'Migrations ran successfully!',
            'output' => $output
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to run migrations: ' . $e->getMessage()
        ], 500);
    }
});

// Run migrate:fresh --seed.
// Drops every table individually (shared-hosting MySQL users often can't drop
// the database or run `db:wipe`), then re-runs migrations and seeds.
// The response includes a diagnostic report so privilege problems are visible
// instead of showing up as a confusing "table already exists" error.
Route::get('/run-migrate-fresh-seed', function () use ($guardMaintenance) {
    $guardMaintenance();

    // Best-effort: long drop + migrate + seed jobs can outlive PHP defaults
    @set_time_limit(300);
    @ini_set('memory_limit', '256M');

    // collect a clean lookup of the migration files currently on disk (only *.php)
    // so we can compare against what the migrations run-tracking table still records
    $diskFilenames = [];
    foreach (glob(database_path('migrations/*.php')) ?: [] as $path) {
        $b = basename($path, '.php');
        // only count real PHP files (skip symlinks / deleted-but-linked files)
        $diskFilenames[] = $b;
    }

    $report = [
        'database' => \Illuminate\Support\Facades\DB::getDatabaseName(),
        'driver'   => \Illuminate\Support\Facades\DB::getDriverName(),
    ];

    try {
        // What privileges does this MySQL user actually have? (diagnostic)
        try {
            $report['grants'] = array_map(
                fn ($row) => array_values((array) $row)[0],
                \Illuminate\Support\Facades\DB::select('SHOW GRANTS')
            );
        } catch (\Throwable $e) {
            $report['grants'] = 'Unable to read grants: ' . $e->getMessage();
        }

        // ── Canonical migration list & auto-purge of stale duplicate files ─────────
        $canonicalMigrations = [
            '0001_01_01_000000_create_users_table',
            '0001_01_01_000001_create_cache_table',
            '0001_01_01_000002_create_jobs_table',
            '2026_08_20_000000_create_roles_table',
            '2026_08_20_000001_create_schools_table',
            '2026_08_20_000002_create_programs_table',
            '2026_08_20_000003_create_classes_table',
            '2026_08_20_000004_create_subjects_table',
            '2026_08_20_000005_create_topics_table',
            '2026_08_20_000006_create_questions_table',
            '2026_08_20_000007_create_question_options_table',
            '2026_08_20_000008_create_quizzes_table',
            '2026_08_20_000009_create_quiz_questions_table',
            '2026_08_20_000010_create_quiz_attempts_table',
            '2026_08_20_000011_create_quiz_answers_table',
            '2026_08_20_000012_create_learner_progress_table',
            '2026_08_20_000013_create_content_packages_table',
            '2026_08_22_000000_create_quiz_adaptive_states_table',
            '2026_08_22_000001_create_user_gamification_table',
            '2026_08_22_000002_create_xp_transactions_table',
            '2026_08_22_000003_create_user_achievements_table',
            '2026_08_23_000002_create_teacher_profiles_table',
            '2026_08_23_000003_create_learner_profiles_table',
            '2026_08_23_000005_create_class_memberships_table',
            '2026_08_24_000001_create_achievements_table',
            '2026_08_24_000004_create_exam_simulations_table',
            '2026_08_24_000005_create_past_questions_tables',
        ];

        // Auto-purge only known old/stale merged migration files from server disk
        $staleMergedFiles = [
            '2026_08_23_000001_create_schools_table',
            '2026_08_24_000002_create_categories_table_and_update_schools',
            '2026_08_24_000003_add_exam_fields_to_questions_table',
        ];
        $purgedExtraFiles = [];
        foreach ($staleMergedFiles as $staleBase) {
            $stalePath = database_path("migrations/{$staleBase}.php");
            if (file_exists($stalePath)) {
                @unlink($stalePath);
                $purgedExtraFiles[] = $staleBase;
            }
        }
        $report['purged_stale_migration_files'] = $purgedExtraFiles;

        $migrationFilesOnDisk = glob(database_path('migrations/*.php')) ?: [];
        $filenamesOnDisk = array_map(fn ($p) => basename($p, '.php'), $migrationFilesOnDisk);
        $report['migration_files_on_disk'] = $filenamesOnDisk;

        // 1. Every table that exists right now
        $tablesBefore = array_map(
            fn ($table) => array_values((array) $table)[0],
            \Illuminate\Support\Facades\DB::select('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE'])
        );
        $report['tables_before'] = $tablesBefore;

        // 2. Drop each table on its own, so one denied DROP can't abort the wipe
        $drop = ['dropped' => [], 'failed' => []];
        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        foreach ($tablesBefore as $table) {
            try {
                \Illuminate\Support\Facades\DB::statement("DROP TABLE IF EXISTS `{$table}`");
                $drop['dropped'][] = $table;
            } catch (\Throwable $e) {
                $drop['failed'][$table] = $e->getMessage();
            }
        }
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
        $report['drop_results'] = $drop;

        // 3. Verify the wipe actually happened.
        $report['tables_remaining_after_drop'] = array_map(
            fn ($table) => array_values((array) $table)[0],
            \Illuminate\Support\Facades\DB::select('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE'])
        );

        // 4. Rebuild the schema
        try {
            \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
            $report['migrate'] = [
                'status' => 'success',
                'output' => \Illuminate\Support\Facades\Artisan::output(),
            ];
        } catch (\Throwable $e) {
            $report['migrate'] = ['status' => 'error', 'error' => $e->getMessage()];
        }

        // 5. Seed
        try {
            \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
            $report['seed'] = [
                'status' => 'success',
                'output' => \Illuminate\Support\Facades\Artisan::output(),
            ];
        } catch (\Throwable $e) {
            $report['seed'] = ['status' => 'error', 'error' => $e->getMessage()];
        }

        $status = match (true) {
            count($report['tables_remaining_after_drop']) > 0 => 'error',
            ($report['migrate']['status'] ?? '') !== 'success' => 'error',
            ($report['seed']['status'] ?? '') !== 'success' => 'partial',
            default => 'success',
        };

        return response()->json(
            array_merge(['status' => $status], $report),
            $status === 'success' ? 200 : 500
        );
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'status' => 'error',
            'message' => 'Failed to run migrate:fresh --seed: ' . $e->getMessage(),
            'report' => $report,
        ], 500);
    }
});

// Run seeders only
Route::get('/run-seed', function () use ($guardMaintenance) {
    $guardMaintenance();

    @set_time_limit(300);
    @ini_set('memory_limit', '256M');

    try {
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'status' => 'success',
            'message' => 'Database seeded successfully!',
            'output' => $output
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to run seeders: ' . $e->getMessage()
        ], 500);
    }
});

// Run past questions migration and seed only (convenient for incremental setup)
Route::get('/run-past-questions-seed', function () use ($guardMaintenance) {
    $guardMaintenance();

    @set_time_limit(300);
    @ini_set('memory_limit', '256M');

    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'PastQuestionSeeder', '--force' => true]);
        return response()->json([
            'status' => 'success',
            'message' => 'Past questions migrated and seeded successfully!',
            'questions_count' => \App\Models\PastQuestion::count(),
            'options_count' => \App\Models\PastQuestionOption::count(),
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to seed past questions: ' . $e->getMessage(),
        ], 500);
    }
});
