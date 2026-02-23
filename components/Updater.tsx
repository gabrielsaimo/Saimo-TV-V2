import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Colors, BorderRadius, Spacing, Typography, Shadows, scale } from '../constants/Colors';
import TVPressable from './TVPressable';

const UPDATE_URL = "https://raw.githubusercontent.com/gabrielsaimo/Saimo-TV/refs/heads/main/update.json";

interface UpdateInfo {
  version: string;
  url: string;
  releaseNotes?: string;
}

export default function Updater() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const checkUpdate = useCallback(async () => {
    try {
      if (UPDATE_URL.includes('TODO')) return;

      const response = await fetch(UPDATE_URL, { cache: 'no-store' });
      const data: UpdateInfo = await response.json();

      if (compareVersions(data.version, currentVersion) > 0) {
        setUpdateInfo(data);
        setVisible(true);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
      }
    } catch (error) {
      console.log('Update check failed:', error);
    }
  }, [currentVersion, fadeAnim, slideAnim]);

  useEffect(() => {
    checkUpdate();
  }, [checkUpdate]);

  const compareVersions = (v1: string, v2: string) => {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const p1 = v1Parts[i] || 0;
      const p2 = v2Parts[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const handleDownload = async () => {
    if (!updateInfo || !updateInfo.url) return;
    setIsDownloading(true);
    setErrorMsg('');

    try {
      const apkUri = FileSystem.documentDirectory + 'update.apk';
      
      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.url,
        apkUri,
        {},
        (downloadProgressResult) => {
          const progress = downloadProgressResult.totalBytesWritten / downloadProgressResult.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result) {
         installApk(result.uri);
      } else {
        setErrorMsg('Erro ao realizar o download.');
        setIsDownloading(false);
      }
    } catch (e) {
      console.log('Download error:', e);
      setErrorMsg('Erro ao baixar atualização.');
      setIsDownloading(false);
    }
  };

  const installApk = async (uri: string) => {
    try {
      if (Platform.OS === 'android') {
        const cUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: cUri,
          flags: 1,
          type: 'application/vnd.android.package-archive',
        });
        setVisible(false);
      }
    } catch (e) {
      console.log('Install error:', e);
      setErrorMsg('Erro ao iniciar a instalação.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          
          <Ionicons name="cloud-download" size={48} color={Colors.primary} />
          
          <Text style={styles.title}>Atualização Disponível</Text>
          <Text style={styles.subtitle}>
            Versão {updateInfo?.version} está disponível para download.
          </Text>
          {updateInfo?.releaseNotes && (
             <Text style={styles.notes}>{updateInfo.releaseNotes}</Text>
          )}

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}% concluído</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TVPressable
                style={[styles.button, styles.btnLater]}
                focusedStyle={styles.btnLaterFocused}
                onPress={handleClose}
              >
                <Text style={styles.btnLaterText}>Depois</Text>
              </TVPressable>
              
              <TVPressable
                style={[styles.button, styles.btnUpdate]}
                focusedStyle={styles.btnUpdateFocused}
                onPress={handleDownload}
              >
                <Text style={styles.btnUpdateText}>Atualizar Agora</Text>
              </TVPressable>
            </View>
          )}

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: scale(500),
    ...Shadows.lg,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.h2.fontSize,
    fontWeight: '700',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.body.fontSize,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  error: {
    color: Colors.error,
    fontSize: Typography.caption.fontSize,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  progressBarBg: {
    width: '100%',
    height: scale(8),
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    color: Colors.primary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    minWidth: scale(140),
    alignItems: 'center',
  },
  btnLater: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnLaterFocused: {
    borderColor: Colors.textSecondary,
    backgroundColor: Colors.surfaceVariant,
  },
  btnLaterText: {
    color: Colors.textSecondary,
    fontSize: Typography.label.fontSize,
    fontWeight: '600',
  },
  btnUpdate: {
    backgroundColor: Colors.primary,
  },
  btnUpdateFocused: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.05 }],
  },
  btnUpdateText: {
    color: 'white',
    fontSize: Typography.label.fontSize,
    fontWeight: 'bold',
  },
});
