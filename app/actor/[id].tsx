import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Colors';
import { loadInitialCategories, getMediaByActor } from '../../services/mediaService';
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
      const actorMedia = getMediaByActor(actorId, allItems);
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ focused }) => [styles.backButton, focused && styles.btnFocused]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.text} />
          </Pressable>
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

        {/* Filmography */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filmografia</Text>
          <View style={styles.grid}>
            {filmography.map((item) => (
              <TVMediaCard key={item.id} item={item} size="small" />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  backButton: { padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.full },
  btnFocused: { borderWidth: 3, borderColor: Colors.primary, borderRadius: BorderRadius.full },
  headerTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '600' },
  profile: { alignItems: 'center', paddingVertical: Spacing.xxl },
  photo: { width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.surface },
  actorName: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700', marginTop: Spacing.lg, textAlign: 'center' },
  filmCount: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, marginTop: Spacing.sm },
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', marginBottom: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
});
