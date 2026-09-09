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

// Clear Cache utility
Route::get('/clear-cache', function () {
    \Illuminate\Support\Facades\Artisan::call('view:clear');
    \Illuminate\Support\Facades\Artisan::call('route:clear');
    \Illuminate\Support\Facades\Artisan::call('config:clear');
    \Illuminate\Support\Facades\Artisan::call('cache:clear');
    return 'All caches cleared successfully! ✨';
});

// Run standard migrations
Route::get('/run-migrations', function () {
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

// Run migrate:fresh --seed
Route::get('/run-migrate-fresh-seed', function () {
    try {
        \Illuminate\Support\Facades\Artisan::call('migrate:fresh', [
            '--seed' => true,
            '--force' => true,
        ]);
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'status' => 'success',
            'message' => 'Database refreshed and seeded successfully! ✨',
            'output' => $output
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Failed to run migrate:fresh --seed: ' . $e->getMessage()
        ], 500);
    }
});

// Run seeders only
Route::get('/run-seed', function () {
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
