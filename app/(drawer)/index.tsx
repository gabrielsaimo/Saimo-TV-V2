import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';

import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useChannelStore } from '../../stores/channelStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  initEPGService,
  prefetchEPG,
  hasEPGMapping,
  setEPGTotalChannels,
  onEPGProgress,
} from '../../services/epgService';
import type { Channel } from '../../types';
import TVChannelCard from '../../components/TVChannelCard';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [epgProgress, setEpgProgress] = useState<{ loaded: number; total: number } | null>(null);
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

  // Assinar progresso de carregamento dos EPGs
  useEffect(() => {
    const unsubscribe = onEPGProgress((loaded, total) => {
      setEpgProgress({ loaded, total });
    });
    return unsubscribe;
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

  // Prefetch EPG - non-blocking, nunca bloqueia UI
  useEffect(() => {
    if (channels.length > 0 && !prefetchedRef.current) {
      prefetchedRef.current = true;
      const channelIds = channels.filter(c => hasEPGMapping(c.id)).map(c => c.id);
      if (channelIds.length === 0) return;

      // Registra total para mostrar progresso
      setEPGTotalChannels(channelIds.length);

      let cancelled = false;
      // setTimeout chain em vez de await loop para nunca bloquear o JS thread
      let batchIndex = 0;
      const loadNextBatch = () => {
        if (cancelled || batchIndex >= channelIds.length) return;
        const batch = channelIds.slice(batchIndex, batchIndex + 2);
        batchIndex += 2;
        prefetchEPG(batch).catch(() => {});
        // Delay generoso entre batches para manter navegação D-pad fluida
        setTimeout(loadNextBatch, 600);
      };
      // Só começa após a UI estar pronta (1.5s após montar)
      const timerId = setTimeout(() => {
        if (!cancelled) loadNextBatch();
      }, 1500);

      return () => {
        cancelled = true;
        clearTimeout(timerId);
      };
    }
  }, [channels]);

  const handleSelectCategory = useCallback((category: string) => {
    setCategory(category as any);
    setSearchQuery('');
    prefetchedRef.current = false;
  }, [setCategory]);

  const channelRows = useMemo(() => {
    const rows: Channel[][] = [];
    for (let i = 0; i < channels.length; i += TV.channelColumns) {
      rows.push(channels.slice(i, i + TV.channelColumns));
    }
    return rows;
  }, [channels]);

  // Mostra progresso se ainda carregando e total > 0
  const showEpgProgress = epgProgress !== null && epgProgress.loaded < epgProgress.total;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>TV ao Vivo</Text>
          <Text style={styles.subtitle}>{channels.length} canais</Text>
        </View>
        {/* Indicador de progresso EPG */}
        {showEpgProgress && (
          <View style={styles.epgBadge}>
            <View style={styles.epgDot} />
            <Text style={styles.epgBadgeText}>
              EPG {epgProgress!.loaded}/{epgProgress!.total}
            </Text>
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
          renderItem={({ item }) => (
            <TVPressable
              style={[
                styles.categoryChip,
                selectedCategory === item && styles.categoryChipActive,
              ]}
              focusedStyle={styles.categoryChipFocused}
              focusScale={1.1}
              onPress={() => handleSelectCategory(item)}
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
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {channelRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map(channel => (
              <TVChannelCard key={channel.id} channel={channel} />
            ))}
          </View>
        ))}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  epgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
  },
  epgDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    // Pisca visualmente indicando carregamento ativo
  },
  epgBadgeText: {
    color: Colors.textSecondary,
    fontSize: Typography.label.fontSize,
    fontWeight: '600',
  },
  categoryBar: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
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
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
