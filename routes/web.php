<?php

use App\Http\Controllers\Auth\LoginController;
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
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $subjects = \App\Models\Subject::where('status', 'active')
        ->withCount('topics')
        ->orderBy('sort_order')
        ->get(['id', 'name', 'code', 'slug', 'description', 'icon', 'school_id']);

    return Inertia::render('Welcome', [
        'subjects' => $subjects,
    ]);
});

// Authentication Routes
Route::get('/login', [LoginController::class, 'show'])->name('login');
Route::post('/login', [LoginController::class, 'store']);
Route::post('/logout', [LoginController::class, 'destroy']);

// Standalone API Auth Endpoints
Route::prefix('api/v1/auth')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::get('/user', [LoginController::class, 'getUser']);
    Route::post('/logout', [LoginController::class, 'logout']);
});

// Protected Core Learning Routes
Route::middleware('auth')->group(function () {
    // Shell Pages Renders
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);
    Route::get('/teacher/dashboard', [AdminDashboardController::class, 'index']);
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

        // Admin Management: Schools, School Admins, Classes, Learners, Subjects, Topics, Questions
        Route::get('/admin/schools', [AdminDashboardController::class, 'getSchools']);
        Route::post('/admin/schools', [AdminDashboardController::class, 'storeSchool']);
        Route::put('/admin/schools/{id}', [AdminDashboardController::class, 'updateSchool']);
        Route::delete('/admin/schools/{id}', [AdminDashboardController::class, 'deleteSchool']);

        Route::get('/admin/school-admins', [AdminDashboardController::class, 'getSchoolAdmins']);
        Route::post('/admin/school-admins', [AdminDashboardController::class, 'storeSchoolAdmin']);
        Route::put('/admin/school-admins/{id}', [AdminDashboardController::class, 'updateSchoolAdmin']);
        Route::delete('/admin/school-admins/{id}', [AdminDashboardController::class, 'deleteSchoolAdmin']);

        Route::get('/admin/classes', [AdminDashboardController::class, 'getClasses']);
        Route::post('/admin/classes', [AdminDashboardController::class, 'storeClass']);
        Route::put('/admin/classes/{id}', [AdminDashboardController::class, 'updateClass']);
        Route::delete('/admin/classes/{id}', [AdminDashboardController::class, 'deleteClass']);
        Route::get('/admin/classes/{classId}/learners', [AdminDashboardController::class, 'getClassLearners']);
        Route::post('/admin/classes/{classId}/enroll', [AdminDashboardController::class, 'enrollClassLearner']);
        Route::delete('/admin/classes/{classId}/learners/{learnerId}', [AdminDashboardController::class, 'removeClassLearner']);

        Route::get('/admin/learners', [AdminDashboardController::class, 'getLearners']);
        Route::post('/admin/learners', [AdminDashboardController::class, 'storeLearner']);
        Route::put('/admin/learners/{id}', [AdminDashboardController::class, 'updateLearner']);
        Route::delete('/admin/learners/{id}', [AdminDashboardController::class, 'deleteLearner']);

        Route::get('/admin/subjects', [AdminDashboardController::class, 'getSubjects']);
        Route::post('/admin/subjects', [AdminDashboardController::class, 'storeSubject']);
        Route::put('/admin/subjects/{id}', [AdminDashboardController::class, 'updateSubject']);
        Route::delete('/admin/subjects/{id}', [AdminDashboardController::class, 'deleteSubject']);

        Route::get('/admin/topics', [AdminDashboardController::class, 'getTopics']);
        Route::post('/admin/topics', [AdminDashboardController::class, 'storeTopic']);
        Route::put('/admin/topics/{id}', [AdminDashboardController::class, 'updateTopic']);
        Route::delete('/admin/topics/{id}', [AdminDashboardController::class, 'deleteTopic']);

        Route::get('/admin/questions', [AdminDashboardController::class, 'getQuestions']);
        Route::post('/admin/questions', [AdminDashboardController::class, 'storeQuestion']);
        Route::put('/admin/questions/{id}', [AdminDashboardController::class, 'updateQuestion']);
        Route::delete('/admin/questions/{id}', [AdminDashboardController::class, 'deleteQuestion']);
    });
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
    return 'All caches cleared successfully! ✨';
});

// Run standard migrations
Route::get('/run-migrations', function () use ($guardMaintenance) {
    $guardMaintenance();

    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'status' => 'success',
            'message' => 'Migrations ran successfully! ✨',
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

        // ── Early detection of stale migration files on the server ─────────────────
        // If the deploy never removed old files (lftp mirror has no --delete), the
        // `migrations` run-tracking table can still list filenames that no longer exist
        // in database/migrations/. mysql would then try to recreate a table that was
        // already created by the original migration, hitting "1050 already exists".
        // We check this before dropping anything, so the route fails fast with a clear
        // message instead of dropping and then dying halfway through.
        $migrationFilesOnDisk = glob(
            database_path('migrations/*.php')
        ) ?: [];
        $filenamesOnDisk = array_map(
            fn ($p) => basename($p, '.php'),
            $migrationFilesOnDisk
        );

        $trackedFilenames = [];
        try {
            $trackedFilenames = array_column(
                \Illuminate\Support\Facades\DB::table('migrations')
                    ->where('batch', '>', 0)
                    ->orderBy('migration')
                    ->get(['migration'])
                    ->toArray(),
                'migration'
            );
        } catch (\Throwable $e) {
            $report['migrations_read'] = 'Unable to read migrations tracking table: ' . $e->getMessage();
        }

        // stale = tracked but no longer on disk (duplicate migration files from a
        // deploy that never deleted old files) → the route must refuse to wipe before
        // migrate re-runs and hits a duplicate-create (1050) error.
        $staleTracked = array_values(
            array_diff($trackedFilenames, $filenamesOnDisk)
        );

        $report['migration_files_on_disk']     = $diskFilenames;
        $report['tracked_migration_filenames'] = $trackedFilenames;
        $report['stale_tracked_migrations']    = $staleTracked;

        if (count($staleTracked) > 0) {
            // Fail fast: do not drop or migrate until the server's stale files are
            // cleaned, otherwise the wipe succeeds and migrate later hits 1050.
            return response()->json([
                'status' => 'error',
                'message' => 'Stale migration files detected on the server.',
                'details' => [
                    'These migration filenames are recorded in the `migrations` table',
                    'but no matching file exists under database/migrations/:',
                    ...$staleTracked,
                    '',
                    'The likely cause: your deploy workflow mirrors files without --delete,',
                    'so old migration files accumulate on the server. Fix by FTP-cleaning',
                    'htdocs/database/migrations/ to match the repo, then re-run this route.',
                ],
            ], 409);
        }

        // committed deletions: the repo has removed a migration file that the tracked
        // `migrations` table still records as run. The file is gone from disk (it was
        // never part of this deployment), so it won't be re-run by `migrate`.
        // (Note: `stale_tracked_migrations` above is the same set.)

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

        // 3. Verify the wipe actually happened. If tables remain here, the MySQL
        //    user cannot DROP tables, so "fresh" can never work via SQL alone.
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

    try {
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'status' => 'success',
            'message' => 'Database seeded successfully! ✨',
            'output' => $output
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to run seeders: ' . $e->getMessage()
        ], 500);
    }
});
