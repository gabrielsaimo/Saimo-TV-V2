/**
 * Trending Service — busca tendências do TMDB e cruza com o catálogo local.
 * Cache de 30 minutos em memória para não chamar a API toda vez.
 */
import type { MediaItem } from '../types';
import { getAllLoadedCategories } from './streamingService';

const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Cache em memória (apenas os IDs do TMDB)
let tmdbTodayIdsCache: number[] | null = null;
let tmdbWeekIdsCache: number[] | null = null;
let lastFetchToday = 0;
let lastFetchWeek = 0;

/** Busca uma página de IDs do TMDB para o período dado */
async function fetchTMDBPage(period: 'day' | 'week', page: number): Promise<number[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/trending/all/${period}?api_key=${TMDB_API_KEY}&language=pt-BR&page=${page}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: { id: number }) => item.id);
  } catch {
    return [];
  }
}

/** Busca até `pages` páginas em paralelo e retorna todos os IDs do TMDB */
async function fetchTMDBTrending(period: 'day' | 'week', pages = 5): Promise<number[]> {
  const pageNums = Array.from({ length: pages }, (_, i) => i + 1);
  const results = await Promise.all(pageNums.map(p => fetchTMDBPage(period, p)));
  return results.flat();
}

/** Procura um item no catálogo local pelo TMDB ID */
function findByTmdbId(tmdbId: number): MediaItem | null {
  const categories = getAllLoadedCategories();
  for (const [, items] of categories) {
    for (const item of items) {
      if (item.tmdb?.id === tmdbId) return item;
    }
  }
  return null;
}

/** Filtra a lista de IDs do TMDB pelos itens existentes no catálogo local */
function filterByLocalCatalog(tmdbIds: number[]): MediaItem[] {
  const matched: MediaItem[] = [];
  const seen = new Set<string>();
  for (const id of tmdbIds) {
    const item = findByTmdbId(id);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      matched.push(item);
    }
  }
  return matched;
}

/** Tendências do dia — com cache de 30 min */
export async function getTrendingToday(): Promise<MediaItem[]> {
  const now = Date.now();
  if (!tmdbTodayIdsCache || now - lastFetchToday > CACHE_DURATION) {
    tmdbTodayIdsCache = await fetchTMDBTrending('day', 5);
    lastFetchToday = now;
  }
  return filterByLocalCatalog(tmdbTodayIdsCache);
}

/** Tendências da semana — com cache de 30 min */
export async function getTrendingWeek(): Promise<MediaItem[]> {
  const now = Date.now();
  if (!tmdbWeekIdsCache || now - lastFetchWeek > CACHE_DURATION) {
    tmdbWeekIdsCache = await fetchTMDBTrending('week', 5);
    lastFetchWeek = now;
  }
  return filterByLocalCatalog(tmdbWeekIdsCache);
}

/** Busca ambas em paralelo */
export async function getAllTrending(): Promise<{ today: MediaItem[]; week: MediaItem[] }> {
  const [today, week] = await Promise.all([getTrendingToday(), getTrendingWeek()]);
  return { today, week };
}

/** Zera o cache para forçar re-fetch na próxima chamada */
export function clearTrendingCache(): void {
  tmdbTodayIdsCache = null;
  tmdbWeekIdsCache = null;
  lastFetchToday = 0;
  lastFetchWeek = 0;
}
