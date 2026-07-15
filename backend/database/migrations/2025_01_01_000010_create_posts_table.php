<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->string('image_url')->nullable();
            $table->float('authenticity_score')->default(0.5)->comment('0–1, higher = more authentic');
            $table->string('chroma_id')->nullable()->comment('vector document id in Chroma');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
            $table->index('authenticity_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
