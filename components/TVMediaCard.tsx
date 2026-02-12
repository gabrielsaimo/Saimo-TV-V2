import React, { memo, useCallback, useState, useRef } from 'react';
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

import type { MediaItem } from '../types';
import { Colors, BorderRadius, Spacing, Typography, TV, scale } from '../constants/Colors';
import { useMediaStore } from '../stores/mediaStore';

interface TVMediaCardProps {
  item: MediaItem & { episodes?: any };
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: { width: TV.mediaCardWidth, height: TV.mediaCardHeight },
  medium: { width: TV.mediaCardLargeWidth, height: TV.mediaCardLargeHeight },
  large: { width: TV.mediaCardLargeWidth + scale(40), height: TV.mediaCardLargeHeight + scale(60) },
};

const getRatingColor = (rating?: number) => {
  if (!rating) return Colors.textSecondary;
  if (rating >= 7) return '#FFD700';
  if (rating >= 5) return '#F59E0B';
  return '#EF4444';
};

const TVMediaCard = memo(({ item, size = 'medium' }: TVMediaCardProps) => {
  const router = useRouter();
  // Seletores granulares: só re-renderiza quando as funções mudam (nunca — são estáveis)
  const addFavorite = useMediaStore(s => s.addFavorite);
  const removeFavorite = useMediaStore(s => s.removeFavorite);
  // isFavorite lido via getState() no mount — sem subscription para evitar re-renders
  const [favorite, setFavorite] = useState(() =>
    useMediaStore.getState().isFavorite(item.id)
  );
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const dimensions = SIZES[size];
  const tmdb = item.tmdb;
  const hasSeries = item.episodes && Object.keys(item.episodes).length > 0;

  const handlePress = useCallback(() => {
    if (hasSeries) {
      router.push({ pathname: '/series/[id]' as any, params: { id: item.id } });
    } else {
      router.push({ pathname: '/media/[id]', params: { id: item.id } });
    }
  }, [item.id, router, hasSeries]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.spring(scaleAnim, { toValue: 1.08, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleLongPress = useCallback(() => {
    if (favorite) removeFavorite(item.id); else addFavorite(item.id);
    setFavorite(f => !f);
  }, [item.id, favorite, addFavorite, removeFavorite]);

  return (
    <View style={styles.cardWrapper}>
      <Pressable onPress={handlePress} onLongPress={handleLongPress} onFocus={handleFocus} onBlur={handleBlur}>
        <Animated.View style={[
          styles.container,
          { width: dimensions.width, height: dimensions.height },
          { transform: [{ scale: scaleAnim }] },
          isFocused && styles.containerFocused,
        ]}>
          <Image
            source={{ uri: tmdb?.poster || '' }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {tmdb?.rating != null && tmdb.rating > 0 && (
            <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(tmdb.rating) }]}>
              <Ionicons name="star" size={12} color="#000" />
              <Text style={styles.ratingText}>{tmdb.rating.toFixed(1)}</Text>
            </View>
          )}
          {favorite && (
            <View style={styles.favBadge}>
              <Ionicons name="heart" size={16} color="#FF4757" />
            </View>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2}>{tmdb?.title || item.name || 'Sem título'}</Text>
            {tmdb?.year && <Text style={styles.year}>{tmdb.year}</Text>}
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}, (prev, next) => prev.item.id === next.item.id);

TVMediaCard.displayName = 'TVMediaCard';

const SCALE_PADDING = 10;

const styles = StyleSheet.create({
  cardWrapper: {
    padding: SCALE_PADDING,
  },
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: Colors.primary,
    elevation: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  poster: { width: '100%', height: '100%', backgroundColor: Colors.surface },
  ratingBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  ratingText: { color: '#000', fontSize: 13, fontWeight: '700' },
  favBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255,71,87,0.3)',
    padding: 6,
    borderRadius: BorderRadius.full,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  title: { color: Colors.text, fontSize: Typography.caption.fontSize, fontWeight: '600', lineHeight: 20 },
  year: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
});

export default TVMediaCard;
