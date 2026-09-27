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
        Schema::create('feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('role')->nullable(); // learner, teacher, school_admin, parent, visitor
            $table->string('category')->default('general_feedback'); // general_feedback, bug_report, feature_request, school_pilot, curriculum_inquiry, content_correction
            $table->unsignedTinyInteger('rating')->nullable(); // 1 to 5
            $table->string('subject')->nullable();
            $table->text('message');
            $table->string('status')->default('new'); // new, reviewed, resolved
            $table->json('meta')->nullable(); // platform, browser, offline_synced, etc.
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feedbacks');
    }
};
