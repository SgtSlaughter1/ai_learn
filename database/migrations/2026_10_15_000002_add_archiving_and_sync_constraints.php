<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users with quiz history are archived (soft deleted) instead of hard deleted,
        // because quiz_attempts.user_id restricts deletes.
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
            $table->string('archived_email', 191)->nullable();
        });

        // Removing an option from a question must not fail because a learner once picked it.
        // The answer keeps its is_correct / marks_awarded, only the option link is cleared.
        Schema::table('quiz_answers', function (Blueprint $table) {
            $table->dropForeign(['selected_option_id']);
            $table->foreign('selected_option_id')->references('id')->on('question_options')->nullOnDelete();
        });

        // One SRS item per learner per question, so concurrent reviews/syncs cannot duplicate rows.
        $this->removeDuplicateSrsItems('question_id');
        $this->removeDuplicateSrsItems('past_question_id');
        Schema::table('spaced_repetition_items', function (Blueprint $table) {
            $table->unique(['user_id', 'question_id'], 'srs_user_question_unique');
            $table->unique(['user_id', 'past_question_id'], 'srs_user_past_question_unique');
        });
    }

    public function down(): void
    {
        Schema::table('spaced_repetition_items', function (Blueprint $table) {
            $table->dropUnique('srs_user_question_unique');
            $table->dropUnique('srs_user_past_question_unique');
        });

        Schema::table('quiz_answers', function (Blueprint $table) {
            $table->dropForeign(['selected_option_id']);
            $table->foreign('selected_option_id')->references('id')->on('question_options')->restrictOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn('archived_email');
        });
    }

    /**
     * Keep the most recently reviewed row for each (user, item) pair.
     */
    private function removeDuplicateSrsItems(string $column): void
    {
        $duplicates = DB::table('spaced_repetition_items')
            ->whereNotNull($column)
            ->select('user_id', $column)
            ->groupBy('user_id', $column)
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $dup) {
            $keepId = DB::table('spaced_repetition_items')
                ->where('user_id', $dup->user_id)
                ->where($column, $dup->{$column})
                ->orderByDesc('last_reviewed_at')
                ->orderByDesc('id')
                ->value('id');

            DB::table('spaced_repetition_items')
                ->where('user_id', $dup->user_id)
                ->where($column, $dup->{$column})
                ->where('id', '!=', $keepId)
                ->delete();
        }
    }
};
