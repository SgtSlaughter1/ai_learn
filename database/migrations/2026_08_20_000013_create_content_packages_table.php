<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->string('level');
            $table->string('version');
            $table->string('file_path')->nullable();
            $table->string('status')->default('published');
            $table->timestamps();

            $table->index('subject_id');
            $table->index('level');
            $table->index('version');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_packages');
    }
};
