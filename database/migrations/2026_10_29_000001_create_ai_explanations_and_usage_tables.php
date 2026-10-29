<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI explanations are written once per question version and chosen option, then reused by every
 * learner (and can later be checked by teachers or shipped offline). Usage is kept per day,
 * feature and model, so the cost of each AI feature can be seen without one row per request.
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
            $table->string('provider', 20);
            $table->string('model', 80);
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->timestamps();

            $table->unique(['source', 'source_id', 'version', 'option_id'], 'ai_explanations_lookup_unique');
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
        Schema::dropIfExists('ai_explanations');
    }
};
