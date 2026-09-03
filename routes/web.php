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
