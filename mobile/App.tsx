import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { useFeed } from './src/hooks/useFeed';
import FeedCard from './src/components/FeedCard';
import SearchBar from './src/components/SearchBar';
import { login, setToken, createPost } from './src/services/api';

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]       = useState('maya@guisedup.test');
  const [password, setPassword] = useState('password');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      setToken(res.token);
      onLogin();
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={loginStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B1A" />
      <Animated.View style={[loginStyles.content, { opacity: fadeAnim }]}>
        <View style={loginStyles.logoWrap}>
          <Text style={loginStyles.logoEmoji}>✦</Text>
          <Text style={loginStyles.logoTitle}>Guised Up</Text>
          <Text style={loginStyles.logoSub}>Real people. Real connections.</Text>
        </View>

        <View style={loginStyles.form}>
          <Text style={loginStyles.label}>Email</Text>
          <TextInput
            id="login-email"
            style={loginStyles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#475569"
            placeholder="you@guisedup.test"
          />

          <Text style={loginStyles.label}>Password</Text>
          <TextInput
            id="login-password"
            style={loginStyles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#475569"
            placeholder="••••••••"
          />

          {!!error && <Text style={loginStyles.error}>{error}</Text>}

          <TouchableOpacity
            id="login-btn"
            style={[loginStyles.btn, loading && loginStyles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={loginStyles.btnText}>Sign in →</Text>
            }
          </TouchableOpacity>

          <Text style={loginStyles.hint}>
            Test credentials: maya@guisedup.test or alex@guisedup.test / password
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── New Post Modal ────────────────────────────────────────────────────────────
function NewPostModal({ visible, onClose, onPosted }: {
  visible: boolean; onClose: () => void; onPosted: () => void;
}) {
  const [body, setBody]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handlePost = async () => {
    if (!body.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createPost(body.trim());
      setBody('');
      onPosted();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Share something real</Text>
          <Text style={modalStyles.subtitle}>
            No filters. No performance. Just you.
          </Text>

          <TextInput
            id="new-post-input"
            style={modalStyles.textArea}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            placeholder="What's actually going on with you today?"
            placeholderTextColor="#475569"
            autoFocus
          />

          <View style={modalStyles.wordCount}>
            <Text style={modalStyles.wordCountText}>
              {body.trim().split(/\s+/).filter(Boolean).length} words
            </Text>
          </View>

          {!!error && <Text style={modalStyles.error}>{error}</Text>}

          <View style={modalStyles.actions}>
            <TouchableOpacity id="cancel-post-btn" style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              id="submit-post-btn"
              style={[modalStyles.postBtn, (!body.trim() || loading) && modalStyles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!body.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={modalStyles.postBtnText}>Post it ✦</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Feed Screen ───────────────────────────────────────────────────────────────
function FeedScreen() {
  const {
    posts, loading, loadingMore, error, hasMore,
    mode, searchQuery, searchLoading, searchError,
    refresh, loadMore, handleSearch, clearSearch, toggleReaction,
  } = useFeed();

  const [showNewPost, setShowNewPost] = useState(false);

  const renderItem = useCallback(({ item }: any) => (
    <FeedCard post={item} onReact={toggleReaction} />
  ), [toggleReaction]);

  const renderHeader = useCallback(() => (
    <View>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>Guised Up</Text>
          <Text style={styles.feedLabel}>
            {mode === 'search' ? `Results for "${searchQuery}"` : 'Real Connections'}
          </Text>
        </View>
        <TouchableOpacity
          id="new-post-fab"
          style={styles.fabBtn}
          onPress={() => setShowNewPost(true)}
        >
          <Text style={styles.fabBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        onClear={clearSearch}
        loading={searchLoading}
      />

      {/* Search mode banner */}
      {mode === 'search' && (
        <View style={styles.searchBanner}>
          <Text style={styles.searchBannerText}>
            🔮 Semantic search — finding real stories that match your words
          </Text>
        </View>
      )}

      {/* Search error */}
      {!!searchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {searchError}</Text>
        </View>
      )}
    </View>
  ), [mode, searchQuery, searchLoading, searchError, handleSearch, clearSearch]);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color="#7C3AED" size="small" />
          <Text style={styles.footerText}>Loading more…</Text>
        </View>
      );
    }
    if (!hasMore && posts.length > 0 && mode === 'feed') {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>✦ You've seen everything real today</Text>
        </View>
      );
    }
    return null;
  }, [loadingMore, hasMore, posts.length, mode]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>{mode === 'search' ? '🔍' : '✨'}</Text>
        <Text style={styles.emptyTitle}>
          {mode === 'search' ? 'No matches found' : 'Your feed is quiet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {mode === 'search'
            ? 'Try different words — our semantic search understands context'
            : 'Share something real to get started'}
        </Text>
      </View>
    );
  }, [loading, mode]);

  if (loading && posts.length === 0) {
    return (
      <View style={styles.fullLoader}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <Text style={styles.loadingText}>Building your real feed…</Text>
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.fullLoader}>
        <Text style={styles.errorEmoji}>⚡</Text>
        <Text style={styles.errorTitle}>Couldn't load feed</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity id="retry-btn" style={styles.retryBtn} onPress={refresh}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        id="feed-list"
        data={posts}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={loading && posts.length > 0}
            onRefresh={refresh}
            tintColor="#7C3AED"
            colors={['#7C3AED']}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        onPosted={refresh}
      />
    </View>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    import('./src/services/api').then(({ restoreToken }) => {
      restoreToken().then(hasToken => {
        setIsLoggedIn(hasToken);
        setIsReady(true);
      });
    });
  }, []);

  if (!isReady) {
    return (
      <View style={styles.fullLoader}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B1A" />
      <FeedScreen />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0B1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B1A',
  },
  listContent: {
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  appName: {
    color: '#E2E8F0',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  feedLabel: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  fabBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
  searchBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  searchBannerText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#450A0A',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  footerText: {
    color: '#64748B',
    fontSize: 13,
  },
  footerEnd: {
    alignItems: 'center',
    padding: 24,
  },
  footerEndText: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  fullLoader: {
    flex: 1,
    backgroundColor: '#0B0B1A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: '#64748B', fontSize: 15 },
  errorEmoji: { fontSize: 48 },
  errorTitle: { color: '#E2E8F0', fontSize: 20, fontWeight: '700' },
  errorSubtitle: { color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B1A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoEmoji: {
    fontSize: 48,
    color: '#7C3AED',
    marginBottom: 12,
  },
  logoTitle: {
    color: '#E2E8F0',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  logoSub: {
    color: '#7C3AED',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  form: {
    gap: 8,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2D2D4E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#E2E8F0',
    fontSize: 15,
    marginBottom: 4,
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  btn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#12122A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: '#2D2D4E',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2D2D4E',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#7C3AED',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2D2D4E',
    borderRadius: 14,
    padding: 14,
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 24,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  wordCount: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 8,
  },
  wordCountText: { color: '#475569', fontSize: 11 },
  error: {
    color: '#F87171',
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2D2D4E',
  },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  postBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
