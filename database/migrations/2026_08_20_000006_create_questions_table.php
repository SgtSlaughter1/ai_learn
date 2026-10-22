<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Shared material that several questions are about: a comprehension passage,
        // a poem or extract, a diagram or a table. Stored once; each question points to it.
        Schema::create('question_contexts', function (Blueprint $table) {
            $table->id();
            // Generated on the device, so a passage created offline and the questions
            // added to it before syncing all land on the same row.
            $table->uuid('client_id')->unique();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20)->default('passage'); // passage, poem, diagram, table
            $table->string('title')->nullable();
            $table->string('instructions', 500)->nullable();
            $table->longText('body')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->boolean('show_line_numbers')->default(false);
            $table->timestamps();

            $table->index(['topic_id', 'school_id']);
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            // Set when the question is about a shared passage; context_order is its
            // position within that passage's questions (1, 2, 3, ...).
            $table->foreignId('context_id')->nullable()->constrained('question_contexts')->nullOnDelete();
            $table->unsignedSmallInteger('context_order')->nullable();
            $table->string('grade_level', 50)->nullable();
            $table->text('question_text');
            $table->string('image_url', 500)->nullable();
            $table->string('type')->default('multiple_choice');
            $table->string('difficulty')->default('medium');
            $table->unsignedSmallInteger('marks')->default(1);
            $table->text('explanation')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->index('school_id');
            $table->index('topic_id');
            $table->index('grade_level');
            $table->index('type');
            $table->index('difficulty');
            $table->index('status');
            $table->index(['topic_id', 'status', 'school_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_contexts');
    }
};
