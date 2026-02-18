import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  InteractionManager,
  FlatList,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useMediaStore } from '../../stores/mediaStore';
import { filterMedia, sortMedia, getAllGenres, deduplicateMedia, deduplicateByName } from '../../services/mediaService';
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
  hydrateFromDisk,
} from '../../services/streamingService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { MediaItem } from '../../types';
import TVMediaCard from '../../components/TVMediaCard';
import TVMediaRow from '../../components/TVMediaRow';
import TVFilterBar from '../../components/TVFilterBar';
import { getAllTrending } from '../../services/trendingService';

// ─── Trending UI components ────────────────────────────────────────────────

/** Skeleton placeholder shown while trending data loads */
const TrendingSkeleton = memo(() => (
  <View style={skeletonStyles.section}>
    <View style={skeletonStyles.header}>
      <Text style={skeletonStyles.title}>🔥 Tendências</Text>
      <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: Spacing.md }} />
    </View>
    <View style={skeletonStyles.row}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={skeletonStyles.card} />
      ))}
    </View>
  </View>
));
TrendingSkeleton.displayName = 'TrendingSkeleton';

/** A horizontal row of trending items — no "Ver tudo" button needed */
const TrendingRow = memo(({ title, items }: { title: string; items: MediaItem[] }) => {
  if (items.length === 0) return null;
  return (
    <View style={trendingStyles.container}>
      <View style={trendingStyles.header}>
        <View style={trendingStyles.titleRow}>
          <Text style={trendingStyles.title}>{title}</Text>
          <View style={trendingStyles.badge}>
            <Text style={trendingStyles.badgeText}>{items.length}</Text>
          </View>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={trendingStyles.list}
        renderItem={({ item }) => <TVMediaCard item={item} size="medium" />}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
      />
    </View>
  );
});
TrendingRow.displayName = 'TrendingRow';

// ────────────────────────────────────────────────────────────────────────────

const ADULT_CATEGORY_IDS = [
  'hot-adultos-bella-da-semana',
  'hot-adultos-legendado',
  'hot-adultos',
];

const BG_SYNC_INTERVAL = 5000;
const SEARCH_DEBOUNCE = 600;
const MAX_GRID_RESULTS = 500;

type CategoryRowData = {
  id: string;
  name: string;
  items: MediaItem[];
};

