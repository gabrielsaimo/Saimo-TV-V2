import React, { useState, useCallback, useRef, ReactNode } from 'react';
import {
  Pressable,
  Animated,
  ViewStyle,
  StyleProp,
  PressableProps,
  StyleSheet,
} from 'react-native';
import { Colors, BorderRadius } from '../constants/Colors';

// ... imports

interface TVPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Style for the visible container (border, background, padding, etc.) */
  style?: StyleProp<ViewStyle>;
  /** Extra style applied when focused (merged with default focus glow) */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Layout style for the outer Pressable (flex, position, width, margin) */
  outerStyle?: StyleProp<ViewStyle>;
  /** Scale factor when focused. Default: 1.06 */
  focusScale?: number;
  /** Border color when focused. Default: '#6366F1' (primary) */
  focusBorderColor?: string;
  children: ReactNode | ((state: { focused: boolean }) => ReactNode);
}

/**
 * TV-optimized Pressable with reliable focus indication.
 * Uses onFocus/onBlur + Animated (proven to work on Android TV)
 * instead of Pressable's ({ focused }) style callback (unreliable).
 */
export default function TVPressable({
  style,
  focusedStyle,
  outerStyle,
  focusScale = 1.06,
  focusBorderColor = '#6366F1',
  onFocus,
  onBlur,
  children,
  ...pressableProps
}: TVPressableProps) {
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    Animated.spring(scaleAnim, {
      toValue: focusScale,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
    onFocus?.(e);
  }, [scaleAnim, focusScale, onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
    onBlur?.(e);
  }, [scaleAnim, onBlur]);

  const childrenNode = typeof children === 'function' ? children({ focused: isFocused }) : children;

  return (
    <Pressable
      {...pressableProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={outerStyle}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale: scaleAnim }], borderWidth: 3, borderColor: 'transparent' },
          isFocused && {
            borderColor: focusBorderColor,
            elevation: 16,
            zIndex: 999, // Ensure focused item is above others
          },
          isFocused && focusedStyle,
        ]}
      >
        {childrenNode}
      </Animated.View>
    </Pressable>
  );
}
