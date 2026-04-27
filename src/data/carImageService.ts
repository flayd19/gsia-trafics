/**
 * carImageService — busca MÚLTIPLAS imagens reais por carro em 4 estágios:
 *
 *  1. pt.wikipedia.org  — thumbnail do artigo (batch de 50)
 *  2. en.wikipedia.org  — thumbnail do artigo (batch de 50, para os que faltam)
 *  3. Wikidata P18      — imagem canônica via QID (Wikipedia → Wikidata → Commons)
 *  4. Wikimedia Commons — busca por texto, retorna até 3 fotos extras
 *
 * Cache armazena string[] (array de URLs) por modelId.
 * getCachedUrl()  → primeira URL (compat. retroativa)
 * getCachedUrls() → todas as URLs disponíveis para carrossel
 */

// ── Títulos dos artigos ───────────────────────────────────────────────────────

type WikiEntry = [pt: string | null, en: string | null];

const MODEL_WIKI: Record<string, WikiEntry> = {
  // VOLKSWAGEN
  gol:                ['Volkswagen Gol',            'Volkswagen Gol'],
  polo:               ['Volkswagen Polo',            'Volkswagen Polo'],
  voyage:             ['Volkswagen Voyage',          'Volkswagen Voyage'],
  saveiro:            ['Volkswagen Saveiro',         'Volkswagen Saveiro'],
  up:                 ['Volkswagen Up!',             'Volkswagen Up'],
  tcross:             ['Volkswagen T-Cross',         'Volkswagen T-Cross'],
  golf:               ['Volkswagen Golf',            'Volkswagen Golf'],
  jetta:              ['Volkswagen Jetta',           'Volkswagen Jetta'],
  amarok:             ['Volkswagen Amarok',          'Volkswagen Amarok'],
  virtus:             ['Volkswagen Virtus',          'Volkswagen Virtus'],
  nivus:              ['Volkswagen Nivus',           'Volkswagen Nivus'],
  taos:               ['Volkswagen Taos',            'Volkswagen Taos'],
  tiguan:             ['Volkswagen Tiguan',          'Volkswagen Tiguan'],
  golf_gti:           ['Volkswagen Golf GTI',        'Volkswagen Golf GTI'],
  gol_g1:             ['Volkswagen Gol',             'Volkswagen Gol'],
  gol_g2:             ['Volkswagen Gol',             'Volkswagen Gol'],
  santana:            ['Volkswagen Santana',         'Volkswagen Santana'],
  passat_classic:     ['Volkswagen Passat',          'Volkswagen Passat'],

  // FIAT
  uno:                ['Fiat Uno',                   'Fiat Uno'],
  uno_mille:          ['Fiat Uno Mille',             'Fiat Uno'],
  mobi:               ['Fiat Mobi',                  'Fiat Mobi'],
  argo:               ['Fiat Argo',                  'Fiat Argo'],
  cronos:             ['Fiat Cronos',                'Fiat Cronos'],
  strada:             ['Fiat Strada',                'Fiat Strada'],
  toro:               ['Fiat Toro',                  'Fiat Toro'],
  pulse:              ['Fiat Pulse',                 'Fiat Pulse'],
  doblo:              ['Fiat Doblò',                 'Fiat Doblò'],
  grand_siena:        ['Fiat Grand Siena',           null],
  fastback:           ['Fiat Fastback',              'Fiat Fastback'],
  palio:              ['Fiat Palio',                 'Fiat Palio'],
  tempra:             ['Fiat Tempra',                'Fiat Tempra'],
  tipo:               ['Fiat Tipo',                  'Fiat Tipo'],

  // CHEVROLET
  onix:               ['Chevrolet Onix',             'Chevrolet Onix'],
  onix_plus:          ['Chevrolet Onix Plus',        null],
  tracker:            ['Chevrolet Tracker',          'Chevrolet Tracker'],
  montana:            ['Chevrolet Montana',          'Chevrolet Montana'],
  s10:                ['Chevrolet S10',              'Chevrolet S10'],
  spin:               ['Chevrolet Spin',             'Chevrolet Spin'],
  cruze:              ['Chevrolet Cruze',            'Chevrolet Cruze'],
  equinox:            ['Chevrolet Equinox',          'Chevrolet Equinox'],
  chevette:           ['Chevrolet Chevette',         'Chevrolet Chevette'],
  monza:              ['Chevrolet Monza',            'Chevrolet Monza'],
  kadett:             ['Chevrolet Kadett',           'Opel Kadett'],
  corvette_c8:        ['Chevrolet Corvette C8',      'Chevrolet Corvette (C8)'],
  corvette_c7_z06:    ['Chevrolet Corvette Z06',     'Chevrolet Corvette Z06'],
  camaro_ss:          ['Chevrolet Camaro',           'Chevrolet Camaro'],
  camaro_zl1:         ['Chevrolet Camaro',           'Chevrolet Camaro ZL1'],

  // FORD
  ka:                 ['Ford Ka',                    'Ford Ka'],
  ecosport:           ['Ford EcoSport',              'Ford EcoSport'],
  ranger:             ['Ford Ranger',                'Ford Ranger'],
  fiesta:             ['Ford Fiesta',                'Ford Fiesta'],
  focus:              ['Ford Focus',                 'Ford Focus'],
  territory:          ['Ford Territory',             'Ford Territory'],
  maverick_ford:      ['Ford Maverick',              'Ford Maverick (2021)'],
  bronco_sport:       ['Ford Bronco Sport',          'Ford Bronco Sport'],
  escort:             ['Ford Escort',                'Ford Escort'],
  mustang:            ['Ford Mustang',               'Ford Mustang'],
  shelby_gt500:       ['Ford Shelby GT500',          'Ford Shelby GT500'],

  // TOYOTA
  corolla:            ['Toyota Corolla',             'Toyota Corolla'],
  hilux:              ['Toyota Hilux',               'Toyota Hilux'],
  yaris:              ['Toyota Yaris',               'Toyota Yaris'],
  sw4:                ['Toyota SW4',                 'Toyota Fortuner'],
  corolla_cross:      ['Toyota Corolla Cross',       'Toyota Corolla Cross'],
  rav4:               ['Toyota RAV4',                'Toyota RAV4'],
  camry:              ['Toyota Camry',               'Toyota Camry'],
  land_cruiser_prado: ['Toyota Land Cruiser Prado',  'Toyota Land Cruiser Prado'],
  gr86:               ['Toyota GR86',                'Toyota GR86'],

  // HONDA
  civic:              ['Honda Civic',                'Honda Civic'],
  hrv:                ['Honda HR-V',                 'Honda HR-V'],
  fit:                ['Honda Fit',                  'Honda Fit'],
  city:               ['Honda City',                 'Honda City'],
  wrv:                ['Honda WR-V',                 'Honda WR-V'],
  accord:             ['Honda Accord',               'Honda Accord'],
  civic_type_r:       ['Honda Civic Type R',         'Honda Civic Type R'],

  // HYUNDAI
  hb20:               ['Hyundai HB20',               'Hyundai HB20'],
  hb20s:              ['Hyundai HB20S',              null],
  creta:              ['Hyundai Creta',              'Hyundai Creta'],
  tucson:             ['Hyundai Tucson',             'Hyundai Tucson'],
  i30:                ['Hyundai i30',                'Hyundai i30'],
  santa_fe:           ['Hyundai Santa Fe',           'Hyundai Santa Fe'],
  i30n:               ['Hyundai i30 N',              'Hyundai i30 N'],

  // NISSAN
  kicks:              ['Nissan Kicks',               'Nissan Kicks'],
  versa:              ['Nissan Versa',               'Nissan Versa'],
  frontier:           ['Nissan Frontier',            'Nissan Frontier'],
  sentra:             ['Nissan Sentra',              'Nissan Sentra'],
  march:              ['Nissan March',               'Nissan March'],
  nissan_gtr_r35:     ['Nissan GT-R',                'Nissan GT-R'],
  nissan_gtr_r34:     ['Nissan Skyline GT-R',        'Nissan Skyline GT-R'],
  nissan_gtr_r33:     ['Nissan Skyline GT-R',        'Nissan Skyline GT-R'],
  nissan_gtr_r32:     ['Nissan Skyline GT-R',        'Nissan Skyline GT-R'],

  // RENAULT
  kwid:               ['Renault Kwid',               'Renault Kwid'],
  sandero:            ['Renault Sandero',            'Renault Sandero'],
  duster:             ['Renault Duster',             'Dacia Duster'],
  logan:              ['Renault Logan',              'Renault Logan'],
  captur:             ['Renault Captur',             'Renault Captur'],
  kardian:            ['Renault Kardian',            null],
  oroch:              ['Renault Oroch',              null],
  renault_megane_rs:  ['Renault Mégane RS',          'Renault Mégane RS'],

  // KIA
  sportage:           ['Kia Sportage',               'Kia Sportage'],
  cerato:             ['Kia Cerato',                 'Kia Cerato'],
  stonic:             ['Kia Stonic',                 'Kia Stonic'],

  // JEEP
  renegade:           ['Jeep Renegade',              'Jeep Renegade'],
  compass:            ['Jeep Compass',               'Jeep Compass'],

  // PEUGEOT / CITROËN
  peugeot2008:        ['Peugeot 2008',               'Peugeot 2008'],
  peugeot208:         ['Peugeot 208',                'Peugeot 208'],
  c3:                 ['Citroën C3',                 'Citroën C3'],
  c4_cactus:          ['Citroën C4 Cactus',          'Citroën C4 Cactus'],

  // MITSUBISHI
  l200:               ['Mitsubishi L200',            'Mitsubishi Triton'],
  eclipse_cross:      ['Mitsubishi Eclipse Cross',   'Mitsubishi Eclipse Cross'],

  // CHERY / BYD
  tiggo8:             ['Chery Tiggo 8',              'Chery Tiggo 8'],
  byd_dolphin:        ['BYD Dolphin',                'BYD Dolphin'],
  byd_king:           ['BYD Seal',                   'BYD Seal'],

  // BMW
  bmw_320i:           ['BMW Série 3',                'BMW 3 Series'],
  bmw_530i:           ['BMW Série 5',                'BMW 5 Series'],
  bmw_x1:             ['BMW X1',                     'BMW X1'],
  bmw_x3:             ['BMW X3',                     'BMW X3'],
  bmw_m2:             ['BMW M2',                     'BMW M2'],
  bmw_m3:             ['BMW M3',                     'BMW M3'],
  bmw_m4:             ['BMW M4',                     'BMW M4'],

  // MERCEDES
  mercedes_c200:      ['Mercedes-Benz Classe C',     'Mercedes-Benz C-Class'],
  mercedes_c300:      ['Mercedes-Benz Classe C',     'Mercedes-Benz C-Class'],
  mercedes_gla:       ['Mercedes-Benz GLA',          'Mercedes-Benz GLA-Class'],
  mercedes_glc:       ['Mercedes-Benz GLC',          'Mercedes-Benz GLC-Class'],
  mercedes_amg_a45:   ['Mercedes-AMG A 45',          'Mercedes-AMG A 45'],
  mercedes_amg_c63:   ['Mercedes-AMG C 63',          'Mercedes-AMG C 63'],
  mercedes_amg_gt:    ['Mercedes-AMG GT',            'Mercedes-AMG GT'],

  // AUDI
  audi_a3:            ['Audi A3',                    'Audi A3'],
  audi_q3:            ['Audi Q3',                    'Audi Q3'],
  audi_q5:            ['Audi Q5',                    'Audi Q5'],
  audi_rs3:           ['Audi RS3',                   'Audi RS3'],
  audi_rs6:           ['Audi RS6',                   'Audi RS6'],

  // LAND ROVER
  lr_evoque:          ['Range Rover Evoque',         'Range Rover Evoque'],
  lr_discovery_sport: ['Land Rover Discovery Sport', 'Land Rover Discovery Sport'],
  lr_defender:        ['Land Rover Defender',        'Land Rover Defender'],

  // VOLVO / PORSCHE / ALFA
  volvo_xc40:         ['Volvo XC40',                 'Volvo XC40'],
  volvo_xc60:         ['Volvo XC60',                 'Volvo XC60'],
  porsche_macan:      ['Porsche Macan',              'Porsche Macan'],
  alfa_giulia_qv:     ['Alfa Romeo Giulia',          'Alfa Romeo Giulia'],

  // DODGE / SUBARU
  challenger_hellcat: ['Dodge Challenger',           'Dodge Challenger'],
  charger_srt:        ['Dodge Charger',              'Dodge Charger'],
  wrx_sti:            ['Subaru WRX STI',             'Subaru WRX STI'],
};

