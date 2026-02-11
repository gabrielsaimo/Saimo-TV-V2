import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesStore {
    favorites: string[];
    addFavorite: (channelId: string) => void;
    removeFavorite: (channelId: string) => void;
    toggleFavorite: (channelId: string) => void;
    isFavorite: (channelId: string) => boolean;
    clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
    persist(
        (set, get) => ({
            favorites: [],

            addFavorite: (channelId: string) => {
                const { favorites } = get();
                if (!favorites.includes(channelId)) {
                    set({ favorites: [...favorites, channelId] });
                }
            },

            removeFavorite: (channelId: string) => {
                const { favorites } = get();
                set({ favorites: favorites.filter(id => id !== channelId) });
            },

            toggleFavorite: (channelId: string) => {
                const { favorites, addFavorite, removeFavorite } = get();
                if (favorites.includes(channelId)) {
                    removeFavorite(channelId);
                } else {
                    addFavorite(channelId);
                }
            },

            isFavorite: (channelId: string) => {
                return get().favorites.includes(channelId);
            },

            clearFavorites: () => {
                set({ favorites: [] });
            },
        }),
        {
            name: 'saimo-favorites',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
