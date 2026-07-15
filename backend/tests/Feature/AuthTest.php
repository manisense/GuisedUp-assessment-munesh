<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email'    => 'test@guisedup.test',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email'    => 'test@guisedup.test',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ]);

        $this->assertNotEmpty($response->json('token'));
    }

    #[Test]
    public function login_fails_with_wrong_password(): void
    {
        User::factory()->create([
            'email'    => 'wrong@guisedup.test',
            'password' => bcrypt('correct'),
        ]);

        $this->postJson('/api/login', [
            'email'    => 'wrong@guisedup.test',
            'password' => 'incorrect',
        ])->assertStatus(422);
    }

    #[Test]
    public function login_fails_with_missing_fields(): void
    {
        $this->postJson('/api/login', [])->assertStatus(422);
    }

    #[Test]
    public function authenticated_user_can_logout(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout')
            ->assertStatus(200);
    }

    #[Test]
    public function unauthenticated_request_to_feed_is_rejected(): void
    {
        $this->getJson('/api/feed')->assertStatus(401);
    }
}
