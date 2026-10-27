<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            // foreignUuid, so the foreign key is really created (uuid()->constrained() silently is not).
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['teacher', 'learner'])->default('learner');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['class_id', 'user_id']);
            $table->index('user_id');
            $table->index(['class_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_memberships');
    }
};
