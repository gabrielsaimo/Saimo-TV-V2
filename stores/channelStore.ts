import { create } from 'zustand';
import type { Channel, CategoryId } from '../types';
import { channels, adultChannels, categoryOrder, getChannelsByCategory } from '../data/channels';

interface ChannelStore {
    // Estado
    selectedCategory: CategoryId | 'Todos' | 'Favoritos' | string;
    currentChannelId: string | null;
    searchQuery: string;
    isLoading: boolean;
    isProList: boolean;
    proChannels: Channel[];

    // Ações
    setCategory: (category: CategoryId | 'Todos' | 'Favoritos' | string) => void;
    setCurrentChannel: (channelId: string | null) => void;
    setSearchQuery: (query: string) => void;
    setLoading: (loading: boolean) => void;
    setProList: (isPro: boolean) => void;
    fetchProChannels: () => Promise<void>;

    // Seletores
    getFilteredChannels: (includeAdult: boolean, favorites: string[]) => Channel[];
    getCategories: (includeAdult: boolean) => string[];
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
    selectedCategory: 'Todos',
    currentChannelId: null,
    searchQuery: '',
    isLoading: false,
    isProList: false,
    proChannels: [],

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

    setProList: (isPro) => {
        set({ isProList: isPro, selectedCategory: 'Todos' });
    },

    fetchProChannels: async () => {
        try {
            set({ isLoading: true });
            const res = await fetch('https://raw.githubusercontent.com/gabrielsaimo/Saimo-TV/main/public/data/lista_pro.json');
            const data = await res.json();
            set({ proChannels: data, isLoading: false });
        } catch (error) {
            console.error('Failed to fetch pro channels:', error);
            set({ isLoading: false });
        }
    },

    getFilteredChannels: (includeAdult: boolean, favorites: string[]) => {
        const { selectedCategory, searchQuery, isProList, proChannels } = get();

        // Base de canais
        let allChs: Channel[] = [];
        if (isProList) {
            allChs = includeAdult
                ? proChannels
                : proChannels.filter(ch => ch.category !== 'ADULTOS' && ch.category !== 'Adulto');
        } else {
            allChs = includeAdult
                ? [...channels, ...adultChannels]
                : channels;
        }

        // Filtro por categoria ou resolução
        if (selectedCategory === 'Favoritos') {
            allChs = allChs.filter(ch => favorites.includes(ch.id));
        } else if (['4K', 'FHD', 'HD', 'SD'].includes(selectedCategory as string)) {
            const res = (selectedCategory as string).toLowerCase();
            allChs = allChs.filter(ch => {
                const name = ch.name.toLowerCase();
                if (res === '4k') return name.includes('4k');
                if (res === 'fhd') return name.includes('fhd') && !name.includes('4k');
                if (res === 'hd') return (name.includes(' hd') || name.endsWith('hd')) && !name.includes('fhd');
                if (res === 'sd') return name.includes('sd');
                return true;
            });
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
        const { isProList, proChannels } = get();
        const resolutions = ['4K', 'FHD', 'HD', 'SD'];

        if (isProList) {
            const cats = Array.from(new Set(proChannels.map(ch => ch.category)));
            const filteredCats = includeAdult ? cats : cats.filter(c => c !== 'ADULTOS' && c !== 'Adulto');
            return ['Todos', 'Favoritos', ...resolutions, ...filteredCats];
        }

        if (includeAdult) {
            return ['Todos', 'Favoritos', ...resolutions, ...categoryOrder];
        }
        return ['Todos', 'Favoritos', ...resolutions, ...categoryOrder.filter(c => c !== 'Adulto')];
    },
}));
