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
import { initEPGService } from '../../services/epgService';
import type { Channel } from '../../types';
import TVChannelCard from '../../components/TVChannelCard';
import TVChannelListItem from '../../components/TVChannelListItem';

const NUM_COLS = 3;
const GRID_PADDING = Spacing.xl;
const COL_GAP = Spacing.lg;
const SCALE_PAD = 6;
// Largura recolhida do sidebar (deve ser igual ao SIDEBAR_COLLAPSED em _layout.tsx)
const SIDEBAR_COLLAPSED_W = TV.sidebarCollapsedWidth + 20;

export default function HomeScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
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

  // Init EPG service once (loads disk cache quickly)
  useEffect(() => {
    initEPGService();
  }, []);

  const categories = getCategories(adultUnlocked);
  const allChannels = getFilteredChannels(adultUnlocked, favorites);

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

  // Ao retornar do player, scrolla para o último canal assistido
  useFocusEffect(useCallback(() => {
    if (!lastWatchedId) return;
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
    return <TVChannelCard channel={item} cardWidth={cardWidth} />;
  }, [channelViewMode, cardWidth]);

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Header — título removido para ganhar espaço */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>{channels.length} canais</Text>
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
          // Fallback apenas para o scroll de retorno do player
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
          }, 300);
        }}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
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
});
