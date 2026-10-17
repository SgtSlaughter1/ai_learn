<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records that can be created on an offline device carry an id generated there,
     * so a resend (or a guest resend, where idempotency keys don't apply) finds the
     * row it already created instead of inserting a duplicate.
     */
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->string('client_id', 64)->nullable()->unique();
        });

        Schema::table('exam_simulations', function (Blueprint $table) {
            $table->string('client_id', 64)->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('exam_simulations', function (Blueprint $table) {
            $table->dropUnique(['client_id']);
            $table->dropColumn('client_id');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropUnique(['client_id']);
            $table->dropColumn('client_id');
        });
    }
};
