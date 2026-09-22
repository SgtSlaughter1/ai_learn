<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('exam_code', 30)->nullable()->after('status'); // jamb, waec, neco, bece, post_utme
            $table->unsignedSmallInteger('exam_year')->nullable()->after('exam_code'); // 2024, 2023, 2022, etc.
            $table->string('paper_type', 50)->nullable()->after('exam_year'); // Paper 1, Paper 2, CBT, Objective
            $table->unsignedSmallInteger('question_number')->nullable()->after('paper_type'); // e.g. Question 14
            $table->text('passage_text')->nullable()->after('question_number'); // Reading comprehension passage or scenario
            $table->string('image_url')->nullable()->after('passage_text'); // Diagram or chart
            $table->json('metadata')->nullable()->after('image_url'); // External ID, source tags, topic match metadata

            $table->index('exam_code');
            $table->index('exam_year');
            $table->index(['exam_code', 'exam_year']);
            $table->index(['exam_code', 'topic_id']);
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropIndex(['exam_code']);
            $table->dropIndex(['exam_year']);
            $table->dropIndex(['exam_code', 'exam_year']);
            $table->dropIndex(['exam_code', 'topic_id']);
            $table->dropColumn([
                'exam_code',
                'exam_year',
                'paper_type',
                'question_number',
                'passage_text',
                'image_url',
                'metadata',
            ]);
        });
    }
};
