// Serviço de streaming online - carrega dados sob demanda via fetch
// Substitui o downloadService.ts - sem downloads, tudo online
import type { MediaItem } from '../types';
import { Paths, File as FSFile, Directory } from 'expo-file-system';

const GITHUB_BASE = 'https://raw.githubusercontent.com/gabrielsaimo/free-tv/main/public/data/enriched/';

// Cache em memória por página: "categoryId-pN" → items
const PAGE_CACHE = new Map<string, MediaItem[]>();

// Cache consolidado por categoria: categoryId → todos items carregados
const CATEGORY_CACHE = new Map<string, MediaItem[]>();

// Controle de última página por categoria
const LAST_PAGE = new Map<string, number>(); // última página conhecida
const HAS_MORE = new Map<string, boolean>(); // se há mais páginas

// ============================================================
// Persistent disk cache (survives app restarts)
// Uses expo-file-system v19 new API (Paths/File/Directory)
// ============================================================
let _diskDir: Directory | null = null;
let _diskReady = false;

function getDiskDir(): Directory {
    if (!_diskDir) {
        _diskDir = new Directory(Paths.document, 'sc');
    }
    return _diskDir;
}

function ensureDisk(): boolean {
    if (_diskReady) return true;
    // Never give up permanently — always retry (filesystem may become ready later)
    try {
        const dir = getDiskDir();
        if (!dir.exists) {
            dir.create({ intermediates: true, idempotent: true });
        }
        _diskReady = true;
        console.log('[DiskCache] Disk ready at:', dir.uri);
        return true;
    } catch (e) {
        console.warn('[DiskCache] ensureDisk failed (will retry):', e);
        return false;
    }
}

/** Save page to disk — deferred to next event loop tick to avoid blocking JS thread */
function diskSave(key: string, items: MediaItem[]): void {
    // setTimeout(0) garante que a escrita em disco não bloqueia o tick atual
    // Crítico no Fire TV Lite: file.write() é síncrono e pode levar 20-50ms por página
    setTimeout(() => {
        try {
            if (!ensureDisk()) return;
            const dir = getDiskDir();
            const file = new FSFile(dir, `${key}.json`);
            const content = JSON.stringify(items);
            // Always use overwrite:true — safely handles both new and existing files
            file.create({ overwrite: true });
            file.write(content);
        } catch (e) {
            console.warn('[DiskCache] diskSave failed:', key, e);
        }
    }, 0);
}

/** Read page from disk (sync — only used during fetch cache-hit path) */
function diskLoad(key: string): MediaItem[] | null {
    try {
        if (!ensureDisk()) return null;
        const dir = getDiskDir();
        const file = new FSFile(dir, `${key}.json`);
        if (!file.exists) return null;
        if (file.size === 0) return null;
        const raw = file.textSync();
        if (!raw || raw.length < 2) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[DiskCache] diskLoad failed:', key, e);
        return null;
    }
}

/** Async disk read — non-blocking, used by hydrateFromDisk */
async function diskLoadAsync(key: string): Promise<MediaItem[] | null> {
    try {
        if (!ensureDisk()) return null;
        const dir = getDiskDir();
        const file = new FSFile(dir, `${key}.json`);
        if (!file.exists) return null;
        if (file.size === 0) return null;
        const raw = await file.text();
        if (!raw || raw.length < 2) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[DiskCache] diskLoadAsync failed:', key, e);
        return null;
    }
}

/**
 * Hydrate ALL pages from disk — async, non-blocking.
 * Yields every 5 categories to keep D-pad responsive during hydration.
 * Returns true if any data was restored.
 */
