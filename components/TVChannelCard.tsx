import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
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

import type { Channel, CurrentProgram } from '../types';
import { Colors, BorderRadius, Spacing, Typography, TV } from '../constants/Colors';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getCurrentProgram, fetchChannelEPG, onEPGUpdate, hasEPGMapping } from '../services/epgService';

interface TVChannelCardProps {
  channel: Channel;
  cardWidth?: number;
  onFocused?: (id: string) => void;
  hasTVPreferredFocus?: boolean;
}

const TVChannelCard = memo(({ channel, cardWidth, onFocused, hasTVPreferredFocus }: TVChannelCardProps) => {
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const showEPG = useSettingsStore(state => state.showEPG);
  const showChannelNumber = useSettingsStore(state => state.showChannelNumber);

  const [favorite, setFavorite] = useState(isFavorite(channel.id));
  const [currentEPG, setCurrentEPG] = useState<CurrentProgram | null>(null);
  const [epgLoading, setEpgLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  const hasMapping = hasEPGMapping(channel.id);

  // Lazy EPG loading: each card fetches its own EPG on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (!showEPG || !hasMapping) return;

    // Try memory cache first (instant)
    const cached = getCurrentProgram(channel.id);
    if (cached) {
      setCurrentEPG(cached);
    } else {
      // Fetch in background
      setEpgLoading(true);
      fetchChannelEPG(channel.id)
        .then(() => {
          if (isMountedRef.current) {
            setCurrentEPG(getCurrentProgram(channel.id));
            setEpgLoading(false);
          }
        })
        .catch(() => {
          if (isMountedRef.current) setEpgLoading(false);
        });
    }

    // Listen for updates from other sources
    const unsubscribe = onEPGUpdate((updatedId) => {
      if (isMountedRef.current && updatedId === channel.id && showEPG) {
        setCurrentEPG(getCurrentProgram(channel.id));
        setEpgLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [channel.id, showEPG, hasMapping]);

  useEffect(() => { setFavorite(isFavorite(channel.id)); }, [isFavorite, channel.id]);

  const handlePress = useCallback(() => {
    router.push({ pathname: '/player/[id]', params: { id: channel.id } });
  }, [channel.id, router]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.spring(scaleAnim, { toValue: 1.08, friction: 8, tension: 100, useNativeDriver: true }).start();
    onFocused?.(channel.id);
  }, [scaleAnim, onFocused, channel.id]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleLongPress = useCallback(() => {
    toggleFavorite(channel.id);
    setFavorite(prev => !prev);
  }, [channel.id, toggleFavorite]);

  return (
    <View style={styles.cardWrapper}>
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
    >
      <Animated.View style={[styles.container, cardWidth ? { width: cardWidth } : null, { transform: [{ scale: scaleAnim }] }, isFocused && styles.containerFocused]}>
        <View style={styles.imageContainer}>
          {channel.logo ? (
            <Image source={{ uri: channel.logo }} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="tv-outline" size={40} color={Colors.textSecondary} />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient} />
          {showChannelNumber && channel.channelNumber && (
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{channel.channelNumber}</Text>
            </View>
          )}
          {favorite && (
            <View style={styles.favBadge}>
              <Ionicons name="heart" size={18} color="#FF4757" />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
          <Text style={styles.category} numberOfLines={1}>{channel.category}</Text>
          {showEPG && (
            <View style={styles.epgContainer}>
              {currentEPG?.current ? (
                <>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>AO VIVO</Text>
                  </View>
                  <Text style={styles.programTitle} numberOfLines={1}>{currentEPG.current.title}</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${currentEPG.progress}%` }]} />
                  </View>
                </>
              ) : epgLoading ? (
                 <Text style={styles.loadingText}>Carregando...</Text>
              ) : hasMapping ? (
                 <Text style={styles.loadingText}>Sem informações</Text>
              ) : (
                 <Text style={styles.loadingText}>Sem guia</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
    </View>
  );
}, (prev, next) =>
  prev.channel.id === next.channel.id &&
  prev.hasTVPreferredFocus === next.hasTVPreferredFocus,
);

TVChannelCard.displayName = 'TVChannelCard';

const SCALE_PADDING = 6;

const styles = StyleSheet.create({
  cardWrapper: {
    padding: SCALE_PADDING,
  },
  container: {
    width: TV.channelCardWidth,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: Colors.primary,
    // Shadow removed to prevent clipping and improve performance on TV
    zIndex: 10,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: '65%', height: '65%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  numberBadge: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, backgroundColor: Colors.overlay, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  numberText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  favBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: 'rgba(255,71,87,0.3)', padding: 6, borderRadius: BorderRadius.full },
  info: { padding: Spacing.md, minHeight: 110 },
  channelName: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '600', marginBottom: 4 },
  category: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  epgContainer: { marginTop: Spacing.sm },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.live },
  liveText: { color: Colors.live, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  programTitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginBottom: 6 },
  progressBar: { height: 4, backgroundColor: Colors.progressBg, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.progressFill },
  loadingText: { color: Colors.textSecondary, fontSize: 11, fontStyle: 'italic' },
});

export default TVChannelCard;
