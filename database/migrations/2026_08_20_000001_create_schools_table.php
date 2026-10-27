<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 50)->unique(); // primary, junior, senior
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('schools')) {
            Schema::create('schools', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->json('category_ids')->nullable();
                // Learners' in-app Recess (short earned game breaks); the school can switch it off.
                $table->boolean('recess_enabled')->default(true);
                $table->string('slug', 150)->unique();
                $table->string('address')->nullable();
                $table->string('city')->nullable();
                $table->string('state')->nullable();
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->text('description')->nullable();
                // One school per admin: unique, and foreignUuid so the foreign key is really created.
                $table->foreignUuid('admin_user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index('is_active');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('schools');
        Schema::dropIfExists('categories');
    }
};
