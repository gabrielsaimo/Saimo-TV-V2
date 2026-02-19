import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { Channel, CurrentProgram } from '../types';
import { Colors, BorderRadius, Spacing, Typography } from '../constants/Colors';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getCurrentProgram, fetchChannelEPG, onEPGUpdate, hasEPGMapping } from '../services/epgService';

interface TVChannelListItemProps {
  channel: Channel;
  onFocused?: (id: string) => void;
}

export const LIST_ITEM_HEIGHT = 96;

const TVChannelListItem = memo(({ channel, onFocused }: TVChannelListItemProps) => {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const showEPG = useSettingsStore(state => state.showEPG);

  const [currentEPG, setCurrentEPG] = useState<CurrentProgram | null>(null);
  const [isFocusedState, setIsFocusedState] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  const hasMapping = hasEPGMapping(channel.id);
  const favorite = isFavorite(channel.id);

  useEffect(() => {
    isMountedRef.current = true;
    if (!showEPG || !hasMapping) return;

    const cached = getCurrentProgram(channel.id);
    if (cached) {
      setCurrentEPG(cached);
    } else {
      fetchChannelEPG(channel.id)
        .then(() => {
          if (isMountedRef.current) setCurrentEPG(getCurrentProgram(channel.id));
        })
        .catch(() => {});
    }

    const unsubscribe = onEPGUpdate((id) => {
      if (isMountedRef.current && id === channel.id && showEPG) {
        setCurrentEPG(getCurrentProgram(channel.id));
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [channel.id, showEPG, hasMapping]);

  const handlePress = useCallback(() => {
    router.push({ pathname: '/player/[id]', params: { id: channel.id } });
  }, [channel.id, router]);

  const handleLongPress = useCallback(() => {
    toggleFavorite(channel.id);
  }, [channel.id, toggleFavorite]);

  const handleFocus = useCallback(() => {
    setIsFocusedState(true);
    Animated.spring(scaleAnim, { toValue: 1.03, friction: 8, tension: 100, useNativeDriver: true }).start();
    onFocused?.(channel.id);
  }, [scaleAnim, onFocused, channel.id]);

  const handleBlur = useCallback(() => {
    setIsFocusedState(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} onFocus={handleFocus} onBlur={handleBlur}>
      <Animated.View
        style={[
          styles.container,
          isFocusedState && styles.containerFocused,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          {channel.logo ? (
            <Image
              source={{ uri: channel.logo }}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="tv-outline" size={32} color={Colors.textSecondary} />
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
            {favorite && <Ionicons name="heart" size={16} color="#FF4757" />}
          </View>
          <Text style={styles.category} numberOfLines={1}>{channel.category}</Text>
          {showEPG && currentEPG?.current && (
            <Text style={styles.program} numberOfLines={1}>▶ {currentEPG.current.title}</Text>
          )}
        </View>

        {/* Live indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}, (prev, next) => prev.channel.id === next.channel.id);

TVChannelListItem.displayName = 'TVChannelListItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: LIST_ITEM_HEIGHT - Spacing.sm,
  },
  containerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceVariant,
  },
  logoContainer: {
    width: 96,
    height: 64,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: Spacing.lg,
    flexShrink: 0,
  },
  logo: { width: '85%', height: '85%' },
  info: { flex: 1, marginRight: Spacing.md },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  name: {
    color: Colors.text,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    flex: 1,
  },
  category: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
  },
  program: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
    marginTop: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.live,
  },
  liveText: {
    color: Colors.live,
    fontSize: Typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default TVChannelListItem;
