/**
 * carImageService — busca imagens reais de carros via Wikipedia Action API.
 *
 * A API é CORS-habilitada (origin=*) e retorna a miniatura principal do artigo
 * Wikipedia para cada modelo, garantindo fotos reais sem depender de hashes MD5.
 *
 * Uso:
 *   import { useCarImages } from '@/hooks/useCarImages';
 *   const getImg = useCarImages();
 *   <img src={getImg('gol')} />
 */

// ── Mapeamento modelId → título do artigo Wikipedia ──────────────────────

export const MODEL_WIKI_TITLES: Record<string, string> = {
  // VOLKSWAGEN
  gol:                'Volkswagen Gol',
  polo:               'Volkswagen Polo',
  voyage:             'Volkswagen Voyage',
  saveiro:            'Volkswagen Saveiro',
  up:                 'Volkswagen Up',
  tcross:             'Volkswagen T-Cross',
  golf:               'Volkswagen Golf',
  jetta:              'Volkswagen Jetta',
  amarok:             'Volkswagen Amarok',
  virtus:             'Volkswagen Virtus',
  nivus:              'Volkswagen Nivus',
  taos:               'Volkswagen Taos',
  tiguan:             'Volkswagen Tiguan',
  golf_gti:           'Volkswagen Golf GTI',
  gol_g1:             'Volkswagen Gol',
  gol_g2:             'Volkswagen Gol',
  santana:            'Volkswagen Santana',
  passat_classic:     'Volkswagen Passat',

  // FIAT
  uno:                'Fiat Uno',
  uno_mille:          'Fiat Uno',
  mobi:               'Fiat Mobi',
  argo:               'Fiat Argo',
  cronos:             'Fiat Cronos',
  strada:             'Fiat Strada',
  toro:               'Fiat Toro',
  pulse:              'Fiat Pulse',
  doblo:              'Fiat Doblò',
  grand_siena:        'Fiat Grand Siena',
  fastback:           'Fiat Fastback',
  palio:              'Fiat Palio',
  tempra:             'Fiat Tempra',
  tipo:               'Fiat Tipo',

  // CHEVROLET
  onix:               'Chevrolet Onix',
  onix_plus:          'Chevrolet Onix Plus',
  tracker:            'Chevrolet Tracker',
  montana:            'Chevrolet Montana',
  s10:                'Chevrolet S10',
  spin:               'Chevrolet Spin',
  cruze:              'Chevrolet Cruze',
  equinox:            'Chevrolet Equinox',
  chevette:           'Chevrolet Chevette',
  monza:              'Chevrolet Monza',
  kadett:             'Opel Kadett',
  corvette_c8:        'Chevrolet Corvette (C8)',
  corvette_c7_z06:    'Chevrolet Corvette Z06',
  camaro_ss:          'Chevrolet Camaro',
  camaro_zl1:         'Chevrolet Camaro ZL1',

  // FORD
  ka:                 'Ford Ka',
  ecosport:           'Ford EcoSport',
  ranger:             'Ford Ranger',
  fiesta:             'Ford Fiesta',
  focus:              'Ford Focus',
  territory:          'Ford Territory',
  maverick_ford:      'Ford Maverick (2021)',
  bronco_sport:       'Ford Bronco Sport',
  escort:             'Ford Escort',
  mustang:            'Ford Mustang',
  shelby_gt500:       'Ford Shelby GT500',

  // TOYOTA
  corolla:            'Toyota Corolla',
  hilux:              'Toyota Hilux',
  yaris:              'Toyota Yaris',
  sw4:                'Toyota Fortuner',
  corolla_cross:      'Toyota Corolla Cross',
  rav4:               'Toyota RAV4',
  camry:              'Toyota Camry',
  land_cruiser_prado: 'Toyota Land Cruiser Prado',
  gr86:               'Toyota GR86',

  // HONDA
  civic:              'Honda Civic',
  hrv:                'Honda HR-V',
  fit:                'Honda Fit',
  city:               'Honda City',
  wrv:                'Honda WR-V',
  accord:             'Honda Accord',
  civic_type_r:       'Honda Civic Type R',

  // HYUNDAI
  hb20:               'Hyundai HB20',
  hb20s:              'Hyundai HB20S',
  creta:              'Hyundai Creta',
  tucson:             'Hyundai Tucson',
  i30:                'Hyundai i30',
  santa_fe:           'Hyundai Santa Fe',
  i30n:               'Hyundai i30 N',

  // NISSAN
  kicks:              'Nissan Kicks',
  versa:              'Nissan Versa',
  frontier:           'Nissan Frontier',
  sentra:             'Nissan Sentra',
  march:              'Nissan March',
  nissan_gtr_r35:     'Nissan GT-R',
  nissan_gtr_r34:     'Nissan Skyline GT-R',
  nissan_gtr_r33:     'Nissan Skyline GT-R',
  nissan_gtr_r32:     'Nissan Skyline GT-R',

  // RENAULT
  kwid:               'Renault Kwid',
  sandero:            'Renault Sandero',
  duster:             'Dacia Duster',
  logan:              'Renault Logan',
  captur:             'Renault Captur',
  kardian:            'Renault Kardian',
  oroch:              'Renault Oroch',
  renault_megane_rs:  'Renault Mégane RS',

  // KIA
  sportage:           'Kia Sportage',
  cerato:             'Kia Cerato',
  stonic:             'Kia Stonic',

  // JEEP
  renegade:           'Jeep Renegade',
  compass:            'Jeep Compass',

  // PEUGEOT / CITROËN
  peugeot2008:        'Peugeot 2008',
  peugeot208:         'Peugeot 208',
  c3:                 'Citroën C3',
  c4_cactus:          'Citroën C4 Cactus',

  // MITSUBISHI
  l200:               'Mitsubishi Triton',
  eclipse_cross:      'Mitsubishi Eclipse Cross',

  // CHERY / BYD
  tiggo8:             'Chery Tiggo 8',
  byd_dolphin:        'BYD Dolphin',
  byd_king:           'BYD Seal',

  // BMW
  bmw_320i:           'BMW 3 Series',
  bmw_530i:           'BMW 5 Series',
  bmw_x1:             'BMW X1',
  bmw_x3:             'BMW X3',
  bmw_m2:             'BMW M2',
  bmw_m3:             'BMW M3',
  bmw_m4:             'BMW M4',

  // MERCEDES
  mercedes_c200:      'Mercedes-Benz C-Class',
  mercedes_c300:      'Mercedes-Benz C-Class',
  mercedes_gla:       'Mercedes-Benz GLA-Class',
  mercedes_glc:       'Mercedes-Benz GLC-Class',
  mercedes_amg_a45:   'Mercedes-AMG A 45',
  mercedes_amg_c63:   'Mercedes-AMG C 63',
  mercedes_amg_gt:    'Mercedes-AMG GT',

  // AUDI
  audi_a3:            'Audi A3',
  audi_q3:            'Audi Q3',
  audi_q5:            'Audi Q5',
  audi_rs3:           'Audi RS3',
  audi_rs6:           'Audi RS6',

  // LAND ROVER
  lr_evoque:          'Range Rover Evoque',
  lr_discovery_sport: 'Land Rover Discovery Sport',
  lr_defender:        'Land Rover Defender',

  // VOLVO
  volvo_xc40:         'Volvo XC40',
  volvo_xc60:         'Volvo XC60',

  // PORSCHE
  porsche_macan:      'Porsche Macan',

  // ALFA ROMEO
  alfa_giulia_qv:     'Alfa Romeo Giulia',

  // DODGE / MUSCLE
  challenger_hellcat: 'Dodge Challenger',
  charger_srt:        'Dodge Charger',

  // SUBARU
  wrx_sti:            'Subaru WRX STI',
};

