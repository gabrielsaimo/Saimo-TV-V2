import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Switch,
  ActivityIndicator,
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
    isProList,
    setProList,
    proChannels,
    fetchProChannels,
    isLoading,
  } = useChannelStore();

  const { favorites } = useFavoritesStore();
  const { adultUnlocked, channelViewMode } = useSettingsStore();

  // ─── Progressive Loading ────────────────────────────────────────
  // Canais são renderizados progressivamente para evitar travar o React Native na primeira renderização de 2000+ itens
  const [displayLimit, setDisplayLimit] = useState(50);

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

  const handleTogglePro = useCallback((val: boolean) => {
    setProList(val);
    setCategory('Todos');
    setSearchQuery('');
    if (val && proChannels.length === 0) {
      fetchProChannels();
    }
  }, [setProList, setCategory, proChannels.length, fetchProChannels]);

  // Canais normais (instantâneos) com filtro de categoria
  // Se for lista PRO, já passamos 'adultUnlocked' direto, pois a store cuida do filtro de adultos.
  // Se for lista NORMAL, passamos 'false' para carregar a parte adulta com lazy load separadamente.
  const regularChannels = getFilteredChannels(isProList ? adultUnlocked : false, favorites);

  // Combina canais normais + adultos (sem aplicar o slice de performance ainda)
  const allChannels = useMemo(() => {
    if (isProList) return regularChannels; // A store já cuida de tudo para a PRO

    let adultSlice = adultUnlocked ? adultChannelsList : [];

    // Aplica filtro de categoria no slice adulto
    if (selectedCategory === 'Favoritos') {
      adultSlice = adultSlice.filter(ch => favorites.includes(ch.id));
    } else if (selectedCategory !== 'Todos' && selectedCategory !== 'Adulto') {
      adultSlice = []; // categoria não-adulta selecionada → esconde adultos
    }

    // Categoria "Adulto" → mostra só adultos da lista normal
    if (selectedCategory === 'Adulto') return adultSlice;

    return [...regularChannels, ...adultSlice];
  }, [isProList, regularChannels, adultUnlocked, selectedCategory, favorites]);

  const searchedChannels = useMemo(() => {
    if (!searchQuery.trim()) return allChannels;
    const query = searchQuery.toLowerCase().trim();
    return allChannels.filter(ch =>
      ch.name.toLowerCase().includes(query) ||
      ch.category.toLowerCase().includes(query)
    );
  }, [allChannels, searchQuery]);

  // Efeito responsável por carregar a lista progressivamente evitando travamento no Native UI
  useEffect(() => {
    setDisplayLimit(50);
    const total = searchedChannels.length;
    if (total <= 50) return;

    // Carrega blocos de 50 a cada 150ms no background
    const interval = setInterval(() => {
      setDisplayLimit(prev => {
        const next = prev + 50;
        if (next >= total) {
          clearInterval(interval);
          return total;
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [searchedChannels]);

  // Slice final para o FlatList renderizar
  const displayedChannels = useMemo(() => searchedChannels.slice(0, displayLimit), [searchedChannels, displayLimit]);

  // Ref da base completa para focus effect (para o scrollHeight e ref de foco)
  const channelsRef = useRef(searchedChannels);
  useEffect(() => { channelsRef.current = searchedChannels; }, [searchedChannels]);

  // Ao retornar do player: scrolla para o último canal e ativa foco nativo nele
  useFocusEffect(useCallback(() => {
    if (!lastWatchedId) return;
    // Snapshot do id no momento do foco (não muda enquanto o usuário está no player)
    setFocusTargetId(lastWatchedId);
    const idx = channelsRef.current.findIndex(ch => ch.id === lastWatchedId);
    if (idx < 0) return;
    
    // Garante que o displayLimit tenha chegado até esse item
    setDisplayLimit(prev => Math.max(prev, idx + 10));

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
        <View style={styles.headerLeft}>
          <Text style={styles.subtitle}>{searchedChannels.length} canais</Text>
          <TVPressable 
            style={styles.switchContainer} 
            onPress={() => handleTogglePro(!isProList)}
            focusScale={1.05}
          >
            <Text style={[styles.switchLabel, !isProList && styles.switchLabelActive]}>Normal</Text>
            <View pointerEvents="none" style={{ marginHorizontal: -4 }}>
              <Switch
                value={isProList}
                trackColor={{ false: Colors.surfaceVariant, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>
            <Text style={[styles.switchLabel, isProList && styles.switchLabelActive]}>Pro</Text>
            {isLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 6 }} />}
          </TVPressable>
        </View>
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
        data={displayedChannels}
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
          setDisplayLimit(prev => Math.max(prev, index + 20));
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
          }, 300);
        }}
        ListFooterComponent={
          displayLimit < searchedChannels.length ? (
            <View style={styles.loadingFooter}>
              <Text style={styles.loadingFooterText}>
                Carregando canais… {Math.min(displayLimit, searchedChannels.length)}/{searchedChannels.length}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  switchLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  switchLabelActive: {
    color: Colors.primary,
    fontWeight: 'bold',
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
