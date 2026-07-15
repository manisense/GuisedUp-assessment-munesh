<?php

namespace Database\Seeders;

use App\Models\Interaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed 2 test users, ~20 posts each, and cross-user interactions.
     *
     * Credentials:
     *   maya@guisedup.test  / password
     *   alex@guisedup.test  / password
     */
    public function run(): void
    {
        // ── Users ────────────────────────────────────────────────────────────
        $maya = User::firstOrCreate(
            ['email' => 'maya@guisedup.test'],
            [
                'name'       => 'Maya Patel',
                'password'   => Hash::make('password'),
                'avatar_url' => null,
            ]
        );

        $alex = User::firstOrCreate(
            ['email' => 'alex@guisedup.test'],
            [
                'name'       => 'Alex Sharma',
                'password'   => Hash::make('password'),
                'avatar_url' => null,
            ]
        );

        // ── Posts ─────────────────────────────────────────────────────────────
        $mayaPosts  = $this->seedPostsForUser($maya->id, $this->mayaTexts());
        $alexPosts  = $this->seedPostsForUser($alex->id, $this->alexTexts());

        // ── Interactions (cross-user to seed the relationship graph) ──────────
        // Maya reacted/replied to 5 of Alex's posts
        foreach (array_slice($alexPosts, 0, 5) as $post) {
            Interaction::firstOrCreate(['user_id' => $maya->id, 'post_id' => $post->id, 'type' => 'reaction']);
            Interaction::firstOrCreate(['user_id' => $maya->id, 'post_id' => $post->id, 'type' => 'reply']);
        }
        // Maya viewed 10 more of Alex's posts
        foreach (array_slice($alexPosts, 5, 10) as $post) {
            Interaction::firstOrCreate(['user_id' => $maya->id, 'post_id' => $post->id, 'type' => 'view']);
        }

        // Alex reacted to 4 of Maya's posts
        foreach (array_slice($mayaPosts, 0, 4) as $post) {
            Interaction::firstOrCreate(['user_id' => $alex->id, 'post_id' => $post->id, 'type' => 'reaction']);
        }
        // Alex viewed 8 more
        foreach (array_slice($mayaPosts, 4, 8) as $post) {
            Interaction::firstOrCreate(['user_id' => $alex->id, 'post_id' => $post->id, 'type' => 'view']);
        }
    }

    private function seedPostsForUser(int $userId, array $texts): array
    {
        $posts = [];
        foreach ($texts as $i => $text) {
            $post = Post::create([
                'user_id'            => $userId,
                'body'               => $text,
                'image_url'          => null,
                'authenticity_score' => Post::computeAuthenticityScore($text),
                'chroma_id'          => null,
                'created_at'         => now()->subHours(rand(1, 14 * 24)),
                'updated_at'         => now(),
            ]);
            $posts[] = $post;
        }
        return $posts;
    }

    private function mayaTexts(): array
    {
        return [
            "woke up early and caught the most perfect sunrise from my balcony. my hair was a mess and i had yesterday's mascara on. felt real.",
            "spent the whole afternoon just reading by the window. no productivity, no hustle. just me and a good book. i think i needed this more than i knew.",
            "my roti came out slightly burnt on one side today. ate it anyway. it was still the best lunch i've had all week.",
            "called my nani after weeks. she spent 40 minutes telling me about the neighbours' drama. I loved every second of it.",
            "i've been overthinking a career decision for 3 weeks now. talked to my friend about it today and she said 'just pick one, maya'. she's right.",
            "the monsoon hit our street today and i immediately went outside to get soaked. 28 years old. no regrets.",
            "working from a chai shop today. it's loud, the wifi is slow, and i'm somehow more focused than i am at home.",
            "found my old diary from class 10. the cringe was astronomical but also — that girl had real feelings and she wrote them down every day. respect.",
            "my plant has a new leaf! this is the most excited i have been about anything in a while and i will not apologise for it.",
            "tried meditating for the first time properly. lasted 4 minutes before i started thinking about what to cook for dinner.",
            "sometimes i think i spend more energy deciding what to eat than actually eating. today i just made whatever and it was fine.",
            "had a work call go really well today. was genuinely surprised because i thought i'd mess it up. still processing that.",
            "my commute today had a dog sleeping on the footpath with its legs in the air. the whole day was good after that.",
            "made daal from scratch for the first time without calling my mom for instructions. it was not perfect. it was good enough and that counts.",
            "some days the news is too much and i have to step away. i went for a walk instead and looked at clouds for ten minutes. helped.",
            "the city is so loud at 6am but if you sit outside you can hear birds before the traffic starts. i'm going to do this more.",
            "bought flowers for myself on the way home. no occasion. sometimes you're the one who should bring you flowers.",
            "i've been so busy i forgot to feel things. today i sat and just felt stuff. it was uncomfortable but necessary.",
            "my friend group video called for 2 hours and we talked about absolutely nothing important. those are the best calls.",
            "slow morning. nothing happened. everything was fine.",
        ];
    }

    private function alexTexts(): array
    {
        return [
            "got lost in a new part of the city today. didn't check maps. ended up finding a street food stall that was genuinely the best pav bhaji i've ever had.",
            "been learning to cook properly this year. today i made chicken curry without following a recipe for the first time. it worked. i think i'm getting it.",
            "took a break from social media for two weeks. came back and nothing had changed and somehow that was both reassuring and a little sad.",
            "my gym progress has been slow but steady. started tracking less and just showing up more. this feels better.",
            "had a moment in the auto today where i wasn't on my phone. just watched the city go by for 20 minutes. i miss doing that.",
            "my desk is finally clean. don't know how long it'll last but right now everything feels possible.",
            "talked to a stranger at a bus stop for 15 minutes. we were both early. he told me about his son's engineering exams. i hope it went well.",
            "finished a project at work that i've been avoiding for a month. the dread was worse than the doing. always is.",
            "three cups of chai today. the third one was pushing it. worth it.",
            "it rained heavily while i was outside and i had no umbrella. instead of stressing i just stood under a shop awning and watched it pour. one of those moments.",
            "my sister called just to check in. didn't want anything. just called. i should do that more for people i care about.",
            "tried a new route to work. 10 minutes longer but so much more pleasant. switching permanently.",
            "wrote in my journal for the first time in 8 months. wasn't even anything interesting, just processed some stuff. felt lighter after.",
            "found out my favourite small restaurant is closing. went there one last time and ordered everything i ever liked. proper farewell.",
            "was nervous about a presentation all morning. it went fine. i need to trust myself more, i think.",
            "the city at night after the rain is something else. everything smells clean and the lights reflect off the wet road. walked home slow.",
            "learning a new skill this month: cooking north-indian food from scratch. currently at the 'edible but not great' stage. growing.",
            "my phone died mid-commute. no music, no scrolling. just thinking. remembered things i hadn't thought about in years.",
            "a kid on the bus was reading a comic so intensely he almost missed his stop. i love that kind of focus.",
            "quiet evening at home. just music and cooking and nothing else to do. this is enough.",
        ];
    }
}
