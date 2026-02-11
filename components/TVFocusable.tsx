import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
  Platform,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface TVFocusableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: ViewStyle;
  focusStyle?: ViewStyle;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  disabled?: boolean;
  scaleOnFocus?: boolean;
}

export default function TVFocusable({
  children,
  onPress,
  onLongPress,
  onFocus,
  onBlur,
  style,
  focusStyle,
  hasTVPreferredFocus,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  disabled,
  scaleOnFocus = true,
}: TVFocusableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (scaleOnFocus) {
      Animated.spring(scaleAnim, {
        toValue: 1.05,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
    onFocus?.();
  }, [onFocus, scaleOnFocus, scaleAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (scaleOnFocus) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
    onBlur?.();
  }, [onBlur, scaleOnFocus, scaleAnim]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      style={({ focused }) => [
        style,
        focused && styles.focused,
        focused && focusStyle,
      ]}
    >
      <Animated.View
        style={[
          { transform: [{ scale: scaleOnFocus ? scaleAnim : 1 }] },
        ]}
      >
        {children}
        {isFocused && <View style={styles.focusBorder} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focused: {
    zIndex: 10,
  },
  focusBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: 14,
    pointerEvents: 'none',
  },
});
