import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useChannelStore } from '../../stores/channelStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { initEPGService, onEPGProgress, getEPGLoadedCount } from '../../services/epgService';
import { getTotalEPGChannels } from '../../data/epgMappings';
import { adultChannels as adultChannelsList } from '../../data/channels';
import type { Channel } from '../../types';
import TVChannelCard from '../../components/TVChannelCard';
import TVChannelListItem from '../../components/TVChannelListItem';

const NUM_COLS = 3;
const GRID_PADDING = Spacing.xl;
const COL_GAP = Spacing.lg;
const SCALE_PAD = 6;
// Largura recolhida do sidebar (deve ser igual ao SIDEBAR_COLLAPSED em _layout.tsx)
const SIDEBAR_COLLAPSED_W = TV.sidebarCollapsedWidth + 20;
// Quantos canais adultos adicionar por tick (lazy load)
const ADULT_BATCH = 50;

export default function HomeScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const {
    selectedCategory,
    setCategory,
    getFilteredChannels,
    getCategories,
    currentChannelId: lastWatchedId,
  } = useChannelStore();

  const { favorites } = useFavoritesStore();
  const { adultUnlocked, channelViewMode } = useSettingsStore();

  // ─── Lazy load de canais adultos ────────────────────────────────────────
  // Canais normais: instantâneos. Adultos: carregados em batches p/ não travar.
  const [loadedAdultCount, setLoadedAdultCount] = useState(0);

  useEffect(() => {
    if (!adultUnlocked) {
      setLoadedAdultCount(0);
      return;
    }
    const total = adultChannelsList.length;
    if (total === 0) return;

    // Primeiro batch imediatamente
    setLoadedAdultCount(ADULT_BATCH);
    if (total <= ADULT_BATCH) return;

    // Batches subsequentes a cada 100ms
    const interval = setInterval(() => {
      setLoadedAdultCount(prev => {
        const next = Math.min(prev + ADULT_BATCH, total);
        if (next >= total) clearInterval(interval);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [adultUnlocked]);

  // Init EPG service once (loads disk cache quickly)
  useEffect(() => {
    initEPGService();
  }, []);

  // ─── EPG loading progress ─────────────────────────────────────────────
  const TOTAL_EPG = getTotalEPGChannels();
  const [epgLoaded, setEpgLoaded] = useState(getEPGLoadedCount);
  useEffect(() => {
    const unsub = onEPGProgress(setEpgLoaded);
    return unsub;
  }, []);

  const categories = getCategories(adultUnlocked);

  // Canais normais (instantâneos) com filtro de categoria
  const regularChannels = getFilteredChannels(false, favorites);

  // Combina canais normais + adultos carregados (com filtro de categoria)
  const allChannels = useMemo(() => {
    if (!adultUnlocked || loadedAdultCount === 0) return regularChannels;

    let adultSlice = adultChannelsList.slice(0, loadedAdultCount);

    // Aplica filtro de categoria no slice adulto
    if (selectedCategory === 'Favoritos') {
      adultSlice = adultSlice.filter(ch => favorites.includes(ch.id));
    } else if (selectedCategory !== 'Todos' && selectedCategory !== 'Adulto') {
      adultSlice = []; // categoria não-adulta selecionada → esconde adultos
    }

    // Categoria "Adulto" → mostra só adultos
    if (selectedCategory === 'Adulto') return adultSlice;

    return [...regularChannels, ...adultSlice];
  }, [adultUnlocked, loadedAdultCount, regularChannels, selectedCategory, favorites]);

  const channels = useMemo(() => {
    if (!searchQuery.trim()) return allChannels;
    const query = searchQuery.toLowerCase().trim();
    return allChannels.filter(ch =>
      ch.name.toLowerCase().includes(query) ||
      ch.category.toLowerCase().includes(query)
    );
  }, [allChannels, searchQuery]);

  // Ref dos canais para o useFocusEffect (evita closure velho)
  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  // Ao retornar do player: scrolla para o último canal e ativa foco nativo nele
  useFocusEffect(useCallback(() => {
    if (!lastWatchedId) return;
    // Snapshot do id no momento do foco (não muda enquanto o usuário está no player)
    setFocusTargetId(lastWatchedId);
    const idx = channelsRef.current.findIndex(ch => ch.id === lastWatchedId);
    if (idx < 0) return;
    const t = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: false });
    }, 150);
    return () => clearTimeout(t);
  }, [lastWatchedId]));

  // Largura dinâmica do card para preencher 3 colunas no espaço disponível
  const availableWidth = screenWidth - SIDEBAR_COLLAPSED_W;
  const cardWidth = Math.max(
    120,
    Math.floor((availableWidth - GRID_PADDING * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS) - SCALE_PAD * 2,
  );

  const handleSelectCategory = useCallback((category: string, index: number) => {
    setCategory(category as any);
    setSelectedCategoryIndex(index);
    setSearchQuery('');
  }, [setCategory]);

  const renderChannel = useCallback(({ item }: { item: Channel }) => {
    if (channelViewMode === 'list') {
      return <TVChannelListItem channel={item} />;
    }
    return (
      <TVChannelCard
        channel={item}
        cardWidth={cardWidth}
        hasTVPreferredFocus={item.id === focusTargetId}
      />
    );
  }, [channelViewMode, cardWidth, focusTargetId]);

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>{channels.length} canais</Text>
        {/* EPG loading badge — desaparece quando tudo estiver carregado */}
        {epgLoaded < TOTAL_EPG && (
          <View style={styles.epgBadge}>
            <View style={styles.epgDot} />
            <Text style={styles.epgBadgeText}>
              EPG {epgLoaded}/{TOTAL_EPG}
            </Text>
          </View>
        )}
        {epgLoaded >= TOTAL_EPG && TOTAL_EPG > 0 && (
          <View style={[styles.epgBadge, styles.epgBadgeDone]}>
            <Text style={styles.epgBadgeDoneText}>EPG ✓</Text>
          </View>
        )}
      </View>

      {/* Category Bar */}
      <View style={styles.categoryBar}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item, index }) => (
            <TVPressable
              style={[
                styles.categoryChip,
                selectedCategory === item && styles.categoryChipActive,
              ]}
              focusedStyle={styles.categoryChipFocused}
              focusScale={1.1}
              onPress={() => handleSelectCategory(item, index)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TVPressable>
          )}
        />
      </View>

      {/* Channel Grid ou Lista */}
      <FlatList
        ref={flatListRef}
        key={channelViewMode}
        data={channels}
        keyExtractor={keyExtractor}
        numColumns={channelViewMode === 'grid' ? NUM_COLS : 1}
        renderItem={renderChannel}
        contentContainerStyle={channelViewMode === 'grid' ? styles.grid : styles.list}
        columnWrapperStyle={channelViewMode === 'grid' ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={9}
        windowSize={8}
        removeClippedSubviews
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
          }, 300);
        }}
        ListFooterComponent={
          adultUnlocked && loadedAdultCount < adultChannelsList.length ? (
            <View style={styles.loadingFooter}>
              <Text style={styles.loadingFooterText}>
                Carregando canais adultos… {loadedAdultCount}/{adultChannelsList.length}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
  },
  epgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  epgDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
  },
  epgBadgeText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  epgBadgeDone: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  epgBadgeDoneText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryBar: {
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceVariant,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
  },
  categoryChipFocused: {
    backgroundColor: 'rgba(99,102,241,0.25)',
  },
  categoryText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  grid: {
    padding: Spacing.xl,
  },
  gridRow: {
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  loadingFooter: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingFooterText: {
    color: Colors.textMuted,
    fontSize: Typography.caption.fontSize,
  },
});
