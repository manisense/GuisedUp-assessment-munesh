<?php

namespace App\Http\Controllers;

use App\Models\Interaction;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FeedController extends Controller
{
    private const PER_PAGE      = 20;
    private const CANDIDATE_DAYS = 14;
    private const MAX_REL        = 100.0; // normalisation ceiling for relationship depth

    // Ranking weights (sum = 1.0)
    private const W_AUTH     = 0.25; // Authenticity
    private const W_REL      = 0.35; // Relationship depth
    private const W_SEM      = 0.25; // Semantic similarity
    private const W_TIME     = 0.15; // Time decay
    private const HALF_LIFE_H = 36;  // hours — half-life for time decay

    /**
     * GET /api/feed?page=N
     * Returns a ranked, paginated feed for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $page   = max(1, (int) $request->query('page', 1));

        // 1. Candidate generation: recent posts + posts from top-interacted authors
        $candidateIds = $this->getCandidatePostIds($viewer->id);

        if (empty($candidateIds)) {
            return response()->json([
                'data' => [],
                'meta' => ['current_page' => $page, 'per_page' => self::PER_PAGE, 'has_more' => false],
            ]);
        }

        // 2. Load candidate posts with authors
        $posts = Post::with('user')
            ->whereIn('id', $candidateIds)
            ->get()
            ->keyBy('id');

        // 3. Relationship depth map: author_id -> weighted score
        $relMap = $this->getRelationshipDepthMap($viewer->id);

        // 4. Interest centroid from Python (optional — cold-start tolerant)
        $semMap = $this->getSemanticSimilarities($viewer->id, $candidateIds);

        // 5. Score each candidate
        $scored = [];
        foreach ($posts as $post) {
            $ageHours = now()->diffInHours($post->created_at, absolute: true);

            $A = (float) $post->authenticity_score;
            $R = $this->normalizeRel($relMap[$post->user_id] ?? 0.0);
            $S = (float) ($semMap[$post->id] ?? 0.5); // 0.5 = neutral on cold-start
            $T = exp(-log(2) * $ageHours / self::HALF_LIFE_H);

            $score = self::W_AUTH * $A
                   + self::W_REL  * $R
                   + self::W_SEM  * $S
                   + self::W_TIME * $T;

            $scored[] = ['post' => $post, 'score' => round($score, 4)];
        }

        // 6. Sort descending by score
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        // 7. Paginate
        $total  = count($scored);
        $offset = ($page - 1) * self::PER_PAGE;
        $page_items = array_slice($scored, $offset, self::PER_PAGE);

        // 8. Hydrate viewer reaction status
        $pagePostIds    = array_column($page_items, null);
        $pagePostIds    = array_map(fn($item) => $item['post']->id, $page_items);
        $viewerReacted  = Interaction::where('user_id', $viewer->id)
            ->whereIn('post_id', $pagePostIds)
            ->where('type', 'reaction')
            ->pluck('post_id')
            ->flip();

        $data = array_map(function ($item) use ($viewerReacted) {
            $post = $item['post'];
            return [
                'id'                 => $post->id,
                'body'               => $post->body,
                'image_url'          => $post->image_url,
                'authenticity_score' => $post->authenticity_score,
                'score'              => $item['score'],
                'created_at'         => $post->created_at->toISOString(),
                'user'               => [
                    'id'         => $post->user->id,
                    'name'       => $post->user->name,
                    'avatar_url' => $post->user->avatar_url ?? null,
                ],
                'viewer_has_reacted' => isset($viewerReacted[$post->id]),
            ];
        }, $page_items);

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $page,
                'per_page'     => self::PER_PAGE,
                'has_more'     => ($offset + self::PER_PAGE) < $total,
            ],
        ]);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Collect candidate post IDs:
     *  - posts from the last N days (broad freshness pool)
     *  - plus posts by top-5 interacted authors (relationship expansion)
     */
    private function getCandidatePostIds(int $viewerId): array
    {
        $cutoff = now()->subDays(self::CANDIDATE_DAYS);

        // Recent posts (exclude viewer's own posts from the feed)
        $recentIds = DB::table('posts')
            ->where('created_at', '>=', $cutoff)
            ->where('user_id', '!=', $viewerId)
            ->pluck('id')
            ->toArray();

        // Top-interacted authors
        $topAuthors = DB::table('interactions as i')
            ->join('posts as p', 'p.id', '=', 'i.post_id')
            ->where('i.user_id', $viewerId)
            ->select('p.user_id', DB::raw('count(*) as cnt'))
            ->groupBy('p.user_id')
            ->orderByDesc('cnt')
            ->limit(5)
            ->pluck('p.user_id')
            ->toArray();

        if (! empty($topAuthors)) {
            $authorPostIds = DB::table('posts')
                ->whereIn('user_id', $topAuthors)
                ->where('user_id', '!=', $viewerId)
                ->pluck('id')
                ->toArray();
            $recentIds = array_values(array_unique(array_merge($recentIds, $authorPostIds)));
        }

        return $recentIds;
    }

    /**
     * Build a map of author_id -> weighted interaction score for the viewer.
     *
     * Weights: reaction=3, reply=2, view=0.2
     */
    private function getRelationshipDepthMap(int $viewerId): array
    {
        $rows = DB::table('interactions as i')
            ->join('posts as p', 'p.id', '=', 'i.post_id')
            ->where('i.user_id', $viewerId)
            ->select(
                'p.user_id',
                DB::raw("SUM(CASE WHEN i.type='reaction' THEN 3
                              WHEN i.type='reply'    THEN 2
                              ELSE 0.2 END) as weighted_score")
            )
            ->groupBy('p.user_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[$row->user_id] = (float) $row->weighted_score;
        }
        return $map;
    }

    /**
     * log1p normalise to 0–1 range using a MAX_REL ceiling.
     */
    private function normalizeRel(float $raw): float
    {
        return log1p($raw) / log1p(self::MAX_REL);
    }

    /**
     * Ask Python service for semantic similarities between the viewer's
     * interest centroid and a list of post_ids.
     * Returns map of post_id -> similarity (0–1).
     * On failure or cold-start: returns empty array (caller defaults to 0.5).
     */
    private function getSemanticSimilarities(int $viewerId, array $postIds): array
    {
        if (empty($postIds)) {
            return [];
        }

        try {
            $embedServiceUrl = config('services.embed.url', 'http://127.0.0.1:8001');
            $response = Http::timeout(5)->post("{$embedServiceUrl}/interest-centroid", [
                'viewer_id' => $viewerId,
                'post_ids'  => $postIds,
            ]);

            if ($response->successful()) {
                return $response->json('similarities', []);
            }
        } catch (\Throwable $e) {
            Log::info('Semantic service unavailable, using neutral score: ' . $e->getMessage());
        }

        return [];
    }
}
