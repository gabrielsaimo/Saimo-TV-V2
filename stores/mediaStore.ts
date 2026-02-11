// Store de mídia (filmes/séries) com Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaFilterType, MediaSortType, SeriesProgress } from '../types';

interface MediaFavorite {
    id: string;
    addedAt: number;
}

interface MediaState {
    // Favoritos
    favorites: MediaFavorite[];
    addFavorite: (id: string) => void;
    removeFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;

    // Histórico de visualização (filmes)
    watchHistory: { id: string; watchedAt: number; progress?: number }[];
    addToHistory: (id: string, progress?: number) => void;
    getProgress: (id: string) => number | undefined;

    // Progresso de séries (Continuar de onde parou)
    seriesProgress: SeriesProgress[];
    setSeriesProgress: (seriesId: string, season: number, episode: number, episodeId: string) => void;
    getSeriesProgress: (seriesId: string) => SeriesProgress | undefined;

    // Filtros ativos
    activeFilter: MediaFilterType;
    activeSort: MediaSortType;
    activeGenre: string | null;
    activeYear: string | null;
    setFilter: (filter: MediaFilterType) => void;
    setSort: (sort: MediaSortType) => void;
    setGenre: (genre: string | null) => void;
    setYear: (year: string | null) => void;
    clearFilters: () => void;
}

export const useMediaStore = create<MediaState>()(
    persist(
        (set, get) => ({
            // Favoritos
            favorites: [],

            addFavorite: (id: string) => {
                const { favorites } = get();
                if (!favorites.some(f => f.id === id)) {
                    set({
                        favorites: [...favorites, { id, addedAt: Date.now() }]
                    });
                }
            },

            removeFavorite: (id: string) => {
                set({
                    favorites: get().favorites.filter(f => f.id !== id)
                });
            },

            isFavorite: (id: string) => {
                return get().favorites.some(f => f.id === id);
            },

            // Histórico (filmes)
            watchHistory: [],

            addToHistory: (id: string, progress?: number) => {
                const { watchHistory } = get();
                const existing = watchHistory.findIndex(h => h.id === id);
                const entry = { id, watchedAt: Date.now(), progress };

                if (existing >= 0) {
                    const updated = [...watchHistory];
                    updated[existing] = entry;
                    set({ watchHistory: updated });
                } else {
                    const updated = [entry, ...watchHistory].slice(0, 100);
                    set({ watchHistory: updated });
                }
            },

            getProgress: (id: string) => {
                return get().watchHistory.find(h => h.id === id)?.progress;
            },

            // Progresso de séries
            seriesProgress: [],

            setSeriesProgress: (seriesId: string, season: number, episode: number, episodeId: string) => {
                const { seriesProgress } = get();
                const existing = seriesProgress.findIndex(p => p.seriesId === seriesId);
                const entry: SeriesProgress = { seriesId, season, episode, episodeId, watchedAt: Date.now() };

                if (existing >= 0) {
                    const updated = [...seriesProgress];
                    updated[existing] = entry;
                    set({ seriesProgress: updated });
                } else {
                    set({ seriesProgress: [...seriesProgress, entry] });
                }
            },

            getSeriesProgress: (seriesId: string) => {
                return get().seriesProgress.find(p => p.seriesId === seriesId);
            },

            // Filtros
            activeFilter: 'all',
            activeSort: 'rating',
            activeGenre: null,
            activeYear: null,

            setFilter: (filter) => set({ activeFilter: filter }),
            setSort: (sort) => set({ activeSort: sort }),
            setGenre: (genre) => set({ activeGenre: genre }),
            setYear: (year) => set({ activeYear: year }),

            clearFilters: () => set({
                activeFilter: 'all',
                activeSort: 'rating',
                activeGenre: null,
                activeYear: null,
            }),
        }),
        {
            name: 'saimo-media-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                favorites: state.favorites,
                watchHistory: state.watchHistory,
                seriesProgress: state.seriesProgress,
            }),
        }
    )
);