export default function MoviesScreen() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Map<string, MediaItem[]>>(new Map());
  const [totalLoaded, setTotalLoaded] = useState(0);
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

  // Trending
  const [trendingToday, setTrendingToday] = useState<MediaItem[]>([]);
  const [trendingWeek, setTrendingWeek] = useState<MediaItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const trendingLoadedRef = useRef(false);

  const lastSyncRef = useRef(0);
  const mountedRef = useRef(true);
  const catalogLoadedRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchActiveRef = useRef(false);

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
        if (activeSort) results = sortMedia(results, activeSort);
        results = deduplicateMedia(results); // Deduplicate search results
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

  useEffect(() => { 
    InteractionManager.runAfterInteractions(() => {
      if (mountedRef.current) loadCatalog(false);
    });
  }, [adultUnlocked]);

  const syncFromCache = useCallback(() => {
    if (!mountedRef.current || isSearchActiveRef.current) return;
    const now = Date.now();
    if (now - lastSyncRef.current < BG_SYNC_INTERVAL) return;
    lastSyncRef.current = now;
    setCategories(getAllLoadedCategories());
    setTotalLoaded(getTotalLoadedCount());
  }, []);

  // Load trending lazily — never blocks catalog display
  const loadTrending = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { today, week } = await getAllTrending();
      if (mountedRef.current) {
        setTrendingToday(today);
        setTrendingWeek(week);
      }
    } catch {
      // Fail silently — trending is non-critical
    } finally {
      if (mountedRef.current) setTrendingLoading(false);
    }
  }, []);

  // Start trending load once the first catalog batch is done (loading → false)
  useEffect(() => {
    if (!loading && !trendingLoadedRef.current) {
      trendingLoadedRef.current = true;
      InteractionManager.runAfterInteractions(() => {
        if (mountedRef.current) loadTrending();
      });
    }
  }, [loading, loadTrending]);

  const startBgLoad = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      if (!mountedRef.current) return;
      setBgLoading(true);
      startBackgroundLoading(() => {
        if (mountedRef.current) syncFromCache();
      }).then(() => {
        if (mountedRef.current) {
          setCategories(getAllLoadedCategories());
          setTotalLoaded(getTotalLoadedCount());
          setBgLoading(false);
        }
      });
    });
  }, [syncFromCache]);

  const loadCatalog = async (isRefresh: boolean) => {
    if (!isRefresh && !catalogLoadedRef.current) await hydrateFromDisk();
    const cachedCategories = getAllLoadedCategories();
    const cachedCount = getTotalLoadedCount();
    if (cachedCategories.size > 0 && !isRefresh) {
      setCategories(cachedCategories);
      setTotalLoaded(cachedCount);
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
      setTotalLoaded(getTotalLoadedCount());
      catalogLoadedRef.current = true;
      startBgLoad();
    } catch (e) {
      console.error('Erro ao carregar catálogo:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

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

  const allItems = useMemo(() => {
    let total = 0;
    categories.forEach(catItems => { total += catItems.length; });
    const items = new Array<MediaItem>(total);
    let idx = 0;
    categories.forEach(catItems => {
      for (let i = 0; i < catItems.length; i++) items[idx++] = catItems[i];
    });
    return deduplicateMedia(items);
  }, [categories]);

  const genres = useMemo(() => getAllGenres(allItems), [allItems]);

  const filteredItems = useMemo(() => {
    if (debouncedQuery.trim()) return [];
    try {
      let items = allItems;
      if (activeFilter !== 'all') items = filterMedia(items, activeFilter);
      if (activeGenre) items = filterMedia(items, undefined, activeGenre);
      items = sortMedia(items, activeSort);
      if (items.length > MAX_GRID_RESULTS) items = items.slice(0, MAX_GRID_RESULTS);
      return items;
    } catch { return []; }
  }, [allItems, debouncedQuery, activeFilter, activeGenre, activeSort]);

  const gridData = debouncedQuery.trim() ? searchResults : filteredItems;
  const showGrid = debouncedQuery.trim() || activeFilter !== 'all' || activeGenre;

  const renderCategoryRow = useCallback(({ item }: { item: CategoryRowData }) => (
    <TVMediaRow title={item.name} categoryId={item.id} items={item.items} />
  ), []);

  const renderGridItem = useCallback(({ item }: { item: MediaItem }) => (
    <TVMediaCard item={item} size="small" />
  ), []);

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
            onPress={() => { stopLoading(); clearAllCaches(); setCategories(new Map()); setTotalLoaded(0); catalogLoadedRef.current = false; loadCatalog(true); }}
          >
            <Ionicons name="refresh" size={22} color={Colors.text} />
          </TVPressable>
        </View>
      </View>

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

      <TVFilterBar genres={genres} />

      {showGrid ? (
        <FlashList<MediaItem>
          key="grid"
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={TV.mediaColumns}
          renderItem={renderGridItem}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={TV.mediaCardHeight + Spacing.md}
          ListHeaderComponent={
            <Text style={styles.resultsText}>{gridData.length} resultados</Text>
          }
          ListFooterComponent={
            bgLoading ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.footerText}>Carregando mais...</Text>
              </View>
            ) : null
          }
          {...({} as any)}
        />
      ) : (
        <FlashList<CategoryRowData>
          key="rows"
          data={categoryData}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryRow}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={TV.mediaCardHeight + 80}
          ListHeaderComponent={
            trendingLoading ? (
              <TrendingSkeleton />
            ) : (trendingToday.length > 0 || trendingWeek.length > 0) ? (
              <>
                <TrendingRow title="🔥 Tendências de Hoje" items={trendingToday} />
                <TrendingRow title="📅 Tendências da Semana" items={trendingWeek} />
              </>
            ) : null
          }
          ListFooterComponent={
            bgLoading ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.footerText}>Carregando mais...</Text>
              </View>
            ) : null
          }
          {...({} as any)}
        />
      )}
    </View>
  );
}

// Skeleton styles
const skeletonStyles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, marginBottom: Spacing.md,
  },
  title: { color: Colors.textSecondary, fontSize: Typography.h3.fontSize, fontWeight: '700' },
  row: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  card: {
    width: TV.mediaCardWidth,
    height: TV.mediaCardHeight,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    opacity: 0.4,
  },
});

// Trending row styles
const trendingStyles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  header: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: {
    color: Colors.text,
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.text,
    fontSize: Typography.label.fontSize,
    fontWeight: '700',
  },
  list: { paddingHorizontal: Spacing.xl },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: Spacing.md, fontSize: Typography.body.fontSize },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 4 },
  headerBtn: { padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.full },
  reloadBtn: { backgroundColor: Colors.primary },
  headerBtnFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, marginHorizontal: Spacing.xl, marginBottom: Spacing.md, height: 56, gap: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: Typography.body.fontSize },
  grid: { paddingHorizontal: Spacing.xl },
  gridRow: { gap: Spacing.md, marginBottom: Spacing.md },
  resultsText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginBottom: Spacing.md },
  footerLoading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  footerText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
});
