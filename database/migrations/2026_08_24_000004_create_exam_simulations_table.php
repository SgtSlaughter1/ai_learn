<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('exam_simulations');

        Schema::create('exam_simulations', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('exam_code', 30); // jamb, waec, neco, bece
            $table->unsignedSmallInteger('exam_year')->nullable();
            $table->json('subject_ids')->nullable(); // JSON array of subject IDs in combination (e.g. 4 for JAMB)
            $table->string('mode', 20)->default('simulation'); // simulation (timed) or practice (self-paced)
            $table->unsignedSmallInteger('total_questions')->default(0);
            $table->unsignedSmallInteger('correct_answers')->default(0);
            $table->decimal('score_percentage', 5, 2)->default(0.00);
            $table->unsignedInteger('duration_seconds')->default(0); // Allocated duration in seconds
            $table->unsignedInteger('time_spent_seconds')->default(0); // Actual time taken
            $table->string('status', 20)->default('in_progress'); // in_progress, completed, abandoned
            $table->json('answers')->nullable(); // Record of all user selected options and correctness
            $table->json('topic_breakdown')->nullable(); // Performance analyzed by curriculum topic
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            // Id generated on the device, so a simulation submitted offline is recorded once.
            $table->string('client_id', 64)->nullable()->unique();

            $table->index('user_id');
            $table->index('school_id');
            $table->index('exam_code');
            $table->index('status');
            $table->index(['user_id', 'exam_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_simulations');
    }
};
