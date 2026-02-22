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

  // We don't really have "modes" in react-native-keyevent as it propagates events regardless.
  // But we use this to filter in JS if needed.
  const modeRef = useRef<TVKeyMode>('intercept');

  const setMode = useCallback((mode: TVKeyMode) => {
    modeRef.current = mode;
  }, []);

  useEffect(() => {
    const listener = (evt: { keyCode: number; action: number }) => {
      if (modeRef.current === 'disabled') return;

      const eventType = mapKeyCodeToEventType(evt.keyCode);
      if (eventType) {
        handlerRef.current({
          eventType,
          keyCode: evt.keyCode,
          action: evt.action === 0 ? 'down' : 'up',
        });
      }
    };

    // Save subscriptions so we can remove only THESE listeners on cleanup
    // (removeAllListeners is dangerous — it nukes every listener globally)
    const upSub   = DeviceEventEmitter.addListener('onKeyUp',   (e) => listener({ ...e, action: 1 }));
    const downSub = DeviceEventEmitter.addListener('onKeyDown', (e) => listener({ ...e, action: 0 }));

    return () => {
      upSub.remove();
      downSub.remove();
    };
  }, []);

  return { setMode };
}

function mapKeyCodeToEventType(keyCode: number): TVKeyEventType | null {
  switch (keyCode) {
    case 19: return 'up';
    case 20: return 'down';
    case 21: return 'left';
    case 22: return 'right';
    case 23: // DPAD_CENTER
    case 66: // ENTER
    case 160: // NUMPAD_ENTER
      return 'select';
    case 82: return 'menu';
    case 85: // PLAY_PAUSE
    case 126: // PLAY
    case 127: // PAUSE
      return 'playPause';
    case 89: return 'rewind';
    case 90: return 'fastForward';
    case 166: return 'channelUp';
    case 167: return 'channelDown';
    default: return null;
  }
}
