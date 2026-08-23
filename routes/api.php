<?php

use App\Http\Controllers\QuizController;
use App\Http\Controllers\SubjectController;
use Illuminate\Support\Facades\Route;

// Public and test endpoints (will be wrapped in auth middleware when fully integrated)
Route::get('/subjects', [SubjectController::class, 'index']);
Route::get('/quizzes/{quiz}', [QuizController::class, 'show']);
