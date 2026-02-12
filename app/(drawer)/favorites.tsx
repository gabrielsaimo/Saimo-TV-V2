import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getAllChannels } from '../../data/channels';
import { getMediaById } from '../../services/mediaService';
import TVChannelCard from '../../components/TVChannelCard';
import TVMediaCard from '../../components/TVMediaCard';
import type { MediaItem } from '../../types';

export default function FavoritesScreen() {
  const { favorites: channelFavorites } = useFavoritesStore();
  const { favorites: mediaFavorites } = useMediaStore();
  const [favoriteMedia, setFavoriteMedia] = useState<MediaItem[]>([]);

  const allChannels = getAllChannels(true);
  const favoriteChannels = allChannels.filter(ch => channelFavorites.includes(ch.id));

  useEffect(() => {
    async function loadMedia() {
      if (mediaFavorites.length === 0) { setFavoriteMedia([]); return; }
      const items: MediaItem[] = [];
      for (const fav of mediaFavorites) {
        const item = await getMediaById(fav.id);
        if (item) items.push(item);
      }
      setFavoriteMedia(items);
    }
    loadMedia();
  }, [mediaFavorites]);

  const totalCount = favoriteChannels.length + favoriteMedia.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
        <Text style={styles.subtitle}>{totalCount} itens</Text>
      </View>

      {totalCount === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nenhum favorito</Text>
          <Text style={styles.emptySubtitle}>
            Use o controle remoto para adicionar canais,{'\n'}filmes ou séries aos favoritos
          </Text>
          <Pressable
            style={({ focused }) => [styles.emptyButton, focused && styles.emptyButtonFocused]}
            onPress={() => {}}
            hasTVPreferredFocus
          >
            <Text style={styles.emptyButtonText}>Explorar conteúdo</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {favoriteMedia.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Filmes e Séries ({favoriteMedia.length})</Text>
              <FlatList
                data={favoriteMedia}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
                renderItem={({ item }) => <TVMediaCard item={item} size="medium" />}
              />
            </View>
          )}

          {favoriteChannels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Canais ({favoriteChannels.length})</Text>
              <FlatList
                data={favoriteChannels}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
                renderItem={({ item }) => <TVChannelCard channel={item} />}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 4 },
  content: { paddingBottom: Spacing.xxxl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', marginBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: Colors.text, fontSize: Typography.h2.fontSize, fontWeight: '600', marginTop: Spacing.lg },
  emptySubtitle: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 28 },
  emptyButton: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  emptyButtonFocused: { borderWidth: 3, borderColor: Colors.text },
  emptyButtonText: { color: '#000', fontWeight: '600', fontSize: Typography.body.fontSize },
});
