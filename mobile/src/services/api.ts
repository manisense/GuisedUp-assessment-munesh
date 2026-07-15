import * as SecureStore from 'expo-secure-store';

// API service for Guised Up feed app
// Uses EXPO_PUBLIC_API_URL if set, fallback to localhost
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

let _token: string | null = null;

export async function setToken(token: string) {
  _token = token;
  await SecureStore.setItemAsync('auth_token', token);
}

export function getToken(): string | null {
  return _token;
}

export async function restoreToken(): Promise<boolean> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    _token = token;
    return true;
  }
  return false;
}

export async function logout() {
  _token = null;
  await SecureStore.deleteItemAsync('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: { id: number; name: string; email: string; avatar_url: string | null };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ── Feed ──────────────────────────────────────────────────────────────────────

export interface FeedUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

export interface FeedPost {
  id: number;
  body: string;
  image_url: string | null;
  authenticity_score: number;
  score: number;
  created_at: string;
  user: FeedUser;
  viewer_has_reacted: boolean;
}

export interface FeedMeta {
  current_page: number;
  per_page: number;
  has_more: boolean;
}

export interface FeedResponse {
  data: FeedPost[];
  meta: FeedMeta;
}

export async function getFeed(page = 1): Promise<FeedResponse> {
  return request<FeedResponse>(`/feed?page=${page}`);
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResponse {
  data: FeedPost[];
  query: string;
  mode: string;
}

export async function searchPosts(q: string): Promise<SearchResponse> {
  return request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`);
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function logInteraction(
  postId: number,
  type: 'view' | 'reply' | 'reaction'
): Promise<void> {
  await request('/interactions', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, type }),
  });
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function createPost(body: string, imageUrl?: string): Promise<FeedPost> {
  return request<FeedPost>('/posts', {
    method: 'POST',
    body: JSON.stringify({ body, image_url: imageUrl ?? null }),
  });
}
