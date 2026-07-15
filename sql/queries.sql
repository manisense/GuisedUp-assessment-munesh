-- ============================================================
-- Guised Up — SQL Challenge Queries
-- ============================================================
-- Target DB: PostgreSQL (prod) / SQLite (dev)
-- All queries are compatible with both.
-- Assumes schema:
--   users(id, name, email, created_at)
--   posts(id, user_id, body, image_url, authenticity_score, created_at)
--   interactions(id, user_id, post_id, type ENUM(view,reply,reaction), created_at)
-- ============================================================


-- ============================================================
-- D1: Top 10 most active users in the last 7 days,
--     ranked by total interactions (views + replies + reactions)
-- ============================================================
SELECT
    u.id                   AS user_id,
    u.name,
    u.email,
    COUNT(i.id)            AS total_interactions
FROM users u
JOIN interactions i ON i.user_id = u.id
WHERE i.created_at >= NOW() - INTERVAL '7 days'   -- PostgreSQL
-- WHERE i.created_at >= DATETIME('now', '-7 days') -- SQLite alternative
GROUP BY u.id, u.name, u.email
ORDER BY total_interactions DESC
LIMIT 10;


-- ============================================================
-- D2: For a given :user_id, return all posts from users they
--     interact with most, ordered by interaction frequency
--     descending, limited to posts from the last 30 days.
-- ============================================================
WITH interaction_freq AS (
    -- Compute how many times :user_id interacted with each author
    SELECT
        p.user_id          AS author_id,
        COUNT(i.id)        AS interaction_count
    FROM interactions i
    JOIN posts p ON p.id = i.post_id
    WHERE i.user_id = :user_id            -- bind: the viewer's user_id
    GROUP BY p.user_id
)
SELECT
    p.id                   AS post_id,
    p.body,
    p.created_at,
    p.user_id              AS author_id,
    u.name                 AS author_name,
    f.interaction_count
FROM posts p
JOIN users u             ON u.id = p.user_id
JOIN interaction_freq f  ON f.author_id = p.user_id
WHERE p.created_at >= NOW() - INTERVAL '30 days'    -- PostgreSQL
-- WHERE p.created_at >= DATETIME('now', '-30 days')   -- SQLite alternative
ORDER BY f.interaction_count DESC, p.created_at DESC;


-- ============================================================
-- D3: Find posts that have been viewed more than 100 times
--     but have zero reactions.
--     Returns: post_id, author_id, view_count, created_at
-- ============================================================
SELECT
    p.id                   AS post_id,
    p.user_id              AS author_id,
    COUNT(
        CASE WHEN i.type = 'view' THEN 1 END
    )                      AS view_count,
    p.created_at
FROM posts p
LEFT JOIN interactions i ON i.post_id = p.id
GROUP BY p.id, p.user_id, p.created_at
HAVING
    COUNT(CASE WHEN i.type = 'view'     THEN 1 END) > 100
    AND
    COUNT(CASE WHEN i.type = 'reaction' THEN 1 END) = 0
ORDER BY view_count DESC;


-- ============================================================
-- D4: Detect potential spam — users who have created more than
--     20 posts in the last 24 hours.
--     Returns: email, post_count
-- ============================================================
SELECT
    u.id                   AS user_id,
    u.name,
    u.email,
    COUNT(p.id)            AS post_count
FROM users u
JOIN posts p ON p.user_id = u.id
WHERE p.created_at >= NOW() - INTERVAL '24 hours'    -- PostgreSQL
-- WHERE p.created_at >= DATETIME('now', '-24 hours')   -- SQLite alternative
GROUP BY u.id, u.name, u.email
HAVING COUNT(p.id) > 20
ORDER BY post_count DESC;
