import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  BackHandler,
  ActivityIndicator,
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
import { useFavoritesStore } from '../../stores/favoritesStore';
import { getAllChannels, getChannelById } from '../../data/channels';
import { useTVKeyHandler } from '../../hooks/useTVKeyHandler';
import EPGGuide from '../../components/EPGGuide';

export default function TVPlayerScreen() {
  const { id: initialId } = useLocalSearchParams<{ id: string }>();
  const [currentChannelId, setCurrentChannelId] = useState(initialId);
  const router = useRouter();

  const { adultUnlocked } = useSettingsStore();
  const { favorites } = useFavoritesStore();
  const { setCurrentChannel, getFilteredChannels } = useChannelStore();

  // O Player agora puxa exatamente a mesma lista filtrada (Categoria + Resolução)
  // que o usuário estava vendo na tela anterior (TVGrid), amarrando a navegação D-pad.
  const allChannelsList = useMemo(() => {
    return getFilteredChannels(adultUnlocked, favorites);
  }, [getFilteredChannels, adultUnlocked, favorites]);

  const channel = useMemo(() => allChannelsList.find(c => c.id === currentChannelId), [allChannelsList, currentChannelId]);

  // ─── Video player ──────────────────────────────────────────────────────
  // Fonte nula: garante que o player NUNCA muda de referência entre trocas de canal.
  // A URL real é carregada via player.replace() no efeito de troca de canal.
  const player = useVideoPlayer(null, p => {
    p.loop = true;
    p.staysActiveInBackground = true;
  });

  const videoViewRef = useRef<VideoView>(null);
  const [epg, setEpg] = useState<CurrentProgram | null>(null);
  const [hasError, setHasError] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [videoResolution, setVideoResolution] = useState<string | null>(null);

  const retryTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelUrlRef    = useRef(channel?.url ?? '');
  // Debounce: evita chamar player.replace() e fetchEPG em cada canal durante rolagem rápida
  const switchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epgDebounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Subscriptions do player — guardadas aqui para poder remover imediatamente no handleBack
  const playerSubsRef = useRef<any[]>([]);

  // ─── Estado de retry com feedback visual ──────────────────────────────
  const [isRetrying, setIsRetrying] = useState(false);
  const isRetryingRef = useRef(false);

  // OSD (channel info banner — shown on channel switch or OK press)
  const [osdVisible, setOsdVisible] = useState(false);
  const osdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMountedRef = useRef(true);

  // ─── Persiste o canal atual no store para o grid saber onde o usuário parou
  useEffect(() => {
    setCurrentChannel(currentChannelId);
  }, [currentChannelId, setCurrentChannel]);

  // ─── Canal anterior / próximo para hints no OSD ────────────────────────
  const prevChannel = useMemo(() => {
    const idx = allChannelsList.findIndex(ch => ch.id === currentChannelId);
    if (idx < 0) return null;
    return allChannelsList[(idx - 1 + allChannelsList.length) % allChannelsList.length];
  }, [allChannelsList, currentChannelId]);

  const nextChannel = useMemo(() => {
    const idx = allChannelsList.findIndex(ch => ch.id === currentChannelId);
    if (idx < 0) return null;
    return allChannelsList[(idx + 1) % allChannelsList.length];
  }, [allChannelsList, currentChannelId]);

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
      setOsdVisible(false);
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

  // ─── Trocar fonte de vídeo quando canal muda (inclui carga inicial) ───
  useEffect(() => {
    if (!channel) return;
    channelUrlRef.current = channel.url;
    if (!isMountedRef.current) return;
    // Cancela retry pendente do canal anterior
    if (retryTimerRef.current)    { clearTimeout(retryTimerRef.current);    retryTimerRef.current    = null; }
    if (retryIntervalRef.current) { clearTimeout(retryIntervalRef.current); retryIntervalRef.current = null; }
    if (switchDebounceRef.current) { clearTimeout(switchDebounceRef.current); switchDebounceRef.current = null; }
    isRetryingRef.current = false;
    setIsRetrying(false);
    setHasError(false);
    setVideoResolution(null);
    // Debounce 300ms: evita replace() rápido demais quando o usuário rola canais
    switchDebounceRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      try { player.replace(channelUrlRef.current); player.play(); } catch {}
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannelId]);

  // ─── Player status ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    const subs: any[] = [];
    subs.push(player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;
      if (payload.status === 'error') {
        if (!isRetryingRef.current) {
          // Primeira falha: ativa indicador e inicia timeout de 5s
          isRetryingRef.current = true;
          setIsRetrying(true);
          retryTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            isRetryingRef.current = false;
            setIsRetrying(false);
            setHasError(true);
            if (retryIntervalRef.current) { clearTimeout(retryIntervalRef.current); retryIntervalRef.current = null; }
          }, 5000);
        }
        // Agenda próxima tentativa em 1.5s (se o timer de 5s ainda não expirou)
        if (retryIntervalRef.current) clearTimeout(retryIntervalRef.current);
        retryIntervalRef.current = setTimeout(() => {
          if (!isMountedRef.current || !isRetryingRef.current) return;
          try { player.replace(channelUrlRef.current); player.play(); } catch {}
        }, 1500);
      } else if (payload.status === 'readyToPlay') {
        // Carregou com sucesso — cancela retry
        if (isRetryingRef.current) {
          isRetryingRef.current = false;
          setIsRetrying(false);
          if (retryTimerRef.current)    { clearTimeout(retryTimerRef.current);    retryTimerRef.current    = null; }
          if (retryIntervalRef.current) { clearTimeout(retryIntervalRef.current); retryIntervalRef.current = null; }
        }
        setHasError(false);
        player.play();
      }
    }));
    subs.push(player.addListener('videoTrackChange', (payload: any) => {
      if (!isMountedRef.current) return;
      const h: number | undefined = payload?.videoTrack?.height;
      if (!h) { setVideoResolution(null); return; }
      if (h >= 2160) setVideoResolution('4K');
      else if (h >= 1440) setVideoResolution('2K');
      else if (h >= 1080) setVideoResolution('1080p');
      else if (h >= 720)  setVideoResolution('720p');
      else if (h >= 480)  setVideoResolution('480p');
      else                setVideoResolution('SD');
    }));
    playerSubsRef.current = subs;
    return () => {
      subs.forEach(s => s.remove());
      playerSubsRef.current = [];
    };
  }, [player]);

  // ─── Cleanup de timers — deps vazia: nunca re-executa entre trocas de canal
  // IMPORTANTE: não inclui [player] aqui. Se player mudasse de referência,
  // o cleanup cancelaria osdTimeoutRef e o OSD ficaria preso na tela.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (osdTimeoutRef.current)     clearTimeout(osdTimeoutRef.current);
      if (retryTimerRef.current)     clearTimeout(retryTimerRef.current);
      if (retryIntervalRef.current)  clearTimeout(retryIntervalRef.current);
      if (switchDebounceRef.current) clearTimeout(switchDebounceRef.current);
      if (epgDebounceRef.current)    clearTimeout(epgDebounceRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pausa o player ao desmontar (separado para não afetar os timers) ──
  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, [player]);

  // ─── EPG fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!channel || !isMountedRef.current) return;
    const channelId = channel.id;
    // Debounce 500ms: não dispara fetch se o usuário ainda está trocando canais
    if (epgDebounceRef.current) clearTimeout(epgDebounceRef.current);
    epgDebounceRef.current = setTimeout(() => {
      fetchChannelEPG(channelId).then(() => {
        if (isMountedRef.current) setEpg(getCurrentProgram(channelId));
      }).catch(() => {});
    }, 500);
    const interval = setInterval(() => {
      if (isMountedRef.current) setEpg(getCurrentProgram(channelId));
    }, 30000);
    return () => {
      clearInterval(interval);
      if (epgDebounceRef.current) { clearTimeout(epgDebounceRef.current); epgDebounceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannelId]);

  // ─── Ref estável para key handler ─────────────────────────────────────
  const switchRef = useRef(switchChannelByOffset);
  switchRef.current = switchChannelByOffset;

  // ─── Key handler ──────────────────────────────────────────────────────
  const { setMode } = useTVKeyHandler((event) => {
    if (!isMountedRef.current) return;
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

  // ─── Refs de estado p/ BackHandler — evita re-registro com janela vazia ──
  const showGuideRef = useRef(showGuide);
  const osdVisibleRef = useRef(osdVisible);
  useEffect(() => { showGuideRef.current = showGuide; }, [showGuide]);
  useEffect(() => { osdVisibleRef.current = osdVisible; }, [osdVisible]);

  const handleBack = useCallback(() => {
    isMountedRef.current = false;
    // Remove player listeners imediatamente — impede que eventos nativos
    // disparem player.replace() / setState após o componente desmontar
    playerSubsRef.current.forEach(s => { try { s.remove(); } catch {} });
    playerSubsRef.current = [];
    if (osdTimeoutRef.current)     clearTimeout(osdTimeoutRef.current);
    if (retryTimerRef.current)     clearTimeout(retryTimerRef.current);
    if (retryIntervalRef.current)  clearTimeout(retryIntervalRef.current);
    if (switchDebounceRef.current) clearTimeout(switchDebounceRef.current);
    if (epgDebounceRef.current)    clearTimeout(epgDebounceRef.current);
    try { player.pause(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)');
    }
  }, [router, player]);

  // ─── Back button — registrado UMA vez, usa refs para estado atual ─────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showGuideRef.current) { setShowGuide(false); return true; }
      if (osdVisibleRef.current) { hideOSD(); return true; }
      handleBack();
      return true;
    });
    return () => handler.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    if (!channel) return;
    isRetryingRef.current = false;
    setIsRetrying(false);
    setHasError(false);
    if (retryTimerRef.current)    { clearTimeout(retryTimerRef.current);    retryTimerRef.current    = null; }
    if (retryIntervalRef.current) { clearTimeout(retryIntervalRef.current); retryIntervalRef.current = null; }
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

      {/* Vídeo — toque exibe/oculta OSD.
          focusable={false}: todo handling de teclas é via useTVKeyHandler
          (DeviceEventEmitter global) — não depende de foco nativo.
          Manter focusable=true causava hasTVPreferredFocus disparar onPress
          nativo ao receber foco, chamando showOSD() após o timer esconder o OSD. */}
      <Pressable
        style={styles.videoContainer}
        onPress={() => osdVisible ? hideOSD() : showOSD()}
        focusable={false}
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

        {/* Retry em andamento */}
        {isRetrying && !hasError && (
          <View style={styles.retryingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.retryingText}>Conectando ao canal...</Text>
          </View>
        )}

        {/* Error */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={Colors.error} />
            <Text style={styles.errorTitle}>Canal indisponível</Text>
            <Text style={styles.errorText}>
              Não foi possível carregar este canal após 5s de tentativas.{'\n'}
              O canal pode estar temporariamente fora do ar.
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
          <View style={styles.osdContainer}>

            {/* ── Hint: canal anterior (↑) ──────────────────────────────── */}
            {prevChannel && (
              <View style={styles.osdNavHint}>
                <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.55)" />
                {prevChannel.logo ? (
                  <Image
                    source={{ uri: prevChannel.logo }}
                    style={styles.osdNavLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="tv-outline" size={16} color="rgba(255,255,255,0.45)" />
                )}
                <Text style={styles.osdNavHintText} numberOfLines={1}>
                  {prevChannel.name}
                </Text>
              </View>
            )}

            {/* ── Banner principal ──────────────────────────────────────── */}
            <View style={styles.osdBanner}>

              {/* ── Logo + número + nome ──────────────────────────────────── */}
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
                <Text style={styles.osdChannelName} numberOfLines={1}>
                  {channel.name}
                </Text>
              </View>

              {/* ── Separador vertical ────────────────────────────────────── */}
              <View style={styles.osdDivider} />

              {/* ── EPG ───────────────────────────────────────────────────── */}
              <View style={styles.osdEpgCol}>
                <View style={styles.osdLiveRow}>
                  <View style={styles.osdCatPill}>
                    <Text style={styles.osdCatText}>{channel.category}</Text>
                  </View>
                  {videoResolution && (
                    <View style={styles.osdResBadge}>
                      <Text style={styles.osdResText}>{videoResolution}</Text>
                    </View>
                  )}
                  {epg?.remaining ? (
                    <Text style={styles.osdRemaining}>{formatRemaining(epg.remaining)}</Text>
                  ) : null}
                </View>

                {epg?.current ? (
                  <>
                    <Text style={styles.osdProgTitle} numberOfLines={1}>
                      {epg.current.title}
                    </Text>
                    <View style={styles.osdProgBar}>
                      <View
                        style={[styles.osdProgFill, { width: `${Math.min(100, epg.progress ?? 0)}%` }]}
                      />
                    </View>
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

            {/* ── Hint: próximo canal (↓) ───────────────────────────────── */}
            {nextChannel && (
              <View style={styles.osdNavHint}>
                <Text style={styles.osdNavHintText} numberOfLines={1}>
                  {nextChannel.name}
                </Text>
                {nextChannel.logo ? (
                  <Image
                    source={{ uri: nextChannel.logo }}
                    style={styles.osdNavLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="tv-outline" size={16} color="rgba(255,255,255,0.45)" />
                )}
                <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.55)" />
              </View>
            )}

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

  // ── Retry em andamento ────────────────────────────────────────────────
  retryingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 16,
  },
  retryingText: {
    color: Colors.textSecondary,
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },

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
  osdContainer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    alignItems: 'center',
    gap: 8,
  },
  osdNavHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,6,18,0.75)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  osdNavHintText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  osdNavLogo: {
    width: 32,
    height: 20,
  },
  osdBanner: {
    width: '100%',
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
  osdChannelName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 112,
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

  // ── Badge de resolução ───────────────────────────────────────────────
  osdResBadge: {
    backgroundColor: 'rgba(99,102,241,0.22)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.45)',
  },
  osdResText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
