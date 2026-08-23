<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('name'); // e.g. "JSS3 Blue", "SS1 Science"
            $table->string('slug')->unique();
            $table->string('grade_level')->nullable();
            $table->string('section')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('school_id');
            $table->index('grade_level');
            $table->index(['school_id', 'grade_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
