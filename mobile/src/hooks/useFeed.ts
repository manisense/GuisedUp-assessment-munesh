import { useState, useEffect, useCallback, useRef } from 'react';
import { getFeed, searchPosts, logInteraction, FeedPost } from '../services/api';

export type FeedMode = 'feed' | 'search';

export function useFeed() {
  const [posts, setPosts]             = useState<FeedPost[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const [page, setPage]               = useState(1);
  const [mode, setMode]               = useState<FeedMode>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FeedPost[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]     = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Feed loading ────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async (reset = false) => {
    if (loading || loadingMore) return;
    const currentPage = reset ? 1 : page;

    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await getFeed(currentPage);
      if (reset) {
        setPosts(res.data);
      } else {
        setPosts(prev => [...prev, ...res.data]);
      }
      setHasMore(res.meta.has_more);
      setPage(currentPage + 1);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, loading, loadingMore]);

  const refresh = useCallback(() => {
    setPage(1);
    setHasMore(true);
    loadFeed(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading || mode === 'search') return;
    loadFeed(false);
  }, [hasMore, loadingMore, loading, mode, loadFeed]);

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setMode('feed');
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setMode('search');
    setSearchLoading(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchPosts(q.trim());
        setSearchResults(res.data);
      } catch (e: any) {
        setSearchError(e.message ?? 'Search failed');
      } finally {
        setSearchLoading(false);
      }
    }, 500);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setMode('feed');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  // ── Reactions ───────────────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (postId: number) => {
    // Optimistic update
    const update = (list: FeedPost[]) =>
      list.map(p =>
        p.id === postId
          ? { ...p, viewer_has_reacted: !p.viewer_has_reacted }
          : p
      );

    setPosts(update);
    setSearchResults(update);

    try {
      await logInteraction(postId, 'reaction');
    } catch {
      // Rollback on failure
      const rollback = (list: FeedPost[]) =>
        list.map(p =>
          p.id === postId
            ? { ...p, viewer_has_reacted: !p.viewer_has_reacted }
            : p
        );
      setPosts(rollback);
      setSearchResults(rollback);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedPosts = mode === 'search' ? searchResults : posts;

  return {
    posts: displayedPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    mode,
    searchQuery,
    searchLoading,
    searchError,
    refresh,
    loadMore,
    handleSearch,
    clearSearch,
    toggleReaction,
  };
}
