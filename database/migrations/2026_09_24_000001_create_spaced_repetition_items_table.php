<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spaced_repetition_items', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('item_type', 30)->default('question'); // 'question' (LMS) or 'past_question' (CBT)
            $table->foreignId('question_id')->nullable()->constrained('questions')->cascadeOnDelete();
            $table->foreignId('past_question_id')->nullable()->constrained('past_questions')->cascadeOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained('topics')->nullOnDelete();

            // SuperMemo SM-2 & Leitner state
            $table->unsignedSmallInteger('repetition_level')->default(0); // 0 = initial, 1 = day 1, 2 = day 3, etc.
            $table->decimal('ease_factor', 4, 2)->default(2.50);
            $table->unsignedSmallInteger('interval_days')->default(1);
            $table->unsignedSmallInteger('consecutive_correct')->default(0);
            $table->unsignedSmallInteger('total_reviews')->default(0);
            $table->unsignedSmallInteger('total_mistakes')->default(0);

            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamp('next_review_at')->nullable();
            $table->string('last_result', 20)->nullable(); // wrong, hard, good, easy
            $table->string('reason_tag', 40)->default('recent_mistake'); // recent_mistake, fragile_mastery, retention_check, weak_topic
            $table->string('status', 20)->default('active'); // active, mastered, paused

            $table->timestamps();

            // Indexes for instant sub-millisecond daily queue lookup
            $table->index(['user_id', 'status', 'next_review_at']);
            $table->index(['user_id', 'question_id']);
            $table->index(['user_id', 'past_question_id']);
            $table->index(['user_id', 'reason_tag']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spaced_repetition_items');
    }
};
