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
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';

interface TVChannelCardProps {
  channel: Channel;
}

const TVChannelCard = memo(({ channel }: TVChannelCardProps) => {
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const showEPG = useSettingsStore(state => state.showEPG);
  const showChannelNumber = useSettingsStore(state => state.showChannelNumber);

  const [favorite, setFavorite] = useState(isFavorite(channel.id));
  const [currentEPG, setCurrentEPG] = useState<CurrentProgram | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (showEPG) setCurrentEPG(getCurrentProgram(channel.id));
    const unsubscribe = onEPGUpdate((updatedId) => {
      if (isMountedRef.current && updatedId === channel.id && showEPG)
        setCurrentEPG(getCurrentProgram(channel.id));
    });
    const interval = setInterval(() => {
      if (isMountedRef.current && showEPG) setCurrentEPG(getCurrentProgram(channel.id));
    }, 60000);
    return () => { isMountedRef.current = false; unsubscribe(); clearInterval(interval); };
  }, [channel.id, showEPG]);

  useEffect(() => { setFavorite(isFavorite(channel.id)); }, [isFavorite, channel.id]);

  const handlePress = useCallback(() => {
    router.push({ pathname: '/player/[id]', params: { id: channel.id } });
  }, [channel.id, router]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.spring(scaleAnim, { toValue: 1.08, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleLongPress = useCallback(() => {
    toggleFavorite(channel.id);
    setFavorite(prev => !prev);
  }, [channel.id, toggleFavorite]);

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} onFocus={handleFocus} onBlur={handleBlur}>
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }, isFocused && styles.containerFocused]}>
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
          {showEPG && currentEPG?.current && (
            <View style={styles.epgContainer}>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>AO VIVO</Text>
              </View>
              <Text style={styles.programTitle} numberOfLines={1}>{currentEPG.current.title}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${currentEPG.progress}%` }]} />
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}, (prev, next) => prev.channel.id === next.channel.id);

TVChannelCard.displayName = 'TVChannelCard';

const styles = StyleSheet.create({
  container: {
    width: TV.channelCardWidth,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: Colors.primary,
    elevation: 8,
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
  info: { padding: Spacing.md },
  channelName: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '600', marginBottom: 4 },
  category: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  epgContainer: { marginTop: Spacing.sm },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.live },
  liveText: { color: Colors.live, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  programTitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginBottom: 6 },
  progressBar: { height: 4, backgroundColor: Colors.progressBg, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.progressFill },
});

export default TVChannelCard;