export async function hydrateFromDisk(): Promise<boolean> {
    if (!ensureDisk()) {
        console.warn('[DiskCache] Hydration skipped — disk unavailable');
        return false;
    }

    let restored = false;
    let count = 0;
    let totalItems = 0;

    for (let i = 0; i < CATEGORIES.length; i++) {
        const cat = CATEGORIES[i];

        let page = 1;
        let catItems: MediaItem[] = [];

        while (true) {
            const key = `${cat.id}-p${page}`;
            if (PAGE_CACHE.has(key)) {
                catItems.push(...(PAGE_CACHE.get(key) || []));
                page++;
                continue;
            }

            const items = await diskLoadAsync(key);
            if (!items || items.length === 0) break;

            PAGE_CACHE.set(key, items);
            catItems.push(...items);
            restored = true;
            page++;
        }

        if (catItems.length > 0) {
            CATEGORY_CACHE.set(cat.id, deduplicateItems(catItems));
            LAST_PAGE.set(cat.id, page - 1);
            const lastPageItems = PAGE_CACHE.get(`${cat.id}-p${page - 1}`);
            HAS_MORE.set(cat.id, lastPageItems ? lastPageItems.length >= 50 : false);
            count++;
            totalItems += catItems.length;
        }

        // Yield every 5 categories to let D-pad events and renders through
        if ((i + 1) % 5 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }

    console.log(`[DiskCache] Hydration complete: ${count} categories, ${totalItems} items restored`);
    return restored;
}

// Número de categorias carregadas em paralelo
export const PARALLEL_BATCH_SIZE = 4; // Reduzido para mostrar itens mais rápido

// TODAS as categorias
export const CATEGORIES = [
    { id: 'acao', name: 'Ação' },
    { id: 'amc-plus', name: 'AMC+' },
    { id: 'animacao', name: 'Animação' },
    { id: 'apple-tv', name: 'Apple TV+' },
    { id: 'aventura', name: 'Aventura' },
    { id: 'brasil-paralelo', name: 'Brasil Paralelo' },
    { id: 'cinema', name: 'Cinema' },
    { id: 'claro-video', name: 'Claro Vídeo' },
    { id: 'comedia', name: 'Comédia' },
    { id: 'crime', name: 'Crime' },
    { id: 'crunchyroll', name: 'Crunchyroll' },
    { id: 'cursos', name: 'Cursos' },
    { id: 'directv', name: 'DirecTV' },
    { id: 'discovery', name: 'Discovery' },
    { id: 'disney', name: 'Disney+' },
    { id: 'docu', name: 'Documentários (Séries)' },
    { id: 'documentario', name: 'Documentários' },
    { id: 'doramas', name: 'Doramas' },
    { id: 'drama', name: 'Drama' },
    { id: 'dublagem-nao-oficial', name: 'Dublagem Não Oficial' },
    { id: 'especial-infantil', name: 'Especial Infantil' },
    { id: 'esportes', name: 'Esportes' },
    { id: 'familia', name: 'Família' },
    { id: 'fantasia', name: 'Fantasia' },
    { id: 'faroeste', name: 'Faroeste' },
    { id: 'ficcao-cientifica', name: 'Ficção Científica' },
    { id: 'funimation-now', name: 'Funimation' },
    { id: 'globoplay', name: 'Globoplay' },
    { id: 'guerra', name: 'Guerra' },
    { id: 'hot-adultos-bella-da-semana', name: 'Adultos - Bella da Semana' },
    { id: 'hot-adultos-legendado', name: 'Adultos - Legendado' },
    { id: 'hot-adultos', name: 'Adultos' },
    { id: 'lancamentos', name: 'Lançamentos' },
    { id: 'legendadas', name: 'Séries Legendadas' },
    { id: 'legendados', name: 'Filmes Legendados' },
    { id: 'lionsgate', name: 'Lionsgate' },
    { id: 'max', name: 'Max' },
    { id: 'nacionais', name: 'Nacionais' },
    { id: 'netflix', name: 'Netflix' },
    { id: 'novelas-turcas', name: 'Novelas Turcas' },
    { id: 'novelas', name: 'Novelas' },
    { id: 'oscar-2025', name: 'Oscar 2025' },
    { id: 'outras-produtoras', name: 'Outras Produtoras' },
    { id: 'outros', name: 'Outros' },
    { id: 'outros_filmes', name: 'Outros Filmes' },
    { id: 'paramount', name: 'Paramount+' },
    { id: 'plutotv', name: 'Pluto TV' },
    { id: 'prime-video', name: 'Prime Video' },
    { id: 'programas-de-tv', name: 'Programas de TV' },
    { id: 'religiosos', name: 'Religiosos' },
    { id: 'romance', name: 'Romance' },
    { id: 'sbt', name: 'SBT' },
    { id: 'shows', name: 'Shows' },
    { id: 'stand-up-comedy', name: 'Stand Up Comedy' },
    { id: 'star', name: 'Star+' },
    { id: 'sugestao-da-semana', name: 'Sugestão da Semana' },
    { id: 'suspense', name: 'Suspense' },
    { id: 'terror', name: 'Terror' },
    { id: 'uhd-4k', name: 'UHD 4K' },
    { id: 'univer', name: 'Univer' },
];

// ============================================================
// Funções de fetch
// ============================================================

/**
 * Busca uma página específica de uma categoria
 * Retorna array vazio se a página não existir (404)
 */
export async function fetchCategoryPage(
    categoryId: string,
    page: number
): Promise<MediaItem[]> {
    const cacheKey = `${categoryId}-p${page}`;

    // Memory cache hit
    if (PAGE_CACHE.has(cacheKey)) {
        return PAGE_CACHE.get(cacheKey)!;
    }

    // Disk cache hit (fast local I/O, no network)
    const diskItems = diskLoad(cacheKey);
    if (diskItems && diskItems.length > 0) {
        PAGE_CACHE.set(cacheKey, diskItems);
        const existing = CATEGORY_CACHE.get(categoryId) || [];
        CATEGORY_CACHE.set(categoryId, deduplicateItems([...existing, ...diskItems]));
        const currentLast = LAST_PAGE.get(categoryId) || 0;
        if (page > currentLast) LAST_PAGE.set(categoryId, page);
        if (diskItems.length < 50) HAS_MORE.set(categoryId, false);
        else if (!HAS_MORE.has(categoryId)) HAS_MORE.set(categoryId, true);
        return diskItems;
    }

    try {
        const url = `${GITHUB_BASE}${categoryId}-p${page}.json`;
        const response = await fetch(url);

        if (!response.ok) {
            // 404 = não há mais páginas
            HAS_MORE.set(categoryId, false);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            HAS_MORE.set(categoryId, false);
            return [];
        }

        // Processar itens (manter apenas campos essenciais)
        const items: MediaItem[] = data.map((obj: any, index: number) => createMediaItem(obj, index));

        // Cachear a página (memória + disco)
        PAGE_CACHE.set(cacheKey, items);
        diskSave(cacheKey, items);

        // Atualizar cache consolidado
        const existing = CATEGORY_CACHE.get(categoryId) || [];
        const merged = deduplicateItems([...existing, ...items]);
        CATEGORY_CACHE.set(categoryId, merged);

        // Atualizar controle de páginas
        const currentLast = LAST_PAGE.get(categoryId) || 0;
        if (page > currentLast) {
            LAST_PAGE.set(categoryId, page);
        }

        // Se retornou menos que 50, provavelmente é a última
        if (items.length < 50) {
            HAS_MORE.set(categoryId, false);
        } else {
            HAS_MORE.set(categoryId, true);
        }

        return items;

    } catch (error: any) {
        console.warn(`[StreamingService] Erro em ${categoryId}-p${page}:`, error.message);
        // Em caso de erro de rede, não marca como sem mais páginas
        return [];
    }
}

/**
 * Carrega a primeira página (preview) de todas as categorias
 * Usado na tela inicial - carrega em batches paralelos
 */
export async function loadAllPreviews(): Promise<Map<string, MediaItem[]>> {
    const result = new Map<string, MediaItem[]>();

    for (let i = 0; i < CATEGORIES.length; i += PARALLEL_BATCH_SIZE) {
        const batch = CATEGORIES.slice(i, i + PARALLEL_BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(async (cat) => {
                // Se já tem no cache, retorna
                if (CATEGORY_CACHE.has(cat.id)) {
                    return { id: cat.id, items: CATEGORY_CACHE.get(cat.id)! };
                }
                const items = await fetchCategoryPage(cat.id, 1);
                return { id: cat.id, items };
            })
        );

        for (const { id, items } of batchResults) {
            if (items.length > 0) {
                result.set(id, items);
            }
        }
    }

    return result;
}

/**
 * Carrega a próxima página de uma categoria
 * Retorna todos os itens acumulados (não apenas os novos)
 */
export async function loadNextPage(categoryId: string): Promise<{
    items: MediaItem[];
    hasMore: boolean;
}> {
    const currentPage = LAST_PAGE.get(categoryId) || 1;
    const nextPage = currentPage + 1;

    // Verificar se já sabemos que não tem mais
    if (HAS_MORE.get(categoryId) === false) {
        return {
            items: CATEGORY_CACHE.get(categoryId) || [],
            hasMore: false,
        };
    }

    const newItems = await fetchCategoryPage(categoryId, nextPage);

    return {
        items: CATEGORY_CACHE.get(categoryId) || [],
        hasMore: HAS_MORE.get(categoryId) !== false,
    };
}

/**
 * Obtém todos os itens carregados de uma categoria
 */
export function getCategoryItems(categoryId: string): MediaItem[] {
    return CATEGORY_CACHE.get(categoryId) || [];
}

/**
 * Verifica se uma categoria tem mais páginas para carregar
 */
export function categoryHasMore(categoryId: string): boolean {
    return HAS_MORE.get(categoryId) !== false;
}

/**
 * Carrega todas as páginas de uma categoria (para busca completa)
 * Use com cuidado - carrega tudo na memória
 */
export async function loadAllPagesForCategory(categoryId: string): Promise<MediaItem[]> {
    let page = LAST_PAGE.get(categoryId) || 1;

    // Se p1 não foi carregada ainda, começar do 1
    if (!PAGE_CACHE.has(`${categoryId}-p1`)) {
        page = 1;
    } else {
        page = page + 1; // começar da próxima não carregada
    }

    while (HAS_MORE.get(categoryId) !== false) {
        const items = await fetchCategoryPage(categoryId, page);
        if (items.length === 0) break;
        page++;
    }

    return CATEGORY_CACHE.get(categoryId) || [];
}

/**
 * Busca em todas as categorias carregadas em memória
 */
export function searchInLoadedData(query: string, maxResults = 200): MediaItem[] {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];

    const results: MediaItem[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    for (const items of CATEGORY_CACHE.values()) {
        for (const item of items) {
            if (seenIds.has(item.id)) continue;
            const title = (item.tmdb?.title || item.name).toLowerCase().trim();
            if (seenTitles.has(title)) continue;
            if (title.includes(normalized)) {
                results.push(item);
                seenIds.add(item.id);
                seenTitles.add(title);
                if (results.length >= maxResults) return results;
            }
        }
    }

    return results;
}

// ============================================================
// Cache management
// ============================================================

/** Clear memory caches only — disk cache stays intact for next startup */
export function clearOnlyMemory() {
    PAGE_CACHE.clear();
    CATEGORY_CACHE.clear();
    LAST_PAGE.clear();
    HAS_MORE.clear();
}

/** Clear EVERYTHING: memory + disk. Used only by the hard reload button. */
export function clearAllCaches() {
    PAGE_CACHE.clear();
    CATEGORY_CACHE.clear();
    LAST_PAGE.clear();
    HAS_MORE.clear();
    try {
        const dir = getDiskDir();
        if (dir.exists) dir.delete();
        _diskReady = false;
        console.log('[DiskCache] All caches cleared (memory + disk)');
    } catch (e) {
        console.warn('[DiskCache] disk delete failed:', e);
    }
}

/**
 * Invalida apenas o cache de p1 de todas as categorias.
 * Usado no refresh para forçar re-fetch de dados frescos
 * sem perder as páginas já carregadas (p2, p3, etc).
 */
export function invalidateP1Cache() {
    const dir = getDiskDir();
    for (const cat of CATEGORIES) {
        PAGE_CACHE.delete(`${cat.id}-p1`);
        if (_diskReady) {
            try {
                const file = new FSFile(dir, `${cat.id}-p1.json`);
                if (file.exists) file.delete();
            } catch (e) {
                console.warn('[DiskCache] invalidateP1Cache delete failed:', cat.id, e);
            }
        }
    }
}

/**
 * Retorna snapshot de todas as categorias carregadas no cache
 */
export function getAllLoadedCategories(): Map<string, MediaItem[]> {
    return new Map(CATEGORY_CACHE);
}

/**
 * Retorna o total de itens carregados em todas as categorias
 */
export function getTotalLoadedCount(): number {
    let count = 0;
    CATEGORY_CACHE.forEach(items => { count += items.length; });
    return count;
}

/**
 * Inicia o carregamento em segundo plano de TODAS as páginas restantes.
 * Usa paralelismo controlado (2 categorias simultâneas) com delays para não travar UI.
 */
let isBackgroundLoading = false;
let stopBackgroundLoading = false;

export async function stopLoading() {
    stopBackgroundLoading = true;
}

export function isLoadingInBackground(): boolean {
    return isBackgroundLoading;
}

const BG_PARALLEL = 1;       // 1 categoria por vez — menos pressão de CPU/IO no Fire TV Lite
const BG_PAGE_DELAY = 300;   // ms entre páginas — mais respiro para navegação D-pad
const BG_CAT_DELAY = 150;    // ms entre categorias

export async function startBackgroundLoading(
    onNewData?: () => void
): Promise<void> {
    if (isBackgroundLoading) return;
    isBackgroundLoading = true;
    stopBackgroundLoading = false;

    console.log('[BackgroundLoad] Iniciando carregamento profundo...');

    // Processar categorias em batches de BG_PARALLEL
    for (let i = 0; i < CATEGORIES.length; i += BG_PARALLEL) {
        if (stopBackgroundLoading) break;

        const batch = CATEGORIES.slice(i, i + BG_PARALLEL);

        // Carregar todas as páginas de cada categoria do batch em paralelo
        await Promise.all(
            batch.map(async (cat) => {
                if (stopBackgroundLoading) return;

                while (HAS_MORE.get(cat.id) !== false && !stopBackgroundLoading) {
                    const currentPage = LAST_PAGE.get(cat.id) || 1;
                    const nextPage = currentPage + 1;
                    const key = `${cat.id}-p${nextPage}`;

                    if (PAGE_CACHE.has(key)) {
                        // Já cached, pular (safety: avançar LAST_PAGE)
                        if (nextPage > currentPage) LAST_PAGE.set(cat.id, nextPage);
                        continue;
                    }

                    try {
                        const newItems = await fetchCategoryPage(cat.id, nextPage);
                        if (newItems.length === 0) break;

                        // Delay curto para ceder a thread JS
                        await new Promise(r => setTimeout(r, BG_PAGE_DELAY));
                    } catch {
                        break;
                    }
                }
            })
        );

        // Notificar UI após cada batch de categorias
        if (onNewData && !stopBackgroundLoading) onNewData();

        // Delay entre batches
        await new Promise(r => setTimeout(r, BG_CAT_DELAY));
    }

    // Notificação final
    if (onNewData) onNewData();

    isBackgroundLoading = false;
    console.log('[BackgroundLoad] Finalizado.');
}

// ============================================================
// Helpers
// ============================================================

function createMediaItem(obj: any, index: number): MediaItem {
    return {
        id: obj.id || `item-${index}`,
        name: obj.name || 'Sem título',
        url: obj.url || '',
        category: obj.category || '',
        type: obj.type || 'movie',
        isAdult: obj.isAdult || false,
        episodes: obj.episodes,
        tmdb: obj.tmdb ? {
            id: obj.tmdb.id,
            imdbId: obj.tmdb.imdbId,
            title: obj.tmdb.title || obj.name || 'Sem título',
            originalTitle: obj.tmdb.originalTitle,
            tagline: obj.tmdb.tagline,
            overview: obj.tmdb.overview?.slice(0, 300) || '',
            status: obj.tmdb.status,
            language: obj.tmdb.language,
            releaseDate: obj.tmdb.releaseDate,
            year: obj.tmdb.year || '',
            runtime: obj.tmdb.runtime,
            rating: obj.tmdb.rating || 0,
            voteCount: obj.tmdb.voteCount,
            popularity: obj.tmdb.popularity,
            certification: obj.tmdb.certification,
            genres: obj.tmdb.genres?.slice(0, 3) || [],
            poster: obj.tmdb.poster || '',
            posterHD: obj.tmdb.posterHD,
            backdrop: obj.tmdb.backdrop,
            backdropHD: obj.tmdb.backdropHD,
            logo: obj.tmdb.logo,
            cast: obj.tmdb.cast || [],
        } : undefined,
    };
}

function deduplicateItems(items: MediaItem[]): MediaItem[] {
    const map = new Map<string, MediaItem>();
    for (const item of items) {
        const key = item.tmdb?.id?.toString() || item.id;
        if (!map.has(key)) {
            map.set(key, item);
        } else if (item.type === 'tv' && item.episodes) {
            // Mesclar episódios de séries
            const existing = map.get(key)!;
            if (existing.episodes && item.episodes) {
                Object.keys(item.episodes).forEach(season => {
                    if (!existing.episodes![season]) {
                        existing.episodes![season] = item.episodes![season];
                    } else {
                        const existingEps = existing.episodes![season];
                        const newEps = item.episodes![season];
                        newEps.forEach(ep => {
                            if (!existingEps.some(e => e.episode === ep.episode)) {
                                existingEps.push(ep);
                            }
                        });
                        existingEps.sort((a, b) => a.episode - b.episode);
                    }
                });
            }
        }
    }
    return Array.from(map.values());
}
