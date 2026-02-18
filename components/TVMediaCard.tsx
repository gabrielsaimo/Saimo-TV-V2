import React, { memo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

// Cor da classificação indicativa
const getCertificationColor = (cert?: string) => {
  if (!cert) return Colors.textSecondary;
  const c = cert.toUpperCase();
  if (c === 'L' || c === 'LIVRE') return '#10B981'; // Verde
  if (c === '10') return '#3B82F6'; // Azul
  if (c === '12') return '#F59E0B'; // Amarelo
  if (c === '14') return '#F97316'; // Laranja
  if (c === '16' || c === '18') return '#EF4444'; // Vermelho
  return Colors.textSecondary;
};

// Cor da nota
const getRatingColor = (rating?: number) => {
  if (!rating) return Colors.textSecondary;
  if (rating >= 7) return '#FFD700'; // Dourado
  if (rating >= 5) return '#F59E0B'; // Amarelo
  return '#EF4444'; // Vermelho
};

const TVMediaCard = memo(({ item, size = 'medium' }: TVMediaCardProps) => {
  const router = useRouter();
  const { isFavorite, addFavorite, removeFavorite } = useMediaStore();
  const [favorite, setFavorite] = useState(isFavorite(item.id));
  const [isFocused, setIsFocused] = useState(false);

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
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleLongPress = useCallback(() => {
    if (favorite) removeFavorite(item.id); else addFavorite(item.id);
    setFavorite(!favorite);
  }, [item.id, favorite, addFavorite, removeFavorite]);

  return (
    <View style={styles.cardWrapper}>
      <Pressable onPress={handlePress} onLongPress={handleLongPress} onFocus={handleFocus} onBlur={handleBlur}>
        <View style={[
          styles.container, 
          { width: dimensions.width, height: dimensions.height }, 
          isFocused ? styles.containerFocused : null
        ]}>
          {/* Poster */}
          <Image 
            source={{ uri: tmdb?.poster || '' }} 
            style={styles.poster} 
            contentFit="cover" 
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={tmdb?.poster || item.url}
          />
          
          {/* Gradient overlay */}
          <LinearGradient 
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.9)']} 
            style={styles.gradient} 
          />
          
          {/* Rating Badge (Top Left) */}
          {(tmdb?.rating || 0) > 0 && (
            <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(tmdb?.rating || 0) }]}>
              <Ionicons name="star" size={10} color="#000" />
              <Text style={styles.ratingText}>{(tmdb?.rating || 0).toFixed(1)}</Text>
            </View>
          )}

           {/* Favorite Indicator (Top Right) */}
           <View style={[styles.favoriteBadge, favorite && styles.favoriteActive]}>
            <Ionicons 
              name={favorite ? 'heart' : 'heart-outline'} 
              size={18} 
              color={favorite ? '#FF4757' : 'white'} 
            />
          </View>

          {/* Type Badge (Bottom Left - Above Title) */}
          <View style={styles.typeBadge}>
            <Ionicons 
              name={item.type === 'movie' ? 'film-outline' : 'tv-outline'} 
              size={12} 
              color="white" 
            />
          </View>

          {/* Certification Badge (Bottom Right - Above Title) */}
          {tmdb?.certification && (
            <View style={[styles.certBadge, { borderColor: getCertificationColor(tmdb?.certification) }]}>
              <Text style={[styles.certText, { color: getCertificationColor(tmdb?.certification) }]}>
                {tmdb?.certification}
              </Text>
            </View>
          )}
          
          {/* Title & Year */}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {tmdb?.title || item.name || 'Sem título'}
            </Text>
            {tmdb?.year && typeof tmdb.year === 'string' && tmdb.year.length > 0 && (
              <Text style={styles.year}>{tmdb.year}</Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}, (prev, next) => prev.item.id === next.item.id);

TVMediaCard.displayName = 'TVMediaCard';

const SCALE_PADDING = 20;

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
    // Provide visual feedback without expensive animation
    transform: [{ scale: 1.05 }],
    zIndex: 10,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  poster: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: Colors.surface 
  },
  gradient: { 
    ...StyleSheet.absoluteFillObject 
  },
  ratingBadge: { 
    position: 'absolute', 
    top: Spacing.sm, 
    left: Spacing.sm, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 6, 
    paddingVertical: 3, 
    borderRadius: BorderRadius.sm, 
    gap: 2 
  },
  ratingText: { 
    color: '#000', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  favoriteBadge: { 
    position: 'absolute', 
    top: Spacing.sm, 
    right: Spacing.sm, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    padding: 6, 
    borderRadius: BorderRadius.full,
    zIndex: 3
  },
  favoriteActive: {
    backgroundColor: 'rgba(255,71,87,0.3)',
  },
  certBadge: {
    position: 'absolute',
    bottom: 60,
    right: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 2,
  },
  certText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadge: { 
    position: 'absolute', 
    bottom: 60, 
    left: Spacing.sm, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    padding: 4, 
    borderRadius: BorderRadius.sm,
    zIndex: 2,
  },
  titleContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: Spacing.sm,
  },
  title: { 
    color: Colors.text, 
    fontSize: Typography.caption.fontSize, 
    fontWeight: '600', 
    lineHeight: 20 
  },
  year: { 
    color: Colors.textSecondary, 
    fontSize: 12, 
    marginTop: 2 
  },
});

export default TVMediaCard;
