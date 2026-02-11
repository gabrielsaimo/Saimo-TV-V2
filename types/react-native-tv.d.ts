/**
 * Type augmentations for React Native TV (Android TV / Fire TV)
 *
 * Adds TV-specific props and state callback types that are available
 * when running on Android TV but not in the standard RN type definitions.
 */

import 'react-native';

declare module 'react-native' {
  // Extend PressableStateCallbackType to include 'focused' for TV
  interface PressableStateCallbackType {
    focused: boolean;
  }

  // Extend PressableProps to include TV-specific navigation props
  interface PressableProps {
    hasTVPreferredFocus?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
  }
}
