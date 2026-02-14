import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, scale, SCREEN } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { getMediaById } from '../../services/mediaService';
import { useMediaStore } from '../../stores/mediaStore';
import type { MediaItem, CastMember } from '../../types';

const getCertColor = (cert?: string) => {
  if (!cert) return Colors.textSecondary;
  const c = cert.toUpperCase();
  if (c === 'L') return '#10B981';
  if (c === '10') return '#3B82F6';
  if (c === '12') return '#F59E0B';
  if (c === '14') return '#F97316';
  if (c === '16' || c === '18') return '#EF4444';
  return Colors.textSecondary;
};

export default function TVMediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);

  const { isFavorite, addFavorite, removeFavorite, addToHistory } = useMediaStore();
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const item = await getMediaById(id);
      setMedia(item);
      setFavorite(isFavorite(id));
      setLoading(false);
    }
    load();
  }, [id, isFavorite]);

  const handleBack = useCallback(() => router.back(), [router]);

  const handlePlay = useCallback(() => {
    if (!media) return;
    addToHistory(media.id);
    router.push({
      pathname: '/media-player/[id]' as any,
      params: { id: media.id, url: encodeURIComponent(media.url), title: media.tmdb?.title || media.name },
    });
  }, [media, router, addToHistory]);

  const handleFavorite = useCallback(() => {
    if (!media) return;
    if (favorite) removeFavorite(media.id);
    else addFavorite(media.id);
    setFavorite(!favorite);
  }, [media, favorite, addFavorite, removeFavorite]);

  const handleActorPress = useCallback((actor: CastMember) => {
    router.push({
      pathname: '/actor/[id]',
      params: { id: actor.id.toString(), name: actor.name },
    });
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!media) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="film-outline" size={80} color={Colors.textSecondary} />
        <Text style={styles.errorText}>Conteúdo não encontrado</Text>
        <TVPressable
          style={styles.backBtn}
          focusScale={1.08}
          onPress={handleBack}
        >
          <Text style={styles.backBtnText}>Voltar</Text>
        </TVPressable>
      </View>
    );
  }

  const tmdb = media.tmdb;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero - landscape layout: backdrop left, info right */}
        <View style={styles.hero}>
          <Image
            source={{ uri: tmdb?.backdrop || tmdb?.poster || '' }}
            style={styles.backdrop}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
           {/* Back */}
          <TVPressable
            style={styles.headerButton}
            focusScale={1.15}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.text} />
          </TVPressable>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', Colors.background]}
            style={styles.heroGradient}
          />

         

          {/* Content over hero */}
          <View style={styles.heroContent}>
            <Image
              source={{ uri: tmdb?.poster || '' }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.heroInfo}>
              <Text style={styles.title} numberOfLines={2}>
                {tmdb?.title || media.name}
              </Text>

              <View style={styles.badges}>
                {tmdb?.year && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tmdb.year}</Text>
                  </View>
                )}
                {tmdb?.runtime && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tmdb.runtime} min</Text>
                  </View>
                )}
                {tmdb?.certification && (
                  <View style={[styles.badge, { borderColor: getCertColor(tmdb.certification) }]}>
                    <Text style={[styles.badgeText, { color: getCertColor(tmdb.certification) }]}>
                      {tmdb.certification}
                    </Text>
                  </View>
                )}
                {tmdb?.rating && (
                  <View style={[styles.badge, styles.ratingBadge]}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={[styles.badgeText, { color: '#FFD700' }]}>
                      {tmdb.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.typeRow}>
                <Ionicons
                  name={media.type === 'movie' ? 'film' : 'tv'}
                  size={18}
                  color={Colors.textSecondary}
                />
                <Text style={styles.typeText}>
                  {media.type === 'movie' ? 'Filme' : 'Série'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TVPressable
            outerStyle={{ flex: 1 }}
            style={styles.playButton}
            focusedStyle={styles.playButtonFocused}
            focusScale={1.05}
            focusBorderColor="#ffffff"
            onPress={handlePlay}
            hasTVPreferredFocus
          >
            <Ionicons name="play" size={28} color="#000" />
            <Text style={styles.playText}>Assistir</Text>
          </TVPressable>

          <TVPressable
            style={[
              styles.iconButton,
              favorite && styles.iconButtonActive,
            ]}
            focusedStyle={styles.favBtnFocused}
            focusScale={1.1}
            onPress={handleFavorite}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={28}
              color={favorite ? '#FF4757' : Colors.text}
            />
          </TVPressable>
        </View>

        {/* Genres */}
        {tmdb?.genres && tmdb.genres.length > 0 && (
          <View style={styles.genres}>
            {tmdb.genres.map((genre, i) => (
              <View key={i} style={styles.genreChip}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Overview */}
        {tmdb?.overview && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sinopse</Text>
            <Text style={styles.overview}>{tmdb.overview}</Text>
          </View>
        )}

        {/* Cast */}
        {tmdb?.cast && tmdb.cast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Elenco</Text>
            <FlatList
              data={tmdb.cast}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm }}
              renderItem={({ item: actor }) => (
                <TVPressable
                  style={styles.castCard}
                  focusedStyle={styles.castCardFocused}
                  focusScale={1.1}
                  onPress={() => handleActorPress(actor)}
                >
                  <Image
                    source={{ uri: actor.photo || '' }}
                    style={styles.castPhoto}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <Text style={styles.castName} numberOfLines={1}>{actor.name}</Text>
                  <Text style={styles.castCharacter} numberOfLines={1}>{actor.character}</Text>
                </TVPressable>
              )}
            />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  hero: { height: SCREEN.height * 0.55, position: 'relative' },
  backdrop: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  headerButton: {
    position: 'absolute', top: Spacing.lg, left: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.md, borderRadius: BorderRadius.full, zIndex: 10,
    alignItems: 'center', justifyContent: 'center', width: 50, height: 50
  },
  heroContent: {
    position: 'absolute', bottom: 0, left: Spacing.xl, right: Spacing.xl,
    flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-end', paddingBottom: Spacing.xl,
  },
  poster: { width: scale(140), height: scale(210), borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  heroInfo: { flex: 1, paddingBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700', lineHeight: 48 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  badge: { borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.sm },
  badgeText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, fontWeight: '600' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderColor: '#FFD700' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  typeText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize },
  actions: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.lg },
  playButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg, gap: Spacing.md,
  },
  playButtonFocused: { backgroundColor: 'rgba(255,255,255,0.2)' },
  playText: { color: '#000', fontSize: Typography.body.fontSize, fontWeight: '700' },
  iconButton: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 3, borderColor: 'transparent' },
  iconButtonActive: { backgroundColor: 'rgba(255,71,87,0.2)' },
  favBtnFocused: { backgroundColor: 'rgba(99,102,241,0.3)' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  genreChip: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  genreText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  section: { marginTop: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  overview: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, lineHeight: 28, paddingHorizontal: Spacing.xl },
  castCard: { width: scale(120), marginRight: Spacing.lg, alignItems: 'center' },
  castCardFocused: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: BorderRadius.lg, padding: 4 },
  castPhoto: { width: scale(100), height: scale(100), borderRadius: scale(50), backgroundColor: Colors.surface },
  castName: { color: Colors.text, fontSize: Typography.caption.fontSize, fontWeight: '600', textAlign: 'center', marginTop: Spacing.sm },
  castCharacter: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, marginTop: Spacing.lg },
  backBtn: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  backBtnText: { color: '#000', fontWeight: '600', fontSize: Typography.body.fontSize },
});
