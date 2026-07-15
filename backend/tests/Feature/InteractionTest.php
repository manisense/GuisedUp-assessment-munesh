<?php

namespace Tests\Feature;

use App\Models\Interaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InteractionTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function user_can_log_a_reaction(): void
    {
        $user   = User::factory()->create();
        $author = User::factory()->create();
        $post   = Post::factory()->create(['user_id' => $author->id]);
        $token  = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/interactions', [
                'post_id' => $post->id,
                'type'    => 'reaction',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['id', 'post_id', 'type', 'created_at'])
            ->assertJsonFragment(['type' => 'reaction', 'post_id' => $post->id]);

        $this->assertDatabaseHas('interactions', [
            'user_id' => $user->id,
            'post_id' => $post->id,
            'type'    => 'reaction',
        ]);
    }

    #[Test]
    public function duplicate_reaction_does_not_cause_error(): void
    {
        $user   = User::factory()->create();
        $author = User::factory()->create();
        $post   = Post::factory()->create(['user_id' => $author->id]);
        $token  = $user->createToken('test')->plainTextToken;

        $payload = ['post_id' => $post->id, 'type' => 'reaction'];

        $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/interactions', $payload)->assertStatus(201);
        $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/interactions', $payload)->assertStatus(201);

        $this->assertEquals(1, Interaction::where([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'type'    => 'reaction',
        ])->count());
    }

    #[Test]
    public function interaction_type_must_be_valid(): void
    {
        $user   = User::factory()->create();
        $author = User::factory()->create();
        $post   = Post::factory()->create(['user_id' => $author->id]);
        $token  = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/interactions', [
                'post_id' => $post->id,
                'type'    => 'like',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    #[Test]
    public function interaction_requires_valid_post_id(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/interactions', [
                'post_id' => 99999,
                'type'    => 'view',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post_id']);
    }
}
