<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            $table->integer('questions_attempted')->default(0);
            $table->integer('questions_correct')->default(0);
            $table->integer('mastery_score')->default(0);
            $table->integer('ability_score')->default(1500);
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'topic_id']);
            $table->index('user_id');
            $table->index('topic_id');
            $table->index('mastery_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_progress');
    }
};
