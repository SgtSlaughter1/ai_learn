<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 50)->unique(); // primary, junior, senior
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('schools') && !Schema::hasColumn('schools', 'category_ids')) {
            Schema::table('schools', function (Blueprint $table) {
                $table->json('category_ids')->nullable()->after('name');
            });

            // Backfill existing category data if present
            if (Schema::hasColumn('schools', 'category')) {
                DB::table('schools')->where('category', 'primary')->update(['category_ids' => json_encode([1])]);
                DB::table('schools')->where('category', 'junior')->update(['category_ids' => json_encode([2])]);
                DB::table('schools')->where('category', 'senior')->update(['category_ids' => json_encode([3])]);
                DB::table('schools')->where('category', 'combined')->update(['category_ids' => json_encode([1, 2, 3])]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('schools') && Schema::hasColumn('schools', 'category_ids')) {
            Schema::table('schools', function (Blueprint $table) {
                $table->dropColumn('category_ids');
            });
        }

        Schema::dropIfExists('categories');
    }
};
