// Mapeamento de canais para códigos EPG (meuguia.tv e guiadetv.com)

// Códigos para meuguia.tv
export const meuguiaChannelCodes: Record<string, string> = {
    // Telecine
    'telecine-action': 'TC2',
    'telecine-premium': 'TC1',
    'telecine-pipoca': 'TC4',
    'telecine-cult': 'TC5',
    'telecine-fun': 'TC6',
    'telecine-touch': 'TC3',

    // HBO
    'hbo': 'HBO',
    'hbo2': 'HB2',
    'hbo-family': 'HFA',
    'hbo-plus': 'HPL',

    // Globo
    'globo-sp': 'GRD',
    'globo-rj': 'GRD',
    'globo-mg': 'GRD',
    'globo-rs': 'GRD',
    'globo-es': 'GRD',
    'globo-am': 'GRD',
    'globo-news': 'GLN',

    // SporTV
    'sportv': 'SPO',
    'sportv2': 'SP2',
    'sportv3': 'SP3',

    // ESPN
    'espn': 'ESP',
    'espn2': 'ES2',
    'espn3': 'ES3',
    'espn4': 'ES4',
    'espn5': 'ES5',

    // TV Aberta
    'sbt': 'SBT',
    'band': 'BAN',
    'record': 'REC',
    'rede-tv': 'RTV',
    'tv-brasil': 'TBR',
    'cultura': 'CUL',

    // Infantil
    'cartoon-network': 'CAR',
    'discovery-kids': 'DIK',
    'gloob': 'GOB',
    'nickelodeon': 'NIC',

    // Documentários
    'discovery': 'DIS',
    'history': 'HIS',
    'history2': 'HI2',
    'animal-planet': 'APL',
    'discovery-hh': 'DHH',
    'discovery-id': 'DID',
    'discovery-science': 'DSC',
    'discovery-turbo': 'DTU',
    'food-network': 'FOD',
    'tlc': 'TLC',
    'hgtv': 'HGT',

    // Séries
    'warner': 'WBT',
    'tnt': 'TNT',
    'tnt-series': 'TBS',
    'tnt-novelas': 'TNV',
    'axn': 'AXN',
    'sony': 'SON',
    'universal-tv': 'UNI',
    'ae': 'A&E',
    'amc': 'AMC',

    // Filmes
    'tcm': 'TCM',
    'space': 'SPA',
    'cinemax': 'CMX',
    'megapix': 'MGP',
    'studio-universal': 'STU',

    // Esportes
    'premiere': '121',
    'premiere2': '122',
    'premiere3': '123',
    'premiere4': '124',
    'combate': '135',
    'band-sports': 'BSP',

    // Entretenimento
    'multishow': 'MUL',
    'bis': 'BIS',
    'viva': 'VIV',
    'off': 'OFF',
    'gnt': 'GNT',
    'arte1': 'AR1',

    // Notícias
    'band-news': 'BNW',
    'record-news': 'RNW',
};

// Slugs para guiadetv.com (canais que não funcionam no meuguia)
export const guiadetvChannelSlugs: Record<string, string> = {
    'hbo-pop': 'hbo-pop',
    'hbo-xtreme': 'hbo-xtreme',
    'hbo-mundi': 'hbo-mundi',
    'cnn-brasil': 'cnn-brasil',
    'cartoonito': 'cartoonito',
};

// Verifica se o canal usa guiadetv.com
export const usesGuiaDeTV = (channelId: string): boolean => {
    return channelId in guiadetvChannelSlugs;
};

// Obtém o código do canal para EPG
export const getEPGCode = (channelId: string): string | null => {
    if (channelId in guiadetvChannelSlugs) {
        return guiadetvChannelSlugs[channelId];
    }
    if (channelId in meuguiaChannelCodes) {
        return meuguiaChannelCodes[channelId];
    }
    return null;
};

// URL base para buscar EPG
export const getEPGUrl = (channelId: string): string | null => {
    if (channelId in guiadetvChannelSlugs) {
        return `https://www.guiadetv.com/canal/${guiadetvChannelSlugs[channelId]}`;
    }
    if (channelId in meuguiaChannelCodes) {
        return `https://meuguia.tv/programacao/canal/${meuguiaChannelCodes[channelId]}`;
    }
    return null;
};
