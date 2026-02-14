import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useChannelStore } from '../../stores/channelStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { initEPGService, prefetchEPG, loadEPGsWithProgress, hasEPGMapping } from '../../services/epgService';
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
  const { adultUnlocked, showEPG } = useSettingsStore();
  const [epgLoading, setEpgLoading] = useState(true);
  const [epgProgress, setEpgProgress] = useState<{ current: number; total: number } | null>(null);

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

  // Bulk Prefetch EPG - Load ALL visible channels before showing
  useEffect(() => {
    // If EPG is disabled, we are "ready" immediately
    if (!showEPG) {
      setEpgLoading(false);
      return;
    }

    // Reset status when channels list changes (filtering/searching)
    setEpgLoading(true);
    prefetchedRef.current = false; // Reset ref just in case

    if (channels.length > 0) {
      const channelIds = channels.filter(c => hasEPGMapping(c.id)).map(c => c.id);
      
      if (channelIds.length === 0) {
        setEpgLoading(false);
        return;
      }

      console.log(`[BulkEPG] Loading for ${channelIds.length} channels...`);
      setEpgProgress({ current: 0, total: channelIds.length });
      
      const startTime = Date.now();
      const MIN_LOADING_TIME = 1000; // Force at least 1 second loading

      // Load with progress
      // We import check to see if loadEPGsWithProgress is available (it is now)
      loadEPGsWithProgress(channelIds, (current, total) => {
        if (mountedRef.current) {
          setEpgProgress({ current, total });
        }
      }).then(async () => {
        if (!mountedRef.current) return;
        
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_LOADING_TIME) {
          await new Promise(r => setTimeout(r, MIN_LOADING_TIME - elapsed));
        }

        if (mountedRef.current) {
           console.log('[BulkEPG] Done!');
           setEpgLoading(false);
           setEpgProgress(null);
        }
      }).catch(err => {
         console.warn('[BulkEPG] Error:', err);
         if (mountedRef.current) {
            setEpgLoading(false);
            setEpgProgress(null);
         }
      });
    } else {
      setEpgLoading(false);
    }
  }, [channels, showEPG]);

  // Use a ref to track mounted state
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSelectCategory = useCallback((category: string, index: number) => {
    setCategory(category as any);
    setSelectedCategoryIndex(index);
    setSearchQuery('');
    prefetchedRef.current = false;
  }, [setCategory]);

  const renderChannel = useCallback(({ item }: { item: Channel }) => (
    <TVChannelCard channel={item} epgReady={!epgLoading} />
  ), [epgLoading]);

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
          
          {/* EPG Loading Indicator - Top Right */}
          {epgProgress && (
            <View style={{
              position: 'absolute',
              top: 20,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              zIndex: 9999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}>
              <Text style={{ color: '#fff', fontSize: 14, userSelect: 'none', fontWeight: 'bold' }}>
                EPG: {epgProgress.current}/{epgProgress.total}
              </Text>
            </View>
          )}

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
    paddingVertical: Spacing.md, // Added to prevent clipping on focus scale
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
