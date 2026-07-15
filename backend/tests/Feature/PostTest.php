<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PostTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsUser(): array
    {
        $user  = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;
        return [$user, $token];
    }

    #[Test]
    public function authenticated_user_can_create_a_post(): void
    {
        Http::fake([
            '*' => Http::response(['chroma_id' => 'chroma-abc-123', 'dims' => 384], 200),
        ]);

        [$user, $token] = $this->actingAsUser();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/posts', [
                'body' => 'I spent the morning watching birds from my window. It was surprisingly peaceful.',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id', 'body', 'authenticity_score', 'created_at',
                'user' => ['id', 'name'],
            ]);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'body'    => 'I spent the morning watching birds from my window. It was surprisingly peaceful.',
        ]);
    }

    #[Test]
    public function post_body_is_required(): void
    {
        [$user, $token] = $this->actingAsUser();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/posts', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);
    }

    #[Test]
    public function authenticity_score_is_higher_for_genuine_text(): void
    {
        $genuineText    = 'i woke up early and my coffee was perfect. my cat sat on my book. it was a good morning.';
        $marketingText  = 'BUY NOW!!! LIMITED OFFER!!! CLICK HERE!!! DM FOR PRICE!!!';

        $genuineScore   = Post::computeAuthenticityScore($genuineText);
        $marketingScore = Post::computeAuthenticityScore($marketingText);

        $this->assertGreaterThan($marketingScore, $genuineScore,
            "Genuine text should have a higher authenticity score than marketing spam");
    }

    #[Test]
    public function unauthenticated_user_cannot_create_post(): void
    {
        $this->postJson('/api/posts', ['body' => 'Hello!'])->assertStatus(401);
    }

    #[Test]
    public function feed_returns_paginated_posts_for_authenticated_user(): void
    {
        [$user, $token] = $this->actingAsUser();

        $author = User::factory()->create();
        Post::factory()->count(5)->create(['user_id' => $author->id]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/feed?page=1');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'body', 'score', 'created_at', 'user']],
                'meta' => ['current_page', 'per_page', 'has_more'],
            ]);
    }

    #[Test]
    public function feed_returns_empty_when_no_posts_exist(): void
    {
        [$user, $token] = $this->actingAsUser();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/feed?page=1');

        $response->assertStatus(200)
            ->assertJson(['data' => [], 'meta' => ['current_page' => 1]]);
    }
}
