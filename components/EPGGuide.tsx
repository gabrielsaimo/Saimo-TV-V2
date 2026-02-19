import React, { useRef, useCallback, useEffect, memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { Channel, CurrentProgram } from '../types';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { getCurrentProgram, fetchChannelEPG, hasEPGMapping } from '../services/epgService';
import TVPressable from './TVPressable';

const ITEM_HEIGHT = 88;

interface EPGGuideProps {
  visible: boolean;
  channels: Channel[];
  currentChannelId: string;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
}

// ─── Row com EPG lazy-loaded ───────────────────────────────────────────────
interface EPGRowProps {
  channel: Channel;
  isActive: boolean;
  onPress: () => void;
}

const EPGRow = memo(({ channel, isActive, onPress }: EPGRowProps) => {
  const [epg, setEpg] = useState<CurrentProgram | null>(() => getCurrentProgram(channel.id));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Se já temos EPG no cache, não busca de novo
    if (epg) return;
    if (!hasEPGMapping(channel.id)) return;

    fetchChannelEPG(channel.id)
      .then(() => {
        if (mountedRef.current) setEpg(getCurrentProgram(channel.id));
      })
      .catch(() => {});

    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const formatTime = (date: Date) => {
    try {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <TVPressable
      style={[styles.row, isActive && styles.rowActive]}
      focusedStyle={styles.rowFocused}
      focusScale={1.02}
      onPress={onPress}
      hasTVPreferredFocus={isActive}
    >
      {/* Logo */}
      <View style={styles.logoWrap}>
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="tv-outline" size={22} color={Colors.textSecondary} />
        )}
      </View>

      {/* Identificação do canal */}
      <View style={styles.chIdWrap}>
        {channel.channelNumber != null && (
          <Text style={[styles.chNum, isActive && styles.chNumActive]}>
            {String(channel.channelNumber).padStart(2, '0')}
          </Text>
        )}
        <Text style={[styles.chName, isActive && styles.chNameActive]} numberOfLines={2}>
          {channel.name}
        </Text>
      </View>

      {/* Programa atual */}
      <View style={styles.epgWrap}>
        {epg?.current ? (
          <>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>AO VIVO</Text>
              <Text style={styles.timeLabel}>{formatTime(epg.current.startTime)}</Text>
            </View>
            <Text style={styles.progTitle} numberOfLines={1}>{epg.current.title}</Text>
            <View style={styles.progBar}>
              <View style={[styles.progFill, { width: `${Math.min(100, epg.progress ?? 0)}%` }]} />
            </View>
          </>
        ) : (
          <Text style={styles.noEpg}>{channel.category}</Text>
        )}
      </View>

      {/* Próximo programa */}
      <View style={styles.nextWrap}>
        {epg?.next ? (
          <>
            <Text style={styles.nextLabel}>A seguir</Text>
            <Text style={styles.nextTitle} numberOfLines={2}>{epg.next.title}</Text>
            <Text style={styles.nextTime}>{formatTime(epg.next.startTime)}</Text>
          </>
        ) : null}
      </View>

    </TVPressable>
  );
}, (prev, next) =>
  prev.channel.id === next.channel.id &&
  prev.isActive === next.isActive
);
EPGRow.displayName = 'EPGRow';

// ─── Componente principal ──────────────────────────────────────────────────
export default function EPGGuide({
  visible,
  channels,
  currentChannelId,
  onClose,
  onSelectChannel,
}: EPGGuideProps) {
  const listRef = useRef<FlatList>(null);
  const currentIndex = channels.findIndex(ch => ch.id === currentChannelId);

  // Scroll para o canal atual ao abrir
  useEffect(() => {
    if (!visible || currentIndex < 0) return;
    const safeIndex = Math.max(0, currentIndex);
    setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: safeIndex,
        viewPosition: 0.35,
        animated: false,
      });
    }, 80);
  }, [visible, currentIndex]);

  const renderItem = useCallback(({ item }: { item: Channel }) => (
    <EPGRow
      channel={item}
      isActive={item.id === currentChannelId}
      onPress={() => {
        if (item.id !== currentChannelId) onSelectChannel(item);
        onClose();
      }}
    />
  ), [currentChannelId, onSelectChannel, onClose]);

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {/* Toque fora para fechar */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View style={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Ionicons name="tv" size={22} color={Colors.primary} />
          <Text style={styles.headerTitle}>Guia de Programação</Text>
          <TVPressable style={styles.closeBtn} focusScale={1.15} onPress={onClose}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </TVPressable>
        </View>

        {/* Lista de canais */}
        <FlatList
          ref={listRef}
          data={channels}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          initialScrollIndex={Math.max(0, currentIndex)}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={14}
          maxToRenderPerBatch={8}
          windowSize={10}
          onScrollToIndexFailed={() => {
            // Se falhar, tenta scrollToOffset aproximado
            if (currentIndex > 0) {
              listRef.current?.scrollToOffset({
                offset: currentIndex * ITEM_HEIGHT,
                animated: false,
              });
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,14,0.97)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.md,
    backgroundColor: 'rgba(15,15,25,1)',
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
  },
  closeBtn: {
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.full,
  },
  // ── Row ─────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowActive: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  rowFocused: {
    backgroundColor: 'rgba(99,102,241,0.28)',
  },
  // ── Logo ────────────────────────────────────────────────────────────────
  logoWrap: {
    width: 80,
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    flexShrink: 0,
    overflow: 'hidden',
  },
  logo: { width: '82%', height: '82%' },
  // ── Channel ID ──────────────────────────────────────────────────────────
  chIdWrap: {
    width: 150,
    marginRight: Spacing.lg,
    flexShrink: 0,
  },
  chNum: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  chNumActive: { color: Colors.primary },
  chName: {
    color: Colors.text,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    lineHeight: 18,
  },
  chNameActive: { color: Colors.primaryLight },
  // ── EPG atual ───────────────────────────────────────────────────────────
  epgWrap: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.live,
  },
  liveLabel: {
    color: Colors.live,
    fontSize: Typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  timeLabel: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
  },
  progTitle: {
    color: Colors.text,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
    marginBottom: 5,
  },
  progBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  noEpg: {
    color: Colors.textMuted,
    fontSize: Typography.caption.fontSize,
  },
  // ── Próximo ─────────────────────────────────────────────────────────────
  nextWrap: {
    width: 200,
    paddingLeft: Spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  nextLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  nextTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 18,
  },
  nextTime: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
});
