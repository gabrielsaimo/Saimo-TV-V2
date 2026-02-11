import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Colors';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { clearEPGCache } from '../../services/epgService';
import { clearAllCaches } from '../../services/streamingService';
import PinModal from '../../components/PinModal';

export default function SettingsScreen() {
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinMode, setPinMode] = useState<'verify' | 'change'>('change');
  const [pinAction, setPinAction] = useState<'change' | 'unlock'>('change');

  const {
    showEPG, setShowEPG,
    showChannelNumber, setShowChannelNumber,
    autoplay, setAutoplay,
    adultUnlocked, lockAdult, unlockAdult,
  } = useSettingsStore();

  const { clearFavorites } = useFavoritesStore();

  const handleChangePIN = useCallback(() => {
    setPinAction('change'); setPinMode('change'); setPinModalVisible(true);
  }, []);

  const handleUnlockAdult = useCallback(() => {
    setPinAction('unlock'); setPinMode('verify'); setPinModalVisible(true);
  }, []);

  const handleLockAdult = useCallback(() => {
    lockAdult();
    Alert.alert('Bloqueado', 'Conteúdo adulto bloqueado.');
  }, [lockAdult]);

  const handleClearCache = useCallback(async () => {
    await clearEPGCache();
    Alert.alert('Sucesso', 'Cache EPG limpo!');
  }, []);

  const handleClearMediaCache = useCallback(() => {
    clearAllCaches();
    Alert.alert('Sucesso', 'Cache de mídia limpo!');
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    Alert.alert('Sucesso', 'Favoritos removidos!');
  }, [clearFavorites]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.subtitle}>Configurações do app</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Interface</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="tv-outline" size={26} color={Colors.primary} />
              <Text style={styles.settingLabel}>Mostrar EPG</Text>
            </View>
            <Switch value={showEPG} onValueChange={setShowEPG} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.text} />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="list-outline" size={26} color={Colors.primary} />
              <Text style={styles.settingLabel}>Número do canal</Text>
            </View>
            <Switch value={showChannelNumber} onValueChange={setShowChannelNumber} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.text} />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="play-outline" size={26} color={Colors.primary} />
              <Text style={styles.settingLabel}>Reproduzir automaticamente</Text>
            </View>
            <Switch value={autoplay} onValueChange={setAutoplay} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.text} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Controle Parental</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name={adultUnlocked ? 'lock-open-outline' : 'lock-closed-outline'} size={26} color={adultUnlocked ? Colors.accent : Colors.primary} />
              <Text style={styles.settingLabel}>Conteúdo adulto</Text>
            </View>
            <Switch value={adultUnlocked} onValueChange={(v) => v ? handleUnlockAdult() : handleLockAdult()} trackColor={{ false: Colors.border, true: Colors.accent }} thumbColor={Colors.text} />
          </View>
          <View style={styles.divider} />
          <Pressable style={({ focused }) => [styles.settingRow, focused && styles.settingRowFocused]} onPress={handleChangePIN}>
            <View style={styles.settingInfo}>
              <Ionicons name="key-outline" size={26} color={Colors.primary} />
              <Text style={styles.settingLabel}>Alterar PIN</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Dados</Text>
        <View style={styles.section}>
          <Pressable style={({ focused }) => [styles.settingRow, focused && styles.settingRowFocused]} onPress={handleClearCache}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash-outline" size={26} color={Colors.warning} />
              <Text style={styles.settingLabel}>Limpar cache EPG</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={({ focused }) => [styles.settingRow, focused && styles.settingRowFocused]} onPress={handleClearFavorites}>
            <View style={styles.settingInfo}>
              <Ionicons name="heart-dislike-outline" size={26} color={Colors.error} />
              <Text style={styles.settingLabel}>Remover todos favoritos</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={({ focused }) => [styles.settingRow, focused && styles.settingRowFocused]} onPress={handleClearMediaCache}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash-outline" size={26} color={Colors.error} />
              <Text style={styles.settingLabel}>Limpar cache de mídia</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>Saimo TV Box</Text>
          <Text style={styles.appVersion}>Versão 1.0.0</Text>
        </View>
      </ScrollView>

      <PinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSuccess={() => {
          setPinModalVisible(false);
          if (pinAction === 'unlock') { unlockAdult(); Alert.alert('Desbloqueado', 'Conteúdo adulto desbloqueado.'); }
          else Alert.alert('Sucesso', 'PIN alterado!');
        }}
        mode={pinMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { color: Colors.text, fontSize: Typography.h1.fontSize, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: Spacing.xl },
  sectionTitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  section: { backgroundColor: Colors.cardBg, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  settingRowFocused: { backgroundColor: Colors.surfaceHover, borderWidth: 2, borderColor: Colors.primary },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingLabel: { color: Colors.text, fontSize: Typography.body.fontSize },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.lg + 26 + Spacing.md },
  appInfo: { alignItems: 'center', marginTop: Spacing.xxl, paddingVertical: Spacing.lg },
  appName: { color: Colors.text, fontSize: Typography.body.fontSize, fontWeight: '600' },
  appVersion: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, marginTop: Spacing.xs },
});
