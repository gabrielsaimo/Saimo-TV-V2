import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, scale, SCREEN } from '../../constants/Colors';
import { getSeriesById } from '../../services/mediaService';
import { useMediaStore } from '../../stores/mediaStore';
import type { SeriesItem, Episode, CastMember } from '../../types';

export default function TVSeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [series, setSeries] = useState<SeriesItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<string>('1');

  const { isFavorite, addFavorite, removeFavorite, getSeriesProgress, setSeriesProgress } = useMediaStore();
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const item = await getSeriesById(id);
      setSeries(item);
      setFavorite(isFavorite(id));
      const progress = getSeriesProgress(id);
      if (progress) setSelectedSeason(progress.season.toString());
      setLoading(false);
    }
    load();
  }, [id, isFavorite, getSeriesProgress]);

  const seasons = useMemo(() => {
    if (!series?.episodes) return [];
    return Object.keys(series.episodes).sort((a, b) => parseInt(a) - parseInt(b));
  }, [series]);

  const episodes = useMemo(() => {
    if (!series?.episodes || !selectedSeason) return [];
    return series.episodes[selectedSeason] || [];
  }, [series, selectedSeason]);

  const progress = useMemo(() => {
    if (!id) return null;
    return getSeriesProgress(id);
  }, [id, getSeriesProgress]);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleFavorite = useCallback(() => {
    if (!series) return;
    if (favorite) removeFavorite(series.id);
    else addFavorite(series.id);
    setFavorite(!favorite);
  }, [series, favorite, addFavorite, removeFavorite]);

  const handlePlayEpisode = useCallback((ep: Episode, season: string) => {
    if (!series) return;
    setSeriesProgress(series.id, parseInt(season), ep.episode, ep.id);
    router.push({
      pathname: '/media-player/[id]' as any,
      params: {
        id: ep.id,
        url: encodeURIComponent(ep.url),
        title: `${series.name} - T${season} E${ep.episode}`,
      },
    });
  }, [series, router, setSeriesProgress]);

  const handleContinue = useCallback(() => {
    if (!series || !progress) return;
    const seasonEps = series.episodes[progress.season.toString()];
    const ep = seasonEps?.find(e => e.episode === progress.episode);
    if (ep) handlePlayEpisode(ep, progress.season.toString());
  }, [series, progress, handlePlayEpisode]);

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

  if (!series) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="tv-outline" size={80} color={Colors.textSecondary} />
        <Text style={styles.errorText}>Série não encontrada</Text>
        <Pressable
          style={({ focused }) => [styles.backBtn, focused && styles.btnFocused]}
          onPress={handleBack}
        >
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const tmdb = series.tmdb;
  const logo = series.episodes?.['1']?.[0]?.logo || tmdb?.poster || '';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: tmdb?.backdrop || logo }}
            style={styles.backdrop}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', Colors.background]}
            style={styles.heroGradient}
          />

          <Pressable
            style={({ focused }) => [styles.headerButton, focused && styles.btnFocused]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.text} />
          </Pressable>

          <View style={styles.heroContent}>
            <Image
              source={{ uri: tmdb?.poster || logo }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.heroInfo}>
              <Text style={styles.title} numberOfLines={2}>
                {tmdb?.title || series.name}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {seasons.length} Temporada{seasons.length > 1 ? 's' : ''}
                </Text>
                {tmdb?.rating && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>{tmdb.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {progress ? (
            <Pressable
              style={({ focused }) => [styles.continueButton, focused && styles.playFocused]}
              onPress={handleContinue}
            >
              <Ionicons name="play" size={28} color="#000" />
              <Text style={styles.continueText}>
                Continuar T{progress.season} E{progress.episode}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ focused }) => [styles.playButton, focused && styles.playFocused]}
              onPress={() => episodes[0] && handlePlayEpisode(episodes[0], selectedSeason)}
            >
              <Ionicons name="play" size={28} color="#000" />
              <Text style={styles.playText}>Assistir</Text>
            </Pressable>
          )}

          <Pressable
            style={({ focused }) => [
              styles.iconButton,
              favorite && styles.iconButtonActive,
              focused && styles.btnFocused,
            ]}
            onPress={handleFavorite}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={28}
              color={favorite ? '#FF4757' : Colors.text}
            />
          </Pressable>
        </View>

        {/* Synopsis */}
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
              contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
              renderItem={({ item: actor }) => (
                <Pressable
                  style={({ focused }) => [styles.castCard, focused && styles.castCardFocused]}
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
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Season Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temporadas</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonsRow}
          >
            {seasons.map((s) => (
              <Pressable
                key={s}
                style={({ focused }) => [
                  styles.seasonChip,
                  selectedSeason === s && styles.seasonChipActive,
                  focused && styles.seasonChipFocused,
                ]}
                onPress={() => setSelectedSeason(s)}
              >
                <Text style={[
                  styles.seasonChipText,
                  selectedSeason === s && styles.seasonChipTextActive,
                ]}>
                  T{s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Episodes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Episódios ({episodes.length})
          </Text>
          {episodes.map((ep) => (
            <Pressable
              key={ep.id}
              style={({ focused }) => [
                styles.episodeCard,
                progress?.episodeId === ep.id && styles.episodeCardActive,
                focused && styles.episodeCardFocused,
              ]}
              onPress={() => handlePlayEpisode(ep, selectedSeason)}
            >
              <View style={styles.episodeNumber}>
                <Text style={styles.episodeNumberText}>{ep.episode}</Text>
              </View>
              <View style={styles.episodeInfo}>
                <Text style={styles.episodeName} numberOfLines={1}>
                  {ep.name || `Episódio ${ep.episode}`}
                </Text>
                {progress?.episodeId === ep.id && (
                  <Text style={styles.episodeContinue}>Continuar assistindo</Text>
                )}
              </View>
              <Ionicons name="play-circle" size={36} color={Colors.primary} />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  hero: { height: SCREEN.height * 0.5, position: 'relative' },
  backdrop: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  headerButton: {
    position: 'absolute', top: Spacing.lg, left: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.md, borderRadius: BorderRadius.full, zIndex: 10,
  },
  heroContent: {
    position: 'absolute', bottom: 0, left: Spacing.xl, right: Spacing.xl,
    flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-end', paddingBottom: Spacing.xl,
  },
  poster: { width: scale(130), height: scale(195), borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  heroInfo: { flex: 1, paddingBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700', lineHeight: 48 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.sm },
  metaText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#FFD700', fontSize: Typography.body.fontSize, fontWeight: '600' },
  actions: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.lg },
  playButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.md,
  },
  continueButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.md,
  },
  playFocused: { borderWidth: 3, borderColor: Colors.text },
  playText: { color: '#000', fontSize: Typography.body.fontSize, fontWeight: '700' },
  continueText: { color: '#000', fontSize: Typography.body.fontSize, fontWeight: '700' },
  iconButton: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  iconButtonActive: { backgroundColor: 'rgba(255,71,87,0.2)' },
  btnFocused: { borderWidth: 3, borderColor: Colors.primary, borderRadius: BorderRadius.lg },
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', marginBottom: Spacing.md },
  overview: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, lineHeight: 28 },
  seasonsRow: { gap: Spacing.md },
  seasonChip: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
  },
  seasonChipActive: { backgroundColor: Colors.primary },
  seasonChipFocused: { borderWidth: 3, borderColor: Colors.text },
  seasonChipText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Typography.body.fontSize },
  seasonChipTextActive: { color: '#000' },
  episodeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.lg,
  },
  episodeCardActive: { borderWidth: 2, borderColor: Colors.primary },
  episodeCardFocused: { borderWidth: 3, borderColor: Colors.primary, backgroundColor: Colors.surfaceHover },
  episodeNumber: {
    width: scale(52), height: scale(52), borderRadius: BorderRadius.md,
    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
  },
  episodeNumberText: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700' },
  episodeInfo: { flex: 1 },
  episodeName: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '500' },
  episodeContinue: { color: Colors.primary, fontSize: Typography.caption.fontSize, marginTop: 4 },
  castCard: { width: scale(100), marginRight: Spacing.lg, alignItems: 'center' },
  castCardFocused: { borderWidth: 2, borderColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 4 },
  castPhoto: { width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: Colors.surface },
  castName: { color: Colors.text, fontSize: Typography.caption.fontSize, fontWeight: '600', textAlign: 'center', marginTop: Spacing.sm },
  castCharacter: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, marginTop: Spacing.lg },
  backBtn: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  backBtnText: { color: '#000', fontWeight: '600', fontSize: Typography.body.fontSize },
});
