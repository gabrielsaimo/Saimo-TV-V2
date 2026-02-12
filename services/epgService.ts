// EPG Service - Cache persistente em disco (7 dias) via expo-file-system
// Cada canal salvo em arquivo separado para evitar CursorWindow error do AsyncStorage

import * as FileSystem from 'expo-file-system';
import type { Program, CurrentProgram } from '../types';
import { getEPGUrl, usesGuiaDeTV } from '../data/epgMappings';

// ===== CONSTANTES =====

const FETCH_TIMEOUT = 15000;
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const EPG_CACHE_DIR = `${FileSystem.cacheDirectory}epg/`;

// Proxies CORS com fallback automático
const CORS_PROXIES = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// ===== CACHE EM MEMÓRIA + DISCO =====

const memoryCache = new Map<string, Program[]>();
const lastFetch = new Map<string, number>();
const pendingFetches = new Map<string, Promise<Program[]>>();
let currentProxyIndex = 0;
let diskCacheLoaded = false;

// Listeners para atualizações
type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners = new Set<EPGListener>();

// ===== CACHE PERSISTENTE (DISCO) =====

interface DiskCacheEntry {
    fetchTime: number;
    programs: Array<{
        id: string;
        title: string;
        description?: string;
        category?: string;
        startTime: number; // timestamp ms
        endTime: number;   // timestamp ms
    }>;
}

async function ensureCacheDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(EPG_CACHE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(EPG_CACHE_DIR, { intermediates: true });
    }
}

