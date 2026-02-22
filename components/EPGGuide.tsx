import React, { useRef, useCallback, useEffect, memo, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { Channel, Program } from '../types';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { getChannelEPG, fetchChannelEPG, hasEPGMapping, onEPGUpdate } from '../services/epgService';
import TVPressable from './TVPressable';

// ─── Layout constants ─────────────────────────────────────────────────────
const CH_COL_W   = 190;
const ROW_H      = 76;
const TIME_H     = 44;
const PX_PER_MIN = 4;
const SLOT_MIN   = 30;
const SLOT_W     = SLOT_MIN * PX_PER_MIN; // 120 px per slot
const HOURS      = 48;
const TL_W       = HOURS * 60 * PX_PER_MIN; // 11 520 px total

// Quantos canais acima/abaixo do atual pré-buscar sequencialmente
const PREFETCH_WINDOW = 8;
// Delay entre cada fetch sequencial (ms) — evita saturar a rede/proxy
const PREFETCH_DELAY  = 80;
// Delay mínimo antes de um ProgramRow fora da janela buscar por conta própria
const ROW_FETCH_DELAY = 600;

// ─── Helpers ──────────────────────────────────────────────────────────────

function calcTimelineStart(): Date {
  const slotMs = SLOT_MIN * 60_000;
  return new Date(Math.floor(Date.now() / slotMs) * slotMs - slotMs);
}

function pxAt(ms: number, startMs: number): number {
  return (ms - startMs) / 60_000 * PX_PER_MIN;
}

function fmtHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── TimeHeader ───────────────────────────────────────────────────────────

interface TimeHeaderProps { startMs: number; nowPx: number; }

const TimeHeader = memo(({ startMs, nowPx }: TimeHeaderProps) => {
  const slots = useMemo(() => {
    const total = HOURS * (60 / SLOT_MIN); // 96 slots
    const now = Date.now();
    return Array.from({ length: total }, (_, i) => {
      const ms = startMs + i * SLOT_MIN * 60_000;
      const isNow = ms <= now && ms + SLOT_MIN * 60_000 > now;
      return { label: fmtHHMM(new Date(ms)), isNow };
    });
  }, [startMs]);

  return (
    <View style={styles.timeHeader}>
      {slots.map((slot, i) => (
        <View key={i} style={[styles.timeSlot, slot.isNow && styles.timeSlotNow]}>
          <Text style={[styles.timeSlotLabel, slot.isNow && styles.timeSlotLabelNow]}>
            {slot.label}
          </Text>
          <View style={styles.slotDivider} />
        </View>
      ))}
      <View pointerEvents="none" style={[styles.nowPin, { left: nowPx }]} />
    </View>
  );
});
TimeHeader.displayName = 'TimeHeader';

// ─── ProgramRow ───────────────────────────────────────────────────────────

interface Block {
  key: string;
  isEmpty: boolean;
  w: number;
  prog?: Program;
  isNow?: boolean;
  progress?: number;
}

interface ProgramRowProps {
  channel: Channel;
  isActive: boolean;
  startMs: number;
  endMs: number;
  onSelect: () => void;
}

const ProgramRow = memo(({ channel, isActive, startMs, endMs, onSelect }: ProgramRowProps) => {
  const [progs, setProgs] = useState<Program[]>(() => getChannelEPG(channel.id));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Subscreve atualizações do serviço — recebe dados quando o pai (EPGGuide)
    // ou qualquer outra fonte conclui o fetch deste canal.
    const unsub = onEPGUpdate((updatedId) => {
      if (updatedId === channel.id && mountedRef.current) {
        setProgs(getChannelEPG(channel.id));
      }
    });

    // Fallback: se o canal ainda não tem dados e o pai não o pré-buscou
    // (está fora da janela PREFETCH_WINDOW), dispara busca própria com delay
    // para não competir com os fetches sequenciais do pai.
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (getChannelEPG(channel.id).length === 0 && hasEPGMapping(channel.id)) {
      fallbackTimer = setTimeout(() => {
        if (mountedRef.current) fetchChannelEPG(channel.id).catch(() => {});
      }, ROW_FETCH_DELAY);
    }

    return () => {
      mountedRef.current = false;
      unsub();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [channel.id]);

  const blocks = useMemo((): Block[] => {
    const now = Date.now();
    const visible = progs
      .filter(p => p.endTime.getTime() > startMs && p.startTime.getTime() < endMs)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (visible.length === 0) {
      return [{ key: 'no-epg', isEmpty: true, w: TL_W }];
    }

    const result: Block[] = [];
    let cursor = startMs;

    for (const p of visible) {
      const ps = Math.max(startMs, p.startTime.getTime());
      const pe = Math.min(endMs, p.endTime.getTime());

      if (ps > cursor) {
        result.push({
          key: `gap-${cursor}`,
          isEmpty: true,
          w: Math.round((ps - cursor) / 60_000 * PX_PER_MIN),
        });
      }

      const dur = pe - ps;
      const elapsed = now - ps;
      const isNow = ps <= now && pe > now;

      result.push({
        key: p.id,
        isEmpty: false,
        w: Math.max(8, Math.round(dur / 60_000 * PX_PER_MIN)),
        prog: p,
        isNow,
        progress: isNow && dur > 0 ? Math.min(100, (elapsed / dur) * 100) : 0,
      });
      cursor = pe;
    }

    if (cursor < endMs) {
      result.push({
        key: 'gap-end',
        isEmpty: true,
        w: Math.round((endMs - cursor) / 60_000 * PX_PER_MIN),
      });
    }
    return result;
  }, [progs, startMs, endMs]);

  return (
    <View style={[styles.progRow, isActive && styles.progRowActive]}>
      {blocks.map(block => {
        if (block.isEmpty) {
          return <View key={block.key} style={[styles.emptyBlock, { width: block.w }]} />;
        }
        const p = block.prog!;
        return (
          <TVPressable
            key={block.key}
            style={[
              styles.progBlock,
              { width: block.w },
              block.isNow && styles.progBlockNow,
            ]}
            focusedStyle={styles.progBlockFocused}
            focusScale={1.02}
            onPress={onSelect}
            hasTVPreferredFocus={isActive && !!block.isNow}
          >
            {({ focused }: { focused: boolean }) => (
              <View style={styles.progBlockInner}>
                <Text
                  style={[styles.progTitle, (focused || block.isNow) && styles.progTitleHi]}
                  numberOfLines={2}
                >
                  {p.title}
                </Text>
                <Text style={[styles.progTime, focused && { color: Colors.text }]}>
                  {fmtHHMM(p.startTime)}
                </Text>
                {block.isNow && (
                  <View style={styles.progBar}>
                    <View style={[styles.progBarFill, { width: `${block.progress ?? 0}%` }]} />
                  </View>
                )}
              </View>
            )}
          </TVPressable>
        );
      })}
    </View>
  );
}, (prev, next) =>
  prev.channel.id === next.channel.id &&
  prev.isActive  === next.isActive &&
  prev.startMs   === next.startMs
);
ProgramRow.displayName = 'ProgramRow';

// ─── ChannelCell (left column) ────────────────────────────────────────────

const ChannelCell = memo(({ channel, isActive }: { channel: Channel; isActive: boolean }) => (
  <View style={[styles.chCell, isActive && styles.chCellActive]}>
    <View style={styles.chLogo}>
      {channel.logo ? (
        <Image
          source={{ uri: channel.logo }}
          style={{ width: '80%', height: '80%' }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : (
        <Ionicons name="tv-outline" size={18} color={Colors.textSecondary} />
      )}
    </View>
    <View style={{ flex: 1 }}>
      {channel.channelNumber != null && (
        <Text style={[styles.chNum, isActive && { color: Colors.primary }]}>
          {String(channel.channelNumber).padStart(2, '0')}
        </Text>
      )}
      <Text style={[styles.chName, isActive && { color: Colors.primaryLight }]} numberOfLines={2}>
        {channel.name}
      </Text>
    </View>
  </View>
), (prev, next) => prev.channel.id === next.channel.id && prev.isActive === next.isActive);
ChannelCell.displayName = 'ChannelCell';

// ─── EPGGuide (main) ──────────────────────────────────────────────────────

export interface EPGGuideProps {
  visible: boolean;
  channels: Channel[];
  currentChannelId: string;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
}

export default function EPGGuide({
  visible,
  channels,
  currentChannelId,
  onClose,
  onSelectChannel,
}: EPGGuideProps) {
  const tlStart = useMemo(() => calcTimelineStart(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const startMs = tlStart.getTime();
  const endMs   = startMs + HOURS * 3_600_000;
  const nowPx   = pxAt(Date.now(), startMs);
  const initX   = useMemo(() => Math.max(0, nowPx - SLOT_W * 2.5), [nowPx]);

  const chListRef   = useRef<FlatList>(null);
  const progListRef = useRef<FlatList>(null);

  // Memoizado: evita findIndex em todo render do EPGGuide
  const activeIdx = useMemo(
    () => channels.findIndex(ch => ch.id === currentChannelId),
    [channels, currentChannelId],
  );

  // ── Prefetch sequencial: evita stampede de N fetches simultâneos ─────────
  // Busca canais da janela ao redor do canal ativo, um de cada vez com delay.
  // O ProgramRow recebe os dados via onEPGUpdate (pub/sub do serviço).
  useEffect(() => {
    if (!visible) return;

    const start = Math.max(0, activeIdx - PREFETCH_WINDOW);
    const end   = Math.min(channels.length, activeIdx + PREFETCH_WINDOW + 1);
    const toFetch = channels.slice(start, end).filter(ch => hasEPGMapping(ch.id));

    let cancelled = false;
    (async () => {
      for (const ch of toFetch) {
        if (cancelled) break;
        fetchChannelEPG(ch.id).catch(() => {});
        await new Promise<void>(r => setTimeout(r, PREFETCH_DELAY));
      }
    })();

    return () => { cancelled = true; };
  }, [visible, activeIdx, channels]);

  // ── Scroll para o canal ativo ao abrir ───────────────────────────────────
  useEffect(() => {
    if (!visible || activeIdx < 0) return;
    const idx = Math.max(0, activeIdx);
    const t = setTimeout(() => {
      chListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.35, animated: false });
      progListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.35, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [visible, activeIdx]);

  // ── Sincroniza scroll vertical entre coluna de canais e grade ────────────
  const syncChList = useCallback((offset: number) => {
    chListRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  const renderChannel = useCallback(({ item }: { item: Channel }) => (
    <ChannelCell channel={item} isActive={item.id === currentChannelId} />
  ), [currentChannelId]);

  const renderRow = useCallback(({ item }: { item: Channel }) => (
    <ProgramRow
      channel={item}
      isActive={item.id === currentChannelId}
      startMs={startMs}
      endMs={endMs}
      onSelect={() => { onSelectChannel(item); onClose(); }}
    />
  ), [currentChannelId, startMs, endMs, onSelectChannel, onClose]);

  const keyExtractor  = useCallback((item: Channel) => item.id, []);
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ROW_H, offset: ROW_H * index, index,
  }), []);

  const onScrollFailed = useCallback((info: { index: number }) => {
    const offset = info.index * ROW_H;
    chListRef.current?.scrollToOffset({ offset, animated: false });
    progListRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {/* Toque fora do painel → fechar */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View style={styles.panel}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Ionicons name="tv" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Guia de Programação</Text>
          <View style={styles.nowBadge}>
            <View style={styles.nowDot} />
            <Text style={styles.nowBadgeText}>{fmtHHMM(new Date())}</Text>
          </View>
          <TVPressable style={styles.closeBtn} focusScale={1.1} onPress={onClose}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TVPressable>
        </View>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Coluna esquerda de canais (fixa, sem scroll horizontal) */}
          <View style={styles.chCol}>
            <View style={[styles.chColHeader, { height: TIME_H }]}>
              <Text style={styles.chColHeaderText}>Canal</Text>
            </View>
            <FlatList
              ref={chListRef}
              data={channels}
              renderItem={renderChannel}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              initialScrollIndex={Math.max(0, activeIdx)}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={false}
              onScrollToIndexFailed={onScrollFailed}
            />
          </View>

          {/* Área de timeline — scroll horizontal sobre os 48h */}
          <ScrollView
            horizontal
            style={styles.tlScroll}
            contentOffset={{ x: initX, y: 0 }}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
          >
            <View style={{ width: TL_W, flex: 1 }}>

              <TimeHeader startMs={startMs} nowPx={nowPx} />

              {/* Linha vertical "agora" — abrange todas as linhas */}
              <View
                pointerEvents="none"
                style={[styles.nowLine, { left: nowPx }]}
              />

              {/* Grade de programas — FlatList vertical virtualizada */}
              <FlatList
                ref={progListRef}
                data={channels}
                renderItem={renderRow}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                initialScrollIndex={Math.max(0, activeIdx)}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                // Renderiza menos itens por ciclo — TV não faz scroll contínuo rápido
                initialNumToRender={12}
                maxToRenderPerBatch={5}
                windowSize={5}
                updateCellsBatchingPeriod={50}
                // 32ms (≈30fps) suficiente para sync — reduz pressão no thread JS
                scrollEventThrottle={32}
                onScroll={e => syncChList(e.nativeEvent.contentOffset.y)}
                onScrollToIndexFailed={onScrollFailed}
              />
            </View>
          </ScrollView>

        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '96%',
    height: '88%',
    backgroundColor: 'rgba(8,8,20,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.22)',
    overflow: 'hidden',
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(14,14,28,1)',
    gap: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
  },
  nowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.live,
  },
  nowBadgeText: {
    color: Colors.primaryLight,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.full,
  },

  // ── Body ───────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // ── Left channel column ────────────────────────────────────────────────
  chCol: {
    width: CH_COL_W,
    backgroundColor: 'rgba(12,12,24,1)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    zIndex: 10,
  },
  chColHeader: {
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  chColHeaderText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  chCell: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  chCellActive: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  chLogo: {
    width: 44,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  chNum: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chName: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },

  // ── Timeline scroll ────────────────────────────────────────────────────
  tlScroll: { flex: 1 },

  // ── Time header ────────────────────────────────────────────────────────
  timeHeader: {
    height: TIME_H,
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,34,1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  timeSlot: {
    width: SLOT_W,
    height: TIME_H,
    justifyContent: 'center',
    paddingLeft: 8,
    position: 'relative',
  },
  timeSlotNow: {
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  timeSlotLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  timeSlotLabelNow: {
    color: Colors.primaryLight,
    fontWeight: '800',
  },
  slotDivider: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nowPin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.live,
    zIndex: 5,
    borderRadius: 1,
  },

  // ── "Now" vertical line spanning all rows ──────────────────────────────
  nowLine: {
    position: 'absolute',
    top: TIME_H,
    width: 2,
    height: 100_000,
    backgroundColor: Colors.live,
    opacity: 0.5,
    zIndex: 5,
  },

  // ── Program rows ───────────────────────────────────────────────────────
  progRow: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  progRowActive: {
    backgroundColor: 'rgba(99,102,241,0.04)',
  },
  emptyBlock: {
    height: ROW_H - 10,
    marginVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  progBlock: {
    height: ROW_H - 10,
    marginVertical: 5,
    marginRight: 2,
    backgroundColor: 'rgba(26,26,50,0.95)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progBlockNow: {
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  progBlockFocused: {
    backgroundColor: Colors.primary,
  },
  progBlockInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: 'space-between',
  },
  progTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15,
    flex: 1,
  },
  progTitleHi: {
    color: Colors.text,
    fontWeight: '600',
  },
  progTime: {
    color: Colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  progBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 3,
  },
  progBarFill: {
    height: '100%',
    backgroundColor: Colors.live,
    borderRadius: 1,
  },
});
