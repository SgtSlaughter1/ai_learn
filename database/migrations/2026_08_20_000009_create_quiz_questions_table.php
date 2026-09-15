<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->integer('sort_order')->default(0);
            $table->integer('marks')->default(1);

            $table->primary(['quiz_id', 'question_id']);
            $table->index('quiz_id');
            $table->index('question_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_questions');
    }
};
