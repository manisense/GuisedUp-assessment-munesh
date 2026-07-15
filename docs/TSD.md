# Guised Up — Technical Solution Document  
## Real Connections Feed

**Author:** Assessment submission  
**Stack:** React Native • Laravel PHP • Python • SQLite (dev) / PostgreSQL (prod) • Chroma (vector)  
**Time box:** 1 day  
**AI tools used:** Cursor (Composer agent) — see §8

---

## 1. Product comprehension

Guised Up’s feed is intentionally **anti-engagement**. Ranking must prefer authenticity, real relationship depth, and semantic relevance — not likes, shares, or virality loops.

| Signal | Intent |
|--------|--------|
| Authenticity | Reward less-filtered media and genuine language |
| Relationship depth | Surface people the user actually interacts with |
| Semantic similarity | Match the user’s topic interests via embeddings |
| Time decay | Prefer fresh posts without overriding relevance |
| NL search | “funny travel stories from last week” → vector + light filters |

Assumptions documented in §7.

---

## 2. System architecture

```
┌─────────────────┐     HTTPS/JSON      ┌──────────────────────────┐
│  React Native   │ ──────────────────► │  Laravel API (Sanctum)   │
│  Feed Screen    │ ◄────────────────── │  Auth, Feed, Posts,      │
└─────────────────┘                     │  Interactions            │
                                        └────────────┬─────────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          │                          │                          │
                          ▼                          ▼                          ▼
                   ┌─────────────┐          ┌─────────────────┐        ┌──────────────┐
                   │ SQL DB      │          │ Python Embedding │        │ Vector store │
                   │ users,posts │          │ Service (:8001)  │───────►│ Chroma       │
                   │ interactions│          │ sentence-transf. │        │ (local)      │
                   └─────────────┘          │ or hash mock     │        └──────────────┘
                                            └─────────────────┘
```

**Flow — create post**

1. Client `POST /api/posts` with Sanctum token.  
2. Laravel validates, persists row, calls Python `/embed`.  
3. Python embeds text, upserts into Chroma with `post_id` metadata.  
4. Laravel stores embedding id / authenticity score locally for ranking.

**Flow — personalized feed**

1. Client `GET /api/feed?page=N`.  
2. Laravel loads candidate posts (recent window + strong-relationship authors).  
3. Fetches viewer interaction graph + interest centroid (from interacted posts).  
4. Scores each candidate with the ranking function (§5).  
5. Returns page of 20 ordered by score.

**Flow — NL search**

1. Client `GET /api/search?q=...`.  
2. Laravel forwards query to Python `/search`.  
3. Python embeds query, Chroma ANN top-k, optional time filter in metadata.  
4. Laravel hydrates post rows and returns top 10.

---

## 3. Database schema

### ER (logical)

```
users 1──* posts
users 1──* interactions *──1 posts
users 1──* personal_access_tokens (Sanctum)
```

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| name | VARCHAR | display name |
| email | VARCHAR UNIQUE | |
| password | VARCHAR | hashed |
| avatar_url | VARCHAR NULL | optional |
| created_at / updated_at | TIMESTAMP | |

#### `posts`
| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| user_id | FK → users | author |
| body | TEXT | post text |
| image_url | VARCHAR NULL | optional |
| authenticity_score | FLOAT | 0–1, computed at create |
| chroma_id | VARCHAR NULL | vector document id |
| created_at / updated_at | TIMESTAMP | |

Indexes: `(user_id, created_at)`, `(created_at)`, `(authenticity_score)`.

#### `interactions`
| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| user_id | FK → users | actor |
| post_id | FK → posts | target |
| type | ENUM | `view`, `reply`, `reaction` |
| created_at / updated_at | TIMESTAMP | |

Indexes: `(user_id, type, created_at)`, `(post_id, type)`, unique soft-dedupe `(user_id, post_id, type)` for reactions (one reaction per user/post in v1).

### Why this shape

- Interactions are the **relationship-depth** source of truth (not follower counts).  
- Authenticity precomputed at write time so the feed read path stays cheap.  
- Embeddings live in Chroma; SQL stays the system of record for posts.

---

## 4. Vector embeddings & vector DB choice

### Choice: **Chroma (local) + Python microservice**

| Option | Why not / why yes |
|--------|-------------------|
| **Chroma** | Zero cloud credits, local, good DX for a take-home, metadata filters |
| Pinecone | Excellent prod ops, needs API key + cost |
| Weaviate / Qdrant | Solid; heavier local ops than Chroma for 1-day scope |
| **pgvector** | Ideal production co-location with Postgres; deferred until Postgres is the primary DB |

**Dev DB:** SQLite (no MySQL/Postgres installed in this environment). Schema is portable; production target is **PostgreSQL + pgvector** with the same ranking SQL filters and ANN via `<=>`.

### Embedding model

- **Preferred:** `sentence-transformers/all-MiniLM-L6-v2` (384-d, fast, free).  
- **Fallback mock:** deterministic hash→unit vector when model download is unavailable — swap is one env flag (`EMBEDDING_MODE=mock|model`). Documented so reviewers can flip to real embeddings with no API redesign.

### Interface (Python FastAPI)

```
POST /embed   { "text": "...", "post_id": 123 } → { "chroma_id", "dims" }
POST /search  { "query": "...", "n": 10, "since": "ISO?" } → { "post_ids": [...] }
```

