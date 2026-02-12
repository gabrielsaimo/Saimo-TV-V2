import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { loadCategory, loadMoreForCategory } from '../../services/mediaService';
import { categoryHasMore } from '../../services/streamingService';
import { useMediaStore } from '../../stores/mediaStore';
import type { MediaItem } from '../../types';
import TVMediaCard from '../../components/TVMediaCard';
import { filterMedia, sortMedia, getAllGenres } from '../../services/mediaService';

export default function TVCategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const {
    activeFilter, activeSort, activeGenre,
    setFilter, setSort, setGenre, clearFilters,
  } = useMediaStore();

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      const data = await loadCategory(id);
      setAllItems(data);
      setHasMore(categoryHasMore(id));
      setLoading(false);
    }
    load();
  }, [id]);

  const handleBack = () => router.back();

  const genres = useMemo(() => getAllGenres(allItems), [allItems]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (activeFilter !== 'all') result = filterMedia(result, activeFilter);
    if (activeGenre) result = filterMedia(result, undefined, activeGenre);
    result = sortMedia(result, activeSort);
    return result;
  }, [allItems, activeFilter, activeGenre, activeSort]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !id) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreForCategory(id);
      setAllItems(result.items);
      setHasMore(result.hasMore);
    } catch (e) {
      console.warn('Erro ao carregar mais:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, id]);

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footer}>
        {loadingMore ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={styles.footerText}>
            {filteredItems.length} títulos carregados
          </Text>
        )}
      </View>
    );
  }, [hasMore, loadingMore, filteredItems.length]);

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

      {/* Header */}
      <View style={styles.header}>
        <TVPressable
          style={styles.backButton}
          focusScale={1.15}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TVPressable>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{name || 'Categoria'}</Text>
          <Text style={styles.count}>
            {filteredItems.length} títulos{hasMore ? '+' : ''}
          </Text>
        </View>
        <View style={{ width: 52 }} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {['all', 'movie', 'tv'].map((f) => (
          <TVPressable
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f && styles.filterChipActive,
            ]}
            focusedStyle={styles.filterChipFocused}
            focusScale={1.1}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todos' : f === 'movie' ? 'Filmes' : 'Séries'}
            </Text>
          </TVPressable>
        ))}
        {activeFilter !== 'all' && (
          <TVPressable
            style={styles.clearBtn}
            focusScale={1.15}
            onPress={clearFilters}
          >
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TVPressable>
        )}
      </View>

      {/* Grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={TV.mediaColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TVMediaCard item={item} size="small" />
        )}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
  },
  backButton: { padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.full },
  titleContainer: { flex: 1, alignItems: 'center' },
  title: { color: Colors.text, fontSize: Typography.h2.fontSize, fontWeight: '700' },
  count: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  btnFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md, gap: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  filterText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Typography.caption.fontSize },
  filterTextActive: { color: '#000' },
  clearBtn: { padding: Spacing.md },
  grid: { paddingHorizontal: Spacing.xl, paddingBottom: 80 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
});