// ── Cache e estado da busca ───────────────────────────────────────────────

/** modelId → URL da imagem (null = artigo existe mas sem foto) */
const imageCache = new Map<string, string | null>();

type Listener = () => void;
const listeners = new Set<Listener>();

let fetchState: 'idle' | 'loading' | 'done' = 'idle';

// ── API pública ───────────────────────────────────────────────────────────

/** Retorna a URL cacheada para um modelId, ou undefined se ainda não carregou. */
export function getCachedUrl(modelId: string): string | undefined {
  const val = imageCache.get(modelId);
  return val ?? undefined;
}

/** Registra um listener que será chamado após cada batch de busca concluir. */
export function subscribeToImageUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ── Busca em batch via Wikipedia Action API ───────────────────────────────

async function fetchBatch(titles: string[]): Promise<void> {
  const encoded = titles.map(t => encodeURIComponent(t)).join('|');
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=480&origin=*`;

  const res = await fetch(url);
  if (!res.ok) return;

  const data = (await res.json()) as {
    query?: {
      pages?: Record<string, { title?: string; thumbnail?: { source?: string } }>;
    };
  };

  const pages = data.query?.pages ?? {};

  // Para cada página retornada, mapear todos os modelIds que usam aquele título
  for (const page of Object.values(pages)) {
    if (!page.title) continue;
    const photoUrl = page.thumbnail?.source ?? null;

    for (const [modelId, wikiTitle] of Object.entries(MODEL_WIKI_TITLES)) {
      if (wikiTitle === page.title) {
        imageCache.set(modelId, photoUrl);
      }
    }
  }
}

/**
 * Baixa imagens de todos os modelos em batches de 50.
 * Idempotente — chamadas subsequentes são no-op.
 */
export async function prefetchAllCarImages(): Promise<void> {
  if (fetchState !== 'idle') return;
  fetchState = 'loading';

  // Títulos únicos (evita buscar o mesmo artigo por aliases como gol_g1/gol_g2)
  const allModelIds  = Object.keys(MODEL_WIKI_TITLES);
  const uniqueTitles = [...new Set(Object.values(MODEL_WIKI_TITLES))];

  // Marcar todos modelIds sem título como null para evitar undefined infinito
  for (const id of allModelIds) {
    if (!imageCache.has(id)) imageCache.set(id, null);
  }

  // Batches de 50 (limite da Wikipedia API)
  const BATCH_SIZE = 50;
  for (let i = 0; i < uniqueTitles.length; i += BATCH_SIZE) {
    const batch = uniqueTitles.slice(i, i + BATCH_SIZE);
    await fetchBatch(batch).catch(() => { /* silencia erro de rede */ });
    listeners.forEach(fn => fn()); // atualiza UI após cada batch
  }

  fetchState = 'done';
}
