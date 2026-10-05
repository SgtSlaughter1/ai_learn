<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_gamification', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->integer('total_xp')->default(0);
            $table->integer('level')->default(1);
            $table->string('tier')->default('Newcomer');
            $table->integer('current_streak')->default(0);
            $table->integer('longest_streak')->default(0);
            $table->integer('streak_freeze_count')->default(1);
            $table->date('last_active_date')->nullable();
            $table->date('last_streak_penalty_at')->nullable();
            $table->date('streak_shield_used_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('total_xp');
            $table->index('level');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_gamification');
    }
};
