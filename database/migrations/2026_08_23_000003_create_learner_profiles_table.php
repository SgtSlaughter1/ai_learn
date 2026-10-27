<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_profiles', function (Blueprint $table) {
            $table->id();
            // One profile per learner (User::learnerProfile is hasOne). foreignUuid, so the key is really created.
            $table->foreignUuid('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('student_id')->nullable();
            $table->string('grade_level')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('school_id');
            $table->index('grade_level');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_profiles');
    }
};
