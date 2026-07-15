<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SearchController extends Controller
{
    /**
     * GET /api/search?q={query}
     * Natural language semantic search across posts using vector similarity.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:300'],
        ]);

        $query = trim($request->query('q'));
        $postIds = [];

        // 1. Ask Python service for semantically similar post_ids via Chroma ANN
        try {
            $embedServiceUrl = config('services.embed.url', 'http://127.0.0.1:8001');
            $response = Http::timeout(8)->post("{$embedServiceUrl}/search", [
                'query' => $query,
                'n'     => 10,
            ]);

            if ($response->successful()) {
                $postIds = $response->json('post_ids', []);
            }
        } catch (\Throwable $e) {
            Log::warning('Search service unavailable: ' . $e->getMessage());
        }

        // 2. Fallback: full-text LIKE search if vector search unavailable
        if (empty($postIds)) {
            $words    = array_filter(explode(' ', $query), fn($w) => strlen($w) >= 3);
            $builder  = Post::with('user')->orderByDesc('created_at')->limit(10);

            foreach ($words as $word) {
                $builder->orWhere('body', 'LIKE', "%{$word}%");
            }

            $posts = $builder->get();

            return response()->json([
                'data'  => $this->formatPosts($posts),
                'query' => $query,
                'mode'  => 'fallback_text',
            ]);
        }

        // 3. Hydrate full post records, preserving Chroma relevance order
        $posts = Post::with('user')
            ->whereIn('id', $postIds)
            ->get()
            ->keyBy('id');

        // Preserve the order Chroma returned (most relevant first)
        $ordered = collect($postIds)
            ->filter(fn($id) => isset($posts[$id]))
            ->map(fn($id) => $posts[$id]);

        return response()->json([
            'data'  => $this->formatPosts($ordered),
            'query' => $query,
            'mode'  => 'vector',
        ]);
    }

    private function formatPosts($posts): array
    {
        return $posts->map(fn($post) => [
            'id'                 => $post->id,
            'body'               => $post->body,
            'image_url'          => $post->image_url,
            'authenticity_score' => $post->authenticity_score,
            'created_at'         => $post->created_at->toISOString(),
            'user'               => [
                'id'         => $post->user->id,
                'name'       => $post->user->name,
                'avatar_url' => $post->user->avatar_url ?? null,
            ],
        ])->values()->all();
    }
}
