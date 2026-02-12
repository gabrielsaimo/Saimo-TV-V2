import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, Typography, Shadows, scale } from '../constants/Colors';
import { useSettingsStore } from '../stores/settingsStore';

interface PinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'verify' | 'change';
}

const PIN_LENGTH = 4;

export default function PinModal({ visible, onClose, onSuccess, mode = 'verify' }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');

  const { verifyPin, setAdultPin } = useSettingsStore();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { setPin(''); setNewPin(''); setConfirmPin(''); setError(''); setStep('current'); }
  }, [visible]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleKeyPress = useCallback((digit: string) => {
    if (mode === 'verify') {
      if (pin.length < PIN_LENGTH) {
        const newValue = pin + digit;
        setPin(newValue);
        setError('');
        if (newValue.length === PIN_LENGTH) {
          if (verifyPin(newValue)) { onSuccess(); onClose(); }
          else { shake(); setError('PIN incorreto'); setTimeout(() => setPin(''), 300); }
        }
      }
    } else {
      if (step === 'current') {
        if (pin.length < PIN_LENGTH) {
          const newValue = pin + digit;
          setPin(newValue); setError('');
          if (newValue.length === PIN_LENGTH) {
            if (verifyPin(newValue)) { setStep('new'); setPin(''); }
            else { shake(); setError('PIN atual incorreto'); setTimeout(() => setPin(''), 300); }
          }
        }
      } else if (step === 'new') {
        if (newPin.length < PIN_LENGTH) {
          const newValue = newPin + digit;
          setNewPin(newValue); setError('');
          if (newValue.length === PIN_LENGTH) setStep('confirm');
        }
      } else {
        if (confirmPin.length < PIN_LENGTH) {
          const newValue = confirmPin + digit;
          setConfirmPin(newValue); setError('');
          if (newValue.length === PIN_LENGTH) {
            if (newValue === newPin) { setAdultPin(newValue); onSuccess(); onClose(); }
            else { shake(); setError('PINs não conferem'); setConfirmPin(''); }
          }
        }
      }
    }
  }, [pin, newPin, confirmPin, step, mode, verifyPin, setAdultPin, onSuccess, onClose, shake]);

  const handleDelete = useCallback(() => {
    if (mode === 'verify') setPin(prev => prev.slice(0, -1));
    else if (step === 'current') setPin(prev => prev.slice(0, -1));
    else if (step === 'new') setNewPin(prev => prev.slice(0, -1));
    else setConfirmPin(prev => prev.slice(0, -1));
    setError('');
  }, [mode, step]);

  const currentValue = mode === 'verify' ? pin : step === 'current' ? pin : step === 'new' ? newPin : confirmPin;
  const getTitle = () => {
    if (mode === 'verify') return 'Digite o PIN';
    if (step === 'current') return 'PIN Atual';
    if (step === 'new') return 'Novo PIN';
    return 'Confirmar PIN';
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
          <Pressable style={({ focused }) => [styles.closeButton, focused && styles.closeFocused]} onPress={onClose}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
          <Ionicons name="lock-closed" size={48} color={Colors.primary} />
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{mode === 'verify' ? 'Conteúdo restrito' : 'Digite 4 dígitos'}</Text>
          <View style={styles.dotsContainer}>
            {Array(PIN_LENGTH).fill(0).map((_, i) => (
              <View key={i} style={[styles.dot, i < currentValue.length && styles.dotFilled, error && styles.dotError]} />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.keypad}>
            {digits.map((digit, index) => {
              if (digit === '') return <View key={index} style={styles.keyEmpty} />;
              if (digit === 'del') return (
                <Pressable key={index} style={({ focused }) => [styles.key, focused && styles.keyFocused]} onPress={handleDelete}>
                  <Ionicons name="backspace-outline" size={28} color={Colors.text} />
                </Pressable>
              );
              return (
                <Pressable key={index} style={({ focused }) => [styles.key, focused && styles.keyFocused]} onPress={() => handleKeyPress(digit)}>
                  <Text style={styles.keyText}>{digit}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xxl, alignItems: 'center', width: scale(420), ...Shadows.lg },
  closeButton: { position: 'absolute', top: Spacing.md, right: Spacing.md, padding: Spacing.sm },
  closeFocused: { backgroundColor: Colors.surfaceHover, borderRadius: BorderRadius.full },
  title: { color: Colors.text, fontSize: Typography.h2.fontSize, fontWeight: '700', marginTop: Spacing.lg, marginBottom: Spacing.xs },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.caption.fontSize, textAlign: 'center', marginBottom: Spacing.xl },
  dotsContainer: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg },
  dot: { width: scale(20), height: scale(20), borderRadius: scale(10), borderWidth: 2, borderColor: Colors.border },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dotError: { borderColor: Colors.error, backgroundColor: Colors.error },
  error: { color: Colors.error, fontSize: Typography.caption.fontSize, marginBottom: Spacing.md },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: scale(300), justifyContent: 'center', gap: Spacing.md },
  key: { width: scale(80), height: scale(80), borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  keyFocused: { backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.text },
  keyEmpty: { width: scale(80), height: scale(80) },
  keyText: { color: Colors.text, fontSize: scale(28), fontWeight: '600' },
});
