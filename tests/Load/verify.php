<?php

use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\XpTransaction;

// Row counts the load test must change by exactly the expected amount (run before and after).
$ids = User::where('email', 'like', '%@loadtest.local')->pluck('id');
echo json_encode([
    'attempts' => QuizAttempt::whereIn('user_id', $ids)->count(),
    'attempts_without_xp' => QuizAttempt::whereIn('user_id', $ids)->whereNull('xp_awarded_at')->count(),
    'quiz_xp_awards' => XpTransaction::whereIn('user_id', $ids)->where('source', 'quiz_complete')->count(),
    'flashcard_xp_awards' => XpTransaction::whereIn('user_id', $ids)->where('source', 'flashcard_review')->count(),
    'revision_bonus_awards' => XpTransaction::whereIn('user_id', $ids)->where('source', 'daily_revision_bonus')->count(),
    'progress_rows' => LearnerProgress::whereIn('user_id', $ids)->count(),
    'jobs_pending' => DB::table('jobs')->count(),
    'failed_jobs' => DB::table('failed_jobs')->count(),
]).PHP_EOL;
