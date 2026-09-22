<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('past_question_options');
        Schema::dropIfExists('past_questions');

        Schema::create('past_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained('topics')->nullOnDelete();
            $table->string('exam_code', 30)->index(); // 'jamb', 'waec', 'neco', 'bece', 'post_utme'
            $table->unsignedSmallInteger('exam_year')->nullable()->index();
            $table->string('paper_type', 100)->default('Paper 1 (CBT)');
            $table->unsignedSmallInteger('question_number')->nullable();
            $table->longText('question_text');
            $table->longText('passage_text')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->string('difficulty', 20)->default('medium'); // easy, medium, hard
            $table->longText('explanation')->nullable();
            $table->string('status', 20)->default('active'); // active, archived
            $table->json('metadata')->nullable(); // holds ALOC id, learning objectives, tags, curriculum alignment
            $table->timestamps();

            $table->index(['exam_code', 'exam_year']);
            $table->index(['exam_code', 'subject_id']);
        });

        Schema::create('past_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('past_question_id')->constrained('past_questions')->cascadeOnDelete();
            $table->string('option_key', 10)->nullable(); // 'A', 'B', 'C', 'D', 'E'
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedTinyInteger('sort_order')->default(1);
            $table->timestamps();

            $table->index(['past_question_id', 'is_correct']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('past_question_options');
        Schema::dropIfExists('past_questions');
    }
};
