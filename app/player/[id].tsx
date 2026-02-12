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
import { useFavoritesStore } from '../../stores/favoritesStore';
import { getCurrentProgram, fetchChannelEPG } from '../../services/epgService';
import { channels as allChannelsList, getChannelById } from '../../data/channels';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const channel = getChannelById(id);
  const router = useRouter();

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

  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const [favorite, setFavorite] = useState(channel ? isFavorite(channel.id) : false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Channel change without remount
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!channel) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setHasError(false);
    try { player.replace(channel.url); player.play(); } catch {}
  }, [channel?.url, player]);

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
  }, [channel?.id]);

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

  // Back Handler (remote back button)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showGuide) { setShowGuide(false); return true; }
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, [showGuide]);

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
    if (!hasError) setShowControls(prev => !prev);
  }, [hasError, showGuide]);

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
  }, [showGuide]);

  const guideScrollRef = useRef<ScrollView>(null);

  const handleToggleGuide = useCallback(() => {
    setShowGuide(prev => !prev);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showGuide) setShowControls(true);
  }, [showGuide]);

  const handleSwitchChannel = useCallback((target: Channel) => {
    setShowGuide(false);
    isMountedRef.current = false;
    try { player.pause(); } catch {}
    router.replace({
      pathname: '/player/[id]',
      params: { id: target.id },
    });
  }, [router, player]);

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
  }, [showGuide, channel?.id]);

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

      <Pressable style={styles.videoContainer} onPress={handleScreenPress}>
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />

        {/* Error State */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={80} color={Colors.error} />
            <Text style={styles.errorTitle}>Canal indisponível</Text>
            <Text style={styles.errorText}>
              Este canal está temporariamente fora do ar.{'\n'}
              Tente novamente mais tarde.
            </Text>
            <Pressable
              style={({ focused }) => [styles.retryButton, focused && styles.buttonFocused]}
              onPress={handleRetry}
            >
              <Ionicons name="refresh" size={24} color={Colors.text} />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
            <Pressable
              style={({ focused }) => [styles.backButtonError, focused && styles.buttonFocused]}
              onPress={handleBack}
            >
              <Text style={styles.backButtonText}>Voltar aos canais</Text>
            </Pressable>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !hasError && (
          <>
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
              style={styles.gradient}
            />

            {/* Top Bar */}
            <View style={styles.topBar}>
              <Pressable
                style={({ focused }) => [styles.backButton, focused && styles.buttonFocused]}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={28} color={Colors.text} />
              </Pressable>

              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>{channel.name}</Text>
                <Text style={styles.channelCategory}>{channel.category}</Text>
              </View>

              {resolution && (
                <View style={styles.resolutionBadge}>
                  <Text style={styles.resolutionText}>{resolution}</Text>
                </View>
              )}

              <Pressable
                style={({ focused }) => [
                  styles.iconButton,
                  showGuide && styles.iconButtonActive,
                  focused && styles.buttonFocused,
                ]}
                onPress={handleToggleGuide}
              >
                <Ionicons name="list" size={28} color={Colors.text} />
              </Pressable>

              <Pressable
                style={({ focused }) => [
                  styles.iconButton,
                  favorite && styles.iconButtonFav,
                  focused && styles.buttonFocused,
                ]}
                onPress={handleToggleFavorite}
              >
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={28}
                  color={favorite ? '#FF4757' : Colors.text}
                />
              </Pressable>
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

        {/* Channel Guide Overlay */}
        {showGuide && (
          <View style={styles.guideOverlay}>
            <Pressable style={styles.guideBackdrop} onPress={handleToggleGuide} />
            <View style={styles.guideContainer}>
              <View style={styles.guideHeader}>
                <Ionicons name="tv-outline" size={24} color={Colors.primary} />
                <Text style={styles.guideTitle}>Guia de Canais</Text>
                <Pressable
                  style={({ focused }) => [styles.guideClose, focused && styles.buttonFocused]}
                  onPress={handleToggleGuide}
                >
                  <Ionicons name="close" size={28} color={Colors.text} />
                </Pressable>
              </View>
              <ScrollView
                ref={guideScrollRef}
                style={styles.guideList}
                showsVerticalScrollIndicator={false}
              >
                {guideChannels.map(({ channel: ch, epg: chEpg }) => {
                  const isActive = ch.id === channel.id;
                  return (
                    <Pressable
                      key={ch.id}
                      style={({ focused }) => [
                        styles.guideItem,
                        isActive && styles.guideItemActive,
                        focused && styles.guideItemFocused,
                      ]}
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
                    </Pressable>
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
  buttonFocused: { borderWidth: 3, borderColor: Colors.primary, borderRadius: BorderRadius.lg },
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
  guideItemFocused: { backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 2, borderColor: Colors.primary },
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
