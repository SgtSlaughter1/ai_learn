<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_adaptive_states', function (Blueprint $table) {
            $table->id();
            $table->uuid('quiz_attempt_id')->unique();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->integer('current_ability')->default(1500);
            $table->integer('questions_answered')->default(0);
            $table->integer('correct_count')->default(0);
            $table->json('answered_question_ids')->nullable();
            $table->json('answer_results')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->timestamps();

            $table->index('user_id');
            $table->index('quiz_id');
            $table->index(['user_id', 'quiz_id']);
            $table->index('is_completed');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_adaptive_states');
    }
};
