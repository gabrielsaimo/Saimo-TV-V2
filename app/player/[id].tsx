import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  BackHandler,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

import type { Channel, CurrentProgram } from '../../types';
import { Colors, BorderRadius, Spacing, Typography } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { getCurrentProgram, fetchChannelEPG } from '../../services/epgService';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChannelStore } from '../../stores/channelStore';
import { getAllChannels, getChannelById } from '../../data/channels';
import { useTVKeyHandler } from '../../hooks/useTVKeyHandler';
import EPGGuide from '../../components/EPGGuide';

export default function TVPlayerScreen() {
  const { id: initialId } = useLocalSearchParams<{ id: string }>();
  const [currentChannelId, setCurrentChannelId] = useState(initialId);
  const channel = getChannelById(currentChannelId);
  const router = useRouter();

  const { adultUnlocked } = useSettingsStore();
  const setCurrentChannel = useChannelStore(state => state.setCurrentChannel);

  const allChannelsList = useMemo(() => getAllChannels(adultUnlocked), [adultUnlocked]);

  // ─── Video player ──────────────────────────────────────────────────────
  const player = useVideoPlayer(channel?.url || '', p => {
    p.loop = true;
    p.staysActiveInBackground = true;
    p.play();
  });

  const videoViewRef = useRef<VideoView>(null);
  const [epg, setEpg] = useState<CurrentProgram | null>(null);
  const [hasError, setHasError] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // OSD (channel info banner — shown on channel switch or OK press)
  const [osdVisible, setOsdVisible] = useState(false);
  const osdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMountedRef = useRef(true);

  // ─── Persiste o canal atual no store para o grid saber onde o usuário parou
  useEffect(() => {
    setCurrentChannel(currentChannelId);
  }, [currentChannelId, setCurrentChannel]);

  // ─── Channel index ref ─────────────────────────────────────────────────
  const currentIndexRef = useRef(allChannelsList.findIndex(ch => ch.id === currentChannelId));
  useEffect(() => {
    currentIndexRef.current = allChannelsList.findIndex(ch => ch.id === currentChannelId);
  }, [currentChannelId, allChannelsList]);

  // ─── Mostrar OSD com auto-hide ─────────────────────────────────────────
  const showOSD = useCallback(() => {
    setOsdVisible(true);
    if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) setOsdVisible(false);
    }, 5000);
  }, []);

  const hideOSD = useCallback(() => {
    setOsdVisible(false);
    if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
  }, []);

  // ─── Trocar canal ─────────────────────────────────────────────────────
  const switchChannelByOffset = useCallback((offset: number) => {
    const idx = currentIndexRef.current;
    if (idx < 0) return;
    const nextIndex = (idx + offset + allChannelsList.length) % allChannelsList.length;
    const nextChannel = allChannelsList[nextIndex];
    if (nextChannel) {
      setEpg(getCurrentProgram(nextChannel.id));
      setCurrentChannelId(nextChannel.id);
      setShowGuide(false);
      showOSD();
    }
  }, [allChannelsList, showOSD]);

  // ─── Trocar canal via guia ─────────────────────────────────────────────
  const handleSwitchChannel = useCallback((target: Channel) => {
    setShowGuide(false);
    setCurrentChannelId(target.id);
  }, []);

  // ─── Trocar fonte de vídeo quando canal muda ───────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!channel) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setHasError(false);
    try { player.replace(channel.url); player.play(); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannelId]);

  // ─── Player status ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    const subs: any[] = [];
    subs.push(player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;
      if (payload.status === 'error') setHasError(true);
      else if (payload.status === 'readyToPlay') { setHasError(false); player.play(); }
    }));
    return () => subs.forEach(s => s.remove());
  }, [player]);

  // ─── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
      try { player.pause(); } catch {}
    };
  }, [player]);

  // ─── EPG fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    fetchChannelEPG(channel.id).then(() => {
      if (isMountedRef.current) setEpg(getCurrentProgram(channel.id));
    }).catch(() => {});
    const interval = setInterval(() => {
      if (isMountedRef.current) setEpg(getCurrentProgram(channel.id));
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannelId]);

  // ─── Ref estável para key handler ─────────────────────────────────────
  const switchRef = useRef(switchChannelByOffset);
  switchRef.current = switchChannelByOffset;

  // ─── Key handler ──────────────────────────────────────────────────────
  const { setMode } = useTVKeyHandler((event) => {
    if (event.action === 'down') return;

    // Menu key → toggle guide
    if (event.eventType === 'menu') {
      if (showGuide) { setShowGuide(false); return; }
      hideOSD();
      setShowGuide(true);
      return;
    }

    // Guide aberto → passa o controle pro native
    if (showGuide) return;

    switch (event.eventType) {
      case 'up':
      case 'channelUp':
        switchRef.current(-1);
        return;
      case 'down':
      case 'channelDown':
        switchRef.current(1);
        return;
      case 'select':
      case 'playPause':
        if (osdVisible) hideOSD();
        else showOSD();
        return;
    }
  });

  useEffect(() => {
    setMode(showGuide ? 'passthrough' : 'intercept');
  }, [showGuide, setMode]);

  // ─── Back button ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showGuide) { setShowGuide(false); return true; }
      if (osdVisible) { hideOSD(); return true; }
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, [showGuide, osdVisible]);

  const handleBack = useCallback(() => {
    isMountedRef.current = false;
    try { player.pause(); } catch {}
    router.back();
  }, [router, player]);

  const handleRetry = useCallback(() => {
    if (!channel) return;
    setHasError(false);
    player.replace(channel.url);
    player.play();
  }, [channel, player]);

  const formatRemaining = (minutes?: number) => {
    if (!minutes) return '';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}min restantes` : `${minutes}min restantes`;
  };

  const formatTime = (date: Date) => {
    try {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!channel) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Vídeo — toque exibe/oculta OSD */}
      <Pressable
        style={styles.videoContainer}
        onPress={() => osdVisible ? hideOSD() : showOSD()}
        focusable={!osdVisible && !showGuide}
        hasTVPreferredFocus={!osdVisible && !showGuide}
        android_ripple={{ color: 'transparent' }}
      >
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          focusable={false}
        />

        {/* Error */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={Colors.error} />
            <Text style={styles.errorTitle}>Canal indisponível</Text>
            <Text style={styles.errorText}>
              Este canal está temporariamente fora do ar.{'\n'}
              Tente novamente mais tarde.
            </Text>
            <TVPressable style={styles.retryButton} focusScale={1.08} onPress={handleRetry} hasTVPreferredFocus>
              <Ionicons name="refresh" size={24} color={Colors.text} />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TVPressable>
            <TVPressable style={styles.backButtonError} focusScale={1.08} onPress={handleBack}>
              <Text style={styles.backButtonText}>Voltar aos canais</Text>
            </TVPressable>
          </View>
        )}

        {/* ── OSD — floating glass card ───────────────────────────────── */}
        {osdVisible && !showGuide && !hasError && (
          <View style={styles.osdBanner}>

            {/* ── Logo + número ─────────────────────────────────────────── */}
            <View style={styles.osdLogoCol}>
              <View style={styles.osdLogoWrap}>
                {channel.logo ? (
                  <Image
                    source={{ uri: channel.logo }}
                    style={styles.osdLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="tv-outline" size={36} color={Colors.textSecondary} />
                )}
              </View>
              {channel.channelNumber != null && (
                <View style={styles.osdChNumBadge}>
                  <Text style={styles.osdChNum}>
                    {String(channel.channelNumber).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Separador vertical ────────────────────────────────────── */}
            <View style={styles.osdDivider} />

            {/* ── EPG ───────────────────────────────────────────────────── */}
            <View style={styles.osdEpgCol}>
              {/* Categoria + tempo restante */}
              <View style={styles.osdLiveRow}>
                <View style={styles.osdCatPill}>
                  <Text style={styles.osdCatText}>{channel.category}</Text>
                </View>
                {epg?.remaining ? (
                  <Text style={styles.osdRemaining}>{formatRemaining(epg.remaining)}</Text>
                ) : null}
              </View>

              {/* Título do programa */}
              {epg?.current ? (
                <>
                  <Text style={styles.osdProgTitle} numberOfLines={1}>
                    {epg.current.title}
                  </Text>
                  {/* Barra de progresso */}
                  <View style={styles.osdProgBar}>
                    <View
                      style={[styles.osdProgFill, { width: `${Math.min(100, epg.progress ?? 0)}%` }]}
                    />
                  </View>
                  {/* Próximo programa */}
                  {epg.next && (
                    <View style={styles.osdNextRow}>
                      <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
                      <Text style={styles.osdNextTitle} numberOfLines={1}>
                        {epg.next.title}
                      </Text>
                      <Text style={styles.osdNextTime}>
                        {formatTime(epg.next.startTime)}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.osdNoEpg}>Sem informação de programação</Text>
              )}
            </View>

          </View>
        )}
      </Pressable>

      {/* ── Guia EPG full-screen ─────────────────────────────────────── */}
      <EPGGuide
        visible={showGuide}
        channels={allChannelsList}
        currentChannelId={currentChannelId}
        onClose={() => setShowGuide(false)}
        onSelectChannel={handleSwitchChannel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },

  // ── Error ─────────────────────────────────────────────────────────────
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
    padding: Spacing.xxl,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.h2.fontSize,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  retryText: { color: Colors.text, fontWeight: '600', fontSize: Typography.body.fontSize },
  backButtonError: { marginTop: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  backButtonText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize },

  // ── OSD — floating glass card ─────────────────────────────────────────
  osdBanner: {
    position: 'absolute',
    bottom: 40,
    left: 48,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6,6,18,0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.32)',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
    minHeight: 116,
    // Sombra profunda para destaque sobre o vídeo
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 24,
  },

  // ── Coluna esquerda: logo + número ──────────────────────────────────
  osdLogoCol: {
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  osdLogoWrap: {
    width: 108,
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  osdLogo: { width: '82%', height: '82%' },
  osdChNumBadge: {
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.38)',
  },
  osdChNum: {
    color: Colors.primaryLight,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  // ── Pílula de categoria ──────────────────────────────────────────────
  osdCatPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  osdCatText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Separador vertical ───────────────────────────────────────────────
  osdDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: -Spacing.lg,
    flexShrink: 0,
  },

  // ── Coluna direita: EPG ─────────────────────────────────────────────
  osdEpgCol: {
    flex: 1,
    gap: 7,
    justifyContent: 'center',
  },
  osdLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  osdRemaining: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
  },
  osdProgTitle: {
    color: Colors.text,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  osdProgBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  osdProgFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  osdNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  osdNextTitle: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
    flex: 1,
  },
  osdNextTime: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
    flexShrink: 0,
  },
  osdNoEpg: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
  },
});
