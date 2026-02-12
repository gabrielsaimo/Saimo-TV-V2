import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useMediaStore } from '../../stores/mediaStore';
import { filterMedia, sortMedia } from '../../services/mediaService';
import {
  CATEGORIES,
  fetchCategoryPage,
  PARALLEL_BATCH_SIZE,
  startBackgroundLoading,
  stopLoading,
  getAllLoadedCategories,
  getTotalLoadedCount,
  clearAllCaches,
  searchInLoadedData,
} from '../../services/streamingService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { MediaItem, MediaFilterType, MediaSortType } from '../../types';
import TVMediaCard from '../../components/TVMediaCard';
import TVMediaRow from '../../components/TVMediaRow';

const ADULT_CATEGORY_IDS = [
  'hot-adultos-bella-da-semana',
  'hot-adultos-legendado',
  'hot-adultos',
];

const BG_SYNC_INTERVAL = 12000;
const SEARCH_DEBOUNCE = 600;
const MAX_GRID_RESULTS = 200;

type CategoryRowData = {
  id: string;
  name: string;
  items: MediaItem[];
};

const TYPE_FILTERS: { key: MediaFilterType; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'movie', label: 'Filmes' },
  { key: 'tv', label: 'Séries' },
];

const SORT_OPTIONS: { key: MediaSortType; label: string; icon: string }[] = [
  { key: 'rating', label: 'Nota', icon: 'star' },
  { key: 'popularity', label: 'Populares', icon: 'trending-up' },
  { key: 'year', label: 'Recentes', icon: 'calendar' },
  { key: 'name', label: 'A-Z', icon: 'text' },
];