function channelCachePath(channelId: string): string {
    const safe = channelId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${EPG_CACHE_DIR}${safe}.json`;
}

async function saveToDisk(channelId: string, programs: Program[], fetchTime: number): Promise<void> {
    try {
        const entry: DiskCacheEntry = {
            fetchTime,
            programs: programs.map(p => ({
                id: p.id,
                title: p.title,
                description: p.description,
                category: p.category,
                startTime: p.startTime.getTime(),
                endTime: p.endTime.getTime(),
            })),
        };
        await FileSystem.writeAsStringAsync(
            channelCachePath(channelId),
            JSON.stringify(entry),
        );
    } catch {
        // Silently fail - memory cache still works
    }
}

async function loadAllFromDisk(): Promise<void> {
    if (diskCacheLoaded) return;
    diskCacheLoaded = true;

    try {
        await ensureCacheDir();
        const files = await FileSystem.readDirectoryAsync(EPG_CACHE_DIR);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const content = await FileSystem.readAsStringAsync(`${EPG_CACHE_DIR}${file}`);
                const entry: DiskCacheEntry = JSON.parse(content);

                // Skip expired cache
                if ((now - entry.fetchTime) >= CACHE_DURATION_MS) {
                    FileSystem.deleteAsync(`${EPG_CACHE_DIR}${file}`, { idempotent: true }).catch(() => {});
                    continue;
                }

                const channelId = file.replace('.json', '');
                // Only load if not already in memory (memory is fresher)
                if (!memoryCache.has(channelId)) {
                    const programs: Program[] = entry.programs.map(p => ({
                        id: p.id,
                        title: p.title,
                        description: p.description || '',
                        category: p.category,
                        startTime: new Date(p.startTime),
                        endTime: new Date(p.endTime),
                    }));
                    memoryCache.set(channelId, programs);
                    lastFetch.set(channelId, entry.fetchTime);
                    // Notify listeners so cards show cached EPG immediately
                    listeners.forEach(listener => listener(channelId, programs));
                }
            } catch {
                // Skip corrupted files
            }
        }
        console.log(`EPG: loaded ${memoryCache.size} channels from disk cache`);
    } catch {
        // Cache dir doesn't exist yet, that's fine
    }
}

// ===== FUNÇÕES AUXILIARES =====

function decodeHTMLEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
        '&eacute;': 'é', '&aacute;': 'á', '&iacute;': 'í',
        '&oacute;': 'ó', '&uacute;': 'ú', '&atilde;': 'ã',
        '&otilde;': 'õ', '&ccedil;': 'ç', '&ndash;': '–', '&mdash;': '—',
    };
    return text.replace(/&[^;]+;/g, m => entities[m] || m);
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ===== PARSING HTML =====

function parseMeuguiaPrograms(html: string, channelId: string): Program[] {
    const programs: Program[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    const cleanHtml = html.replace(/<li class="subheader[^"]*"><%=[^>]+%><\/li>/gi, '');

    const dateHeaders: { index: number; date: Date }[] = [];
    const headerRegex = /<li class="subheader[^"]*">[^<]*?(\d{1,2})\/(\d{1,2})[^<]*<\/li>/gi;

    let headerMatch;
    while ((headerMatch = headerRegex.exec(cleanHtml)) !== null) {
        const day = parseInt(headerMatch[1]);
        const month = parseInt(headerMatch[2]) - 1;
        let date = new Date(currentYear, month, day, 0, 0, 0, 0);

        if (month < today.getMonth() - 6) {
            date = new Date(currentYear + 1, month, day, 0, 0, 0, 0);
        }

        dateHeaders.push({ index: headerMatch.index, date });
    }

    if (dateHeaders.length === 0) {
        dateHeaders.push({
            index: 0,
            date: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        });
    }

    const programRegex = /<div class=['"]lileft time['"]\>\s*(\d{1,2}:\d{2})\s*<\/div>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<h3>([^<]*)<\/h3>/gi;

    let programMatch;
    let lastHour = -1;
    let currentDateIndex = 0;

    while ((programMatch = programRegex.exec(cleanHtml)) !== null) {
        const timeStr = programMatch[1];
        const title = programMatch[2].trim();
        const category = programMatch[3].trim();

        while (currentDateIndex < dateHeaders.length - 1 &&
            programMatch.index > dateHeaders[currentDateIndex + 1].index) {
            currentDateIndex++;
            lastHour = -1;
        }

        let programDate = new Date(dateHeaders[currentDateIndex].date);
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (lastHour !== -1 && hours < lastHour - 6) {
            programDate = new Date(programDate.getTime() + 24 * 60 * 60 * 1000);
        }
        lastHour = hours;

        const startTime = new Date(programDate);
        startTime.setHours(hours, minutes, 0, 0);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

        programs.push({
            id: `${channelId}-${startTime.getTime()}`,
            title: decodeHTMLEntities(title),
            description: '',
            category: decodeHTMLEntities(category),
            startTime,
            endTime,
        });
    }

    programs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < programs.length - 1; i++) {
        programs[i].endTime = programs[i + 1].startTime;
    }

    return programs;
}

function parseGuiadetvPrograms(html: string, channelId: string): Program[] {
    const programs: Program[] = [];
    const pattern = /data-dt="(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})[^"]*"[\s\S]*?<a[^>]*href="[^"]*programa\/[^"]+"[^>]*>[\s\S]*?([A-Za-zÀ-ÿ0-9][^<]{2,150})/g;

    let match;
    while ((match = pattern.exec(html)) !== null) {
        const dateTimeStr = match[1];
        const title = match[2].trim();

        const startTime = new Date(dateTimeStr.replace(' ', 'T') + '-03:00');
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

        programs.push({
            id: `${channelId}-${startTime.getTime()}`,
            title: decodeHTMLEntities(title),
            description: '',
            startTime,
            endTime,
        });
    }

    programs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < programs.length - 1; i++) {
        programs[i].endTime = programs[i + 1].startTime;
    }

    return programs;
}

// ===== FETCH COM FALLBACK =====

async function fetchWithProxyFallback(
    url: string,
    channelId: string,
    source: 'meuguia' | 'guiadetv'
): Promise<string | null> {
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxyIndex = (currentProxyIndex + i) % CORS_PROXIES.length;
        const proxyUrl = CORS_PROXIES[proxyIndex](url);

        try {
            const response = await fetchWithTimeout(proxyUrl, FETCH_TIMEOUT);

            if (response.ok) {
                const html = await response.text();

                let isValidHtml = false;
                if (source === 'guiadetv') {
                    isValidHtml = html.length > 1000 &&
                        (html.includes('data-dt=') || html.includes('/programa/'));
                } else {
                    isValidHtml = html.length > 1000 &&
                        (html.includes('lileft time') || html.includes('<h2>'));
                }

                if (isValidHtml) {
                    currentProxyIndex = proxyIndex;
                    return html;
                }
            }
        } catch (error) {
            continue;
        }
    }

    return null;
}

// ===== API PÚBLICA =====

export async function initEPGService(): Promise<void> {
    await loadAllFromDisk();
    console.log(`EPG Service initialized (disk cache: ${memoryCache.size} channels)`);
}

export async function fetchChannelEPG(channelId: string): Promise<Program[]> {
    // Verifica cache válido
    const cached = memoryCache.get(channelId);
    const fetchTime = lastFetch.get(channelId) || 0;
    const now = Date.now();

    if (cached && cached.length > 0 && (now - fetchTime) < CACHE_DURATION_MS) {
        const nowDate = new Date();
        const futurePrograms = cached.filter(p => p.endTime > nowDate);
        if (futurePrograms.length >= 3) {
            return cached;
        }
    }

    // Verifica fetch pendente
    const pending = pendingFetches.get(channelId);
    if (pending) {
        return pending;
    }

    // Inicia novo fetch
    const fetchPromise = (async (): Promise<Program[]> => {
        const url = getEPGUrl(channelId);
        if (!url) return cached || [];

        const source = usesGuiaDeTV(channelId) ? 'guiadetv' : 'meuguia';
        const html = await fetchWithProxyFallback(url, channelId, source);

        if (!html) return cached || [];

        const programs = source === 'guiadetv'
            ? parseGuiadetvPrograms(html, channelId)
            : parseMeuguiaPrograms(html, channelId);

        if (programs.length > 0) {
            // Mantém apenas próximas 48 horas para economizar espaço
            const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const filteredPrograms = programs.filter(p => p.startTime < cutoff);

            const ft = Date.now();
            memoryCache.set(channelId, filteredPrograms);
            lastFetch.set(channelId, ft);

            // Salva em disco (fire-and-forget, não bloqueia)
            saveToDisk(channelId, filteredPrograms, ft).catch(() => {});

            listeners.forEach(listener => listener(channelId, filteredPrograms));
        }

        return programs;
    })();

    pendingFetches.set(channelId, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        pendingFetches.delete(channelId);
    }
}

export function getChannelEPG(channelId: string): Program[] {
    return memoryCache.get(channelId) || [];
}

export function getCurrentProgram(channelId: string): CurrentProgram | null {
    const programs = memoryCache.get(channelId);
    if (!programs || programs.length === 0) return null;

    const now = new Date();
    const currentIndex = programs.findIndex(p =>
        p.startTime <= now && p.endTime > now
    );

    if (currentIndex === -1) return null;

    const current = programs[currentIndex];
    const next = programs[currentIndex + 1] || null;

    const duration = current.endTime.getTime() - current.startTime.getTime();
    const elapsed = now.getTime() - current.startTime.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));

    // Tempo restante em minutos
    const remaining = Math.round((current.endTime.getTime() - now.getTime()) / 60000);

    return { current, next, progress, remaining };
}

export function onEPGUpdate(listener: EPGListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function hasEPG(channelId: string): boolean {
    const programs = memoryCache.get(channelId);
    return !!programs && programs.length > 0;
}

export async function clearEPGCache(): Promise<void> {
    memoryCache.clear();
    lastFetch.clear();
    try {
        const info = await FileSystem.getInfoAsync(EPG_CACHE_DIR);
        if (info.exists) {
            await FileSystem.deleteAsync(EPG_CACHE_DIR, { idempotent: true });
        }
    } catch {
        // Ignore cleanup errors
    }
}

export function getEPGStats() {
    return {
        cachedChannels: memoryCache.size,
        totalPrograms: Array.from(memoryCache.values()).reduce((sum, p) => sum + p.length, 0),
        pendingFetches: pendingFetches.size,
    };
}

// Prefetch EPG para canais visíveis
export async function prefetchEPG(channelIds: string[]): Promise<void> {
    const promises = channelIds.map(id =>
        fetchChannelEPG(id).catch(() => [])
    );
    await Promise.all(promises);
}

// Verifica se canal tem mapeamento EPG (sem fetch)
export function hasEPGMapping(channelId: string): boolean {
    return getEPGUrl(channelId) !== null;
}
