<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->restrictOnDelete(); // null means "shared with every school", so never null it on delete
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->string('name');
            $table->string('slug', 150)->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->integer('sort_order')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index('school_id');
            $table->index('class_id');
            $table->index(['school_id', 'class_id']);
            $table->index('status');
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subjects');
    }
};