Laravel never loads the model; it stays a thin API/auth/ranking orchestrator.

---

## 5. Feed ranking algorithm

### Plain English

For each candidate post for viewer `V`:

1. **Authenticity (A)** — score already on the post (heuristic: length naturalness, low emoji spam, no image or unfiltered-looking URL heuristics). Higher is better.  
2. **Relationship depth (R)** — how much `V` has interacted with the author (weighted: reaction=3, reply=2, view=0.2) over a rolling window, log-scaled.  
3. **Semantic similarity (S)** — cosine similarity between post embedding and `V`’s interest centroid (mean embedding of posts `V` reacted/replied to; cold-start → global “authentic” centroid or skip S).  
4. **Time decay (T)** — exponential half-life (~36h): newer posts score higher, but a strong R/S can still beat freshness.

Final score:

```
score = wA*A + wR*R + wS*S + wT*T
```

Default weights (tunable): `wA=0.25, wR=0.35, wS=0.25, wT=0.15`.

**Explicit non-goals:** likes, share counts, comment volume, follower edge alone — none enter the score.

### Pseudocode

```
function rankFeed(viewerId, page, perPage=20):
  candidates = recentPosts(days=14) ∪ postsByTopInteractedAuthors(viewerId, limit=50)
  interest = interestCentroid(viewerId)  # from Chroma via Python, or null

  scores = []
  for post in candidates:
    A = post.authenticity_score
    R = log1p(weightedInteractions(viewerId, post.author_id)) / log1p(MAX_REL)
    S = cosine(embed(post), interest) if interest else 0.5
    ageHours = hoursSince(post.created_at)
    T = exp(-ln(2) * ageHours / 36)
    score = 0.25*A + 0.35*R + 0.25*S + 0.15*T
    scores.append((post, score))

  sort scores descending
  return paginate(scores, page, perPage)
```

Search uses Chroma ANN first, then optional rerank with a light authenticity/time boost (not engagement).

---

## 6. API design

### Auth

- Laravel Sanctum **personal access tokens**.  
- Seeded users receive tokens in seeder / login endpoint.  
- All feed endpoints: `Authorization: Bearer {token}`.

### Endpoints

#### `POST /api/login`
```json
// request
{ "email": "maya@guisedup.test", "password": "password" }
// response
{ "token": "...", "user": { "id", "name", "email" } }
```

#### `POST /api/posts`
```json
// request
{ "body": "Caught the sunrise with messy hair and great coffee.", "image_url": null }
// response 201
{ "id", "body", "image_url", "authenticity_score", "created_at", "user": { ... } }
```

#### `GET /api/feed?page=1`
```json
{
  "data": [
    {
      "id": 1,
      "body": "...",
      "image_url": null,
      "authenticity_score": 0.82,
      "score": 0.71,
      "created_at": "...",
      "user": { "id", "name", "avatar_url" },
      "viewer_has_reacted": false
    }
  ],
  "meta": { "current_page": 1, "per_page": 20, "has_more": true }
}
```

#### `GET /api/search?q=funny%20travel%20stories%20from%20last%20week`
```json
{ "data": [ /* up to 10 posts */ ], "query": "..." }
```

#### `POST /api/interactions`
```json
// request
{ "post_id": 12, "type": "reaction" }  // view | reply | reaction
// response 201
{ "id", "post_id", "type", "created_at" }
```

---

## 7. Trade-offs & assumptions

1. **SQLite in this environment** — MySQL/Postgres weren’t available; migrations are SQL-portable. Prod recommendation: Postgres + pgvector.  
2. **Mock embeddings available** — model download can fail offline; mock is deterministic and swap-compatible.  
3. **Authenticity heuristic is simple** — production would train a small classifier on labeled “polished vs real” media; here we use text/features.  
4. **No follower graph** — brief centers genuine interaction; follows can be added later as a weak prior.  
5. **Candidate generation** — full corpus scoring is skipped; we use a time window + relationship expansion for latency.  
6. **One reaction per user/post** — keeps depth signal cleaner for v1.  
7. **RN single screen** — feed + search only, as specified.

---

## 8. AI agentic tools used

| Tool | How it helped |
|------|----------------|
| **Cursor (Composer agent)** | Scaffolded Laravel modules, RN feed UI, SQL challenges, and this TSD in one session; iterated on ranking weights and API shapes |
| Agent workflow | Parallelizable file generation, local command execution for composer/npm, keeping architecture decisions explicit in the TSD before coding |

Honest note: AI accelerated boilerplate and consistency; product ranking choices, schema, and trade-offs above were directed and reviewed as the engineering decisions under assessment.

---

## 9. What a reviewer should run

See root `README.md` for setup. Critical path:

1. Start Python embedding service.  
2. Migrate + seed Laravel (2 users + sample posts/interactions).  
3. Run PHPUnit feature tests (≥3).  
4. Start API + Expo app → Feed Screen.  
5. Demo video script: `docs/VIDEO_SCRIPT.md`.

---

## 10. Out of scope / time-boxed leftovers

If anything is incomplete at submission, call it out in the README. Ideal stretch items not required for scoring: image authenticity ML, follow graph, batch export of embeddings to pgvector, EAS build.
