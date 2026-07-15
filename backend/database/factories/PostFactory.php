<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Post>
 */
class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        $body = $this->faker->paragraph(rand(2, 4));
        return [
            'user_id'            => User::factory(),
            'body'               => $body,
            'image_url'          => null,
            'authenticity_score' => Post::computeAuthenticityScore($body),
            'chroma_id'          => null,
        ];
    }
}
