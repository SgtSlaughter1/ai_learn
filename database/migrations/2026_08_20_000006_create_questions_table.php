<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            $table->text('question_text');
            $table->string('image_url', 500)->nullable();
            $table->string('type')->default('multiple_choice');
            $table->string('difficulty')->default('medium');
            $table->text('explanation')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->index('school_id');
            $table->index('topic_id');
            $table->index('type');
            $table->index('difficulty');
            $table->index('status');
            $table->index(['topic_id', 'status', 'school_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
