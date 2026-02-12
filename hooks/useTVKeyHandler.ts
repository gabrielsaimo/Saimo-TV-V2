import { useEffect, useRef, useCallback } from 'react';
import { NativeModules, DeviceEventEmitter } from 'react-native';

const { KeyEventModule } = NativeModules;

export type TVKeyEventType =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'menu'
  | 'playPause'
  | 'rewind'
  | 'fastForward'
  | 'channelUp'
  | 'channelDown';

export interface TVKeyEvent {
  eventType: TVKeyEventType;
  keyCode: number;
  action: 'down' | 'up';
}

export type TVKeyMode = 'disabled' | 'intercept' | 'passthrough';

export type TVKeyHandler = (event: TVKeyEvent) => void;

/**
 * Hook to intercept Android TV remote D-pad and media key events.
 * Enables native key interception on mount, disables on unmount.
 * Only fires handler on key-up to avoid repeat/double-fire.
 *
 * @param handler Callback for key events
 * @returns { setMode } to switch between intercept/passthrough/disabled
 */
export function useTVKeyHandler(handler: TVKeyHandler) {
  const handlerRef = useRef<TVKeyHandler>(handler);
  handlerRef.current = handler;

  const setMode = useCallback((mode: TVKeyMode) => {
    KeyEventModule?.setMode(mode);
  }, []);

  useEffect(() => {
    KeyEventModule?.setMode('intercept');

    const subscription = DeviceEventEmitter.addListener(
      'onTVKeyEvent',
      (event: TVKeyEvent) => {
        // Only fire on key-up to prevent repeat actions from held keys
        if (event.action === 'up') {
          handlerRef.current(event);
        }
      },
    );

    return () => {
      subscription.remove();
      KeyEventModule?.setMode('disabled');
    };
  }, []);

  return { setMode };
}
