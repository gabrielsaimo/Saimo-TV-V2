import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  BackHandler,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { useMediaStore } from '../../stores/mediaStore';
import { useTVKeyHandler } from '../../hooks/useTVKeyHandler';
import type { SeriesEpisodes } from '../../types';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function resolveRedirects(initialUrl: string): Promise<string> {
  try {
    const response = await fetch(initialUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });
    return response.url;
  } catch {
    try {
      const response = await fetch(initialUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'Range': 'bytes=0-0',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
      });
      return response.url;
    } catch {
      return initialUrl;
    }
  }
}

export default function TVMediaPlayerScreen() {
  const params = useLocalSearchParams<{
    id: string;
    url: string;
    title: string;
    seriesId?: string;
    season?: string;
    episode?: string;
    seriesName?: string;
    seriesEpisodes?: string;
  }>();
  const router = useRouter();

  const rawUrl = params.url || '';
  const decodedUrl = rawUrl ? decodeURIComponent(rawUrl) : '';
  const { id, title } = params;

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoViewRef = useRef<VideoView>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const { addToHistory, setSeriesProgress } = useMediaStore();

  // Parse series context for next episode
  const seriesContext = useMemo(() => {
    if (!params.seriesId || !params.seriesEpisodes) return null;
    try {
      const episodes: SeriesEpisodes = JSON.parse(decodeURIComponent(params.seriesEpisodes));
      const currentSeason = params.season || '1';
      const currentEpisode = parseInt(params.episode || '1', 10);
      return {
        seriesId: params.seriesId,
        seriesName: params.seriesName || '',
        episodes,
        currentSeason,
        currentEpisode,
      };
    } catch {
      return null;
    }
  }, [params.seriesId, params.seriesEpisodes, params.season, params.episode, params.seriesName]);

  const nextEpisode = useMemo(() => {
    if (!seriesContext) return null;
    const { episodes, currentSeason, currentEpisode } = seriesContext;
    const seasonEps = episodes[currentSeason];
    if (!seasonEps) return null;

    const nextEpInSeason = seasonEps.find(ep => ep.episode === currentEpisode + 1);
    if (nextEpInSeason) return { episode: nextEpInSeason, season: currentSeason };

    const seasons = Object.keys(episodes).sort((a, b) => parseInt(a) - parseInt(b));
    const currentSeasonIndex = seasons.indexOf(currentSeason);
    if (currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
      const nextSeasonKey = seasons[currentSeasonIndex + 1];
      const nextSeasonEps = episodes[nextSeasonKey];
      if (nextSeasonEps && nextSeasonEps.length > 0) {
        return { episode: nextSeasonEps[0], season: nextSeasonKey };
      }
    }
    return null;
  }, [seriesContext]);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisode || !seriesContext) return;
    const { episode: ep, season } = nextEpisode;
    setSeriesProgress(seriesContext.seriesId, parseInt(season), ep.episode, ep.id);
    router.replace({
      pathname: '/media-player/[id]' as any,
      params: {
        id: ep.id,
        url: encodeURIComponent(ep.url),
        title: `${seriesContext.seriesName} - T${season} E${ep.episode}`,
        seriesId: seriesContext.seriesId,
        season: season,
        episode: ep.episode.toString(),
        seriesName: seriesContext.seriesName,
        seriesEpisodes: params.seriesEpisodes,
      },
    });
  }, [nextEpisode, seriesContext, router, setSeriesProgress, params.seriesEpisodes]);

  // Resolve redirects
  useEffect(() => {
    isMountedRef.current = true;
    if (!decodedUrl) {
      setError('URL do video nao recebida');
      setDebugInfo('URL vazia - nenhum parametro recebido');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setDebugInfo(`Resolvendo: ${decodedUrl}`);

    resolveRedirects(decodedUrl).then((finalUrl) => {
      if (!isMountedRef.current) return;
      setDebugInfo(`Original: ${decodedUrl}\nFinal: ${finalUrl}`);
      setResolvedUrl(finalUrl);
    }).catch((err) => {
      if (!isMountedRef.current) return;
      setDebugInfo(`Fallback para URL original: ${decodedUrl}\nErro: ${err}`);
      setResolvedUrl(decodedUrl);
    });

    return () => { isMountedRef.current = false; };
  }, [decodedUrl, retryKey]);

  // Expo Video player
  const player = useVideoPlayer(null, (p) => {
    p.staysActiveInBackground = true;
    p.timeUpdateEventInterval = 0.5;
  });

  // When URL is resolved, load and play
  useEffect(() => {
    if (!resolvedUrl) return;
    player.replace(resolvedUrl);
    player.play();
  }, [resolvedUrl, player]);

  // Player listeners
  useEffect(() => {
    if (!player) return;
    const subs: any[] = [];

    subs.push(player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;
      const { status, error: statusError } = payload;
      if (status === 'loading') setIsLoading(true);
      else if (status === 'readyToPlay') { setIsLoading(false); player.play(); }
      else if (status === 'error') {
        setIsLoading(false);
        if (statusError) setError(`Erro ao reproduzir: ${statusError.message}`);
      }
    }));

    subs.push(player.addListener('playingChange', (payload) => {
      if (!isMountedRef.current) return;
      isPlayingRef.current = payload.isPlaying;
      setIsPlaying(payload.isPlaying);
    }));

    subs.push(player.addListener('timeUpdate', (event) => {
      if (!isMountedRef.current) return;
      setCurrentTime(event.currentTime);
      if (player.duration) setDuration(player.duration);
    }));

    return () => subs.forEach(s => s.remove());
  }, [player]);

  // Controls auto-hide timer
  // resetHideTimer tem referência estável (sem deps de estado) para não
  // resetar o timer a cada mudança de isPlaying (ex: buffering).
  // Usa isPlayingRef.current no callback para pegar o valor mais recente.
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlayingRef.current) setShowControls(false);
    }, 5000);
  }, []); // sem deps — referência estável

  // Inicia o timer uma única vez no mount
  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const handleClose = useCallback(async () => {
    isMountedRef.current = false;
    if (player) player.pause();
    if (id) addToHistory(id);
    router.back();
  }, [id, router, addToHistory, player]);

  // Back Handler (remote back button)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => handler.remove();
  }, [handleClose]);



  const togglePlayPause = useCallback(() => {
    if (isPlaying) player.pause();
    else player.play();
    resetHideTimer();
  }, [isPlaying, player, resetHideTimer]);

  const handleSkipForward = useCallback(() => {
    if (!player) return;
    player.currentTime = Math.min(currentTime + 10, duration || currentTime + 10);
    resetHideTimer();
  }, [currentTime, duration, player, resetHideTimer]);

  const handleSkipBackward = useCallback(() => {
    if (!player) return;
    player.currentTime = Math.max(currentTime - 10, 0);
    resetHideTimer();
  }, [currentTime, player, resetHideTimer]);

  const handleSeekPress = useCallback((event: any) => {
    if (!player || duration <= 0) return;
    const { locationX } = event.nativeEvent;
    const barWidth = Dimensions.get('window').width - Spacing.xl * 2;
    const percent = Math.max(0, Math.min(1, locationX / barWidth));
    player.currentTime = percent * duration;
    resetHideTimer();
  }, [duration, player, resetHideTimer]);

  const handleScreenPress = () => {
    if (showControls) setShowControls(false);
    else resetHideTimer();
  };

  // D-pad / Remote key handler
  const { setMode } = useTVKeyHandler(
    (event) => {
      if (showControls) {
        // Controls visible → passthrough mode handles D-pad focus navigation
        switch (event.eventType) {
          case 'playPause':
            togglePlayPause();
            break;
          case 'down':
            setShowControls(false);
            break;
          case 'menu':
            break;
        }
        return;
      }

      // Controls hidden → intercept mode, handle all keys directly
      switch (event.eventType) {
        case 'left':
        case 'rewind':
          handleSkipBackward();
          break;
        case 'right':
        case 'fastForward':
          handleSkipForward();
          break;
        case 'select':
        case 'playPause':
          togglePlayPause();
          break;
        case 'up':
          resetHideTimer();
          break;
        case 'down':
          resetHideTimer();
          break;
        case 'menu':
          break;
      }
    },
  );

  // Switch D-pad mode based on controls visibility
  useEffect(() => {
    if (showControls) {
      setMode('passthrough');
    } else {
      setMode('intercept');
    }
  }, [showControls, setMode]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <Pressable style={styles.videoContainer} onPress={handleScreenPress}>
        {resolvedUrl ? (
          <VideoView
            ref={videoViewRef}
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
          />
        ) : null}
      </Pressable>

      {/* Loading */}
      {isLoading && !error && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {resolvedUrl ? 'Carregando video...' : 'Resolvendo link...'}
          </Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={80} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>DEBUG INFO:</Text>
            <Text style={styles.debugText} selectable>ID: {id || '(vazio)'}</Text>
            <Text style={styles.debugText} selectable>{debugInfo}</Text>
          </View>
          <TVPressable
            style={styles.retryButton}
            focusScale={1.08}
            onPress={() => {
              setError(null); setResolvedUrl(null);
              setIsLoading(true); setRetryKey(k => k + 1);
            }}
          >
            <Ionicons name="refresh" size={24} color="#000" />
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TVPressable>
        </View>
      )}

      {/* Controls */}
      {showControls && !error && (
        <View style={styles.controls}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TVPressable
              style={styles.closeButton}
              focusScale={1.15}
              onPress={handleClose}
            >
              <Ionicons name="arrow-back" size={28} color="white" />
            </TVPressable>
            <Text style={styles.title} numberOfLines={1}>{title || 'Reproduzindo'}</Text>
            {nextEpisode && (
              <TVPressable
                style={styles.nextEpisodeButton}
                focusedStyle={styles.nextEpisodeFocused}
                focusScale={1.1}
                onPress={handleNextEpisode}
              >
                <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
                <Text style={styles.nextEpisodeText}>
                  T{nextEpisode.season} E{nextEpisode.episode.episode}
                </Text>
              </TVPressable>
            )}
            {!nextEpisode && <View style={{ width: 50 }} />}
          </View>

          {/* Center Controls */}
          <View style={styles.centerControls}>
            <TVPressable
              style={styles.skipButton}
              focusScale={1.1}
              onPress={handleSkipBackward}
            >
              <Ionicons name="play-back" size={40} color="white" />
              <Text style={styles.skipText}>10s</Text>
            </TVPressable>

            <TVPressable
              style={styles.playButton}
              focusedStyle={styles.playButtonFocused}
              focusScale={1.15}
              onPress={togglePlayPause}
              hasTVPreferredFocus
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={56} color="white" />
            </TVPressable>

            <TVPressable
              style={styles.skipButton}
              focusScale={1.1}
              onPress={handleSkipForward}
            >
              <Ionicons name="play-forward" size={40} color="white" />
              <Text style={styles.skipText}>10s</Text>
            </TVPressable>
          </View>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeSeparator}>/</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
            <Pressable
              style={styles.progressBarContainer}
              onPress={handleSeekPress}
            >
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                <View style={[styles.progressThumb, { left: `${progress}%` }]} />
              </View>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { flex: 1 },
  video: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  loadingText: { color: Colors.text, marginTop: Spacing.md, fontSize: Typography.body.fontSize },
  errorText: { color: Colors.error, marginTop: Spacing.md, fontSize: Typography.body.fontSize, textAlign: 'center', paddingHorizontal: Spacing.xl },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md, marginTop: Spacing.lg, gap: Spacing.sm,
  },
  retryText: { color: '#000', fontWeight: '600', fontSize: Typography.body.fontSize },
  buttonFocused: { backgroundColor: 'rgba(99,102,241,0.3)' },
  debugContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: Spacing.lg, marginTop: Spacing.lg, marginHorizontal: Spacing.xl, maxWidth: '80%',
  },
  debugTitle: { color: '#FFD700', fontSize: Typography.caption.fontSize, fontWeight: '700', marginBottom: Spacing.sm },
  debugText: { color: '#aaa', fontSize: 14, fontFamily: 'monospace', marginBottom: 4 },
  controls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  closeButton: { padding: Spacing.md, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: BorderRadius.full },
  title: { flex: 1, color: Colors.text, fontSize: Typography.h3.fontSize, fontWeight: '600', textAlign: 'center', marginHorizontal: Spacing.md },
  centerControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xxxl },
  playButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: Spacing.xl, borderRadius: BorderRadius.full },
  playButtonFocused: { backgroundColor: 'rgba(99,102,241,0.4)' },
  skipButton: { alignItems: 'center', padding: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: BorderRadius.lg },
  skipText: { color: Colors.text, fontSize: Typography.caption.fontSize, marginTop: 4 },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  timeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  timeText: { color: Colors.text, fontSize: Typography.body.fontSize, fontFamily: 'monospace' },
  timeSeparator: { color: Colors.textSecondary, marginHorizontal: Spacing.sm },
  progressBarContainer: { width: '100%', height: 48, justifyContent: 'center', paddingVertical: 12 },
  progressBarBg: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, position: 'relative' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progressThumb: { position: 'absolute', width: 20, height: 20, backgroundColor: Colors.primary, borderRadius: 10, top: -6, marginLeft: -10 },
  // Next Episode Button
  nextEpisodeButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.3)',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg, gap: Spacing.xs,
    borderWidth: 2, borderColor: 'transparent',
  },
  nextEpisodeFocused: {
    backgroundColor: 'rgba(99,102,241,0.6)',
  },
  nextEpisodeText: { color: Colors.text, fontSize: Typography.caption.fontSize, fontWeight: '600' },
});