// ── Cache e estado ────────────────────────────────────────────────────────────

/** modelId → lista de URLs de imagens (array vazio = sem foto após todas as tentativas) */
const imageCache = new Map<string, string[]>();

type Listener = () => void;
const listeners = new Set<Listener>();

let fetchState: 'idle' | 'running' | 'done' = 'idle';

// ── API pública ───────────────────────────────────────────────────────────────

/** Retorna todas as URLs encontradas para o modelo (para carrossel). */
export function getCachedUrls(modelId: string): string[] {
  return imageCache.get(modelId) ?? [];
}

/** Retorna a primeira URL disponível (compatibilidade retroativa). */
export function getCachedUrl(modelId: string): string | undefined {
  return imageCache.get(modelId)?.[0];
}

/**
 * Retorna uma foto determinística para uma instância específica do carro.
 * Carros do mesmo modelo (ex: 3 Gols) recebem fotos diferentes entre si.
 * O mesmo instanceId sempre devolve a mesma foto (estável entre renders).
 */
export function getImageForInstance(modelId: string, instanceId: string): string | undefined {
  const urls = imageCache.get(modelId);
  if (!urls || urls.length === 0) return undefined;
  // Hash simples e rápido baseado nos caracteres do instanceId
  let hash = 0;
  for (let i = 0; i < instanceId.length; i++) {
    hash = (hash * 31 + instanceId.charCodeAt(i)) & 0xffff;
  }
  return urls[hash % urls.length];
}

