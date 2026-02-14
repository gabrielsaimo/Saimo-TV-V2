import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, TV, scale } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { loadInitialCategories, getMediaByActor, deduplicateMedia } from '../../services/mediaService';
import type { MediaItem, CastMember } from '../../types';
import TVMediaCard from '../../components/TVMediaCard';

export default function TVActorScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState<CastMember | null>(null);
  const [filmography, setFilmography] = useState<MediaItem[]>([]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const actorId = parseInt(id, 10);
      const categories = await loadInitialCategories();
      const allItems: MediaItem[] = [];
      categories.forEach(items => allItems.push(...items));
      const uniqueItems = deduplicateMedia(allItems);
      const actorMedia = getMediaByActor(actorId, uniqueItems);
      setFilmography(actorMedia);
      for (const item of actorMedia) {
        const castMember = item.tmdb?.cast?.find(c => c.id === actorId);
        if (castMember) { setActor(castMember); break; }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleBack = () => router.back();

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <FlatList
        data={filmography}
        keyExtractor={(item) => item.id}
        numColumns={TV.mediaColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TVMediaCard item={item} size="small" />
        )}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <TVPressable
                style={styles.backButton}
                focusScale={1.15}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={28} color={Colors.text} />
              </TVPressable>
              <Text style={styles.headerTitle}>Ator</Text>
              <View style={{ width: 52 }} />
            </View>

            {/* Actor Profile */}
            <View style={styles.profile}>
              <Image
                source={{ uri: actor?.photo || '' }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <Text style={styles.actorName}>{actor?.name || name || 'Ator'}</Text>
              <Text style={styles.filmCount}>
                {filmography.length} título{filmography.length !== 1 ? 's' : ''} no catálogo
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Filmografia</Text>
            </View>
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  backButton: { padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.full },
  btnFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  headerTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '600' },
  profile: { alignItems: 'center', paddingVertical: Spacing.xxl },
  photo: { width: scale(160), height: scale(160), borderRadius: scale(80), backgroundColor: Colors.surface },
  actorName: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700', marginTop: Spacing.lg, textAlign: 'center' },
  filmCount: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, marginTop: Spacing.sm },
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', marginBottom: Spacing.lg },
  grid: { paddingHorizontal: Spacing.xl, paddingBottom: 80 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
});
