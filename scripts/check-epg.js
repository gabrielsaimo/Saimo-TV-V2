#!/usr/bin/env node
/**
 * check-epg.js — Verifica quais canais têm EPG funcionando
 *
 * Uso: node scripts/check-epg.js
 *
 * Testa diretamente as fontes meuguia.tv e guiadetv.com (sem proxy CORS,
 * pois rodamos no Node, não no app). Salva o resultado em scripts/epg-report.md
 * e scripts/epg-report.json.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Configuração ─────────────────────────────────────────────────────────────
const TIMEOUT_MS = 12000;
const CONCURRENCY = 5;  // Quantos canais testar ao mesmo tempo
const REPORT_DIR = path.join(__dirname);
const REPORT_MD  = path.join(REPORT_DIR, 'epg-report.md');
const REPORT_JSON = path.join(REPORT_DIR, 'epg-report.json');

// ─── Todos os canais do app ───────────────────────────────────────────────────
const CHANNELS = [
  // Filmes
  { id: 'hbo',               name: 'HBO',                  category: 'Filmes' },
  { id: 'hbo2',              name: 'HBO 2',                category: 'Filmes' },
  { id: 'hbo-family',        name: 'HBO Family',           category: 'Filmes' },
  { id: 'hbo-mundi',         name: 'HBO Mundi',            category: 'Filmes' },
  { id: 'hbo-pop',           name: 'HBO Pop',              category: 'Filmes' },
  { id: 'hbo-xtreme',        name: 'HBO Xtreme',           category: 'Filmes' },
  { id: 'hbo-plus',          name: 'HBO Plus',             category: 'Filmes' },
  { id: 'tcm',               name: 'TCM',                  category: 'Filmes' },
  { id: 'space',             name: 'Space',                category: 'Filmes' },
  { id: 'cinemax',           name: 'Cinemax',              category: 'Filmes' },
  { id: 'megapix',           name: 'Megapix',              category: 'Filmes' },
  { id: 'studio-universal',  name: 'Studio Universal',     category: 'Filmes' },
  { id: 'curta',             name: 'Curta!',               category: 'Filmes' },
  { id: 'telecine-fun',      name: 'Telecine Fun',         category: 'Filmes' },
  { id: 'telecine-touch',    name: 'Telecine Touch',       category: 'Filmes' },
  { id: 'telecine-cult',     name: 'Telecine Cult',        category: 'Filmes' },
  { id: 'telecine-action',   name: 'Telecine Action',      category: 'Filmes' },
  { id: 'telecine-premium',  name: 'Telecine Premium',     category: 'Filmes' },
  { id: 'telecine-pipoca',   name: 'Telecine Pipoca',      category: 'Filmes' },
  // Series
  { id: 'warner',            name: 'Warner Channel',       category: 'Series' },
  { id: 'tnt',               name: 'TNT',                  category: 'Series' },
  { id: 'tnt-novelas',       name: 'TNT Novelas',          category: 'Series' },
  { id: 'axn',               name: 'AXN',                  category: 'Series' },
  { id: 'sony',              name: 'Sony Channel',         category: 'Series' },
  { id: 'universal-tv',      name: 'Universal TV',         category: 'Series' },
  { id: 'ae',                name: 'A&E',                  category: 'Series' },
  { id: 'tnt-series',        name: 'TNT Series',           category: 'Series' },
  { id: 'amc',               name: 'AMC',                  category: 'Series' },
  // Infantil
  { id: 'gloob',             name: 'Gloob',                category: 'Infantil' },
  { id: 'cartoon-network',   name: 'Cartoon Network',      category: 'Infantil' },
  { id: 'cartoonito',        name: 'Cartoonito',           category: 'Infantil' },
  { id: 'discovery-kids',    name: 'Discovery Kids',       category: 'Infantil' },
  { id: '24h-simpsons',      name: '24h Simpsons',         category: 'Infantil' },
  { id: '24h-dragonball',    name: '24h Dragon Ball',      category: 'Infantil' },
  { id: '24h-odeia-chris',   name: 'Todo Mundo Odeia o Chris', category: 'Infantil' },
  { id: 'adult-swim',        name: 'Adult Swim',           category: 'Infantil' },
  { id: 'nickelodeon',       name: 'Nickelodeon',          category: 'Infantil' },
  { id: 'gospel-cartoon',    name: 'Gospel Cartoon',       category: 'Infantil' },
  { id: 'geekdot',           name: 'Geekdot',              category: 'Infantil' },
  // Documentarios
  { id: 'discovery',         name: 'Discovery Channel',    category: 'Documentarios' },
  { id: 'animal-planet',     name: 'Animal Planet',        category: 'Documentarios' },
  { id: 'history',           name: 'History',              category: 'Documentarios' },
  { id: 'history2',          name: 'History 2',            category: 'Documentarios' },
  { id: 'food-network',      name: 'Food Network',         category: 'Documentarios' },
  { id: 'tlc',               name: 'TLC',                  category: 'Documentarios' },
  { id: 'hgtv',              name: 'HGTV',                 category: 'Documentarios' },
  { id: 'discovery-hh',      name: 'Discovery H&H',        category: 'Documentarios' },
  { id: 'discovery-id',      name: 'Investigation Discovery', category: 'Documentarios' },
  { id: 'discovery-science', name: 'Discovery Science',    category: 'Documentarios' },
  { id: 'discovery-world',   name: 'Discovery World',      category: 'Documentarios' },
  { id: 'discovery-turbo',   name: 'Discovery Turbo',      category: 'Documentarios' },
  // Entretenimento
  { id: 'multishow',         name: 'Multishow',            category: 'Entretenimento' },
  { id: 'bis',               name: 'BIS',                  category: 'Entretenimento' },
  { id: 'viva',              name: 'Viva',                 category: 'Entretenimento' },
  { id: 'off',               name: 'OFF',                  category: 'Entretenimento' },
  { id: 'gnt',               name: 'GNT',                  category: 'Entretenimento' },
  { id: 'arte1',             name: 'Arte 1',               category: 'Entretenimento' },
  { id: 'cultura',           name: 'TV Cultura',           category: 'Entretenimento' },
  { id: 'loading-tv',        name: 'Loading',              category: 'Entretenimento' },
  { id: 'revry-brasil',      name: 'Revry Brasil',         category: 'Entretenimento' },
  { id: 'mytime-movie',      name: 'MyTime Movie',         category: 'Entretenimento' },
  { id: 'classique-tv',      name: 'Classique TV',         category: 'Entretenimento' },
  { id: 'gospel-movie-tv',   name: 'Gospel Movie TV',      category: 'Entretenimento' },
  // BBBs (nunca terão EPG)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `bbb${i + 1}`, name: `BBB CAN ${i + 1}`, category: 'Entretenimento'
  })),
  // Noticias
  { id: 'globo-news',        name: 'Globo News',           category: 'Noticias' },
  { id: 'cnn-brasil',        name: 'CNN Brasil',           category: 'Noticias' },
  { id: 'band-news',         name: 'Band News',            category: 'Noticias' },
  { id: 'record-news',       name: 'Record News',          category: 'Noticias' },
  { id: 'jovem-pan-news',    name: 'Jovem Pan News',       category: 'Noticias' },
  { id: 'stz-tv',            name: 'STZ TV',               category: 'Noticias' },
  // TV Aberta
  { id: 'globo-sp',          name: 'Globo SP',             category: 'TV Aberta' },
  { id: 'globo-rj',          name: 'Globo RJ',             category: 'TV Aberta' },
  { id: 'globo-mg',          name: 'Globo MG',             category: 'TV Aberta' },
  { id: 'globo-rs',          name: 'Globo RS',             category: 'TV Aberta' },
  { id: 'globo-es',          name: 'Globo ES',             category: 'TV Aberta' },
  { id: 'globo-am',          name: 'Globo AM',             category: 'TV Aberta' },
  { id: 'sbt',               name: 'SBT',                  category: 'TV Aberta' },
  { id: 'band',              name: 'Band',                 category: 'TV Aberta' },
  { id: 'record',            name: 'Record TV',            category: 'TV Aberta' },
  { id: 'rede-tv',           name: 'RedeTV!',              category: 'TV Aberta' },
  { id: 'tv-brasil',         name: 'TV Brasil',            category: 'TV Aberta' },
  { id: 'aparecida',         name: 'TV Aparecida',         category: 'TV Aberta' },
  { id: 'tv-gazeta',         name: 'TV Gazeta',            category: 'TV Aberta' },
  { id: 'impd',              name: 'IMPD',                 category: 'TV Aberta' },
  { id: 'amazon-sat',        name: 'Amazon Sat',           category: 'TV Aberta' },
  { id: 'sbt-interior',      name: 'SBT Interior',         category: 'TV Aberta' },
  { id: 'sertao-tv',         name: 'Sertão TV',            category: 'TV Aberta' },
  { id: 'cwb-tv',            name: 'CWB TV',               category: 'TV Aberta' },
  { id: 'record-internacional', name: 'Record Internacional', category: 'TV Aberta' },
  { id: 'novo-tempo',        name: 'TV Novo Tempo',        category: 'TV Aberta' },
  { id: 'rede-gospel',       name: 'Rede Gospel',          category: 'TV Aberta' },
  { id: 'despertar-tv',      name: 'Despertar TV',         category: 'TV Aberta' },
  // Esportes
  { id: 'sportv',            name: 'SporTV',               category: 'Esportes' },
  { id: 'sportv2',           name: 'SporTV 2',             category: 'Esportes' },
  { id: 'sportv3',           name: 'SporTV 3',             category: 'Esportes' },
  { id: 'espn',              name: 'ESPN',                 category: 'Esportes' },
  { id: 'espn2',             name: 'ESPN 2',               category: 'Esportes' },
  { id: 'espn3',             name: 'ESPN 3',               category: 'Esportes' },
  { id: 'espn4',             name: 'ESPN 4',               category: 'Esportes' },
  { id: 'espn5',             name: 'ESPN 5',               category: 'Esportes' },
  { id: 'premiere',          name: 'Premiere',             category: 'Esportes' },
  { id: 'premiere2',         name: 'Premiere 2',           category: 'Esportes' },
  { id: 'premiere3',         name: 'Premiere 3',           category: 'Esportes' },
  { id: 'premiere4',         name: 'Premiere 4',           category: 'Esportes' },
  { id: 'combate',           name: 'Combate',              category: 'Esportes' },
  { id: 'band-sports',       name: 'Band Sports',          category: 'Esportes' },
  { id: 'fifa-plus',         name: 'FIFA+ Português',      category: 'Esportes' },
  { id: 'canal-do-inter',    name: 'Canal do Inter',       category: 'Esportes' },
  // Internacionais (sem EPG, mas listados para o relatório)
  { id: 'al-jazeera',        name: 'Al Jazeera English',   category: 'Internacionais' },
  { id: 'dw-english',        name: 'DW English',           category: 'Internacionais' },
  { id: 'rt-documentary',    name: 'RT Documentary',       category: 'Internacionais' },
  { id: 'euronews',          name: 'Euronews',             category: 'Internacionais' },
  { id: 'cgtn',              name: 'CGTN',                 category: 'Internacionais' },
  { id: 'abc-news',          name: 'ABC News',             category: 'Internacionais' },
  { id: 'cbs-news',          name: 'CBS News',             category: 'Internacionais' },
  { id: 'bloomberg',         name: 'Bloomberg',            category: 'Internacionais' },
  { id: 'accuweather',       name: 'AccuWeather',          category: 'Internacionais' },
  { id: 'red-bull-tv',       name: 'Red Bull TV',          category: 'Internacionais' },
  { id: 'nat-geo-int',       name: 'National Geographic',  category: 'Internacionais' },
  { id: 'nat-geo-wild-int',  name: 'Nat Geo Wild',         category: 'Internacionais' },
  { id: 'dazn-combat',       name: 'DAZN Combat',          category: 'Internacionais' },
  { id: 'fox-sports-int',    name: 'Fox Sports',           category: 'Internacionais' },
  { id: 'amc-int',           name: 'AMC (Internacional)',  category: 'Internacionais' },
  // Musica
  { id: 'top-mix-gospel',    name: 'TV Top Mix Gospel',    category: 'Musica' },
  { id: 'retro-music-tv',    name: 'Retro Music Television', category: 'Musica' },
  { id: 'kpop-tv',           name: 'K-Pop Television',     category: 'Musica' },
];

// ─── Mapeamentos EPG (sincronizados com data/epgMappings.ts) ─────────────────
const MEUGUIA = {
  'telecine-action':   'TC2',
  'telecine-premium':  'TC1',
  'telecine-pipoca':   'TC4',
  'telecine-cult':     'TC5',
  'telecine-fun':      'TC6',
  'telecine-touch':    'TC3',
  'hbo':               'HBO',
  'hbo2':              'HB2',
  'hbo-family':        'HFA',
  'hbo-plus':          'HPL',
  'globo-sp':          'GRD',
  'globo-rj':          'GRD',
  'globo-mg':          'GRD',
  'globo-rs':          'GRD',
  'globo-es':          'GRD',
  'globo-am':          'GRD',
  'globo-news':        'GLN',
  'sportv':            'SPO',
  'sportv2':           'SP2',
  'sportv3':           'SP3',
  'espn':              'ESP',
  'espn2':             'ES2',
  'espn3':             'ES3',
  'espn4':             'ES4',
  'espn5':             'ES5',
  'sbt':               'SBT',
  'band':              'BAN',
  'record':            'REC',
  'rede-tv':           'RTV',
  'cultura':           'CUL',
  'cartoon-network':   'CAR',
  'discovery-kids':    'DIK',
  'gloob':             'GOB',
  'nickelodeon':       'NIC',
  'discovery':         'DIS',
  'history':           'HIS',
  'animal-planet':     'APL',
  'discovery-hh':      'HEA',   // corrigido: DHH → HEA
  'discovery-science': 'DSC',
  'discovery-turbo':   'DTU',
  'discovery-world':   'DIW',
  'tlc':               'TRV',   // corrigido: TLC → TRV
  'warner':            'WBT',
  'tnt':               'TNT',
  'tnt-series':        'TBS',
  'axn':               'AXN',
  'sony':              'SET',   // corrigido: SON → SET
  'universal-tv':      'USA',   // corrigido: UNI → USA
  'ae':                'MDO',   // corrigido: A&E → MDO
  'tcm':               'TCM',
  'space':             'SPA',
  'cinemax':           'MNX',   // corrigido: CMX → MNX
  'megapix':           'MPX',   // corrigido: MGP → MPX
  'studio-universal':  'HAL',   // corrigido: STU → HAL
  'premiere':          '121',
  'combate':           '135',
  'band-sports':       'BSP',
  'viva':              'VIV',
  'off':               'OFF',
  'gnt':               'GNT',
  'band-news':         'NEW',   // corrigido: BNW → NEW
  'bloomberg':         'BIT',
  'dw-english':        'DWL',
};

const GUIADETV = {
  // Originais
  'hbo-pop':        'hbo-pop',
  'hbo-xtreme':     'hbo-xtreme',
  'hbo-mundi':      'hbo-mundi',
  'cnn-brasil':     'cnn-brasil',
  'cartoonito':     'cartoonito',
  // Novos
  'amc':            'amc',
  'tnt-novelas':    'tnt-novelas',
  'history2':       'history-2',
  'food-network':   'food-network',
  'hgtv':           'hgtv',
  'multishow':      'multishow',
  'bis':            'bis',
  'arte1':          'arte-1',
  'record-news':    'record-news',
  'jovem-pan-news': 'jovem-pan-news',
  'tv-brasil':      'tv-brasil',
  'aparecida':      'tv-aparecida',
  'premiere2':      'premiere-2',
  'premiere3':      'premiere-3',
  'premiere4':      'premiere-4',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEPGInfo(channelId) {
  if (GUIADETV[channelId]) {
    return { source: 'guiadetv', code: GUIADETV[channelId],
             url: `https://www.guiadetv.com/canal/${GUIADETV[channelId]}` };
  }
  if (MEUGUIA[channelId]) {
    return { source: 'meuguia', code: MEUGUIA[channelId],
             url: `https://meuguia.tv/programacao/canal/${MEUGUIA[channelId]}` };
  }
  return null;
}

function fetchWithTimeout(url, timeoutMs, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'));

  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch (e) { return reject(new Error(`URL inválida: ${url}`)); }

    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const timer = setTimeout(() => { req.destroy(); reject(new Error('TIMEOUT')); }, timeoutMs);

    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    }, (res) => {
      // Segue redirects (relativo ou absoluto)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        clearTimeout(timer);
        req.destroy();
        // Resolve URL relativa contra a URL original
        let nextUrl;
        try { nextUrl = new URL(res.headers.location, url).href; }
        catch { return reject(new Error(`Redirect inválido: ${res.headers.location}`)); }
        fetchWithTimeout(nextUrl, timeoutMs, depth + 1).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      // Limita a 500KB para não explodir memória
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes < 512000) data += chunk;
      });
      res.on('end', () => { clearTimeout(timer); resolve({ statusCode: res.statusCode, body: data }); });
      res.on('error', (e) => { clearTimeout(timer); reject(e); });
    });

    req.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function validateHTML(html, source) {
  if (!html || html.length < 500) return { valid: false, programCount: 0, reason: 'Resposta muito curta' };

  if (source === 'guiadetv') {
    const hasDtMarker = html.includes('data-dt=');
    const hasProgramLink = html.includes('/programa/');
    const count = (html.match(/data-dt="/g) || []).length;
    if (!hasDtMarker && !hasProgramLink) return { valid: false, programCount: 0, reason: 'Sem marcadores data-dt nem /programa/' };
    return { valid: count > 0, programCount: count, reason: count > 0 ? 'OK' : 'Marcador encontrado mas sem datas' };
  } else {
    // meuguia
    const hasTimeMarker = html.includes('lileft time');
    const hasH2 = html.includes('<h2>');
    const count = (html.match(/lileft time/g) || []).length;
    if (!hasTimeMarker && !hasH2) return { valid: false, programCount: 0, reason: 'Sem marcadores lileft time nem <h2>' };
    return { valid: count > 0, programCount: count, reason: count > 0 ? 'OK' : 'H2 encontrado mas sem horários' };
  }
}

async function testChannel(ch) {
  const epgInfo = getEPGInfo(ch.id);

  if (!epgInfo) {
    return { ...ch, status: 'NO_MAPPING', source: null, url: null,
             code: null, programCount: 0, error: null, reason: 'Sem mapeamento EPG' };
  }

  try {
    const result = await fetchWithTimeout(epgInfo.url, TIMEOUT_MS);
    const validation = validateHTML(result.body, epgInfo.source);

    return {
      ...ch,
      status: validation.valid ? 'OK' : 'MAPPING_BUT_EMPTY',
      source: epgInfo.source,
      url: epgInfo.url,
      code: epgInfo.code,
      programCount: validation.programCount,
      httpStatus: result.statusCode,
      error: null,
      reason: validation.reason,
    };
  } catch (err) {
    return {
      ...ch,
      status: 'ERROR',
      source: epgInfo.source,
      url: epgInfo.url,
      code: epgInfo.code,
      programCount: 0,
      httpStatus: null,
      error: err.message,
      reason: err.message,
    };
  }
}

// ─── Executor em paralelo (lotes de CONCURRENCY) ──────────────────────────────
async function runBatches(channels) {
  const results = [];
  const total = channels.length;
  let done = 0;

  for (let i = 0; i < channels.length; i += CONCURRENCY) {
    const batch = channels.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(testChannel));
    results.push(...batchResults);
    done += batch.length;
    const pct = Math.round((done / total) * 100);
    process.stdout.write(`\r  Progresso: ${done}/${total} (${pct}%)   `);
  }
  console.log();
  return results;
}

// ─── Gerador de relatório Markdown ────────────────────────────────────────────
function generateMarkdown(results, elapsed) {
  const ok        = results.filter(r => r.status === 'OK');
  const broken    = results.filter(r => r.status === 'MAPPING_BUT_EMPTY');
  const error     = results.filter(r => r.status === 'ERROR');
  const noMapping = results.filter(r => r.status === 'NO_MAPPING');

  const total = results.length;
  const mapped = ok.length + broken.length + error.length;

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  let md = `# Relatório EPG — ${date}\n\n`;
  md += `> Tempo total: ${elapsed}s • ${total} canais testados • ${mapped} têm mapeamento\n\n`;
  md += `## Resumo\n\n`;
  md += `| Status | Canais |\n|--------|--------|\n`;
  md += `| ✅ EPG funcionando       | ${ok.length} |\n`;
  md += `| ⚠️ Mapeado mas sem dados | ${broken.length} |\n`;
  md += `| ❌ Erro na requisição    | ${error.length} |\n`;
  md += `| ➖ Sem mapeamento        | ${noMapping.length} |\n\n`;

  // ── ✅ Funcionando ──
  if (ok.length > 0) {
    md += `---\n## ✅ EPG Funcionando (${ok.length} canais)\n\n`;
    md += `| Canal | ID | Categoria | Fonte | Código | Programas |\n`;
    md += `|-------|----|-----------|-------|--------|----------|\n`;
    const grouped = groupBy(ok, r => r.category);
    for (const [cat, chans] of Object.entries(grouped).sort()) {
      for (const ch of chans.sort((a, b) => a.name.localeCompare(b.name))) {
        md += `| ${ch.name} | \`${ch.id}\` | ${cat} | ${ch.source} | \`${ch.code}\` | ~${ch.programCount} |\n`;
      }
    }
  }

  // ── ⚠️ Mapeado mas vazio ──
  if (broken.length > 0) {
    md += `\n---\n## ⚠️ Mapeado mas Sem Dados (${broken.length} canais)\n\n`;
    md += `Têm URL no mapeamento mas a página não retornou programação válida.\n`;
    md += `Possível causa: código errado, canal descontinuado no guia, ou site bloqueando.\n\n`;
    md += `| Canal | ID | Categoria | Fonte | Código | Motivo |\n`;
    md += `|-------|----|-----------|-------|--------|--------|\n`;
    for (const ch of broken.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `| ${ch.name} | \`${ch.id}\` | ${ch.category} | ${ch.source} | \`${ch.code}\` | ${ch.reason} |\n`;
    }
  }

  // ── ❌ Erro ──
  if (error.length > 0) {
    md += `\n---\n## ❌ Erro na Requisição (${error.length} canais)\n\n`;
    md += `| Canal | ID | Categoria | Fonte | Erro |\n`;
    md += `|-------|----|-----------|-------|------|\n`;
    for (const ch of error.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `| ${ch.name} | \`${ch.id}\` | ${ch.category} | ${ch.source} | ${ch.error} |\n`;
    }
  }

  // ── ➖ Sem Mapeamento ──
  md += `\n---\n## ➖ Sem Mapeamento EPG (${noMapping.length} canais)\n\n`;
  md += `Esses canais não têm URL configurada em \`data/epgMappings.ts\`.\n`;
  md += `São candidatos para adicionar novos mapeamentos.\n\n`;
  const noMappingGrouped = groupBy(noMapping, r => r.category);
  for (const [cat, chans] of Object.entries(noMappingGrouped).sort()) {
    md += `### ${cat}\n`;
    for (const ch of chans.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `- \`${ch.id}\` — ${ch.name}\n`;
    }
    md += '\n';
  }

  // ── Sugestões de fontes alternativas ──
  md += `---\n## 💡 Sugestões de Fontes EPG Alternativas\n\n`;
  md += `Para os canais sem mapeamento, algumas fontes possíveis:\n\n`;
  md += `- **meuguia.tv**: \`https://meuguia.tv/programacao/canal/CODIGO\`\n`;
  md += `  - Lista completa de códigos: https://meuguia.tv/programacao\n`;
  md += `- **guiadetv.com**: \`https://www.guiadetv.com/canal/SLUG\`\n`;
  md += `  - Buscar canal: https://www.guiadetv.com\n`;
  md += `- **guia.cliquecanal.com.br**: Outra fonte brasileira\n`;
  md += `- **xmltv.net**: Guias XML para canais internacionais\n`;
  md += `- **epg.pw**: Base XMLTV global com canais brasileiros\n\n`;

  // Canais sem mapeamento de maior interesse
  const priorities = noMapping.filter(ch =>
    ['TV Aberta', 'Noticias', 'Esportes', 'Documentarios'].includes(ch.category)
  );
  if (priorities.length > 0) {
    md += `### 🎯 Prioridade Alta (por categoria)\n\n`;
    md += `| Canal | ID | Categoria | Sugestão de Busca |\n`;
    md += `|-------|----|-----------|-------------------|\n`;
    for (const ch of priorities.sort((a, b) => a.category.localeCompare(b.category))) {
      const query = encodeURIComponent(ch.name.toLowerCase().replace(/\s+/g, '-'));
      md += `| ${ch.name} | \`${ch.id}\` | ${ch.category} | [guiadetv](https://www.guiadetv.com/busca?q=${query}) |\n`;
    }
  }

  return md;
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  EPG Checker — Saimo TV');
  console.log(`  ${CHANNELS.length} canais • concorrência ${CONCURRENCY}`);
  console.log('══════════════════════════════════════════════');
  console.log('');

  // Filtra apenas canais com mapeamento para testar na rede,
  // mais os sem mapeamento (esses retornam imediatamente)
  const toTest = CHANNELS.filter(ch => getEPGInfo(ch.id) !== null);
  const noMapping = CHANNELS.filter(ch => getEPGInfo(ch.id) === null);

  console.log(`  Canais com mapeamento: ${toTest.length}`);
  console.log(`  Canais sem mapeamento: ${noMapping.length}`);
  console.log(`  Testando URLs... (timeout ${TIMEOUT_MS / 1000}s por canal)`);
  console.log('');

  const start = Date.now();
  const testedResults = await runBatches(toTest);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Adiciona os sem mapeamento como "NO_MAPPING" direto (sem fetch)
  const noMappingResults = noMapping.map(ch => ({
    ...ch, status: 'NO_MAPPING', source: null, url: null,
    code: null, programCount: 0, error: null, reason: 'Sem mapeamento EPG',
  }));

  const allResults = [...testedResults, ...noMappingResults];

  // ── Estatísticas ──
  const ok        = allResults.filter(r => r.status === 'OK');
  const broken    = allResults.filter(r => r.status === 'MAPPING_BUT_EMPTY');
  const errored   = allResults.filter(r => r.status === 'ERROR');
  const noMap     = allResults.filter(r => r.status === 'NO_MAPPING');

  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log(`  Concluído em ${elapsed}s`);
  console.log('══════════════════════════════════════════════');
  console.log(`  ✅ EPG funcionando:        ${ok.length} canais`);
  console.log(`  ⚠️  Mapeado mas sem dados:  ${broken.length} canais`);
  console.log(`  ❌ Erro na requisição:     ${errored.length} canais`);
  console.log(`  ➖ Sem mapeamento:         ${noMap.length} canais`);
  console.log('══════════════════════════════════════════════');
  console.log('');

  if (ok.length > 0) {
    console.log('✅ Funcionando:');
    for (const ch of ok) console.log(`   ${ch.name.padEnd(25)} [${ch.source}:${ch.code}] ~${ch.programCount} programas`);
    console.log('');
  }

  if (broken.length > 0) {
    console.log('⚠️  Mapeado mas sem dados:');
    for (const ch of broken) console.log(`   ${ch.name.padEnd(25)} [${ch.source}:${ch.code}] — ${ch.reason}`);
    console.log('');
  }

  if (errored.length > 0) {
    console.log('❌ Erro:');
    for (const ch of errored) console.log(`   ${ch.name.padEnd(25)} — ${ch.error}`);
    console.log('');
  }

  // ── Salva relatórios ──
  const md = generateMarkdown(allResults, elapsed);
  fs.writeFileSync(REPORT_MD, md, 'utf8');
  fs.writeFileSync(REPORT_JSON, JSON.stringify(allResults, null, 2), 'utf8');

  console.log(`📄 Relatório salvo em:`);
  console.log(`   ${REPORT_MD}`);
  console.log(`   ${REPORT_JSON}`);
  console.log('');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
