<?php

namespace App\Http\Controllers;

use App\Models\Interaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InteractionController extends Controller
{
    /**
     * POST /api/interactions
     * Log a user interaction (view, reply, reaction) against a post.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'post_id' => ['required', 'integer', 'exists:posts,id'],
            'type'    => ['required', 'string', 'in:view,reply,reaction'],
        ]);

        // Use updateOrCreate to respect the unique constraint gracefully
        $interaction = Interaction::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'post_id' => $request->post_id,
                'type'    => $request->type,
            ],
            [] // no additional attributes to update
        );

        return response()->json([
            'id'         => $interaction->id,
            'post_id'    => $interaction->post_id,
            'type'       => $interaction->type,
            'created_at' => $interaction->created_at->toISOString(),
        ], 201);
    }
}
