<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PostController extends Controller
{
    /**
     * POST /api/posts
     * Create a post, compute authenticity score, embed via Python service.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'body'      => ['required', 'string', 'min:1', 'max:2000'],
            'image_url' => ['nullable', 'url', 'max:500'],
        ]);

        $score    = Post::computeAuthenticityScore($request->body);
        $post = Post::create([
            'user_id'            => $request->user()->id,
            'body'               => $request->body,
            'image_url'          => $request->image_url,
            'authenticity_score' => $score,
            'chroma_id'          => null,
        ]);

        try {
            $embedServiceUrl = config('services.embed.url', 'http://127.0.0.1:8001');
            $response = Http::timeout(5)->post("{$embedServiceUrl}/embed", [
                'text'    => $post->body,
                'post_id' => $post->id,
            ]);

            if ($response->successful()) {
                $post->update(['chroma_id' => $response->json('chroma_id')]);
            }
        } catch (\Throwable $e) {
            Log::warning('Embedding service unavailable: ' . $e->getMessage());
        }

        $post->load('user');

        return response()->json([
            'id'                 => $post->id,
            'body'               => $post->body,
            'image_url'          => $post->image_url,
            'authenticity_score' => $post->authenticity_score,
            'chroma_id'          => $post->chroma_id,
            'created_at'         => $post->created_at->toISOString(),
            'user'               => [
                'id'         => $post->user->id,
                'name'       => $post->user->name,
                'avatar_url' => $post->user->avatar_url ?? null,
            ],
        ], 201);
    }
}
