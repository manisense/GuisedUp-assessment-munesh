import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useRef,
} from 'react-native';
import { FeedPost } from '../services/api';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Deterministic pastel from name
function getAvatarColor(name: string): string {
  const colors = [
    '#7C3AED', '#2563EB', '#059669', '#DC2626',
    '#D97706', '#9333EA', '#0891B2', '#BE185D',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function authenticityLabel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: '✦ Authentic', color: '#34D399' };
  if (score >= 0.5)  return { label: '◈ Genuine',   color: '#60A5FA' };
  return                      { label: '◉ Curated',  color: '#F59E0B' };
}

interface FeedCardProps {
  post: FeedPost;
  onReact: (id: number) => void;
}

const FeedCard = memo(({ post, onReact }: FeedCardProps) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const auth = authenticityLabel(post.authenticity_score);
  const avatarColor = getAvatarColor(post.user.name);

  const handleReact = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 50 }),
    ]).start();
    onReact(post.id);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(post.user.name)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{post.user.name}</Text>
          <Text style={styles.timeAgo}>{timeAgo(post.created_at)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: auth.color + '20' }]}>
          <Text style={[styles.badgeText, { color: auth.color }]}>{auth.label}</Text>
        </View>
      </View>

      {/* Body */}
      <Text style={styles.body}>{post.body}</Text>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          id={`react-btn-${post.id}`}
          onPress={handleReact}
          style={styles.reactBtn}
          activeOpacity={0.7}
        >
          <Animated.Text style={[styles.reactEmoji, { transform: [{ scale: scaleAnim }] }]}>
            {post.viewer_has_reacted ? '❤️' : '🤍'}
          </Animated.Text>
          <Text style={[styles.reactLabel, post.viewer_has_reacted && styles.reactLabelActive]}>
            {post.viewer_has_reacted ? 'Loved' : 'Love this'}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoreChip}>
          <Text style={styles.scoreText}>
            {Math.round(post.score * 100)}% match
          </Text>
        </View>
      </View>
    </View>
  );
});

FeedCard.displayName = 'FeedCard';
export default FeedCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2D2D4E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'System',
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  timeAgo: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  body: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.15,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2D2D4E',
    paddingTop: 12,
  },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactEmoji: {
    fontSize: 20,
  },
  reactLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  reactLabelActive: {
    color: '#F472B6',
  },
  scoreChip: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scoreText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
});
