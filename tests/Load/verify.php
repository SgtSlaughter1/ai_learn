<?php
// Row counts the load test must change by exactly the expected amount (run before and after).
$ids = App\Models\User::where('email', 'like', '%@loadtest.local')->pluck('id');
echo json_encode([
    'attempts' => App\Models\QuizAttempt::whereIn('user_id', $ids)->count(),
    'attempts_without_xp' => App\Models\QuizAttempt::whereIn('user_id', $ids)->whereNull('xp_awarded_at')->count(),
    'quiz_xp_awards' => App\Models\XpTransaction::whereIn('user_id', $ids)->where('source', 'quiz_complete')->count(),
    'flashcard_xp_awards' => App\Models\XpTransaction::whereIn('user_id', $ids)->where('source', 'flashcard_review')->count(),
    'revision_bonus_awards' => App\Models\XpTransaction::whereIn('user_id', $ids)->where('source', 'daily_revision_bonus')->count(),
    'progress_rows' => App\Models\LearnerProgress::whereIn('user_id', $ids)->count(),
    'jobs_pending' => DB::table('jobs')->count(),
    'failed_jobs' => DB::table('failed_jobs')->count(),
]).PHP_EOL;