export default function MoviesScreen() {
  // Initialize state directly from cache for instant display
  const [loading, setLoading] = useState(() => getAllLoadedCategories().size === 0);
  const [categories, setCategories] = useState<Map<string, MediaItem[]>>(() => getAllLoadedCategories());
  const [totalLoaded, setTotalLoaded] = useState(() => getTotalLoadedCount());
  const [bgLoading, setBgLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const {
    activeFilter, activeSort, activeGenre,
    setFilter, setSort, setGenre, clearFilters
  } = useMediaStore();

  const { adultUnlocked } = useSettingsStore();

  const lastSyncRef = useRef(0);
  const mountedRef = useRef(true);
  const catalogLoadedRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchActiveRef = useRef(false);
  const totalLoadedRef = useRef(totalLoaded);
  // Refs de cache: declarados ANTES dos useMemo que os usam (evita TDZ ReferenceError)
  const allItemsCacheRef = useRef<{ size: number; items: MediaItem[] }>({ size: -1, items: [] });
  const genresCacheRef = useRef<{ size: number; genres: string[] }>({ size: 0, genres: [] });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopLoading();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Search debounce
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeoutId = setTimeout(() => {
      try {
        let results = searchInLoadedData(debouncedQuery);
        if (activeFilter !== 'all') results = filterMedia(results, activeFilter);
        if (activeGenre) results = filterMedia(results, undefined, activeGenre);
        results = sortMedia(results, activeSort);
        if (results.length > MAX_GRID_RESULTS) results = results.slice(0, MAX_GRID_RESULTS);
        if (mountedRef.current) {
          setSearchResults(results);
          setSearching(false);
        }
      } catch {
        if (mountedRef.current) {
          setSearchResults([]);
          setSearching(false);
        }
      }
    }, 16);
    return () => clearTimeout(timeoutId);
  }, [debouncedQuery, activeFilter, activeGenre, activeSort]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchInput(text);
    isSearchActiveRef.current = !!text.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) {
      setDebouncedQuery('');
      isSearchActiveRef.current = false;
      const loaded = getAllLoadedCategories();
      setCategories(loaded);
      setTotalLoaded(getTotalLoadedCount());
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setDebouncedQuery(text);
    }, SEARCH_DEBOUNCE);
  }, []);

  useEffect(() => { loadCatalog(false); }, [adultUnlocked]);

  // Only update UI when total count actually changed (avoids redundant re-renders)
  const syncFromCache = useCallback(() => {
    if (!mountedRef.current || isSearchActiveRef.current) return;
    const now = Date.now();
    if (now - lastSyncRef.current < BG_SYNC_INTERVAL) return;
    lastSyncRef.current = now;
    const newCount = getTotalLoadedCount();
    if (newCount === totalLoadedRef.current) return;
    totalLoadedRef.current = newCount;
    setCategories(getAllLoadedCategories());
    setTotalLoaded(newCount);
  }, []);

  const startBgLoad = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      if (!mountedRef.current) return;
      setBgLoading(true);
      startBackgroundLoading(() => {
        if (mountedRef.current) syncFromCache();
      }).then(() => {
        if (mountedRef.current) {
          setCategories(getAllLoadedCategories());
          const count = getTotalLoadedCount();
          totalLoadedRef.current = count;
          setTotalLoaded(count);
          setBgLoading(false);
        }
      });
    });
  }, [syncFromCache]);

  const loadCatalog = async (isRefresh: boolean) => {
    const cachedCategories = getAllLoadedCategories();
    const cachedCount = getTotalLoadedCount();
    if (cachedCategories.size > 0 && !isRefresh) {
      setCategories(cachedCategories);
      setTotalLoaded(cachedCount);
      totalLoadedRef.current = cachedCount;
      setLoading(false);
      startBgLoad();
      catalogLoadedRef.current = true;
      return;
    }
    setLoading(true);
    try {
      const relevantCategories = CATEGORIES.filter(cat => {
        if (!adultUnlocked && ADULT_CATEGORY_IDS.includes(cat.id)) return false;
        return true;
      });
      await stopLoading();
      for (let i = 0; i < relevantCategories.length; i += PARALLEL_BATCH_SIZE) {
        const batch = relevantCategories.slice(i, i + PARALLEL_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (cat) => {
            try {
              const items = await fetchCategoryPage(cat.id, 1);
              return { id: cat.id, items };
            } catch { return { id: cat.id, items: [] }; }
          })
        );
        if (!mountedRef.current) return;
        setCategories(prev => {
          const newMap = new Map(prev);
          batchResults.forEach(({ id, items }) => {
            if (items.length > 0) newMap.set(id, items);
          });
          return newMap;
        });
        if (i === 0) setLoading(false);
      }
      const count = getTotalLoadedCount();
      totalLoadedRef.current = count;
      setTotalLoaded(count);
      catalogLoadedRef.current = true;
      startBgLoad();
    } catch (e) {
      console.error('Erro ao carregar catálogo:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const showGrid = !!(debouncedQuery.trim() || activeFilter !== 'all' || activeGenre || activeSort !== 'rating');

  const categoryData = useMemo((): CategoryRowData[] => {
    return CATEGORIES
      .filter(cat => {
        if (!adultUnlocked && ADULT_CATEGORY_IDS.includes(cat.id)) return false;
        const items = categories.get(cat.id);
        return items && items.length > 0;
      })
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        items: (categories.get(cat.id) || []).slice(0, 15),
      }));
  }, [categories, adultUnlocked]);

  // Only compute flat array when grid mode is active (avoids work in row mode)
  // Deduplicates by title. Uses ref cache so the O(65K) loop só roda quando
  // o número de categorias muda — não a cada sync de 8s com mesmo tamanho.
  const allItems = useMemo(() => {
    if (!showGrid) return [];
    // Retorna cache se mesmo número de categorias (mapa referência mudou mas conteúdo igual)
    if (categories.size === allItemsCacheRef.current.size && allItemsCacheRef.current.items.length > 0) {
      return allItemsCacheRef.current.items;
    }
    const seenTitles = new Set<string>();
    const items: MediaItem[] = [];
    categories.forEach(catItems => {
      for (const item of catItems) {
        const title = (item.tmdb?.title || item.name).toLowerCase().trim();
        if (seenTitles.has(title)) continue;
        seenTitles.add(title);
        items.push(item);
      }
    });
    allItemsCacheRef.current = { size: categories.size, items };
    return items;
  }, [categories, showGrid]);

  const filteredItems = useMemo(() => {
    if (!showGrid || debouncedQuery.trim()) return [];
    try {
      let items = allItems;
      if (activeFilter !== 'all') items = filterMedia(items, activeFilter);
      if (activeGenre) items = filterMedia(items, undefined, activeGenre);
      items = sortMedia(items, activeSort);
      if (items.length > MAX_GRID_RESULTS) items = items.slice(0, MAX_GRID_RESULTS);
      return items;
    } catch { return []; }
  }, [allItems, showGrid, debouncedQuery, activeFilter, activeGenre, activeSort]);

  // Available genres - only recompute when category count changes (not on item updates)
  const availableGenres = useMemo(() => {
    if (categories.size === 0) return [];
    if (categories.size === genresCacheRef.current.size && genresCacheRef.current.genres.length > 0) {
      return genresCacheRef.current.genres;
    }
    const genres = new Set<string>();
    categories.forEach(items => {
      for (const item of items) {
        item.tmdb?.genres?.forEach(g => genres.add(g));
      }
    });
    const sorted = Array.from(genres).sort();
    genresCacheRef.current = { size: categories.size, genres: sorted };
    return sorted;
  }, [categories]);

  const gridData = debouncedQuery.trim() ? searchResults : filteredItems;

  // Chunk grid data into rows for ScrollView
  const gridRows = useMemo(() => {
    const rows: MediaItem[][] = [];
    for (let i = 0; i < gridData.length; i += TV.mediaColumns) {
      rows.push(gridData.slice(i, i + TV.mediaColumns));
    }
    return rows;
  }, [gridData]);

  const hasActiveFilters = activeFilter !== 'all' || activeGenre || activeSort !== 'rating';

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando catálogo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Ondmed</Text>
          <Text style={styles.subtitle}>
            {categories.size} categorias • {totalLoaded} títulos
            {bgLoading ? ' (carregando...)' : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TVPressable
            style={styles.headerBtn}
            focusedStyle={styles.headerBtnFocused}
            focusScale={1.15}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={24} color={Colors.text} />
          </TVPressable>
          <TVPressable
            style={[styles.headerBtn, styles.reloadBtn]}
            focusedStyle={styles.headerBtnFocused}
            focusScale={1.15}
            onPress={() => { stopLoading(); clearAllCaches(); setCategories(new Map()); setTotalLoaded(0); totalLoadedRef.current = 0; catalogLoadedRef.current = false; loadCatalog(true); }}
          >
            <Ionicons name="refresh" size={22} color={Colors.text} />
          </TVPressable>
        </View>
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={22} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar filmes e séries..."
            placeholderTextColor={Colors.textSecondary}
            value={searchInput}
            onChangeText={handleSearchChange}
            autoFocus
          />
        </View>
      )}

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {/* Type filters */}
          {TYPE_FILTERS.map(f => (
            <TVPressable
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              focusedStyle={styles.filterChipFocused}
              focusScale={1.08}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TVPressable>
          ))}

          <View style={styles.filterSeparator} />

          {/* Sort options */}
          {SORT_OPTIONS.map(s => (
            <TVPressable
              key={s.key}
              style={[styles.filterChip, activeSort === s.key && styles.filterChipActive]}
              focusedStyle={styles.filterChipFocused}
              focusScale={1.08}
              onPress={() => setSort(s.key)}
            >
              <Ionicons
                name={s.icon as any}
                size={16}
                color={activeSort === s.key ? Colors.text : Colors.textSecondary}
              />
              <Text style={[styles.filterText, activeSort === s.key && styles.filterTextActive]}>
                {s.label}
              </Text>
            </TVPressable>
          ))}

          {/* Clear filters */}
          {hasActiveFilters && (
            <>
              <View style={styles.filterSeparator} />
              <TVPressable
                style={[styles.filterChip, styles.clearChip]}
                focusedStyle={styles.filterChipFocused}
                focusScale={1.08}
                onPress={() => clearFilters()}
              >
                <Ionicons name="close-circle" size={16} color={Colors.error} />
                <Text style={[styles.filterText, { color: Colors.error }]}>Limpar</Text>
              </TVPressable>
            </>
          )}
        </ScrollView>
      </View>

      {/* Genre Bar */}
      {availableGenres.length > 0 && (
        <View style={styles.genreBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreList}
          >
            {availableGenres.map(genre => (
              <TVPressable
                key={genre}
                style={[styles.genreChip, activeGenre === genre && styles.genreChipActive]}
                focusedStyle={styles.genreChipFocused}
                focusScale={1.05}
                onPress={() => setGenre(activeGenre === genre ? null : genre)}
              >
                <Text style={[styles.genreText, activeGenre === genre && styles.genreTextActive]}>
                  {genre}
                </Text>
              </TVPressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {showGrid ? (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resultsText}>{gridData.length} resultados</Text>
          {searching && (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: Spacing.md }} />
          )}
          {gridRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map(item => (
                <TVMediaCard key={item.id} item={item} size="small" />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        // FlatList virtualiza as linhas: só renderiza ~5 rows visíveis ao invés de 55 de uma vez
        // Reduz de 825 TVMediaCards renderizados simultaneamente para ~75
        // Isso é crítico para Fire TV Lite (1GB RAM): menos memória, menos GC, menos hooks ativos
        <FlatList
          style={styles.contentScroll}
          data={categoryData}
          keyExtractor={item => item.id}
          renderItem={({ item: cat }) => (
            <TVMediaRow title={cat.name} categoryId={cat.id} items={cat.items} />
          )}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={100}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: Spacing.md, fontSize: Typography.body.fontSize },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 4 },
  headerBtn: { padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.full },
  reloadBtn: { backgroundColor: Colors.primary },
  headerBtnFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, marginHorizontal: Spacing.xl, marginBottom: Spacing.sm, height: 56, gap: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: Typography.body.fontSize },

  // Filter bar
  filterBar: {
    paddingVertical: Spacing.xs,
  },
  filterList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceVariant,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipFocused: {
    backgroundColor: 'rgba(99,102,241,0.3)',
  },
  filterText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  filterSeparator: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  clearChip: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },

  // Genre bar
  genreBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  genreList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  genreChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  genreChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
  },
  genreChipFocused: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderColor: Colors.primaryLight,
  },
  genreText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  genreTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },

  // Content area
  contentScroll: { flex: 1 },

  // Grid
  grid: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  gridRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  resultsText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginBottom: Spacing.md },
});
