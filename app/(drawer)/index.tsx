import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useChannelStore } from '../../stores/channelStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { initEPGService } from '../../services/epgService';
import type { Channel } from '../../types';
import TVChannelCard from '../../components/TVChannelCard';

export default function HomeScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);

  const {
    selectedCategory,
    setCategory,
    getFilteredChannels,
    getCategories,
  } = useChannelStore();

  const { favorites } = useFavoritesStore();
  const { adultUnlocked, showEPG } = useSettingsStore();

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

  const handleSelectCategory = useCallback((category: string, index: number) => {
    setCategory(category as any);
    setSelectedCategoryIndex(index);
    setSearchQuery('');
  }, [setCategory]);

  const renderChannel = useCallback(({ item }: { item: Channel }) => (
    <TVChannelCard channel={item} />
  ), []);

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TV ao Vivo</Text>
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

      {/* Channel Grid */}
      <FlatList
        data={channels}
        keyExtractor={keyExtractor}
        numColumns={TV.channelColumns}
        renderItem={renderChannel}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.h1.fontSize,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    marginTop: 4,
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
});
