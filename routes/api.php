<?php

use App\Http\Controllers\Api\PastQuestionController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\SubjectController;
use Illuminate\Support\Facades\Route;

// Public and test endpoints (will be wrapped in auth middleware when fully integrated)
Route::get('/subjects', [SubjectController::class, 'index']);
Route::get('/quizzes/{quiz}', [QuizController::class, 'show']);

// Past questions public API endpoints (accessible for standalone PWA and client simulations)
Route::prefix('v1/past-questions')->group(function () {
    Route::get('/meta', [PastQuestionController::class, 'getMeta']);
    Route::get('/questions', [PastQuestionController::class, 'getQuestions']);
    Route::post('/verify-answer', [PastQuestionController::class, 'verifyAnswer']);
    Route::get('/similar', [PastQuestionController::class, 'getSimilar']);
    Route::post('/simulation/start', [PastQuestionController::class, 'startSimulation']);
    Route::post('/simulation/submit', [PastQuestionController::class, 'submitSimulation']);
    Route::get('/history', [PastQuestionController::class, 'getHistory']);
    Route::post('/explain', [PastQuestionController::class, 'explain']);
});

// LMS Questions API
Route::prefix('v1/questions')->group(function () {
    Route::get('/similar', [\App\Http\Controllers\Web\AIWebController::class, 'similarQuestion']);
    Route::post('/explain', [\App\Http\Controllers\Web\AIWebController::class, 'explain']);
});

// Teacher & Classroom Intervention API
Route::prefix('v1/teacher')->middleware('auth:sanctum')->group(function () {
    Route::get('/stats', [\App\Http\Controllers\Web\TeacherDashboardController::class, 'getStats']);
    Route::get('/classes/{classId}/learners', [\App\Http\Controllers\Web\TeacherDashboardController::class, 'getClassLearners']);
    Route::get('/classes/{classId}/diagnostics', [\App\Http\Controllers\Web\TeacherDashboardController::class, 'getClassDiagnostics']);
    Route::post('/interventions/assign', [\App\Http\Controllers\Web\TeacherDashboardController::class, 'assignIntervention']);
});

// Admin & Teacher Management API
Route::prefix('v1/admin')->middleware('auth:sanctum')->group(function () {
    Route::get('/teachers', [\App\Http\Controllers\Web\AdminDashboardController::class, 'getTeachers']);
    Route::post('/teachers', [\App\Http\Controllers\Web\AdminDashboardController::class, 'saveTeacher']);
    Route::put('/teachers/{id}', [\App\Http\Controllers\Web\AdminDashboardController::class, 'updateTeacher']);
    Route::delete('/teachers/{id}', [\App\Http\Controllers\Web\AdminDashboardController::class, 'deleteTeacher']);

    Route::get('/classes', [\App\Http\Controllers\Web\AdminDashboardController::class, 'getClasses']);
    Route::get('/subjects', [\App\Http\Controllers\Web\AdminDashboardController::class, 'getSubjects']);
    Route::get('/topics', [\App\Http\Controllers\Web\AdminDashboardController::class, 'getTopics']);

    Route::get('/questions', [\App\Http\Controllers\Web\AdminDashboardController::class, 'getQuestions']);
    Route::post('/questions', [\App\Http\Controllers\Web\AdminDashboardController::class, 'saveQuestion']);
    Route::post('/questions/ai-extract', [\App\Http\Controllers\Web\AdminDashboardController::class, 'aiExtractQuestions']);
    Route::post('/questions/bulk', [\App\Http\Controllers\Web\AdminDashboardController::class, 'bulkSaveQuestions']);
    Route::put('/questions/{id}', [\App\Http\Controllers\Web\AdminDashboardController::class, 'updateQuestion']);
    Route::delete('/questions/{id}', [\App\Http\Controllers\Web\AdminDashboardController::class, 'deleteQuestion']);
});

// Spaced Repetition API
Route::prefix('v1/revision')->group(function () {
    Route::get('/today', [\App\Http\Controllers\Api\SpacedRepetitionController::class, 'getTodayQueue']);
    Route::post('/submit', [\App\Http\Controllers\Api\SpacedRepetitionController::class, 'submitReview']);
    Route::post('/complete-session', [\App\Http\Controllers\Api\SpacedRepetitionController::class, 'completeSession']);
    Route::get('/stats', [\App\Http\Controllers\Api\SpacedRepetitionController::class, 'getStats']);
});


