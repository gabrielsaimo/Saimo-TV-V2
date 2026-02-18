import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  BackHandler,
  ScrollView,
  Animated,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import type { Channel, CurrentProgram } from '../../types';
import { Colors, BorderRadius, Spacing, Typography } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { getCurrentProgram, fetchChannelEPG } from '../../services/epgService';
import { useSettingsStore } from '../../stores/settingsStore';
import { getAllChannels, getChannelById } from '../../data/channels';
import { useTVKeyHandler } from '../../hooks/useTVKeyHandler';

function getResolutionLabel(h: number): string {
  if (h >= 2160) return '4K';
  if (h >= 1440) return '2K';
  if (h >= 1080) return '1080p';
  if (h >= 720) return '720p';
  if (h >= 480) return '480p';
  if (h >= 360) return '360p';
  return `${h}p`;
}

export default function TVPlayerScreen() {
  const { id: initialId } = useLocalSearchParams<{ id: string }>();
  const [currentChannelId, setCurrentChannelId] = useState(initialId);
  const channel = getChannelById(currentChannelId);
  const router = useRouter();

  // Settings
  const { adultUnlocked } = useSettingsStore();

  // Compute available channels based on settings
  const allChannelsList = useMemo(() => {
    return getAllChannels(adultUnlocked);
  }, [adultUnlocked]);

  // Video player
  const player = useVideoPlayer(channel?.url || '', player => {
    player.loop = true;
    player.staysActiveInBackground = true;
    player.play();
  });

  const videoViewRef = useRef<VideoView>(null);
  const [showControls, setShowControls] = useState(true);
  const [epg, setEpg] = useState<CurrentProgram | null>(null);
  const [hasError, setHasError] = useState(false);
  const [resolution, setResolution] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Channel OSD
  const [osdChannel, setOsdChannel] = useState<Channel | null>(null);
  const osdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const [favorite, setFavorite] = useState(channel ? isFavorite(channel.id) : false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Channel navigation — use refs for the key handler to avoid stale closures
  const currentIndexRef = useRef(allChannelsList.findIndex(ch => ch.id === currentChannelId));
  
  // Update ref when channel or list changes
  useEffect(() => {
    currentIndexRef.current = allChannelsList.findIndex(ch => ch.id === currentChannelId);
  }, [currentChannelId, allChannelsList]);

  const switchChannelByOffset = useCallback((offset: number) => {
    const idx = currentIndexRef.current;
    if (idx < 0) {
      console.warn('Channel index not found');
      // Fallback: try to find by ID again or reset to 0
      const currentIdx = allChannelsList.findIndex(ch => ch.id === currentChannelId);
      if (currentIdx >= 0) {
         currentIndexRef.current = currentIdx;
      } else {
         return;
      }
    }

    const nextIndex = (idx + offset + allChannelsList.length) % allChannelsList.length;
    const nextChannel = allChannelsList[nextIndex];

    console.log(`[CHANNEL SWITCH] ${allChannelsList[idx]?.name} (${idx}) → ${nextChannel?.name} (${nextIndex})`);

    if (nextChannel) {
      // Show cached EPG immediately if already loaded for this channel
      setEpg(getCurrentProgram(nextChannel.id));
      setOsdChannel(nextChannel);
      setShowControls(false);
      setShowGuide(false);
      setShowMenu(false);
      setFavorite(isFavorite(nextChannel.id));
      setCurrentChannelId(nextChannel.id);
    }
  }, [isFavorite, allChannelsList, currentChannelId]);

  // OSD auto-hide
  useEffect(() => {
    if (osdChannel) {
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
      osdTimeoutRef.current = setTimeout(() => setOsdChannel(null), 5000);
    }
    return () => {
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    };
  }, [osdChannel]);

  // Channel change: when currentChannelId changes, replace the video source
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!channel) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    console.log(`[PLAYER] Replacing source → ${channel.name} (${channel.url.substring(0, 60)}...)`);
    setHasError(false);
    try { player.replace(channel.url); player.play(); } catch (e) { console.warn('[PLAYER] replace error:', e); }
  }, [currentChannelId, player]);

  // Player status listener
  useEffect(() => {
    if (!player) return;
    const subs: any[] = [];
    subs.push(player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;
      if (payload.status === 'error') setHasError(true);
      else if (payload.status === 'readyToPlay') {
        setHasError(false);
        player.play();
      }
    }));
    return () => subs.forEach(s => s.remove());
  }, [player]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { player.pause(); } catch {}
    };
  }, [player]);

  // Fetch EPG
  useEffect(() => {
    if (!channel) return;
    fetchChannelEPG(channel.id).then(() => {
      if (isMountedRef.current) setEpg(getCurrentProgram(channel.id));
    }).catch(() => {});
    const interval = setInterval(() => {
      if (isMountedRef.current) setEpg(getCurrentProgram(channel.id));
    }, 30000);
    return () => clearInterval(interval);
  }, [currentChannelId]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && !hasError) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setShowControls(false);
      }, 5000);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showControls, hasError]);

  // Store switchChannelByOffset in ref for the key handler to avoid stale closure
  const switchChannelByOffsetRef = useRef(switchChannelByOffset);
  switchChannelByOffsetRef.current = switchChannelByOffset;

  // D-pad / Remote key handler
  const { setMode } = useTVKeyHandler(
    (event) => {
      // Only trigger on Key Up (release) to prevent double-firing
      if (event.action === 'down') return;

      console.log(`[KEY] eventType=${event.eventType} keyCode=${event.keyCode} action=${event.action}`);

      // Priority 1: Menu Key - Always toggle menu
      if (event.eventType === 'menu') {
        if (showMenu) setShowMenu(false);
        else if (showGuide) setShowGuide(false);
        else {
          setShowMenu(true);
          setShowControls(false);
        }
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        return;
      }

      // Priority 2: If Side Menu or Guide is open, let them handle nav (Passthrough)
      if (showGuide || showMenu) return;

      // Priority 3: Up/Down ALWAYS switches channels — even when controls are visible
      // (controls auto-hide when switchChannelByOffset is called)
      switch (event.eventType) {
        case 'up':
        case 'channelUp':
          console.log('[KEY] Switching channel UP');
          switchChannelByOffsetRef.current(-1);
          return;
        case 'down':
        case 'channelDown':
          console.log('[KEY] Switching channel DOWN');
          switchChannelByOffsetRef.current(1);
          return;
      }

      // Priority 4: If Controls are visible, let native focus handle select/left/right for buttons
      if (showControls) return;

      // Full-screen video mode only
      switch (event.eventType) {
        case 'select':
        case 'playPause':
          handleScreenPress();
          return;
      }
    },
  );

  // Switch key interception mode when overlays open/close
  useEffect(() => {
    // Guide/Menu open: passthrough so native focus can navigate the list
    if (showGuide || showMenu) {
      setMode('passthrough');
      return;
    }
    // All other states: intercept — we handle up/down ourselves regardless of controls state
    setMode('intercept');
  }, [showGuide, showMenu, setMode]);

  // Back Handler (remote back button)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showMenu) { setShowMenu(false); return true; }
      if (showGuide) { setShowGuide(false); return true; }
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, [showGuide, showMenu]);

  const handleBack = useCallback(() => {
    isMountedRef.current = false;
    try { player.pause(); } catch {}
    router.back();
  }, [router, player]);

  const handleToggleFavorite = useCallback(() => {
    if (!channel) return;
    toggleFavorite(channel.id);
    setFavorite(prev => !prev);
  }, [channel, toggleFavorite]);

  const handleScreenPress = useCallback(() => {
    if (showGuide) { setShowGuide(false); return; }
    if (showMenu) { setShowMenu(false); return; }
    if (!hasError) setShowControls(prev => !prev);
  }, [hasError, showGuide, showMenu]);

  const handleRetry = useCallback(() => {
    if (!channel) return;
    setHasError(false);
    player.replace(channel.url);
    player.play();
  }, [channel, player]);

  // Guide
  const guideChannels = useMemo(() => {
    if (!showGuide) return [];
    return allChannelsList.map(ch => ({
      channel: ch,
      epg: getCurrentProgram(ch.id),
    }));
  }, [showGuide, allChannelsList]);

  const guideScrollRef = useRef<ScrollView>(null);

  const handleToggleGuide = useCallback(() => {
    setShowGuide(prev => !prev);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showGuide) setShowControls(true);
  }, [showGuide]);

  const handleSwitchChannel = useCallback((target: Channel) => {
    setShowGuide(false);
    setFavorite(isFavorite(target.id));
    setCurrentChannelId(target.id);
  }, [isFavorite]);

  // Scroll to current channel in guide
  useEffect(() => {
    if (showGuide && guideScrollRef.current && channel) {
      const idx = allChannelsList.findIndex(ch => ch.id === channel.id);
      if (idx > 0) {
        setTimeout(() => {
          guideScrollRef.current?.scrollTo({ y: Math.max(0, idx * 72 - 100), animated: false });
        }, 50);
      }
    }
  }, [showGuide, channel?.id, allChannelsList]);

  const formatRemaining = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h${mins}min`;
  };

  if (!channel) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <Pressable 
        style={styles.videoContainer} 
        onPress={handleScreenPress}
        focusable={!showControls} // Allow taking focus when controls are hidden
        hasTVPreferredFocus={!showControls} // Request focus when controls hide
        android_ripple={{ color: 'transparent' }}
      >
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          focusable={false} // Prevent video view from taking focus
        />

        {/* Error State */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={Colors.error} />
            <Text style={styles.errorTitle}>Canal indisponivel</Text>
            <Text style={styles.errorText}>
              Este canal esta temporariamente fora do ar.{'\n'}
              Tente novamente mais tarde.
            </Text>
            <TVPressable
              style={styles.retryButton}
              focusScale={1.08}
              onPress={handleRetry}
            >
              <Ionicons name="refresh" size={24} color={Colors.text} />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TVPressable>
            <TVPressable
              style={styles.backButtonError}
              focusScale={1.08}
              onPress={handleBack}
            >
              <Text style={styles.backButtonText}>Voltar aos canais</Text>
            </TVPressable>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !hasError && !showMenu && (
          <>
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
              style={styles.gradient}
            />

            {/* Top Bar */}
            <View style={styles.topBar}>
              <TVPressable
                style={styles.backButton}
                focusScale={1.15}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={28} color={Colors.text} />
              </TVPressable>

              <View style={styles.channelInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {channel.channelNumber && (
                    <Text style={[styles.channelName, { color: Colors.primary, marginRight: 8 }]}>
                      {String(channel.channelNumber).padStart(2, '0')}
                    </Text>
                  )}
                  <Text style={styles.channelName} numberOfLines={1}>
                    {channel.name}
                  </Text>
                </View>
                <Text style={styles.channelCategory}>{channel.category}</Text>
              </View>

              {resolution && (
                <View style={styles.resolutionBadge}>
                  <Text style={styles.resolutionText}>{resolution}</Text>
                </View>
              )}

              <TVPressable
                style={[
                  styles.iconButton,
                  showGuide && styles.iconButtonActive,
                ]}
                focusScale={1.15}
                onPress={handleToggleGuide}
                hasTVPreferredFocus={showControls && !showMenu && !showGuide} // Autofocus this when controls appear
              >
                <Ionicons name="list" size={28} color={Colors.text} />
              </TVPressable>

              <TVPressable
                style={[
                  styles.iconButton,
                  favorite && styles.iconButtonFav,
                ]}
                focusScale={1.15}
                onPress={handleToggleFavorite}
              >
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={28}
                  color={favorite ? '#FF4757' : Colors.text}
                />
              </TVPressable>
            </View>

            {/* Bottom Bar - EPG */}
            <View style={styles.bottomBar}>
              <View style={styles.epgInfo}>
                {epg?.current ? (
                  <>
                    <View style={styles.liveRow}>
                      <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>AO VIVO</Text>
                      </View>
                      <Text style={styles.remainingText}>
                        {formatRemaining(epg.remaining)}
                      </Text>
                    </View>
                    <Text style={styles.programTitle} numberOfLines={1}>
                      {epg.current.title}
                    </Text>
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${epg.progress}%` }]}
                      />
                    </View>
                    {epg.next && (
                      <View style={styles.nextContainer}>
                        <Text style={styles.nextLabel}>A seguir:</Text>
                        <Text style={styles.nextProgram} numberOfLines={1}>
                          {epg.next.title}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>AO VIVO</Text>
                    </View>
                    <Text style={styles.programTitle}>{channel.name}</Text>
                  </>
                )}
              </View>
            </View>
          </>
        )}

        {/* Channel OSD */}
        {osdChannel && !showGuide && !showMenu && (
          <View style={styles.osdContainer}>
            <View style={styles.osdContent}>
              {/* Left: channel number + nav arrows */}
              <View style={styles.osdLeft}>
                <Text style={styles.osdNavArrow}>▲</Text>
                <Text style={styles.osdNumber}>
                  {osdChannel.channelNumber != null
                    ? String(osdChannel.channelNumber).padStart(2, '0')
                    : '—'}
                </Text>
                <Text style={styles.osdNavArrow}>▼</Text>
              </View>

              {/* Right: channel name + EPG info */}
              <View style={styles.osdInfo}>
                <Text style={styles.osdName} numberOfLines={1}>{osdChannel.name}</Text>
                <Text style={styles.osdCategory}>{osdChannel.category}</Text>

                {epg?.current && (
                  <View style={styles.osdEpg}>
                    <View style={styles.osdLiveRow}>
                      <View style={styles.osdLiveDot} />
                      <Text style={styles.osdLiveText}>AO VIVO</Text>
                      {epg.remaining ? (
                        <Text style={styles.osdRemaining}>{formatRemaining(epg.remaining)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.osdProgram} numberOfLines={1}>
                      {epg.current.title}
                    </Text>
                    <View style={styles.osdProgressBar}>
                      <View style={[styles.osdProgressFill, { width: `${epg.progress}%` }]} />
                    </View>
                    {epg.next && (
                      <Text style={styles.osdNext} numberOfLines={1}>
                        A seguir: {epg.next.title}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Menu Overlay */}
        {showMenu && (
          <View style={styles.menuOverlay}>
            <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
            <View style={styles.menuContainer}>
              <Text style={styles.menuTitle}>Opcoes</Text>
              <TVPressable
                style={styles.menuItem}
                focusedStyle={styles.menuItemFocused}
                focusScale={1.03}
                onPress={() => {
                  handleToggleFavorite();
                  setShowMenu(false);
                }}
                hasTVPreferredFocus
              >
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={28}
                  color={favorite ? '#FF4757' : Colors.text}
                />
                <Text style={styles.menuItemText}>
                  {favorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                </Text>
              </TVPressable>
              <TVPressable
                style={styles.menuItem}
                focusedStyle={styles.menuItemFocused}
                focusScale={1.03}
                onPress={() => {
                  setShowMenu(false);
                  handleToggleGuide();
                }}
              >
                <Ionicons name="list" size={28} color={Colors.text} />
                <Text style={styles.menuItemText}>Guia de Canais</Text>
              </TVPressable>
            </View>
          </View>
        )}

        {/* Channel Guide Overlay */}
        {showGuide && (
          <View style={styles.guideOverlay}>
            <Pressable style={styles.guideBackdrop} onPress={handleToggleGuide} />
            <View style={styles.guideContainer}>
              <View style={styles.guideHeader}>
                <Ionicons name="tv-outline" size={24} color={Colors.primary} />
                <Text style={styles.guideTitle}>Guia de Canais</Text>
                <TVPressable
                  style={styles.guideClose}
                  focusScale={1.15}
                  onPress={handleToggleGuide}
                >
                  <Ionicons name="close" size={28} color={Colors.text} />
                </TVPressable>
              </View>
              <ScrollView
                ref={guideScrollRef}
                style={styles.guideList}
                showsVerticalScrollIndicator={false}
              >
                {guideChannels.map(({ channel: ch, epg: chEpg }) => {
                  const isActive = ch.id === channel.id;
                  return (
                    <TVPressable
                      key={ch.id}
                      style={[
                        styles.guideItem,
                        isActive && styles.guideItemActive,
                      ]}
                      focusedStyle={styles.guideItemFocused}
                      focusScale={1.02}
                      onPress={() => !isActive && handleSwitchChannel(ch)}
                    >
                      <View style={styles.guideChannelNum}>
                        <Text style={[styles.guideNumText, isActive && styles.guideNumTextActive]}>
                          {ch.channelNumber}
                        </Text>
                      </View>
                      <View style={styles.guideChannelInfo}>
                        <Text
                          style={[styles.guideChannelName, isActive && styles.guideChannelNameActive]}
                          numberOfLines={1}
                        >
                          {ch.name}
                        </Text>
                        {chEpg?.current ? (
                          <Text style={styles.guideProgramName} numberOfLines={1}>
                            {chEpg.current.title}
                          </Text>
                        ) : (
                          <Text style={styles.guideProgramEmpty}>{ch.category}</Text>
                        )}
                      </View>
                      {isActive && (
                        <View style={styles.guideActiveDot} />
                      )}
                    </TVPressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  gradient: { ...StyleSheet.absoluteFillObject },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
    padding: Spacing.xxl,
  },
  errorTitle: { color: Colors.text, fontSize: Typography.h2.fontSize, fontWeight: '700', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  errorText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize, textAlign: 'center', lineHeight: 28, marginBottom: Spacing.xl },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm,
  },
  retryText: { color: Colors.text, fontWeight: '600', fontSize: Typography.body.fontSize },
  backButtonError: { marginTop: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  backButtonText: { color: Colors.textSecondary, fontSize: Typography.body.fontSize },
  buttonFocused: { backgroundColor: 'rgba(99,102,241,0.3)' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
  },
  backButton: { padding: Spacing.md, marginRight: Spacing.md },
  channelInfo: { flex: 1 },
  channelName: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '600' },
  channelCategory: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  iconButton: { padding: Spacing.md, marginLeft: Spacing.md, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BorderRadius.full },
  iconButtonActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  iconButtonFav: { backgroundColor: 'rgba(255, 71, 87, 0.2)' },
  resolutionBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginLeft: Spacing.md,
  },
  resolutionText: { color: '#fff', fontSize: Typography.caption.fontSize, fontWeight: '700', letterSpacing: 0.5 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
  },
  epgInfo: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: BorderRadius.lg, padding: Spacing.lg },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  liveIndicator: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.live, marginRight: Spacing.xs },
  liveText: { color: Colors.live, fontSize: Typography.caption.fontSize, fontWeight: '700', letterSpacing: 0.5 },
  remainingText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  programTitle: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '600', marginBottom: Spacing.sm },
  progressBar: { height: 6, backgroundColor: Colors.progressBg, borderRadius: BorderRadius.xs, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: Colors.progressFill },
  nextContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  nextLabel: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, fontWeight: '600' },
  nextProgram: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, flex: 1 },
  // Channel OSD — redesigned with EPG support
  osdContainer: {
    position: 'absolute', bottom: Spacing.xl * 2, left: Spacing.xl,
    right: '38%', zIndex: 100,
  },
  osdContent: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.93)', borderRadius: BorderRadius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
  },
  osdLeft: {
    width: 90, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingVertical: Spacing.lg, gap: Spacing.xs,
  },
  osdNavArrow: {
    color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center',
  },
  osdNumber: {
    color: Colors.primary, fontSize: 34, fontWeight: '800',
    fontFamily: 'monospace', textAlign: 'center',
  },
  osdInfo: { flex: 1, padding: Spacing.lg },
  osdName: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700' },
  osdCategory: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 2 },
  osdEpg: {
    marginTop: Spacing.sm, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: Spacing.sm,
  },
  osdLiveRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  osdLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.live },
  osdLiveText: {
    color: Colors.live, fontSize: Typography.caption.fontSize,
    fontWeight: '700', letterSpacing: 0.5, flex: 1, marginLeft: Spacing.xs,
  },
  osdRemaining: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  osdProgram: {
    color: Colors.text, fontSize: Typography.body.fontSize,
    fontWeight: '500', marginBottom: Spacing.xs,
  },
  osdProgressBar: {
    height: 3, backgroundColor: Colors.progressBg,
    borderRadius: 2, overflow: 'hidden', marginBottom: Spacing.xs,
  },
  osdProgressFill: { height: '100%', backgroundColor: Colors.primary },
  osdNext: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize },
  // Menu Overlay
  menuOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 200,
  },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  menuContainer: {
    backgroundColor: 'rgba(20,20,20,0.98)', borderRadius: BorderRadius.xl,
    padding: Spacing.xl, minWidth: 350, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  menuTitle: {
    color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700',
    marginBottom: Spacing.lg, textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md, gap: Spacing.md,
    borderWidth: 2, borderColor: 'transparent',
  },
  menuItemFocused: {
    backgroundColor: 'rgba(99,102,241,0.3)', borderColor: Colors.primary,
  },
  menuItemText: { color: Colors.text, fontSize: Typography.body.fontSize },
  // Guide
  guideOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  guideBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  guideContainer: { width: '45%', backgroundColor: 'rgba(20,20,20,0.98)' },
  guideHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', gap: Spacing.md,
  },
  guideTitle: { color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '700', flex: 1 },
  guideClose: { padding: Spacing.sm },
  guideList: { flex: 1 },
  guideItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  guideItemActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderLeftWidth: 4, borderLeftColor: Colors.primary },
  guideItemFocused: { backgroundColor: 'rgba(99,102,241,0.2)' },
  guideChannelNum: { width: 48, alignItems: 'center' },
  guideNumText: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, fontWeight: '600', fontFamily: 'monospace' },
  guideNumTextActive: { color: Colors.primary },
  guideChannelInfo: { flex: 1, marginLeft: Spacing.md },
  guideChannelName: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '600' },
  guideChannelNameActive: { color: Colors.primary },
  guideProgramName: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 2 },
  guideProgramEmpty: { color: 'rgba(255,255,255,0.25)', fontSize: Typography.caption.fontSize, marginTop: 2 },
  guideActiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.live, marginLeft: Spacing.md },
});
