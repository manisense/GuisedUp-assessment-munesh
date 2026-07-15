# Guised Up — Full-Stack Assessment

> **Real people. Real connections.** A personalized anti-engagement feed that rewards authenticity over virality.

---

## 📁 Project Structure

```
guisedup/
├── backend/          # Laravel 13 PHP API (Sanctum auth)
├── python-service/   # FastAPI embedding microservice (Chroma + sentence-transformers)
├── mobile/           # Expo React Native feed screen
├── sql/              # SQL challenge queries (D1–D4)
└── docs/             # Technical Solution Document
```

---

## 🚀 Quick Start (All Services)

### Prerequisites
- PHP 8.3+ with SQLite extension
- Composer
- Node.js 20+
- Python 3.10+
- Expo CLI (`npm install -g expo-cli`) or Expo Go app on your phone

---

### 1. Backend (Laravel API)

```bash
cd backend

# Copy environment
cp .env.example .env
php artisan key:generate

# Install dependencies
composer install

# Migrate and seed (2 test users + 40 posts + interactions)
php artisan migrate:fresh --seed

# Start API server on :8000
php artisan serve
```

**Test credentials:**
| Email | Password |
|-------|----------|
| `maya@guisedup.test` | `password` |
| `alex@guisedup.test` | `password` |

**Run tests:**
```bash
./vendor/bin/phpunit --testdox
# Expected: 17 tests, 58 assertions — all passing
```

---

### 2. Python Embedding Service

```bash
cd python-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start service on :8001
uvicorn main:app --port 8001 --reload

# Health check
curl http://127.0.0.1:8001/health
```

**Embedding modes** (set via `EMBEDDING_MODE` env var):
- `mock` (default) — deterministic hash → unit vector. No downloads. Safe offline.
- `model` — uses `sentence-transformers/all-MiniLM-L6-v2` (384-dim). Requires ~100MB download.

```bash
# To enable real embeddings:
EMBEDDING_MODE=model uvicorn main:app --port 8001
```

---

### 3. React Native App (Expo)

```bash
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npm start

# Scan QR code with Expo Go app, or:
npm run ios      # iOS simulator
npm run android  # Android emulator
```

> **Note:** If running on a physical device, update `BASE_URL` in `src/services/api.ts` to your machine's local IP (e.g., `http://192.168.1.x:8000/api`).

---

## 🔑 API Endpoints

All endpoints (except `/api/login`) require `Authorization: Bearer {token}` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Returns Sanctum token |
| `POST` | `/api/logout` | Revoke token |
| `POST` | `/api/posts` | Create post (body, image_url optional) |
| `GET`  | `/api/feed?page=N` | Ranked personalized feed (20/page) |
| `GET`  | `/api/search?q=query` | NL semantic search (top 10) |
| `POST` | `/api/interactions` | Log view/reply/reaction |

**Quick test:**
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maya@guisedup.test","password":"password"}' | jq -r .token)

# Get feed
curl http://localhost:8000/api/feed \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0]'

# Search
curl "http://localhost:8000/api/search?q=morning+coffee" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

---

## 🧠 Ranking Algorithm

The feed ranks posts by weighted score: **A + R + S + T**

| Signal | Weight | Description |
|--------|--------|-------------|
| **A** — Authenticity | 25% | Heuristic: genuine language, no spam patterns |
| **R** — Relationship depth | 35% | Weighted interactions: reaction(3) + reply(2) + view(0.2), log-normalized |
| **S** — Semantic similarity | 25% | Cosine similarity vs viewer's interest centroid via Chroma |
| **T** — Time decay | 15% | Exponential half-life of 36h |

**Explicit non-goals:** likes, shares, follower counts, virality metrics — none enter the score.

---

## 📊 SQL Queries

See [`sql/queries.sql`](sql/queries.sql) for all 4 challenge queries:

- **D1** — Top 10 most active users in last 7 days
- **D2** — Posts by most-interacted-with authors for a given user
- **D3** — Posts with 100+ views but zero reactions
- **D4** — Spam detection: 20+ posts in 24 hours

---

## 📄 Technical Solution Document

See [`docs/TSD.md`](docs/TSD.md) for:
- System architecture diagram
- Full database schema
- Vector embedding & Chroma rationale
- Ranking algorithm pseudocode
- API design & auth strategy
- Trade-offs and assumptions
- AI tools used

---

## 🎬 Demo Video

A walkthrough video demonstrating the application and explaining the features is required for this assessment. 
See the suggested recording script and guide in [`docs/VIDEO_SCRIPT.md`](docs/VIDEO_SCRIPT.md).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Laravel 13, PHP 8.5, Sanctum |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Vector DB | Chroma (local, no cloud keys needed) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 or hash mock |
| ML service | Python 3.10 + FastAPI + uvicorn |
| Mobile | React Native 0.86 + Expo SDK 57 |

---

## 🔄 What I'd add with more time

- Image authenticity scoring (CV classifier for filter detection)
- pgvector migration for production co-location
- Push notifications for genuine interactions
- Follow graph as a weak prior signal
- EAS (Expo Application Services) production build
- Rate limiting on post creation endpoint

---

*Built in 1 day as part of the Guised Up Full-Stack Developer Assessment.*
