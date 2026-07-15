import React, { useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  loading?: boolean;
}

export default function SearchBar({ value, onChangeText, onClear, loading }: SearchBarProps) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () =>
    Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const onBlur = () =>
    Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2D2D4E', '#7C3AED'],
  });

  return (
    <Animated.View style={[styles.container, { borderColor }]}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        id="search-bar"
        style={styles.input}
        placeholder="Search real stories…"
        placeholderTextColor="#475569"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {loading && <Text style={styles.spinner}>⏳</Text>}
      {!!value && !loading && (
        <TouchableOpacity id="search-clear-btn" onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearBtn}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  icon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
    fontFamily: 'System',
    padding: 0,
  },
  spinner: {
    fontSize: 14,
  },
  clearBtn: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
