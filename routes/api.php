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
    Route::post('/simulation/start', [PastQuestionController::class, 'startSimulation']);
    Route::post('/simulation/submit', [PastQuestionController::class, 'submitSimulation']);
    Route::get('/history', [PastQuestionController::class, 'getHistory']);
    Route::post('/explain', [PastQuestionController::class, 'explain']);
});

