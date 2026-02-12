import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { MediaItem } from '../types';
import { Colors, Spacing, Typography, TV } from '../constants/Colors';

// Largura fixa por item: card + padding SCALE_PADDING (10px cada lado) = card + 20
// getItemLayout permite que o FlatList calcule posições sem medir cada item
const CARD_ITEM_WIDTH = TV.mediaCardLargeWidth + 20; // medium size + SCALE_PADDING * 2
const LIST_PADDING = Spacing.xl; // paddingHorizontal do contentContainerStyle
import TVPressable from './TVPressable';
import TVMediaCard from './TVMediaCard';

interface TVMediaRowProps {
  title: string;
  categoryId: string;
  items: MediaItem[];
}

const TVMediaRow = memo(({ title, categoryId, items }: TVMediaRowProps) => {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TVPressable
          style={styles.seeAllButton}
          focusedStyle={styles.seeAllFocused}
          focusScale={1.1}
          onPress={() => router.push({ pathname: '/category/[id]' as any, params: { id: categoryId, name: title } })}
        >
          <Text style={styles.seeAllText}>Ver tudo</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TVPressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TVMediaCard item={item} size="medium" />}
        initialNumToRender={5}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews={false}
        // getItemLayout elimina medição de cada card — crítico com 15 cards por linha
        // O FlatList sabe a posição de cada item sem precisar renderizar todos primeiro
        getItemLayout={(_, index) => ({
          length: CARD_ITEM_WIDTH,
          offset: LIST_PADDING + CARD_ITEM_WIDTH * index,
          index,
        })}
      />
    </View>
  );
}, (prev, next) => prev.categoryId === next.categoryId && prev.items.length === next.items.length);

TVMediaRow.displayName = 'TVMediaRow';

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700' },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.sm, borderRadius: 8 },
  seeAllFocused: { backgroundColor: 'rgba(99,102,241,0.25)' },
  seeAllText: { color: Colors.primary, fontSize: Typography.caption.fontSize, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.xl },
});

export default TVMediaRow;
