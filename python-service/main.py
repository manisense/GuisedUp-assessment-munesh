"""
Guised Up — Python Embedding Microservice
==========================================
FastAPI service. Chroma is optional — if not installed/available,
uses an in-memory dict as a fallback mock store.

Endpoints:
  POST /embed            — embed post text and store in Chroma (or in-memory)
  POST /search           — ANN search for NL query
  POST /interest-centroid — compute similarities for feed ranking

Embedding modes (EMBEDDING_MODE env var):
  - "mock"  (default): deterministic hash → unit vector (no model download)
  - "model": sentence-transformers/all-MiniLM-L6-v2 (requires ~100MB download)

Vector store:
  - If chromadb is installed: uses PersistentClient at CHROMA_PATH
  - If not installed: uses in-memory dict (cleared on restart)
"""

import hashlib
import logging
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
EMBEDDING_MODE  = os.getenv("EMBEDDING_MODE", "mock")
CHROMA_PATH     = os.getenv("CHROMA_PATH", "./chroma_data")
COLLECTION_NAME = "guisedup_posts"
EMBED_DIM       = 384

# ── Vector store (Chroma with in-memory fallback) ──────────────────────────────
_use_chroma = False
_collection = None
_memory_store: dict[str, dict] = {}  # chroma_id -> {embedding, post_id}

try:
    import chromadb
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    _collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    _use_chroma = True
    logger.info("✅ ChromaDB loaded — using persistent vector store")
except ImportError:
    logger.warning("⚠️  chromadb not installed — using in-memory vector store")
    logger.warning("    To enable: pip install chromadb")
except Exception as e:
    logger.warning(f"⚠️  ChromaDB unavailable ({e}) — using in-memory store")

# ── Embedding backend ──────────────────────────────────────────────────────────
_model = None

def _load_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers/all-MiniLM-L6-v2…")
        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        logger.info("Model loaded ✅")
    return _model


def embed_text(text: str) -> list[float]:
    if EMBEDDING_MODE == "model":
        model = _load_model()
        vec = model.encode(text, normalize_embeddings=True)
        return vec.tolist()
    return _mock_embed(text)


def _mock_embed(text: str) -> list[float]:
    """Deterministic hash → unit vector. Swap: set EMBEDDING_MODE=model."""
    seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2 ** 32)
    rng  = np.random.default_rng(seed)
    vec  = rng.standard_normal(EMBED_DIM).astype(np.float32)
    norm = np.linalg.norm(vec)
    return (vec / norm).tolist() if norm > 0 else vec.tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0

# ── Store helpers ──────────────────────────────────────────────────────────────

def store_upsert(chroma_id: str, embedding: list[float], post_id: int, text_preview: str):
    if _use_chroma:
        _collection.upsert(
            ids=[chroma_id],
            embeddings=[embedding],
            metadatas=[{"post_id": post_id, "text_preview": text_preview[:120]}],
        )
    else:
        _memory_store[chroma_id] = {"embedding": embedding, "post_id": post_id}


def store_count() -> int:
    if _use_chroma:
        return _collection.count()
    return len(_memory_store)


def store_query(query_vec: list[float], n: int) -> list[int]:
    """Returns post_ids ordered by cosine similarity (most similar first)."""
    if _use_chroma:
        count = _collection.count()
        if count == 0:
            return []
        results = _collection.query(
            query_embeddings=[query_vec],
            n_results=min(n, count),
            include=["metadatas"],
        )
        return [m["post_id"] for m in results["metadatas"][0]]
    else:
        if not _memory_store:
            return []
        scored = [
            (entry["post_id"], cosine_similarity(query_vec, entry["embedding"]))
            for entry in _memory_store.values()
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in scored[:n]]


def store_get_embeddings(chroma_ids: list[str]) -> list[tuple[int, list[float]]]:
    """Returns [(post_id, embedding)] for given ids."""
    if _use_chroma:
        try:
            result = _collection.get(ids=chroma_ids, include=["embeddings", "metadatas"])
            return [
                (meta["post_id"], emb)
                for meta, emb in zip(result["metadatas"], result["embeddings"])
            ]
        except Exception:
            return []
    else:
        out = []
        for cid in chroma_ids:
            if cid in _memory_store:
                entry = _memory_store[cid]
                out.append((entry["post_id"], entry["embedding"]))
        return out

# ── FastAPI ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Guised Up Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    text: str
    post_id: int


class SearchRequest(BaseModel):
    query: str
    n: int = 10
    since: Optional[str] = None


class CentroidRequest(BaseModel):
    viewer_id: int
    post_ids: list[int]


@app.post("/embed")
async def embed(req: EmbedRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    chroma_id = f"post_{req.post_id}"
    embedding = embed_text(req.text)
    store_upsert(chroma_id, embedding, req.post_id, req.text)

    logger.info(f"Embedded post {req.post_id} (mode={EMBEDDING_MODE}, store={'chroma' if _use_chroma else 'memory'})")
    return {
        "chroma_id": chroma_id,
        "dims": EMBED_DIM,
        "mode": EMBEDDING_MODE,
        "store": "chroma" if _use_chroma else "memory",
    }


@app.post("/search")
async def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    query_vec = embed_text(req.query)
    post_ids  = store_query(query_vec, max(1, min(req.n, 50)))

    return {"post_ids": post_ids, "query": req.query}


@app.post("/interest-centroid")
async def interest_centroid(req: CentroidRequest):
    if not req.post_ids:
        return {"similarities": {}}

    chroma_ids = [f"post_{pid}" for pid in req.post_ids]
    entries    = store_get_embeddings(chroma_ids)

    if not entries:
        return {"similarities": {}}

    embeddings = [emb for _, emb in entries]
    centroid   = np.mean(np.array(embeddings, dtype=np.float32), axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    similarities = {}
    for post_id, emb in entries:
        sim = cosine_similarity(centroid.tolist(), emb)
        similarities[post_id] = round((sim + 1.0) / 2.0, 4)  # scale to [0,1]

    return {"similarities": similarities}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mode": EMBEDDING_MODE,
        "store": "chroma" if _use_chroma else "memory",
        "count": store_count(),
    }
