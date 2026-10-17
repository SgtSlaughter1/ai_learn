<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** When the attempt's XP was awarded, so queued XP processing runs exactly once per attempt. */
    public function up(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->timestamp('xp_awarded_at')->nullable();
        });

        // Attempts recorded before this column existed already had their XP awarded.
        DB::table('quiz_attempts')->where('status', 'completed')
            ->update(['xp_awarded_at' => DB::raw('COALESCE(completed_at, created_at)')]);
    }

    public function down(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->dropColumn('xp_awarded_at');
        });
    }
};
