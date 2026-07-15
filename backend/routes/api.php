<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\InteractionController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Guised Up API Routes
|--------------------------------------------------------------------------
*/

// Public auth routes
Route::post('/login',  [AuthController::class, 'login']);

// Authenticated routes (rate limited for production)
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // Posts
    Route::post('/posts', [PostController::class, 'store']);

    // Feed (personalized, ranked)
    Route::get('/feed', [FeedController::class, 'index']);

    // Natural language search
    Route::get('/search', [SearchController::class, 'search']);

    // Interactions
    Route::post('/interactions', [InteractionController::class, 'store']);
});
