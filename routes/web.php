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
    return Inertia::render('Welcome');
});

// Authentication Routes
Route::get('/login', [LoginController::class, 'show'])->name('login');
Route::post('/login', [LoginController::class, 'store']);
Route::post('/logout', [LoginController::class, 'destroy']);

// Protected Core Learning Routes
Route::middleware('auth')->group(function () {
    // Shell Pages Renders
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);
    Route::get('/teacher/dashboard', [TeacherDashboardController::class, 'index']);
    Route::get('/subjects', [SubjectWebController::class, 'index']);
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
        Route::get('/subjects', [SubjectWebController::class, 'getSubjects']);
        Route::get('/subjects/{subject}', [SubjectWebController::class, 'getSubjectDetails']);
        Route::get('/quizzes/{quiz}', [QuizWebController::class, 'getQuizData']);
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

        // Teacher Dashboard & Class Management
        Route::get('/teacher/classes/{classId}/learners', [TeacherDashboardController::class, 'getClassLearners']);
        Route::post('/teacher/classes', [TeacherDashboardController::class, 'createClass']);
        Route::post('/teacher/classes/{classId}/enroll', [TeacherDashboardController::class, 'enrollLearner']);
        Route::delete('/teacher/classes/{classId}/learners/{learnerId}', [TeacherDashboardController::class, 'removeLearner']);
    });
});

Route::get('/api/health', function () {
    return response()->json('OK');
});

// PWA Service Worker & Manifest Route Handlers (Ensures Service-Worker-Allowed header everywhere)
Route::get('/sw.js', function () {
    $path = public_path('build/sw.js');
    if (!file_exists($path)) {
        $path = public_path('sw.js');
    }
    if (!file_exists($path)) {
        return response('/* SW not found */', 404, ['Content-Type' => 'application/javascript']);
    }
    return response()->file($path, [
        'Content-Type' => 'application/javascript',
        'Service-Worker-Allowed' => '/',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
});

Route::get('/workbox-{hash}.js', function ($hash) {
    $filename = "workbox-{$hash}.js";
    $path = public_path($filename);
    if (!file_exists($path)) {
        $path = public_path("build/{$filename}");
    }
    if (!file_exists($path)) {
        return response('/* workbox not found */', 404, ['Content-Type' => 'application/javascript']);
    }
    return response()->file($path, ['Content-Type' => 'application/javascript']);
});

Route::get('/build/sw.js', function () {
    $path = public_path('build/sw.js');
    if (!file_exists($path)) {
        return response('/* SW not found */', 404, ['Content-Type' => 'application/javascript']);
    }
    return response()->file($path, [
        'Content-Type' => 'application/javascript',
        'Service-Worker-Allowed' => '/',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
});

Route::get('/manifest.webmanifest', function () {
    $path = public_path('build/manifest.webmanifest');
    if (!file_exists($path)) {
        $path = public_path('manifest.webmanifest');
    }
    return response()->file($path, [
        'Content-Type' => 'application/manifest+json',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
});

Route::get('/registerSW.js', function () {
    $path = public_path('build/registerSW.js');
    if (!file_exists($path)) {
        $path = public_path('registerSW.js');
    }
    if (!file_exists($path)) {
        return response('/* registerSW not found */', 404, ['Content-Type' => 'application/javascript']);
    }
    return response()->file($path, ['Content-Type' => 'application/javascript']);
});

Route::get('/build/registerSW.js', function () {
    $path = public_path('build/registerSW.js');
    if (!file_exists($path)) {
        $path = public_path('registerSW.js');
    }
    if (!file_exists($path)) {
        return response('/* registerSW not found */', 404, ['Content-Type' => 'application/javascript']);
    }
    return response()->file($path, ['Content-Type' => 'application/javascript']);
});

Route::get('/assets/{path}', function ($path) {
    $file = public_path('build/assets/' . $path);
    if (file_exists($file)) {
        $mime = match (pathinfo($file, PATHINFO_EXTENSION)) {
            'js' => 'application/javascript',
            'css' => 'text/css',
            'woff2' => 'font/woff2',
            'woff' => 'font/woff',
            'ttf' => 'font/ttf',
            default => mime_content_type($file) ?: 'application/octet-stream',
        };
        return response()->file($file, ['Content-Type' => $mime]);
    }
    abort(404);
})->where('path', '.*');
