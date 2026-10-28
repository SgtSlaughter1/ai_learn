<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * School CBT: tests a school sets for its own classes (CA tests, exams, mocks), sat in the
 * school with a start code from the invigilator and marked on the server only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('school_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->text('instructions')->nullable();
            $table->unsignedSmallInteger('duration_minutes');
            $table->timestamp('opens_at');
            $table->timestamp('closes_at');
            $table->unsignedTinyInteger('pass_mark')->nullable(); // percent
            $table->boolean('shuffle_questions')->default(true);
            $table->boolean('shuffle_options')->default(true);
            // The score can show on submit; corrections only once the teacher releases results.
            $table->boolean('show_score_immediately')->default(false);
            $table->timestamp('results_released_at')->nullable();
            // Read out by the invigilator in the room; never sent to learners.
            $table->string('access_code', 8)->nullable();
            $table->string('status', 20)->default('draft'); // draft, published, closed
            // Kept in step with school_exam_questions so lists never count rows.
            $table->unsignedSmallInteger('question_count')->default(0);
            $table->unsignedSmallInteger('total_marks')->default(0);
            $table->timestamps();

            $table->index(['school_id', 'status', 'opens_at']);
            $table->index('created_by');
        });

        Schema::create('school_exam_classes', function (Blueprint $table) {
            $table->foreignId('school_exam_id')->constrained('school_exams')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();

            $table->primary(['school_exam_id', 'class_id']);
            $table->index('class_id'); // a learner's exams, by their classes
        });

        Schema::create('school_exam_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_exam_id')->constrained('school_exams')->cascadeOnDelete();
            // Null once the question is deleted from the bank; marked attempts keep their scores.
            $table->foreignId('question_id')->nullable()->constrained('questions')->nullOnDelete();
            $table->unsignedSmallInteger('position');
            $table->unsignedSmallInteger('marks')->default(1);
            $table->timestamps();

            $table->unique(['school_exam_id', 'question_id']);
            $table->index(['school_exam_id', 'position']);
        });

        Schema::create('school_exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_exam_id')->constrained('school_exams')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('in_progress'); // in_progress, submitted, auto_submitted, ended
            // This learner's paper: question order and each question's option order, fixed at start.
            $table->json('paper');
            $table->json('answers')->nullable(); // school_exam_question id => option id
            $table->unsignedSmallInteger('answered_count')->default(0);
            $table->unsignedSmallInteger('left_screen_count')->default(0);
            $table->unsignedSmallInteger('extra_minutes')->default(0);
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedSmallInteger('score')->nullable();
            $table->unsignedSmallInteger('max_score')->default(0);
            $table->decimal('percentage', 5, 2)->nullable();
            $table->json('topic_breakdown')->nullable();
            $table->timestamps();

            $table->unique(['school_exam_id', 'user_id']);
            $table->index(['school_exam_id', 'status', 'deadline_at']); // room view and closing late attempts
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_exam_attempts');
        Schema::dropIfExists('school_exam_questions');
        Schema::dropIfExists('school_exam_classes');
        Schema::dropIfExists('school_exams');
    }
};
