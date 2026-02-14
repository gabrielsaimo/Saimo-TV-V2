import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/Colors';
import TVPressable from './TVPressable';
import { useMediaStore } from '../stores/mediaStore';

interface TVFilterBarProps {
  genres: string[];
}

export default function TVFilterBar({ genres }: TVFilterBarProps) {
  const { 
    activeFilter, activeSort, activeGenre, 
    setFilter, setSort, setGenre, clearFilters 
  } = useMediaStore();

  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(heightAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 200] // Collapsed vs Expanded height
  });

  const renderChip = (
    label: string, 
    isActive: boolean, 
    onPress: () => void,
    icon?: keyof typeof Ionicons.glyphMap
  ) => (
    <TVPressable
      style={[styles.chip, isActive && styles.chipActive]}
      focusedStyle={styles.chipFocused}
      onPress={onPress}
    >
      {({ focused }: { focused: boolean }) => (
        <View style={styles.chipContent}>
          {icon && (
            <Ionicons 
              name={icon} 
              size={16} 
              color={focused ? '#FFF' : (isActive ? Colors.primary : Colors.textSecondary)} 
              style={{ marginRight: 4 }}
            />
          )}
          <Text style={[
            styles.chipText, 
            isActive && styles.chipTextActive,
            focused && { color: '#FFF' }
          ]}>
            {label}
          </Text>
        </View>
      )}
    </TVPressable>
  );

  return (
    <Animated.View style={[styles.container, expanded && { height: 200 }]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Toggle Filters Button */}
        <TVPressable
          style={styles.filterBtn}
          focusedStyle={styles.filterBtnFocused}
          onPress={toggleExpand}
        >
          <Ionicons name="filter" size={20} color={Colors.text} />
          <Text style={styles.filterBtnText}>Filtros</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
        </TVPressable>

        {/* Clear Filters (only if active) */}
        {(activeFilter !== 'all' || activeSort !== 'rating' || activeGenre) && (
          <TVPressable
            style={styles.clearBtn}
            focusedStyle={styles.clearBtnFocused}
            onPress={clearFilters}
          >
            <Ionicons name="close-circle" size={18} color="#EF4444" />
            <Text style={styles.clearText}>Limpar</Text>
          </TVPressable>
        )}

        {/* Type Filters */}
        <View style={styles.divider} />
        {renderChip('Tudo', activeFilter === 'all', () => setFilter('all'))}
        {renderChip('Filmes', activeFilter === 'movie', () => setFilter('movie'), 'film')}
        {renderChip('Séries', activeFilter === 'tv', () => setFilter('tv'), 'tv')}

        {/* Sort Filters - Only show if enough space or expanded */}
        <View style={styles.divider} />
        {renderChip('Recentes', activeSort === 'year', () => setSort('year'))}
        {renderChip('Populares', activeSort === 'popularity', () => setSort('popularity'))}
        {renderChip('A-Z', activeSort === 'name', () => setSort('name'))}

      </ScrollView>

      {/* Expanded Genre Section */}
      {expanded && (
        <View style={styles.genreSection}>
          <Text style={styles.sectionTitle}>Gêneros</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreList}>
            <TVPressable
               style={[styles.genreChip, !activeGenre && styles.genreChipActive]}
               focusedStyle={styles.genreChipFocused}
               onPress={() => setGenre(null)}
            >
              <Text style={[styles.genreText, !activeGenre && styles.genreTextActive]}>Todos</Text>
            </TVPressable>
            
            {genres.map(g => (
              <TVPressable
                key={g}
                style={[styles.genreChip, activeGenre === g && styles.genreChipActive]}
                focusedStyle={styles.genreChipFocused}
                onPress={() => setGenre(g === activeGenre ? null : g)}
              >
                <Text style={[styles.genreText, activeGenre === g && styles.genreTextActive]}>
                  {g}
                </Text>
              </TVPressable>
            ))}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    // overflow: 'hidden', // Allow focus scale to overflow
    zIndex: 100,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.sm,
    height: 60,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnFocused: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: {
    color: Colors.text,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  clearBtnFocused: {
    backgroundColor: '#EF4444',
  },
  clearText: {
    color: '#EF4444',
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: Colors.primary,
  },
  chipFocused: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  genreSection: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    marginLeft: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  genreList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm, // space for scale
  },
  genreChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genreChipFocused: {
    borderColor: Colors.primary,
    transform: [{ scale: 1.1 }]
  },
  genreText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  genreTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
});
