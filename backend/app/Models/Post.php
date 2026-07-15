<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'body',
        'image_url',
        'authenticity_score',
        'chroma_id',
    ];

    protected $casts = [
        'authenticity_score' => 'float',
        'created_at'         => 'datetime',
        'updated_at'         => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function interactions(): HasMany
    {
        return $this->hasMany(Interaction::class);
    }

    /**
     * Compute a simple text-based authenticity score (0–1).
     * Production: replace with a trained classifier.
     *
     * Signals:
     *  +  Longer, sentence-like text (more "real")
     *  -  Excessive emoji spam
     *  -  All-caps words
     *  +  Presence of lowercase personal language ("i", "my", "we")
     *  -  Polished marketing phrases
     */
    public static function computeAuthenticityScore(string $text): float
    {
        $score = 0.5;

        $wordCount = str_word_count($text);
        // Natural length bonus (10-80 words)
        if ($wordCount >= 10 && $wordCount <= 80) {
            $score += 0.15;
        } elseif ($wordCount > 80) {
            $score += 0.05;
        }

        // Personal pronoun bonus
        if (preg_match('/\b(i|i\'m|i\'ve|my|we|our)\b/i', $text)) {
            $score += 0.10;
        }

        // Emoji count penalty (>5 emoji = spam-like)
        preg_match_all('/[\x{1F300}-\x{1FAFF}]/u', $text, $emojiMatches);
        $emojiCount = count($emojiMatches[0]);
        if ($emojiCount > 5) {
            $score -= 0.15;
        } elseif ($emojiCount > 10) {
            $score -= 0.30;
        }

        // ALL CAPS words penalty
        $words = explode(' ', $text);
        $capsCount = count(array_filter($words, fn($w) => strlen($w) > 2 && $w === strtoupper($w) && ctype_alpha($w)));
        if ($capsCount > 2) {
            $score -= 0.10;
        }

        // Marketing phrase penalty
        $marketingPhrases = ['buy now', 'click here', 'limited offer', 'dm for price', 'follow for follow'];
        foreach ($marketingPhrases as $phrase) {
            if (stripos($text, $phrase) !== false) {
                $score -= 0.20;
                break;
            }
        }

        return round(max(0.0, min(1.0, $score)), 4);
    }
}
