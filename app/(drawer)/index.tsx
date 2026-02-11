import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import { useChannelStore } from '../../stores/channelStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { initEPGService, prefetchEPG, hasEPGMapping } from '../../services/epgService';
import type { Channel } from '../../types';
import TVChannelCard from '../../components/TVChannelCard';

export default function HomeScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const prefetchedRef = useRef(false);

  const {
    selectedCategory,
    setCategory,
    getFilteredChannels,
    getCategories,
  } = useChannelStore();

  const { favorites } = useFavoritesStore();
  const { adultUnlocked } = useSettingsStore();

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

  // Prefetch EPG
  useEffect(() => {
    if (channels.length > 0 && !prefetchedRef.current) {
      prefetchedRef.current = true;
      const channelIds = channels.filter(c => hasEPGMapping(c.id)).map(c => c.id);
      if (channelIds.length === 0) return;

      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const loadAll = async () => {
          for (let i = 0; i < channelIds.length; i += 3) {
            if (cancelled) return;
            const batch = channelIds.slice(i, i + 3);
            await prefetchEPG(batch);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        };
        loadAll();
      });

      return () => {
        cancelled = true;
        task.cancel();
      };
    }
  }, [channels]);

  const handleSelectCategory = useCallback((category: string, index: number) => {
    setCategory(category as any);
    setSelectedCategoryIndex(index);
    setSearchQuery('');
    prefetchedRef.current = false;
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
            <Pressable
              style={({ focused }) => [
                styles.categoryChip,
                selectedCategory === item && styles.categoryChipActive,
                focused && styles.categoryChipFocused,
              ]}
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
            </Pressable>
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
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceHover,
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
