// Serviço de mídia - funções auxiliares + wrappers para streamingService
import type { MediaItem, SeriesItem } from '../types';
import {
    loadAllPreviews,
    fetchCategoryPage,
    getCategoryItems,
    loadNextPage,
    searchInLoadedData,
    CATEGORIES,
} from './streamingService';

// Re-exportar categorias do streamingService
export const MEDIA_CATEGORIES = CATEGORIES;

// Utility: Duplicatas por NOME exato (case-insensitive)
export function deduplicateByName(items: MediaItem[]): MediaItem[] {
    const seen = new Set<string>();
    const unique: MediaItem[] = [];

    for (const item of items) {
        const name = (item.tmdb?.title || item.name).trim().toLowerCase();
        if (!seen.has(name)) {
            seen.add(name);
            unique.push(item);
        }
    }
    return unique;
}

// Carregar preview (p1) de uma categoria
export async function loadCategory(categoryId: string): Promise<MediaItem[]> {
    const existing = getCategoryItems(categoryId);
    if (existing.length > 0) return existing;
    return fetchCategoryPage(categoryId, 1);
}

// Carregar previews de todas categorias
export async function loadInitialCategories(): Promise<Map<string, MediaItem[]>> {
    return loadAllPreviews();
}

// Carregar próxima página de uma categoria (para infinite scroll)
export async function loadMoreForCategory(categoryId: string): Promise<{
    items: MediaItem[];
    hasMore: boolean;
}> {
    return loadNextPage(categoryId);
}

// Buscar mídia por nome (nos dados carregados em memória)
export function searchMedia(query: string, items?: MediaItem[]): MediaItem[] {
    let results: MediaItem[] = [];
    // Se items fornecido, busca neles
    if (items && items.length > 0) {
        const normalized = query.toLowerCase().trim();
        if (!normalized) return deduplicateByName(items);
        results = items.filter(item => {
            const title = item.tmdb?.title || item.name;
            return title.toLowerCase().includes(normalized);
        });
    } else {
        // Senão, busca em todo o cache
        results = searchInLoadedData(query);
    }
    return deduplicateByName(results);
}

// Filtrar mídia
export function filterMedia(
    items: MediaItem[],
    type?: 'movie' | 'tv',
    genre?: string,
    year?: string,
): MediaItem[] {
    return items.filter(item => {
        if (type && item.type !== type) return false;
        if (genre && !item.tmdb?.genres?.includes(genre)) return false;
        if (year && item.tmdb?.year !== year) return false;
        return true;
    });
}

// Deduplicar mídia (por ID e por nome)
export function deduplicateMedia(items: MediaItem[]): MediaItem[] {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    return items.filter(item => {
        // Checar ID
        if (seenIds.has(item.id)) return false;

        // Checar nome normalizado
        const name = (item.tmdb?.title || item.name || '').toLowerCase().trim();
        if (name && seenNames.has(name)) return false;

        seenIds.add(item.id);
        if (name) seenNames.add(name);

        return true;
    });
}

// Ordenar mídia
export function sortMedia(
    items: MediaItem[],
    by: 'rating' | 'year' | 'name' | 'popularity' = 'rating'
): MediaItem[] {
    return [...items].sort((a, b) => {
        switch (by) {
            case 'rating':
                return (b.tmdb?.rating || 0) - (a.tmdb?.rating || 0);
            case 'year':
                return (b.tmdb?.year || '0').localeCompare(a.tmdb?.year || '0');
            case 'name':
                return (a.tmdb?.title || a.name).localeCompare(b.tmdb?.title || b.name);
            case 'popularity':
                return (b.tmdb?.popularity || 0) - (a.tmdb?.popularity || 0);
            default:
                return 0;
        }
    });
}

// Obter todos os gêneros únicos
export function getAllGenres(items: MediaItem[]): string[] {
    const genres = new Set<string>();
    items.forEach(item => {
        item.tmdb?.genres?.forEach(g => genres.add(g));
    });
    return Array.from(genres).sort();
}

// Obter todos os anos únicos
export function getAllYears(items: MediaItem[]): string[] {
    const years = new Set<string>();
    items.forEach(item => {
        if (item.tmdb?.year) years.add(item.tmdb.year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
}

// Buscar filmes/séries por ator
export function getMediaByActor(actorId: number, items: MediaItem[]): MediaItem[] {
    return items.filter(item =>
        item.tmdb?.cast?.some((c: any) => c.id === actorId)
    );
}

// Buscar item por ID (nos dados carregados)
export async function getMediaById(id: string): Promise<MediaItem | null> {
    const allCategories = await loadInitialCategories();
    for (const items of Array.from(allCategories.values())) {
        const found = items.find((item: MediaItem) => item.id === id);
        if (found) return found;
    }
    return null;
}

// Buscar série por ID
export async function getSeriesById(id: string): Promise<SeriesItem | null> {
    const item = await getMediaById(id);
    if (item && isSeries(item)) {
        return item as unknown as SeriesItem;
    }
    return null;
}

// Verificar se um item é série
export function isSeries(item: any): boolean {
    return item.episodes && Object.keys(item.episodes).length > 0;
}
