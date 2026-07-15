# Guised Up Demo Video Script

**Note:** This is a guide for recording your final submission video.

## Preparation
1. Start the Laravel backend: `cd backend && php artisan serve`
2. Start the Python service: `cd python-service && source venv/bin/activate && uvicorn main:app --port 8001`
3. Start Expo: `cd mobile && npm start`
4. Have your screen recording tool ready (Loom or QuickTime).

## The Script / Walkthrough

### 1. Introduction (30s)
*   **Action:** Show your face if possible, or start with the code editor.
*   **Script:** "Hi, I'm [Your Name]. This is my submission for the Guised Up Full-Stack Assessment. The goal was to build an anti-engagement feed that prioritizes authenticity and real connection."

### 2. The App Demo (1m 30s)
*   **Action:** Show the React Native app running in Expo Go (or simulator).
*   **Script:** 
    *   "Here's the app. I'll log in as Maya (maya@guisedup.test)."
    *   *Show the feed loading.* "The feed ranks posts based on Authenticity, Relationship Depth, Semantic Similarity, and Time Decay."
    *   *Scroll the feed.* "Notice the badges: 'Authentic' and 'Genuine', calculated at post creation based on text heuristics."
    *   *React to a post.* "I can react to a post, which optimistically updates the UI and logs an interaction to strengthen our 'Relationship Depth' score."
    *   *Use the search bar.* "Let me search for 'morning coffee'. This uses natural language processing via the Python microservice to find semantically similar posts."
    *   *Create a post.* "Finally, I'll create a real, unfiltered post. The authenticity score is immediately calculated on the backend."

### 3. Architecture & Code (1m)
*   **Action:** Switch to the code editor. Show `FeedController.php` and `python-service/main.py`.
*   **Script:**
    *   "On the backend, I used Laravel 13 with Sanctum. The `FeedController` is where the A+R+S+T ranking magic happens."
    *   "For embeddings, I built a FastAPI Python microservice. It uses Chroma for vector storage, but gracefully degrades to an in-memory mock if disk space or dependencies are limited."
    *   "The database uses SQLite for development, but the migrations and SQL queries (like the ones in `queries.sql`) are fully compatible with PostgreSQL for production."

### 4. AI Tool Usage (30s)
*   **Action:** Show the `TSD.md` file.
*   **Script:** "As required, I used AI tools extensively. I primarily used Cursor (Composer agent) to scaffold the React Native UI, generate the Laravel boilerplate, and iterate on the ranking algorithm, allowing me to move extremely fast and focus on architecture."

### 5. Conclusion (15s)
*   **Script:** "Thanks for reviewing my submission. You can find all the details, including my SQL queries and Technical Solution Document, in the repo."