export function subscribeToImageUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void { listeners.forEach(fn => fn()); }

/** Adiciona URL ao array do modelo sem duplicar. */
function pushUnique(modelId: string, url: string): void {
  if (!url) return;
  const arr = imageCache.get(modelId) ?? [];
  if (!arr.includes(url)) {
    arr.push(url);
    imageCache.set(modelId, arr);
  }
}

// ── Tipos internos ────────────────────────────────────────────────────────────

interface WikiThumbPage {
  title?: string;
  thumbnail?: { source?: string };
}
interface WikiPropsPage {
  title?: string;
  pageprops?: { wikibase_item?: string };
}
interface WikidataEntity {
  claims?: {
    P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
  };
}
interface CommonsImagePage {
  title?: string;
  imageinfo?: Array<{ url?: string }>;
}

// ── Estágio 1 & 2: Wikipedia thumbnails (batch) ───────────────────────────────

async function wikiThumbBatch(
  base: 'https://pt.wikipedia.org' | 'https://en.wikipedia.org',
  titles: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const encoded = titles.map(t => encodeURIComponent(t)).join('|');
  const url =
    `${base}/w/api.php?action=query&titles=${encoded}` +
    `&prop=pageimages&format=json&pithumbsize=640&origin=*`;

  try {
    const res = await fetch(url);
    if (!res.ok) return result;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, WikiThumbPage> };
    };
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.title && page.thumbnail?.source) {
        result.set(page.title, page.thumbnail.source);
      }
    }
  } catch { /* rede indisponível */ }

  return result;
}

