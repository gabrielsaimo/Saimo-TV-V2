// EPG Service - Cache em memória + disco (7 dias de TTL)
// Nunca bloqueia a UI: parsing cede o JS thread entre canais
// Per-file disk cache via expo-file-system v19 (sync API)

import type { Program, CurrentProgram } from '../types';
import { getEPGUrl, usesGuiaDeTV } from '../data/epgMappings';
import { Paths, File as FSFile, Directory } from 'expo-file-system';

// ===== CONSTANTES =====

const FETCH_TIMEOUT = 15000;
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MEM_RETENTION_MS = 24 * 60 * 60 * 1000; // 24h em memória (economiza RAM)

// Proxies CORS com fallback automático
const CORS_PROXIES = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// ===== CACHE EM MEMÓRIA =====

const memoryCache = new Map<string, Program[]>();
const lastFetch = new Map<string, number>();
const pendingFetches = new Map<string, Promise<Program[]>>();
let currentProxyIndex = 0;

// Listeners para atualizações
type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners = new Set<EPGListener>();

// ===== CACHE EM DISCO (expo-file-system v19 — sync per-file) =====

let _epgDir: Directory | null = null;
let _diskReady = false;

interface SerializedProgram {
    id: string;
    title: string;
    description?: string;
    category?: string;
    startTime: number; // timestamp ms
    endTime: number;   // timestamp ms
}

interface DiskEntry {
    fetchTime: number;
    programs: SerializedProgram[];
}

function getEpgDir(): Directory {
    if (!_epgDir) {
        _epgDir = new Directory(Paths.document, 'epg');
    }
    return _epgDir;
}

function ensureDisk(): boolean {
    if (_diskReady) return true;
    try {
        const dir = getEpgDir();
        if (!dir.exists) {
            dir.create({ intermediates: true, idempotent: true });
        }
        _diskReady = true;
        return true;
    } catch (e) {
        console.warn('[EPGDisk] ensureDisk failed (will retry):', e);
        return false;
    }
}

function safeKey(channelId: string): string {
    return channelId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Save per-channel EPG to individual file (sync — no async overhead) */
function diskSave(channelId: string, programs: Program[], fetchTime: number): void {
    try {
        if (!ensureDisk()) return;
        const dir = getEpgDir();
        const file = new FSFile(dir, `${safeKey(channelId)}.json`);
        const entry: DiskEntry = {
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
        file.create({ overwrite: true });
        file.write(JSON.stringify(entry));
    } catch (e) {
        console.warn('[EPGDisk] diskSave failed:', channelId, e);
    }
}

/** Load per-channel EPG from individual file (sync — instant read) */
function diskLoad(channelId: string): { programs: Program[], fetchTime: number } | null {
    try {
        if (!ensureDisk()) return null;
        const dir = getEpgDir();
        const file = new FSFile(dir, `${safeKey(channelId)}.json`);
        if (!file.exists || file.size === 0) return null;
        const raw = file.textSync();
        if (!raw || raw.length < 2) return null;
        const entry: DiskEntry = JSON.parse(raw);
        const now = Date.now();
        if ((now - entry.fetchTime) >= CACHE_DURATION_MS) return null; // expirado
        const programs: Program[] = entry.programs.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            category: p.category,
            startTime: new Date(p.startTime),
            endTime: new Date(p.endTime),
        }));
        return { programs, fetchTime: entry.fetchTime };
    } catch (e) {
        return null;
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

/** Yield para o JS thread — garante que toques e navegação são processados */
function yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
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
    // Garante que o diretório de cache existe (não carrega tudo — lazy per-channel)
    ensureDisk();
    console.log('EPG Service initialized (lazy per-channel cache)');
}

export async function fetchChannelEPG(channelId: string): Promise<Program[]> {
    // 1. Verifica cache em memória
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

    // 2. Verifica cache em disco (sem fetch de rede) — lazy load per-channel
    if (!cached || cached.length === 0) {
        const disk = diskLoad(channelId);
        if (disk) {
            const nowDate = new Date();
            const futurePrograms = disk.programs.filter(p => p.endTime > nowDate);
            if (futurePrograms.length >= 3) {
                // Carrega disco → memória (apenas 24h)
                const tomorrow = new Date(now + MEM_RETENTION_MS);
                const memPrograms = disk.programs.filter(p => p.startTime < tomorrow);
                memoryCache.set(channelId, memPrograms);
                lastFetch.set(channelId, disk.fetchTime);
                return memPrograms;
            }
        }
    }

    // 3. Verifica fetch pendente (evita requests duplicados)
    const pending = pendingFetches.get(channelId);
    if (pending) {
        return pending;
    }

    // 4. Fetch da rede
    const fetchPromise = (async (): Promise<Program[]> => {
        const url = getEPGUrl(channelId);
        if (!url) return cached || [];

        const source = usesGuiaDeTV(channelId) ? 'guiadetv' : 'meuguia';
        const html = await fetchWithProxyFallback(url, channelId, source);

        if (!html) return cached || [];

        // Cede o JS thread antes do parsing (previne travamento da UI)
        await yieldToUI();

        const programs = source === 'guiadetv'
            ? parseGuiadetvPrograms(html, channelId)
            : parseMeuguiaPrograms(html, channelId);

        if (programs.length > 0) {
            const now = Date.now();

            // Disco: armazena 7 dias de programas
            const sevenDaysFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000);
            const diskPrograms = programs.filter(p => p.startTime < sevenDaysFromNow);
            diskSave(channelId, diskPrograms, now);

            // Memória: mantém apenas próximas 24 horas (economiza RAM em TV box)
            const tomorrow = new Date(now + MEM_RETENTION_MS);
            const memPrograms = programs.filter(p => p.startTime < tomorrow);

            memoryCache.set(channelId, memPrograms);
            lastFetch.set(channelId, now);

            listeners.forEach(listener => listener(channelId, memPrograms));
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

/** Verifica se canal tem cache fresco (memória) — sem load de disco nem fetch */
export function hasFreshCache(channelId: string): boolean {
    const cached = memoryCache.get(channelId);
    const fetchTime = lastFetch.get(channelId) || 0;
    if (!cached || cached.length === 0) return false;
    const nowDate = new Date();
    const futurePrograms = cached.filter(p => p.endTime > nowDate);
    return (Date.now() - fetchTime) < CACHE_DURATION_MS && futurePrograms.length >= 3;
}

export async function clearEPGCache(): Promise<void> {
    memoryCache.clear();
    lastFetch.clear();
    // Apaga diretório de cache do disco e recria
    try {
        const dir = getEpgDir();
        if (dir.exists) {
            dir.delete();
        }
        _diskReady = false;
        ensureDisk();
    } catch (e) {
        console.warn('[EPGDisk] clearEPGCache failed:', e);
    }
}

export function getEPGStats() {
    return {
        cachedChannels: memoryCache.size,
        totalPrograms: Array.from(memoryCache.values()).reduce((sum, p) => sum + p.length, 0),
        pendingFetches: pendingFetches.size,
    };
}

/** Busca EPG de um único canal em background — não bloqueia UI */
export async function prefetchEPG(channelIds: string[]): Promise<void> {
    const promises = channelIds.map(id =>
        fetchChannelEPG(id).catch(() => [])
    );
    await Promise.all(promises);
}

/** Verifica se canal tem mapeamento EPG (sem fetch) */
export function hasEPGMapping(channelId: string): boolean {
    return getEPGUrl(channelId) !== null;
}
