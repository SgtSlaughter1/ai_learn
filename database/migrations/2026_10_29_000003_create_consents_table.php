<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every consent given or withdrawn, never edited: who, to what, which version, recorded by whom
 * and when. The latest row per user and document is the current answer; the rest is the proof.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consents', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('document', 20); // terms | parental | ai_training
            $table->string('version', 20);
            $table->boolean('granted');
            $table->string('source', 10); // self | school
            $table->foreignUuid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            // The current answer: one user's rows for one document, newest first.
            $table->index(['user_id', 'document', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consents');
    }
};