// ── Estágio 3: Wikidata P18 ───────────────────────────────────────────────────

/** Passo 3a: Wikipedia enTitle → Wikidata QID */
async function fetchWikidataQIDs(
  enTitles: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH = 50;

  for (let i = 0; i < enTitles.length; i += BATCH) {
    const batch = enTitles.slice(i, i + BATCH);
    const encoded = batch.map(t => encodeURIComponent(t)).join('|');
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}` +
      `&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, WikiPropsPage> };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const qid = page.pageprops?.wikibase_item;
        if (page.title && qid) result.set(page.title, qid);
      }
    } catch { /* skip */ }
  }

  return result;
}

/** Passo 3b: QIDs → filenames de imagem P18 no Wikidata */
async function fetchWikidataP18(
  qids: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH = 50;

  for (let i = 0; i < qids.length; i += BATCH) {
    const batch = qids.slice(i, i + BATCH);
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities` +
      `&ids=${batch.join('|')}&props=claims&format=json&origin=*`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        entities?: Record<string, WikidataEntity>;
      };
      for (const [qid, entity] of Object.entries(data.entities ?? {})) {
        const filename = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (filename) result.set(qid, filename);
      }
    } catch { /* skip */ }
  }

  return result;
}

/** Passo 3c: filenames Commons → URLs diretas */
async function resolveCommonsFiles(
  filenames: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH = 50;

  for (let i = 0; i < filenames.length; i += BATCH) {
    const batch = filenames.slice(i, i + BATCH);
    const titles = batch
      .map(f => encodeURIComponent(`File:${f}`))
      .join('|');
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=${titles}&prop=imageinfo&iiprop=url&iiurlwidth=640` +
      `&format=json&origin=*`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, CommonsImagePage> };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const filename = page.title?.replace('File:', '');
        const imgUrl   = page.imageinfo?.[0]?.url;
        if (filename && imgUrl) result.set(filename, imgUrl);
      }
    } catch { /* skip */ }
  }

  return result;
}

