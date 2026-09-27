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
            $table->foreignId('program_id')->nullable()->constrained('programs')->nullOnDelete();
            $table->string('name'); // e.g. "SS1 Science Alpha", "Nursery 1 Diamond", "KG1 Sunshine"
            $table->string('slug', 150)->unique();
            $table->string('grade_level', 50)->nullable(); // CRECHE, KG1..KG2, NUR1..NUR2, PRI1..PRI6, JSS1..JSS3, SS1..SS3
            $table->string('arm', 50)->nullable(); // school_class_arm: Alpha, Beta, Gold, Blue, Sunshine, etc.
            $table->string('section', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('school_id');
            $table->index('program_id');
            $table->index('grade_level');
            $table->index('arm');
            $table->index(['school_id', 'grade_level']);
            $table->index(['school_id', 'program_id']);
            $table->index(['school_id', 'is_active', 'grade_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
