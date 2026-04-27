/**
 * carImageService — busca imagens reais de carros em 3 estágios em cascata:
 *
 *  1. pt.wikipedia.org  — melhor cobertura para carros brasileiros
 *  2. en.wikipedia.org  — bom para carros internacionais / premium
 *  3. Wikimedia Commons search — busca de imagens para os que ainda faltam
 *
 * Cada modelo tem até 3 chances de conseguir uma foto real.
 * Só é marcado como null depois de esgotar todos os estágios.
 */

// ── Títulos dos artigos ───────────────────────────────────────────────────────
//
// Chave: modelId do jogo.
// Valor: [ título_pt, título_en ]  (null = sem artigo nesse idioma)
//
// Estratégia: pt.wikipedia.org → en.wikipedia.org → Commons search

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

/** modelId → URL da imagem (null = sem foto após todas as tentativas) */
const imageCache = new Map<string, string | null>();

type Listener = () => void;
const listeners = new Set<Listener>();

let fetchState: 'idle' | 'running' | 'done' = 'idle';

// ── API pública ───────────────────────────────────────────────────────────────

export function getCachedUrl(modelId: string): string | undefined {
  const val = imageCache.get(modelId);
  return val ?? undefined;          // null → undefined (sem foto), undefined → não carregado ainda
}

export function subscribeToImageUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void { listeners.forEach(fn => fn()); }

// ── Helpers de fetch ──────────────────────────────────────────────────────────

async function wikiThumbBatch(
  base: 'https://pt.wikipedia.org' | 'https://en.wikipedia.org',
  titles: string[],
): Promise<Map<string, string>> {
  /** título → URL da miniatura */
  const result = new Map<string, string>();

  const encoded = titles.map(t => encodeURIComponent(t)).join('|');
  const url =
    `${base}/w/api.php?action=query&titles=${encoded}` +
    `&prop=pageimages&format=json&pithumbsize=600&origin=*`;

  const res = await fetch(url);
  if (!res.ok) return result;

  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
  };

  for (const page of Object.values(data.query?.pages ?? {})) {
    if (page.title && page.thumbnail?.source) {
      result.set(page.title, page.thumbnail.source);
    }
  }
  return result;
}

async function commonsSearch(query: string): Promise<string | null> {
  /** Busca na Wikimedia Commons e retorna URL da primeira imagem de carro encontrada. */
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query + ' car automobile')}` +
    `&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=600` +
    `&format=json&origin=*&gsrlimit=8`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: {
      pages?: Record<string, {
        title?: string;
        imageinfo?: Array<{ url?: string }>;
      }>;
    };
  };

  const pages = Object.values(data.query?.pages ?? {});

  for (const page of pages) {
    const title = (page.title ?? '').toLowerCase();
    const imgUrl = page.imageinfo?.[0]?.url ?? '';

    // Rejeita logos, ícones e imagens não relacionadas
    const isLogo  = /logo|icon|badge|emblem|shield|flag|map/i.test(title);
    const isPhoto = /\.(jpg|jpeg|png|webp)/i.test(imgUrl);

    if (!isLogo && isPhoto && imgUrl) return imgUrl;
  }

  return null;
}

// ── Orquestrador em 3 estágios ────────────────────────────────────────────────

export async function prefetchAllCarImages(): Promise<void> {
  if (fetchState !== 'idle') return;
  fetchState = 'running';

  const allIds = Object.keys(MODEL_WIKI);
  const BATCH  = 50;

  // ── Estágio 1: pt.wikipedia.org ──────────────────────────────────
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
      const batch   = uniqueTitles.slice(i, i + BATCH);
      const thumbs  = await wikiThumbBatch('https://pt.wikipedia.org', batch).catch(() => new Map());

      for (const [title, url] of thumbs) {
        for (const id of titleToIds.get(title) ?? []) {
          imageCache.set(id, url);
        }
      }
      notify();
    }
  }

  // ── Estágio 2: en.wikipedia.org (só os que ainda não têm imagem) ──
  {
    const missing = allIds.filter(id => !imageCache.has(id) || imageCache.get(id) === null);

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
      const thumbs = await wikiThumbBatch('https://en.wikipedia.org', batch).catch(() => new Map());

      for (const [title, url] of thumbs) {
        for (const id of titleToIds.get(title) ?? []) {
          if (!imageCache.get(id)) imageCache.set(id, url);
        }
      }
      notify();
    }
  }

  // ── Estágio 3: Wikimedia Commons search (restantes) ──────────────
  {
    const stillMissing = allIds.filter(
      id => !imageCache.has(id) || imageCache.get(id) === null
    );

    // Monta termo de busca a partir dos títulos disponíveis
    const searchTermFor = (id: string): string => {
      return MODEL_WIKI[id][1] ?? MODEL_WIKI[id][0] ?? id.replace(/_/g, ' ');
    };

    // Processa em paralelo com concorrência limitada (4 ao mesmo tempo)
    const CONCURRENCY = 4;
    for (let i = 0; i < stillMissing.length; i += CONCURRENCY) {
      const chunk = stillMissing.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async id => {
          const url = await commonsSearch(searchTermFor(id)).catch(() => null);
          imageCache.set(id, url);
        })
      );
      notify();
    }
  }

  // ── Marca como null os que não encontraram nada ───────────────────
  for (const id of allIds) {
    if (!imageCache.has(id)) imageCache.set(id, null);
  }

  notify();
  fetchState = 'done';
}
