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
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            $table->text('question_text');
            $table->string('type')->default('multiple_choice');
            $table->string('difficulty')->default('medium');
            $table->text('explanation')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->index('topic_id');
            $table->index('type');
            $table->index('difficulty');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
