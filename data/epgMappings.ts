// Mapeamento de canais para códigos EPG (meuguia.tv e guiadetv.com)
// Última verificação: 2026-02-17 — scripts/check-epg.js
//
// meuguia.tv   → 56 canais com EPG funcionando
// guiadetv.com → 22 canais (5 originais + 17 novos)

// Códigos para meuguia.tv  (URL: https://meuguia.tv/programacao/canal/CODIGO)
export const meuguiaChannelCodes: Record<string, string> = {
    // ── Telecine ───────────────────────────────────────────────────────────────
    'telecine-action':   'TC2',
    'telecine-premium':  'TC1',
    'telecine-pipoca':   'TC4',
    'telecine-cult':     'TC5',
    'telecine-fun':      'TC6',
    'telecine-touch':    'TC3',

    // ── HBO ────────────────────────────────────────────────────────────────────
    'hbo':               'HBO',
    'hbo2':              'HB2',
    'hbo-family':        'HFA',
    'hbo-plus':          'HPL',

    // ── Globo ──────────────────────────────────────────────────────────────────
    'globo-sp':          'GRD',
    'globo-rj':          'GRD',
    'globo-mg':          'GRD',
    'globo-rs':          'GRD',
    'globo-es':          'GRD',
    'globo-am':          'GRD',
    'globo-news':        'GLN',

    // ── SporTV ─────────────────────────────────────────────────────────────────
    'sportv':            'SPO',
    'sportv2':           'SP2',
    'sportv3':           'SP3',

    // ── ESPN ───────────────────────────────────────────────────────────────────
    'espn':              'ESP',
    'espn2':             'ES2',
    'espn3':             'ES3',
    'espn4':             'ES4',
    'espn5':             'ES5',

    // ── TV Aberta ──────────────────────────────────────────────────────────────
    'sbt':               'SBT',
    'band':              'BAN',
    'record':            'REC',
    'rede-tv':           'RTV',
    'cultura':           'CUL',

    // ── Infantil ───────────────────────────────────────────────────────────────
    'cartoon-network':   'CAR',
    'discovery-kids':    'DIK',
    'gloob':             'GOB',
    'nickelodeon':       'NIC',

    // ── Documentários ─────────────────────────────────────────────────────────
    'discovery':         'DIS',
    'history':           'HIS',
    'animal-planet':     'APL',
    'discovery-hh':      'HEA',   // era DHH (errado) → HEA = Discovery Home & Health ✓
    'discovery-science': 'DSC',
    'discovery-turbo':   'DTU',
    'discovery-world':   'DIW',
    'tlc':               'TRV',   // era TLC (errado) → TRV ✓

    // ── Séries ─────────────────────────────────────────────────────────────────
    'warner':            'WBT',
    'tnt':               'TNT',
    'tnt-series':        'TBS',
    'axn':               'AXN',
    'sony':              'SET',   // era SON (errado) → SET ✓
    'universal-tv':      'USA',   // era UNI (errado) → USA ✓
    'ae':                'MDO',   // era 'A&E' (errado) → MDO ✓

    // ── Filmes ─────────────────────────────────────────────────────────────────
    'tcm':               'TCM',
    'space':             'SPA',
    'cinemax':           'MNX',   // era CMX (errado) → MNX ✓
    'megapix':           'MPX',   // era MGP (errado) → MPX ✓
    'studio-universal':  'HAL',   // era STU (errado) → HAL ✓

    // ── Esportes ───────────────────────────────────────────────────────────────
    'premiere':          '121',
    'combate':           '135',
    'band-sports':       'BSP',

    // ── Entretenimento ─────────────────────────────────────────────────────────
    'viva':              'VIV',
    'off':               'OFF',
    'gnt':               'GNT',

    // ── Notícias ───────────────────────────────────────────────────────────────
    'band-news':         'NEW',   // era BNW (errado) → NEW ✓

    // ── Internacionais ─────────────────────────────────────────────────────────
    'bloomberg':         'BIT',
    'dw-english':        'DWL',
};

// Slugs para tvplus.com.br  (URL: https://www.tvplus.com.br/programacao/{slug})
export const tvplusChannelSlugs: Record<string, string> = {
    'adult-swim': 'adult-swim',
    'curta':      'curta',
};

// Slugs para guiadetv.com  (URL: https://www.guiadetv.com/canal/{slug})
export const guiadetvChannelSlugs: Record<string, string> = {
    // ── Originais (já existiam) ────────────────────────────────────────────────
    'hbo-pop':           'hbo-pop',
    'hbo-xtreme':        'hbo-xtreme',
    'hbo-mundi':         'hbo-mundi',
    'cnn-brasil':        'cnn-brasil',
    'cartoonito':        'cartoonito',

    // ── Filmes ─────────────────────────────────────────────────────────────────
    'amc':               'amc',

    // ── Séries ─────────────────────────────────────────────────────────────────
    'tnt-novelas':       'tnt-novelas',

    // ── Documentários ─────────────────────────────────────────────────────────
    'history2':          'history-2',
    'food-network':      'food-network',
    'hgtv':              'hgtv',
    // ── Entretenimento ─────────────────────────────────────────────────────────
    'multishow':         'multishow',
    'bis':               'bis',
    'arte1':             'arte-1',

    // ── Notícias ───────────────────────────────────────────────────────────────
    'record-news':       'record-news',
    'jovem-pan-news':    'jovem-pan-news',

    // ── TV Aberta ──────────────────────────────────────────────────────────────
    'tv-brasil':         'tv-brasil',
    'aparecida':         'tv-aparecida',

    // ── Esportes ───────────────────────────────────────────────────────────────
    'premiere2':         'premiere-2',
    'premiere3':         'premiere-3',
    'premiere4':         'premiere-4',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Total de canais que têm mapeamento EPG em qualquer fonte */
export const getTotalEPGChannels = (): number =>
    Object.keys(meuguiaChannelCodes).length +
    Object.keys(guiadetvChannelSlugs).length +
    Object.keys(tvplusChannelSlugs).length;

export const usesTVPlus = (channelId: string): boolean =>
    channelId in tvplusChannelSlugs;

export const usesGuiaDeTV = (channelId: string): boolean =>
    channelId in guiadetvChannelSlugs;

export const getEPGCode = (channelId: string): string | null => {
    if (channelId in tvplusChannelSlugs)   return tvplusChannelSlugs[channelId];
    if (channelId in guiadetvChannelSlugs) return guiadetvChannelSlugs[channelId];
    if (channelId in meuguiaChannelCodes)  return meuguiaChannelCodes[channelId];
    return null;
};

export const getEPGUrl = (channelId: string): string | null => {
    if (channelId in tvplusChannelSlugs)
        return `https://www.tvplus.com.br/programacao/${tvplusChannelSlugs[channelId]}`;
    if (channelId in guiadetvChannelSlugs)
        return `https://www.guiadetv.com/canal/${guiadetvChannelSlugs[channelId]}`;
    if (channelId in meuguiaChannelCodes)
        return `https://meuguia.tv/programacao/canal/${meuguiaChannelCodes[channelId]}`;
    return null;
};
