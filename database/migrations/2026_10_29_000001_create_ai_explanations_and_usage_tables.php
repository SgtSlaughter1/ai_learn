<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI explanations are written once per question version and chosen option, then reused by every
 * learner. A person can check each one: learners report one that looks wrong, and the teachers
 * or admins who manage the question approve, correct or hide it; too many reports hide an
 * unchecked one until someone looks. Usage is kept per day, feature and model, so the cost of
 * each AI feature can be seen without one row per request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_explanations', function (Blueprint $table) {
            $table->id();
            $table->string('source', 20); // question | past_question
            $table->unsignedBigInteger('source_id');
            $table->unsignedInteger('version'); // the question's updated_at, so an edit gets a fresh explanation
            $table->unsignedBigInteger('option_id')->default(0); // 0: the learner skipped it
            $table->text('body');
            $table->string('review_status', 20)->default('ai'); // ai | approved | corrected | hidden
            $table->unsignedInteger('open_reports')->default(0)->index();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('provider', 20);
            $table->string('model', 80);
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->timestamps();

            $table->unique(['source', 'source_id', 'version', 'option_id'], 'ai_explanations_lookup_unique');
        });

        Schema::create('ai_explanation_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_explanation_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reason', 20); // wrong | confusing | inappropriate
            $table->string('note', 500)->nullable();
            $table->timestamp('created_at')->nullable();

            // One report per person per explanation, until a reviewer has looked at it.
            $table->unique(['ai_explanation_id', 'user_id']);
        });

        Schema::create('ai_usage_daily', function (Blueprint $table) {
            $table->id();
            $table->date('day');
            $table->string('feature', 30);
            $table->string('provider', 20);
            $table->string('model', 80);
            $table->unsignedInteger('requests')->default(0);
            $table->unsignedBigInteger('prompt_tokens')->default(0);
            $table->unsignedBigInteger('completion_tokens')->default(0);

            $table->unique(['day', 'feature', 'provider', 'model'], 'ai_usage_daily_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_daily');
        Schema::dropIfExists('ai_explanation_reports');
        Schema::dropIfExists('ai_explanations');
    }
};