// ── Estágio 4: Commons multi-resultado ───────────────────────────────────────

const JUNK_PATTERN = /logo|icon|badge|emblem|shield|flag|map|diagram|schematic|template/i;

async function commonsSearchMulti(query: string, limit = 3): Promise<string[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=640` +
    `&format=json&origin=*&gsrlimit=25`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, CommonsImagePage> };
    };
    const results: string[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title  = (page.title ?? '').toLowerCase();
      const imgUrl = page.imageinfo?.[0]?.url ?? '';
      if (!JUNK_PATTERN.test(title) && /\.(jpg|jpeg|png|webp)/i.test(imgUrl) && imgUrl) {
        results.push(imgUrl);
        if (results.length >= limit) break;
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Orquestrador em 4 estágios ────────────────────────────────────────────────

export async function prefetchAllCarImages(): Promise<void> {
  if (fetchState !== 'idle') return;
  fetchState = 'running';

  const allIds = Object.keys(MODEL_WIKI);
  const BATCH  = 50;

  // ── Estágio 1: pt.wikipedia.org (thumbnails) ─────────────────────────
  {
    const titleToIds = new Map<string, string[]>();
    for (const id of allIds) {
      const ptTitle = MODEL_WIKI[id][0];
      if (!ptTitle) continue;
      if (!titleToIds.has(ptTitle)) titleToIds.set(ptTitle, []);
      titleToIds.get(ptTitle)!.push(id);
    }

    const uniqueTitles = [...titleToIds.keys()];
    for (let i = 0; i < uniqueTitles.length; i += BATCH) {
      const batch  = uniqueTitles.slice(i, i + BATCH);
      const thumbs = await wikiThumbBatch('https://pt.wikipedia.org', batch);
      for (const [title, url] of thumbs) {
        for (const id of titleToIds.get(title) ?? []) pushUnique(id, url);
      }
      notify();
    }
  }

  // ── Estágio 2: en.wikipedia.org (thumbnails para os que faltam) ───────
  {
    const missing = allIds.filter(id => (imageCache.get(id) ?? []).length === 0);
    const titleToIds = new Map<string, string[]>();
    for (const id of missing) {
      const enTitle = MODEL_WIKI[id][1];
      if (!enTitle) continue;
      if (!titleToIds.has(enTitle)) titleToIds.set(enTitle, []);
      titleToIds.get(enTitle)!.push(id);
    }

    const uniqueTitles = [...titleToIds.keys()];
    for (let i = 0; i < uniqueTitles.length; i += BATCH) {
      const batch  = uniqueTitles.slice(i, i + BATCH);
      const thumbs = await wikiThumbBatch('https://en.wikipedia.org', batch);
      for (const [title, url] of thumbs) {
        for (const id of titleToIds.get(title) ?? []) pushUnique(id, url);
      }
      notify();
    }
  }

  // ── Estágio 3: Wikidata P18 (imagem canônica via QID) ────────────────
  //    Funciona para TODOS os modelos com título EN, independente de já
  //    terem foto do Wikipedia — adiciona como segunda opção no carrossel.
  {
    // Coleta todos os títulos EN únicos
    const enTitleToIds = new Map<string, string[]>();
    for (const id of allIds) {
      const enTitle = MODEL_WIKI[id][1];
      if (!enTitle) continue;
      if (!enTitleToIds.has(enTitle)) enTitleToIds.set(enTitle, []);
      enTitleToIds.get(enTitle)!.push(id);
    }

    // 3a: títulos EN → QIDs
    const enTitles = [...enTitleToIds.keys()];
    const titleToQID = await fetchWikidataQIDs(enTitles).catch(() => new Map<string, string>());

    // 3b: QIDs → filenames P18
    const allQIDs = [...new Set([...titleToQID.values()])];
    const qidToFilename = allQIDs.length > 0
      ? await fetchWikidataP18(allQIDs).catch(() => new Map<string, string>())
      : new Map<string, string>();

    // 3c: filenames → URLs reais
    const filenames = [...new Set([...qidToFilename.values()])];
    const filenameToUrl = filenames.length > 0
      ? await resolveCommonsFiles(filenames).catch(() => new Map<string, string>())
      : new Map<string, string>();

    // Mapeia de volta para modelIds
    for (const [enTitle, qid] of titleToQID) {
      const filename = qidToFilename.get(qid);
      if (!filename) continue;
      const imgUrl = filenameToUrl.get(filename);
      if (!imgUrl) continue;
      for (const id of enTitleToIds.get(enTitle) ?? []) {
        pushUnique(id, imgUrl);
      }
    }
    notify();
  }

  // ── Estágio 4: Commons multi-busca (até 3 fotos extras) ───────────────
  //    Prioriza carros com menos imagens. Usa 2 queries: PT e EN.
  //    Limita a 5 buscas paralelas para não sobrecarregar.
  {
    // Ordena: menos imagens primeiro
    const byCount = [...allIds].sort(
      (a, b) => (imageCache.get(a)?.length ?? 0) - (imageCache.get(b)?.length ?? 0),
    );

    const CONCURRENCY = 5;
    for (let i = 0; i < byCount.length; i += CONCURRENCY) {
      const chunk = byCount.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async id => {
        const [ptTitle, enTitle] = MODEL_WIKI[id];
        const existing = imageCache.get(id)?.length ?? 0;

        // Query 1 (EN ou PT)
        const q1 = enTitle ?? ptTitle;
        if (q1) {
          const urls = await commonsSearchMulti(`${q1} automobile`, 2);
          for (const u of urls) pushUnique(id, u);
        }

        // Query 2 (PT, se diferente do EN e ainda < 3 imagens)
        const q2 = ptTitle && ptTitle !== enTitle ? ptTitle : null;
        const afterQ1 = imageCache.get(id)?.length ?? 0;
        if (q2 && afterQ1 < 3) {
          const urls = await commonsSearchMulti(`${q2} automóvel`, 2);
          for (const u of urls) pushUnique(id, u);
        }

        // Se ainda não tem nenhuma, tenta busca genérica pelo modelId
        const afterQ2 = imageCache.get(id)?.length ?? 0;
        if (afterQ2 === 0) {
          const fallback = id.replace(/_/g, ' ');
          const urls = await commonsSearchMulti(fallback, 2);
          for (const u of urls) pushUnique(id, u);
        }

        // Garante entrada no cache mesmo se vazio
        if (!imageCache.has(id)) imageCache.set(id, []);

        // Descarta para não bloquear notify
        void existing;
      }));
      notify();
    }
  }

  notify();
  fetchState = 'done';
}
