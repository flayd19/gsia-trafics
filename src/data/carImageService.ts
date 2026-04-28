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

  // ── JDM ──────────────────────────────────────────────────────────
  toyota_supra_mk4:   ['Toyota Supra',                'Toyota Supra A80'],
  toyota_supra_mk5:   ['Toyota GR Supra',             'Toyota GR Supra'],
  mazda_rx7_fd:       ['Mazda RX-7',                  'Mazda RX-7'],
  mazda_rx7_fc:       ['Mazda RX-7',                  'Mazda RX-7'],
  mazda_rx8:          ['Mazda RX-8',                  'Mazda RX-8'],
  honda_s2000:        ['Honda S2000',                 'Honda S2000'],
  honda_nsx_na1:      ['Honda NSX',                   'Honda NSX (first generation)'],
  mitsubishi_evo9:    ['Mitsubishi Lancer Evolution', 'Mitsubishi Lancer Evolution IX'],
  mitsubishi_evo10:   ['Mitsubishi Lancer Evolution', 'Mitsubishi Lancer Evolution X'],
  mitsubishi_evo8:    ['Mitsubishi Lancer Evolution', 'Mitsubishi Lancer Evolution VIII'],
  nissan_silvia_s15:  ['Nissan Silvia',               'Nissan Silvia'],
  nissan_180sx:       ['Nissan 180SX',                'Nissan 180SX'],
  honda_integra_type_r: ['Honda Integra Type R',      'Honda Integra Type R'],
  ae86:               ['Toyota AE86',                 'Toyota AE86'],
  celica_gt4:         ['Toyota Celica',               'Toyota Celica GT-Four'],
  subaru_brz:         ['Subaru BRZ',                  'Subaru BRZ'],
  mazda_mx5:          ['Mazda MX-5',                  'Mazda MX-5'],
  mitsubishi_eclipse_gsx: ['Mitsubishi Eclipse',      'Mitsubishi Eclipse'],
  toyota_gr_yaris:    ['Toyota GR Yaris',             'Toyota GR Yaris'],
  toyota_gr_corolla:  ['Toyota GR Corolla',           'Toyota GR Corolla'],
  hyundai_elantra_n:  ['Hyundai Elantra N',           'Hyundai Elantra N'],
  kia_stinger_gt:     ['Kia Stinger',                 'Kia Stinger'],
  nissan_350z:        ['Nissan 350Z',                 'Nissan 350Z'],
  nissan_370z:        ['Nissan 370Z',                 'Nissan 370Z'],
  nissan_z_rz34:      ['Nissan Z',                    'Nissan Z (RZ34)'],

  // ── Supercars já existentes (estavam faltando no MODEL_WIKI) ─────
  lamborghini_huracan:  ['Lamborghini Huracán',       'Lamborghini Huracán'],
  lamborghini_aventador:['Lamborghini Aventador',     'Lamborghini Aventador'],
  ferrari_488:          ['Ferrari 488',               'Ferrari 488'],
  ferrari_f8:           ['Ferrari F8',                'Ferrari F8 Tributo'],
  ferrari_296:          ['Ferrari 296',               'Ferrari 296 GTB'],
  mclaren_720s:         ['McLaren 720S',              'McLaren 720S'],
  mclaren_570s:         ['McLaren 570S',              'McLaren 570S'],
  porsche_911_gt3:      ['Porsche 911 GT3',           'Porsche 911 GT3'],
  porsche_911_turbo_s:  ['Porsche 911 Turbo',         'Porsche 911 Turbo'],
  porsche_cayman_gt4:   ['Porsche Cayman',            'Porsche 718 Cayman GT4 RS'],
  audi_r8:              ['Audi R8',                   'Audi R8'],
  honda_nsx_type_s:     ['Honda NSX',                 'Honda NSX (second generation)'],
  ford_gt_mk4:          ['Ford GT',                   'Ford GT (second generation)'],

  // ── Porsche linha completa (novos) ───────────────────────────────
  porsche_718_cayman:   ['Porsche Cayman',            'Porsche 718 Cayman'],
  porsche_718_boxster:  ['Porsche Boxster',           'Porsche 718 Boxster'],
  porsche_911_gt3_rs:   ['Porsche 911 GT3 RS',        'Porsche 911 GT3 RS'],
  porsche_911_gt2_rs:   ['Porsche 911 GT2 RS',        'Porsche 911 GT2 RS'],
  porsche_911_carrera:  ['Porsche 911',               'Porsche 911'],
  porsche_911_targa:    ['Porsche 911',               'Porsche 911 Targa'],
  porsche_911_sport_classic: ['Porsche 911',          'Porsche 911 Sport Classic'],
  porsche_911_dakar:    ['Porsche 911 Dakar',         'Porsche 911 Dakar'],
  porsche_taycan:       ['Porsche Taycan',            'Porsche Taycan'],
  porsche_panamera:     ['Porsche Panamera',          'Porsche Panamera'],
  porsche_cayenne_coupe:['Porsche Cayenne',           'Porsche Cayenne Coupé'],

  // ── Lamborghini ──────────────────────────────────────────────────
  lambo_revuelto:       ['Lamborghini Revuelto',      'Lamborghini Revuelto'],
  lambo_urus_performante:['Lamborghini Urus',         'Lamborghini Urus'],
  lambo_sian:           ['Lamborghini Sián FKP 37',   'Lamborghini Sián'],
  lambo_countach_lpi:   ['Lamborghini Countach',      'Lamborghini Countach LPI 800-4'],
  lambo_diablo:         ['Lamborghini Diablo',        'Lamborghini Diablo'],
  lambo_murcielago:     ['Lamborghini Murciélago',    'Lamborghini Murciélago'],
  lambo_gallardo:       ['Lamborghini Gallardo',      'Lamborghini Gallardo'],

  // ── Ferrari ──────────────────────────────────────────────────────
  ferrari_sf90:         ['Ferrari SF90 Stradale',     'Ferrari SF90 Stradale'],
  ferrari_laferrari:    ['Ferrari LaFerrari',         'Ferrari LaFerrari'],
  ferrari_roma:         ['Ferrari Roma',              'Ferrari Roma'],
  ferrari_portofino_m:  ['Ferrari Portofino',         'Ferrari Portofino'],
  ferrari_812_superfast:['Ferrari 812 Superfast',     'Ferrari 812 Superfast'],
  ferrari_812_competizione:['Ferrari 812',            'Ferrari 812 Competizione'],
  ferrari_daytona_sp3:  ['Ferrari Daytona SP3',       'Ferrari Daytona SP3'],
  ferrari_monza_sp2:    ['Ferrari Monza SP1 e SP2',   'Ferrari Monza SP1 and SP2'],
  ferrari_purosangue:   ['Ferrari Purosangue',        'Ferrari Purosangue'],
  ferrari_f12:          ['Ferrari F12 Berlinetta',    'Ferrari F12berlinetta'],
  ferrari_f40:          ['Ferrari F40',               'Ferrari F40'],
  ferrari_f50:          ['Ferrari F50',               'Ferrari F50'],
  ferrari_enzo:         ['Ferrari Enzo',              'Ferrari Enzo Ferrari'],

  // ── McLaren ──────────────────────────────────────────────────────
  mclaren_artura:       ['McLaren Artura',            'McLaren Artura'],
  mclaren_765lt:        ['McLaren 765LT',             'McLaren 765LT'],
  mclaren_senna:        ['McLaren Senna',             'McLaren Senna'],
  mclaren_p1:           ['McLaren P1',                'McLaren P1'],
  mclaren_speedtail:    ['McLaren Speedtail',         'McLaren Speedtail'],
  mclaren_gt:           ['McLaren GT',                'McLaren GT'],
  mclaren_elva:         ['McLaren Elva',              'McLaren Elva'],

  // ── Aston Martin ─────────────────────────────────────────────────
  aston_vantage:        ['Aston Martin Vantage',      'Aston Martin Vantage'],
  aston_db12:           ['Aston Martin DB12',         'Aston Martin DB12'],
  aston_dbs:            ['Aston Martin DBS Superleggera', 'Aston Martin DBS Superleggera'],
  aston_valhalla:       ['Aston Martin Valhalla',     'Aston Martin Valhalla'],
  aston_valkyrie:       ['Aston Martin Valkyrie',     'Aston Martin Valkyrie'],
  aston_dbx707:         ['Aston Martin DBX',          'Aston Martin DBX'],

  // ── Bugatti ──────────────────────────────────────────────────────
  bugatti_chiron:       ['Bugatti Chiron',            'Bugatti Chiron'],
  bugatti_bolide:       ['Bugatti Bolide',            'Bugatti Bolide'],
  bugatti_veyron_ss:    ['Bugatti Veyron',            'Bugatti Veyron'],
  bugatti_centodieci:   ['Bugatti Centodieci',        'Bugatti Centodieci'],

  // ── Koenigsegg ───────────────────────────────────────────────────
  koenigsegg_jesko:     ['Koenigsegg Jesko',          'Koenigsegg Jesko'],
  koenigsegg_regera:    ['Koenigsegg Regera',         'Koenigsegg Regera'],
  koenigsegg_gemera:    ['Koenigsegg Gemera',         'Koenigsegg Gemera'],
  koenigsegg_agera_rs:  ['Koenigsegg Agera',          'Koenigsegg Agera'],

  // ── Pagani ───────────────────────────────────────────────────────
  pagani_huayra:        ['Pagani Huayra',             'Pagani Huayra'],
  pagani_utopia:        ['Pagani Utopia',             'Pagani Utopia'],
  pagani_zonda:         ['Pagani Zonda',              'Pagani Zonda'],

  // ── Lotus ────────────────────────────────────────────────────────
  lotus_evija:          ['Lotus Evija',               'Lotus Evija'],
  lotus_emira:          ['Lotus Emira',               'Lotus Emira'],

  // ── Maserati / Hipercarros / AMG / BMW M / Audi RS ──────────────
  maserati_mc20:        ['Maserati MC20',             'Maserati MC20'],
  rimac_nevera:         ['Rimac Nevera',              'Rimac Nevera'],
  czinger_21c:          ['Czinger 21C',               'Czinger 21C'],
  amg_one:              ['Mercedes-AMG ONE',          'Mercedes-AMG One'],
  amg_gt_black_series:  ['Mercedes-AMG GT',           'Mercedes-AMG GT Black Series'],
  amg_sl63:             ['Mercedes-Benz SL',          'Mercedes-Benz SL-Class (R232)'],
  bmw_m5_cs:            ['BMW M5',                    'BMW M5 (F90)'],
  bmw_m8_competition:   ['BMW M8',                    'BMW M8'],
  audi_rsq8:            ['Audi RS Q8',                'Audi RS Q8'],
  audi_rs_etron_gt:     ['Audi e-tron GT',            'Audi e-tron GT'],
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
