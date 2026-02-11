import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PIN = '1234';

interface SettingsStore {
    // PIN e controle adulto
    adultPin: string;
    adultUnlocked: boolean;

    // Player
    autoplay: boolean;
    volume: number;

    // UI
    showChannelNumber: boolean;
    showEPG: boolean;

    // Ações
    setAdultPin: (pin: string) => void;
    verifyPin: (pin: string) => boolean;
    unlockAdult: () => void;
    lockAdult: () => void;
    setAutoplay: (value: boolean) => void;
    setVolume: (value: number) => void;
    setShowChannelNumber: (value: boolean) => void;
    setShowEPG: (value: boolean) => void;
    resetSettings: () => void;
}

const initialState = {
    adultPin: DEFAULT_PIN,
    adultUnlocked: false,
    autoplay: true,
    volume: 1,
    showChannelNumber: true,
    showEPG: true,
};

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            setAdultPin: (pin: string) => {
                if (pin.length === 4 && /^\d{4}$/.test(pin)) {
                    set({ adultPin: pin });
                }
            },

            verifyPin: (pin: string) => {
                return get().adultPin === pin;
            },

            unlockAdult: () => {
                set({ adultUnlocked: true });
            },

            lockAdult: () => {
                set({ adultUnlocked: false });
            },

            setAutoplay: (value: boolean) => {
                set({ autoplay: value });
            },

            setVolume: (value: number) => {
                set({ volume: Math.max(0, Math.min(1, value)) });
            },

            setShowChannelNumber: (value: boolean) => {
                set({ showChannelNumber: value });
            },

            setShowEPG: (value: boolean) => {
                set({ showEPG: value });
            },

            resetSettings: () => {
                set(initialState);
            },
        }),
        {
            name: 'saimo-settings',
            storage: createJSONStorage(() => AsyncStorage),
            // Não persistir o estado de desbloqueio adulto
            partialize: (state) => ({
                adultPin: state.adultPin,
                autoplay: state.autoplay,
                volume: state.volume,
                showChannelNumber: state.showChannelNumber,
                showEPG: state.showEPG,
            }),
        }
    )
);
