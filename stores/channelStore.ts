import { create } from 'zustand';
import type { Channel, CategoryId } from '../types';
import { channels, adultChannels, categoryOrder, getChannelsByCategory } from '../data/channels';

interface ChannelStore {
    // Estado
    selectedCategory: CategoryId | 'Todos' | 'Favoritos';
    currentChannelId: string | null;
    searchQuery: string;
    isLoading: boolean;

    // Ações
    setCategory: (category: CategoryId | 'Todos' | 'Favoritos') => void;
    setCurrentChannel: (channelId: string | null) => void;
    setSearchQuery: (query: string) => void;
    setLoading: (loading: boolean) => void;

    // Seletores
    getFilteredChannels: (includeAdult: boolean, favorites: string[]) => Channel[];
    getCategories: (includeAdult: boolean) => string[];
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
    selectedCategory: 'Todos',
    currentChannelId: null,
    searchQuery: '',
    isLoading: false,

    setCategory: (category) => {
        set({ selectedCategory: category });
    },

    setCurrentChannel: (channelId) => {
        set({ currentChannelId: channelId });
    },

    setSearchQuery: (query) => {
        set({ searchQuery: query });
    },

    setLoading: (loading) => {
        set({ isLoading: loading });
    },

    getFilteredChannels: (includeAdult: boolean, favorites: string[]) => {
        const { selectedCategory, searchQuery } = get();

        // Base de canais
        let allChs = includeAdult
            ? [...channels, ...adultChannels]
            : channels;

        // Filtro por categoria
        if (selectedCategory === 'Favoritos') {
            allChs = allChs.filter(ch => favorites.includes(ch.id));
        } else if (selectedCategory !== 'Todos') {
            allChs = allChs.filter(ch => ch.category === selectedCategory);
        }

        // Filtro por busca
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            allChs = allChs.filter(ch =>
                ch.name.toLowerCase().includes(query) ||
                ch.category.toLowerCase().includes(query)
            );
        }

        return allChs;
    },

    getCategories: (includeAdult: boolean) => {
        if (includeAdult) {
            return ['Todos', 'Favoritos', ...categoryOrder];
        }
        return ['Todos', 'Favoritos', ...categoryOrder.filter(c => c !== 'Adulto')];
    },
}));
