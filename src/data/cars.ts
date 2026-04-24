// =====================================================================
// BANCO DE CARROS BRASILEIROS — 50 modelos com variações e preço FIPE
// =====================================================================

export type CarCategory = 'popular' | 'medio' | 'suv' | 'pickup' | 'esportivo' | 'eletrico';
export type CarConditionLabel = 'Novo' | 'Ótimo' | 'Bom' | 'Regular' | 'Ruim' | 'Sucata';

export interface CarVariant {
  id: string;       // ex: 'gol_10_trend'
  trim: string;     // ex: '1.0 Trend'
  year: number;
  fipePrice: number; // em R$
}

export interface CarModel {
  id: string;       // ex: 'gol'
  brand: string;    // ex: 'Volkswagen'
  model: string;    // ex: 'Gol'
  icon: string;     // emoji
  category: CarCategory;
  variants: CarVariant[];
}

/** Retorna label legível para condição 0-100 */
export function conditionLabel(condition: number): CarConditionLabel {
  if (condition >= 95) return 'Novo';
  if (condition >= 80) return 'Ótimo';
  if (condition >= 60) return 'Bom';
  if (condition >= 40) return 'Regular';
  if (condition >= 20) return 'Ruim';
  return 'Sucata';
}

/** Retorna cor (Tailwind class) para badge de condição */
export function conditionColor(condition: number): string {
  if (condition >= 80) return 'text-emerald-500';
  if (condition >= 60) return 'text-green-500';
  if (condition >= 40) return 'text-yellow-500';
  if (condition >= 20) return 'text-orange-500';
  return 'text-red-500';
}

/** Fator de valor de mercado baseado na condição (0-100 → 0.35 a 1.0) */
export function conditionValueFactor(condition: number): number {
  // Novo (100) = 100% da FIPE; Sucata (0) = 10%
  // Faixa real: [0.10, 1.00] — permite que veículos com condition baixa
  // sejam gerados abaixo do piso de 22% e recebam o clamp corretamente.
  return 0.10 + (condition / 100) * 0.90;
}

/**
 * Proporção mínima do preço de negociação em relação à FIPE.
 * Usado nas ofertas de compradores e no sistema de negociação.
 */
export const MIN_ASKING_PRICE_RATIO = 0.22;

/**
 * Aplica o piso de negociação ao preço calculado (usado em negociações,
 * não no marketplace — para marketplace use calcMarketAskingPrice).
 */
export function clampAskingPrice(price: number, fipePrice: number): number {
  return Math.max(price, Math.round(fipePrice * MIN_ASKING_PRICE_RATIO));
}

/**
 * Calcula o preço de listagem no mercado global com base em faixas de condição.
 *
 * Faixas de valor base:
 *   condition > 80  →  90–97 % da FIPE  (bom/ótimo)
 *   condition 60-80 →  85–90 % da FIPE  (regular)
 *   condition < 60  →  79–85 % da FIPE  (ruim/sucata)
 *
 * Após definir o valor base, aplica variação de mercado: −4 % a +3 %.
 * Piso absoluto: MIN_ASKING_PRICE_RATIO (22 % da FIPE).
 */
export function calcMarketAskingPrice(fipePrice: number, condition: number): number {
  let minRatio: number;
  let maxRatio: number;

  if (condition > 80) {
    minRatio = 0.90; maxRatio = 0.97;
  } else if (condition >= 60) {
    minRatio = 0.85; maxRatio = 0.90;
  } else {
    minRatio = 0.79; maxRatio = 0.85;
  }

  // 1. Valor base uniforme dentro da faixa
  const baseRatio = minRatio + Math.random() * (maxRatio - minRatio);

  // 2. Variação de mercado: −4 % a +3 %
  const variation = 0.96 + Math.random() * 0.07;

  const finalRatio = baseRatio * variation;

  // 3. Piso absoluto: 22 % da FIPE
  return Math.max(
    Math.round(fipePrice * finalRatio),
    Math.round(fipePrice * MIN_ASKING_PRICE_RATIO),
  );
}

/**
 * Daily rental cost for a garage slot (charged only when occupied).
 * Formula: 100 × 2^(n−1)
 * Slot 1 → R$100/day · Slot 2 → R$200/day · Slot 10 → R$51 200/day …
 */
export function garageSlotDailyCost(slotIndex: number): number {
  return 100 * Math.pow(2, slotIndex - 1);
}

/** Slots da garagem com custo para desbloquear — até 50 vagas */
export const GARAGE_SLOTS: { id: number; unlockCost: number }[] = [
  // Slots 1–10: custos manuais calibrados
  { id: 1,  unlockCost: 0 },
  { id: 2,  unlockCost: 20_000 },
  { id: 3,  unlockCost: 40_000 },
  { id: 4,  unlockCost: 80_000 },
  { id: 5,  unlockCost: 150_000 },
  { id: 6,  unlockCost: 280_000 },
  { id: 7,  unlockCost: 500_000 },
  { id: 8,  unlockCost: 850_000 },
  { id: 9,  unlockCost: 1_400_000 },
  { id: 10, unlockCost: 2_200_000 },
  // Slots 11–50: crescimento ×1.6 por slot (custo diário tornará a maioria inacessível)
  ...Array.from({ length: 40 }, (_, i) => ({
    id:          i + 11,
    unlockCost:  Math.round(2_200_000 * Math.pow(1.6, i + 1)),
  })),
];

// =====================================================================
// OS 50 MODELOS
// =====================================================================
export const CAR_MODELS: CarModel[] = [
  // ── VOLKSWAGEN ──────────────────────────────────────────────────
  {
    id: 'gol',
    brand: 'Volkswagen',
    model: 'Gol',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'gol_10_trend',      trim: '1.0 Trend',       year: 2023, fipePrice: 62_000 },
      { id: 'gol_10_msi',        trim: '1.0 MSI',         year: 2022, fipePrice: 55_000 },
      { id: 'gol_16_comfortline',trim: '1.6 Comfortline', year: 2021, fipePrice: 68_000 },
    ],
  },
  {
    id: 'polo',
    brand: 'Volkswagen',
    model: 'Polo',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'polo_10_tsi_comfortline', trim: '1.0 TSI Comfortline', year: 2023, fipePrice: 105_000 },
      { id: 'polo_10_tsi_highline',    trim: '1.0 TSI Highline',    year: 2023, fipePrice: 118_000 },
      { id: 'polo_16_msi_trendline',   trim: '1.6 MSI Trendline',   year: 2022, fipePrice: 90_000 },
    ],
  },
  {
    id: 'voyage',
    brand: 'Volkswagen',
    model: 'Voyage',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'voyage_16_trendline', trim: '1.6 Trendline', year: 2022, fipePrice: 73_000 },
      { id: 'voyage_16_comfortline', trim: '1.6 Comfortline', year: 2022, fipePrice: 82_000 },
    ],
  },
  {
    id: 'saveiro',
    brand: 'Volkswagen',
    model: 'Saveiro',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'saveiro_16_robust',    trim: '1.6 Robust',    year: 2023, fipePrice: 98_000 },
      { id: 'saveiro_16_trendline', trim: '1.6 Trendline', year: 2023, fipePrice: 105_000 },
    ],
  },
  {
    id: 'up',
    brand: 'Volkswagen',
    model: 'Up!',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'up_10_move', trim: '1.0 Move', year: 2021, fipePrice: 52_000 },
      { id: 'up_10_take', trim: '1.0 Take', year: 2021, fipePrice: 47_000 },
      { id: 'up_10_high', trim: '1.0 High', year: 2022, fipePrice: 58_000 },
    ],
  },
  {
    id: 'tcross',
    brand: 'Volkswagen',
    model: 'T-Cross',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'tcross_10_tsi_trendline',   trim: '1.0 TSI Trendline',   year: 2023, fipePrice: 130_000 },
      { id: 'tcross_10_tsi_comfortline', trim: '1.0 TSI Comfortline', year: 2023, fipePrice: 145_000 },
      { id: 'tcross_14_tsi_highline',    trim: '1.4 TSI Highline',    year: 2023, fipePrice: 165_000 },
    ],
  },
  {
    id: 'jetta',
    brand: 'Volkswagen',
    model: 'Jetta',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'jetta_14_tsi_comfortline', trim: '1.4 TSI Comfortline', year: 2023, fipePrice: 158_000 },
      { id: 'jetta_14_tsi_highline',    trim: '1.4 TSI Highline',    year: 2023, fipePrice: 175_000 },
    ],
  },
  {
    id: 'amarok',
    brand: 'Volkswagen',
    model: 'Amarok',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'amarok_30_v6_comfortline', trim: '3.0 V6 Comfortline', year: 2023, fipePrice: 395_000 },
      { id: 'amarok_20_tdi_comfortline',trim: '2.0 TDI Comfortline', year: 2021, fipePrice: 265_000 },
    ],
  },

  // ── FIAT ────────────────────────────────────────────────────────
  {
    id: 'uno',
    brand: 'Fiat',
    model: 'Uno',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'uno_10_attractive',  trim: '1.0 Attractive',  year: 2021, fipePrice: 45_000 },
      { id: 'uno_14_way',         trim: '1.4 Way',         year: 2021, fipePrice: 52_000 },
    ],
  },
  {
    id: 'mobi',
    brand: 'Fiat',
    model: 'Mobi',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'mobi_10_like',  trim: '1.0 Like',  year: 2023, fipePrice: 58_000 },
      { id: 'mobi_10_drive', trim: '1.0 Drive', year: 2023, fipePrice: 63_000 },
      { id: 'mobi_10_way',   trim: '1.0 Way',   year: 2023, fipePrice: 68_000 },
    ],
  },
  {
    id: 'argo',
    brand: 'Fiat',
    model: 'Argo',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'argo_10_drive',     trim: '1.0 Drive',     year: 2023, fipePrice: 78_000 },
      { id: 'argo_13_drive_gsr', trim: '1.3 Drive GSR', year: 2023, fipePrice: 88_000 },
      { id: 'argo_18_hgt',       trim: '1.8 HGT',       year: 2022, fipePrice: 96_000 },
    ],
  },
  {
    id: 'cronos',
    brand: 'Fiat',
    model: 'Cronos',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'cronos_13_drive',     trim: '1.3 Drive',     year: 2023, fipePrice: 87_000 },
      { id: 'cronos_13_precision', trim: '1.3 Precision', year: 2023, fipePrice: 94_000 },
    ],
  },
  {
    id: 'strada',
    brand: 'Fiat',
    model: 'Strada',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'strada_13_working',   trim: '1.3 Working',   year: 2023, fipePrice: 95_000 },
      { id: 'strada_13_endurance', trim: '1.3 Endurance', year: 2023, fipePrice: 105_000 },
      { id: 'strada_18_volcano',   trim: '1.8 Volcano',   year: 2022, fipePrice: 118_000 },
    ],
  },
  {
    id: 'toro',
    brand: 'Fiat',
    model: 'Toro',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'toro_18_freedom',  trim: '1.8 Freedom',  year: 2023, fipePrice: 148_000 },
      { id: 'toro_20_ultra',    trim: '2.0 Ultra',    year: 2023, fipePrice: 218_000 },
      { id: 'toro_13_volcano',  trim: '1.3 Volcano',  year: 2023, fipePrice: 162_000 },
    ],
  },
  {
    id: 'pulse',
    brand: 'Fiat',
    model: 'Pulse',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'pulse_10_drive',   trim: '1.0 Drive',   year: 2023, fipePrice: 92_000 },
      { id: 'pulse_13_impetus', trim: '1.3 Impetus', year: 2023, fipePrice: 112_000 },
    ],
  },
  {
    id: 'fastback',
    brand: 'Fiat',
    model: 'Fastback',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'fastback_10_audace',  trim: '1.0 Audace',  year: 2023, fipePrice: 108_000 },
      { id: 'fastback_13_impetus', trim: '1.3 Impetus', year: 2023, fipePrice: 125_000 },
    ],
  },

  // ── CHEVROLET ────────────────────────────────────────────────────
  {
    id: 'onix',
    brand: 'Chevrolet',
    model: 'Onix',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'onix_10_joy',     trim: '1.0 Joy',       year: 2023, fipePrice: 72_000 },
      { id: 'onix_10_lt',      trim: '1.0 LT',        year: 2023, fipePrice: 80_000 },
      { id: 'onix_10_turbo',   trim: '1.0 Turbo RS',  year: 2023, fipePrice: 98_000 },
    ],
  },
  {
    id: 'onix_plus',
    brand: 'Chevrolet',
    model: 'Onix Plus',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'onixplus_10_lt',    trim: '1.0 LT',      year: 2023, fipePrice: 86_000 },
      { id: 'onixplus_10_turbo', trim: '1.0 Turbo',   year: 2023, fipePrice: 102_000 },
    ],
  },
  {
    id: 'tracker',
    brand: 'Chevrolet',
    model: 'Tracker',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'tracker_10_turbo_lt',      trim: '1.0 Turbo LT',      year: 2023, fipePrice: 122_000 },
      { id: 'tracker_10_turbo_premier', trim: '1.0 Turbo Premier',  year: 2023, fipePrice: 145_000 },
    ],
  },
  {
    id: 'montana',
    brand: 'Chevrolet',
    model: 'Montana',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'montana_12_turbo_lt',      trim: '1.2 Turbo LT',      year: 2023, fipePrice: 108_000 },
      { id: 'montana_12_turbo_premier', trim: '1.2 Turbo Premier',  year: 2023, fipePrice: 128_000 },
    ],
  },
  {
    id: 's10',
    brand: 'Chevrolet',
    model: 'S10',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 's10_25_lt_4x2',    trim: '2.5 LT 4x2',    year: 2023, fipePrice: 195_000 },
      { id: 's10_28_ltz_4x4',   trim: '2.8 LTZ 4x4',   year: 2023, fipePrice: 265_000 },
      { id: 's10_28_high_4x4',  trim: '2.8 High 4x4',  year: 2023, fipePrice: 290_000 },
    ],
  },
  {
    id: 'spin',
    brand: 'Chevrolet',
    model: 'Spin',
    icon: '🚐',
    category: 'medio',
    variants: [
      { id: 'spin_18_lt',      trim: '1.8 LT',      year: 2022, fipePrice: 98_000 },
      { id: 'spin_10_turbo',   trim: '1.0 Turbo',   year: 2023, fipePrice: 108_000 },
    ],
  },

  // ── FORD ────────────────────────────────────────────────────────
  {
    id: 'ka',
    brand: 'Ford',
    model: 'Ka',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'ka_10_se',   trim: '1.0 SE',   year: 2021, fipePrice: 55_000 },
      { id: 'ka_15_sel',  trim: '1.5 SEL',  year: 2021, fipePrice: 65_000 },
      { id: 'ka_15_titanium', trim: '1.5 Titanium', year: 2021, fipePrice: 72_000 },
    ],
  },
  {
    id: 'ecosport',
    brand: 'Ford',
    model: 'EcoSport',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'ecosport_15_se',         trim: '1.5 SE',         year: 2022, fipePrice: 110_000 },
      { id: 'ecosport_20_titanium',   trim: '2.0 Titanium',   year: 2022, fipePrice: 128_000 },
    ],
  },
  {
    id: 'ranger',
    brand: 'Ford',
    model: 'Ranger',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'ranger_22_xls_4x2',  trim: '2.2 XLS 4x2',  year: 2022, fipePrice: 198_000 },
      { id: 'ranger_32_xlt_4x4',  trim: '3.2 XLT 4x4',  year: 2022, fipePrice: 265_000 },
      { id: 'ranger_32_ltd_4x4',  trim: '3.2 Limited 4x4', year: 2023, fipePrice: 305_000 },
    ],
  },

  // ── TOYOTA ───────────────────────────────────────────────────────
  {
    id: 'corolla',
    brand: 'Toyota',
    model: 'Corolla',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'corolla_20_xei',    trim: '2.0 XEI',     year: 2023, fipePrice: 168_000 },
      { id: 'corolla_20_altis',  trim: '2.0 Altis',   year: 2023, fipePrice: 182_000 },
      { id: 'corolla_18_hybrid', trim: '1.8 GR Hybrid', year: 2023, fipePrice: 210_000 },
    ],
  },
  {
    id: 'hilux',
    brand: 'Toyota',
    model: 'Hilux',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'hilux_28_sr_4x4',   trim: '2.8 SR 4x4',     year: 2023, fipePrice: 248_000 },
      { id: 'hilux_28_srx_4x4',  trim: '2.8 SRX 4x4',    year: 2023, fipePrice: 295_000 },
      { id: 'hilux_28_gr_sport', trim: '2.8 GR Sport',    year: 2023, fipePrice: 335_000 },
    ],
  },
  {
    id: 'yaris',
    brand: 'Toyota',
    model: 'Yaris',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'yaris_15_xl',    trim: '1.5 XL',    year: 2023, fipePrice: 88_000 },
      { id: 'yaris_15_xls',   trim: '1.5 XLS',   year: 2023, fipePrice: 98_000 },
      { id: 'yaris_15_xls_m', trim: '1.5 XLS Multidrive', year: 2023, fipePrice: 106_000 },
    ],
  },
  {
    id: 'sw4',
    brand: 'Toyota',
    model: 'SW4',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'sw4_28_sr',  trim: '2.8 SR',  year: 2023, fipePrice: 285_000 },
      { id: 'sw4_28_srx', trim: '2.8 SRX', year: 2023, fipePrice: 325_000 },
    ],
  },

  // ── HONDA ────────────────────────────────────────────────────────
  {
    id: 'civic',
    brand: 'Honda',
    model: 'Civic',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'civic_15_turbo_sport', trim: '1.5 Turbo Sport',   year: 2023, fipePrice: 162_000 },
      { id: 'civic_20_sport',       trim: '2.0 Sport',          year: 2023, fipePrice: 145_000 },
      { id: 'civic_15_touring',     trim: '1.5 Turbo Touring',  year: 2023, fipePrice: 182_000 },
    ],
  },
  {
    id: 'hrv',
    brand: 'Honda',
    model: 'HR-V',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'hrv_15_lx',    trim: '1.5 LX',    year: 2023, fipePrice: 126_000 },
      { id: 'hrv_20_exl',   trim: '2.0 EXL',   year: 2022, fipePrice: 128_000 },
      { id: 'hrv_15_turbo', trim: '1.5 Turbo Advance', year: 2023, fipePrice: 158_000 },
    ],
  },
  {
    id: 'fit',
    brand: 'Honda',
    model: 'Fit',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'fit_15_lx',    trim: '1.5 LX',    year: 2020, fipePrice: 80_000 },
      { id: 'fit_15_exl',   trim: '1.5 EXL',   year: 2020, fipePrice: 90_000 },
      { id: 'fit_15_twist', trim: '1.5 Twist',  year: 2021, fipePrice: 86_000 },
    ],
  },

  // ── HYUNDAI ──────────────────────────────────────────────────────
  {
    id: 'hb20',
    brand: 'Hyundai',
    model: 'HB20',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'hb20_10_sense',   trim: '1.0 Sense',   year: 2023, fipePrice: 70_000 },
      { id: 'hb20_10_vision',  trim: '1.0 Vision',  year: 2023, fipePrice: 78_000 },
      { id: 'hb20_10_platinum',trim: '1.0 Platinum', year: 2023, fipePrice: 86_000 },
    ],
  },
  {
    id: 'creta',
    brand: 'Hyundai',
    model: 'Creta',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'creta_10_action',   trim: '1.0 Action',   year: 2023, fipePrice: 118_000 },
      { id: 'creta_10_platinum', trim: '1.0 Platinum', year: 2023, fipePrice: 142_000 },
      { id: 'creta_20_ultimate', trim: '2.0 Ultimate', year: 2022, fipePrice: 138_000 },
    ],
  },
  {
    id: 'tucson',
    brand: 'Hyundai',
    model: 'Tucson',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'tucson_16_gls',     trim: '1.6 GLS',     year: 2022, fipePrice: 178_000 },
      { id: 'tucson_16_gls_nb',  trim: '1.6 GLS NBio', year: 2022, fipePrice: 168_000 },
    ],
  },

  // ── NISSAN ──────────────────────────────────────────────────────
  {
    id: 'kicks',
    brand: 'Nissan',
    model: 'Kicks',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'kicks_16_s',       trim: '1.6 S',       year: 2023, fipePrice: 105_000 },
      { id: 'kicks_16_sv',      trim: '1.6 SV',      year: 2023, fipePrice: 118_000 },
      { id: 'kicks_16_advance', trim: '1.6 Advance', year: 2023, fipePrice: 132_000 },
    ],
  },
  {
    id: 'versa',
    brand: 'Nissan',
    model: 'Versa',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'versa_16_sense', trim: '1.6 Sense', year: 2023, fipePrice: 82_000 },
      { id: 'versa_16_sv',    trim: '1.6 SV',    year: 2023, fipePrice: 92_000 },
    ],
  },
  {
    id: 'frontier',
    brand: 'Nissan',
    model: 'Frontier',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'frontier_23_xe_4x2', trim: '2.3 XE 4x2', year: 2023, fipePrice: 202_000 },
      { id: 'frontier_23_le_4x4', trim: '2.3 LE 4x4', year: 2023, fipePrice: 252_000 },
    ],
  },

  // ── RENAULT ──────────────────────────────────────────────────────
  {
    id: 'kwid',
    brand: 'Renault',
    model: 'Kwid',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'kwid_10_zen',     trim: '1.0 Zen',     year: 2023, fipePrice: 60_000 },
      { id: 'kwid_10_intense', trim: '1.0 Intense', year: 2023, fipePrice: 68_000 },
      { id: 'kwid_10_outsider',trim: '1.0 Outsider', year: 2023, fipePrice: 72_000 },
    ],
  },
  {
    id: 'sandero',
    brand: 'Renault',
    model: 'Sandero',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'sandero_16_life',  trim: '1.6 Life',  year: 2022, fipePrice: 62_000 },
      { id: 'sandero_16_zen',   trim: '1.6 Zen',   year: 2022, fipePrice: 70_000 },
      { id: 'sandero_16_rs',    trim: '1.6 RS',    year: 2021, fipePrice: 78_000 },
    ],
  },
  {
    id: 'duster',
    brand: 'Renault',
    model: 'Duster',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'duster_16_zen',    trim: '1.6 Zen 4x2',     year: 2022, fipePrice: 88_000 },
      { id: 'duster_16_iconic', trim: '1.6 Iconic',       year: 2023, fipePrice: 95_000 },
      { id: 'duster_20_iconic', trim: '2.0 Iconic 4x4',   year: 2022, fipePrice: 110_000 },
    ],
  },

  // ── JEEP ────────────────────────────────────────────────────────
  {
    id: 'renegade',
    brand: 'Jeep',
    model: 'Renegade',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'renegade_13_sport',      trim: '1.3 Sport',      year: 2023, fipePrice: 120_000 },
      { id: 'renegade_13_longitude',  trim: '1.3 Longitude',  year: 2023, fipePrice: 138_000 },
      { id: 'renegade_13_trailhawk',  trim: '1.3 Trailhawk',  year: 2023, fipePrice: 162_000 },
    ],
  },
  {
    id: 'compass',
    brand: 'Jeep',
    model: 'Compass',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'compass_13_sport',      trim: '1.3 Sport',      year: 2023, fipePrice: 152_000 },
      { id: 'compass_13_longitude',  trim: '1.3 Longitude',  year: 2023, fipePrice: 168_000 },
      { id: 'compass_20_trailhawk',  trim: '2.0 Trailhawk',  year: 2023, fipePrice: 218_000 },
    ],
  },

  // ── PEUGEOT / CITROËN ───────────────────────────────────────────
  {
    id: 'peugeot208',
    brand: 'Peugeot',
    model: '208',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'p208_10_like',    trim: '1.0 Like',    year: 2023, fipePrice: 82_000 },
      { id: 'p208_12_allure',  trim: '1.2 Allure',  year: 2023, fipePrice: 98_000 },
      { id: 'p208_12_gt',      trim: '1.2 GT',      year: 2023, fipePrice: 108_000 },
    ],
  },
  {
    id: 'c3',
    brand: 'Citroën',
    model: 'C3',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'c3_10_feel',    trim: '1.0 Feel',    year: 2023, fipePrice: 75_000 },
      { id: 'c3_10_shine',   trim: '1.0 Shine',   year: 2023, fipePrice: 85_000 },
    ],
  },

  // ── MITSUBISHI ──────────────────────────────────────────────────
  {
    id: 'l200',
    brand: 'Mitsubishi',
    model: 'L200 Triton',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'l200_24_gl',      trim: '2.4 GL',      year: 2023, fipePrice: 198_000 },
      { id: 'l200_24_sport',   trim: '2.4 Sport',   year: 2023, fipePrice: 248_000 },
      { id: 'l200_24_outdoor', trim: '2.4 Outdoor', year: 2023, fipePrice: 272_000 },
    ],
  },
  {
    id: 'eclipse_cross',
    brand: 'Mitsubishi',
    model: 'Eclipse Cross',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'eclipse_15_hpe',    trim: '1.5 HPE',    year: 2023, fipePrice: 178_000 },
      { id: 'eclipse_15_hpe_s',  trim: '1.5 HPE-S',  year: 2023, fipePrice: 195_000 },
    ],
  },

  // ── CAOA CHERY / BYD ────────────────────────────────────────────
  {
    id: 'tiggo8',
    brand: 'Caoa Chery',
    model: 'Tiggo 8 Pro',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'tiggo8_15_vvt',   trim: '1.5 VVT',   year: 2023, fipePrice: 198_000 },
      { id: 'tiggo8_20_vvt',   trim: '2.0 VVT',   year: 2023, fipePrice: 218_000 },
    ],
  },
  {
    id: 'byd_dolphin',
    brand: 'BYD',
    model: 'Dolphin',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'dolphin_plus',   trim: 'Plus',   year: 2024, fipePrice: 165_000 },
      { id: 'dolphin_grande', trim: 'Grande', year: 2024, fipePrice: 178_000 },
    ],
  },
  {
    id: 'byd_king',
    brand: 'BYD',
    model: 'King',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'king_plus', trim: 'Plus', year: 2024, fipePrice: 238_000 },
    ],
  },

  // ── ESPORTIVOS ──────────────────────────────────────────────────
  {
    id: 'mustang',
    brand: 'Ford',
    model: 'Mustang',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'mustang_23_gt',         trim: '5.0 V8 GT',         year: 2023, fipePrice: 598_000 },
      { id: 'mustang_23_ecoboost',   trim: '2.3 EcoBoost',      year: 2023, fipePrice: 378_000 },
    ],
  },
  {
    id: 'gr86',
    brand: 'Toyota',
    model: 'GR86',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'gr86_24_mt', trim: '2.4 MT', year: 2023, fipePrice: 295_000 },
    ],
  },
  {
    id: 'civic_type_r',
    brand: 'Honda',
    model: 'Civic Type R',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'type_r_20', trim: '2.0 Turbo Type R', year: 2023, fipePrice: 425_000 },
    ],
  },
];

// ── HELPERS ──────────────────────────────────────────────────────

/** Busca modelo por id */
export function findCarModel(modelId: string): CarModel | undefined {
  return CAR_MODELS.find(m => m.id === modelId);
}

/** Busca variante por id dentro de um modelo */
export function findVariant(model: CarModel, variantId: string): CarVariant | undefined {
  return model.variants.find(v => v.id === variantId);
}

/** Preço FIPE de uma variante específica */
export function getFipePrice(modelId: string, variantId: string): number {
  const model = findCarModel(modelId);
  if (!model) return 0;
  const variant = findVariant(model, variantId);
  return variant?.fipePrice ?? 0;
}

/** Nome completo legível do carro */
export function carFullName(modelId: string, variantId: string): string {
  const model = findCarModel(modelId);
  if (!model) return '—';
  const variant = findVariant(model, variantId);
  return `${model.brand} ${model.model} ${variant?.trim ?? ''}`.trim();
}

/** Ano de uma variante */
export function carYear(modelId: string, variantId: string): number {
  const model = findCarModel(modelId);
  if (!model) return 0;
  return findVariant(model, variantId)?.year ?? 0;
}

// ── Constantes de geração do mercado ────────────────────────────
/** Mínimo de veículos gerados por ciclo de 30 min. */
const MARKET_MIN_BATCH = 40;
/** Máximo de veículos gerados por ciclo de 30 min. */
const MARKET_MAX_BATCH = 60;
/** Proporção mínima de veículos populares no mercado. */
const POPULAR_MIN_RATIO = 0.30;
/** Quantas vezes o mesmo modelo pode aparecer no mesmo ciclo. */
const MAX_SAME_MODEL = 2;

/**
 * Gera um único veículo aleatório a partir de um modelo.
 * Condições ponderadas: 30% bom-ótimo · 40% regular · 25% ruim · 5% sucata.
 */
function buildOneCar(model: CarModel): MarketplaceCar {
  const variant = model.variants[Math.floor(Math.random() * model.variants.length)];
  const roll = Math.random();
  const condition = roll > 0.70
    ? Math.floor(70 + Math.random() * 25)  // 70-95  (bom-ótimo)  30%
    : roll > 0.30
    ? Math.floor(40 + Math.random() * 30)  // 40-70  (regular)    40%
    : roll > 0.05
    ? Math.floor(15 + Math.random() * 25)  // 15-40  (ruim)       25%
    : Math.floor(1  + Math.random() * 15); //  1-15  (sucata)      5%

  return {
    id:           `mp_${variant.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    modelId:      model.id,
    variantId:    variant.id,
    brand:        model.brand,
    model:        model.model,
    trim:         variant.trim,
    year:         variant.year,
    fipePrice:    variant.fipePrice,
    condition,
    askingPrice:  calcMarketAskingPrice(variant.fipePrice, condition),
    icon:         model.icon,
    category:     model.category,
    seller:       MARKETPLACE_SELLERS[Math.floor(Math.random() * MARKETPLACE_SELLERS.length)],
    pendingOffer: null,
  };
}

/**
 * Seleciona `count` modelos de `pool` com limite de repetição por modelo
 * (`MAX_SAME_MODEL`). Garante variedade mesmo em pools pequenos.
 */
function pickModels(pool: CarModel[], count: number): CarModel[] {
  if (pool.length === 0) return [];
  const picked: CarModel[] = [];
  const usage = new Map<string, number>();

  for (let attempts = 0; attempts < count * 12 && picked.length < count; attempts++) {
    const m = pool[Math.floor(Math.random() * pool.length)];
    if ((usage.get(m.id) ?? 0) < MAX_SAME_MODEL) {
      picked.push(m);
      usage.set(m.id, (usage.get(m.id) ?? 0) + 1);
    }
  }
  // Fallback sem restrição caso o pool seja muito pequeno
  while (picked.length < count) {
    picked.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picked;
}

/**
 * Gera o inventário do mercado global para um ciclo de 30 min.
 *
 * Distribuição por ciclo:
 *   • Total: 40–60 veículos (aleatório)
 *   • ≥ 30 % populares
 *   • 1 garantido de cada outra categoria (medio / suv / pickup / esportivo / eletrico)
 *   • Restante: preenchimento aleatório de qualquer categoria
 *   • Máximo de 2 aparições do mesmo modelo por ciclo
 */
export function buildMarketplaceInventory(): MarketplaceCar[] {
  // Agrupa modelos por categoria
  const byCategory = new Map<CarCategory, CarModel[]>();
  for (const m of CAR_MODELS) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m);
    byCategory.set(m.category, list);
  }

  const nonPopularCategories = (
    ['medio', 'suv', 'pickup', 'esportivo', 'eletrico'] as CarCategory[]
  ).filter(c => byCategory.has(c));

  // Total do ciclo: 40–60
  const total = MARKET_MIN_BATCH
    + Math.floor(Math.random() * (MARKET_MAX_BATCH - MARKET_MIN_BATCH + 1));

  // Quota de populares (mínimo 30 %)
  const popularCount = Math.max(Math.ceil(total * POPULAR_MIN_RATIO), 1);

  // 1 garantido por categoria não-popular
  const guaranteedOtherCount = nonPopularCategories.length;

  // Preenchimento dinâmico do restante
  const fillCount = Math.max(0, total - popularCount - guaranteedOtherCount);

  const selected: CarModel[] = [];

  // 1. Populares
  const popularPool = byCategory.get('popular') ?? [];
  selected.push(...pickModels(popularPool, popularCount));

  // 2. 1 garantido por categoria
  for (const cat of nonPopularCategories) {
    const pool = byCategory.get(cat) ?? [];
    if (pool.length > 0) {
      selected.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // 3. Preenchimento aleatório (qualquer categoria)
  if (fillCount > 0) {
    selected.push(...pickModels(CAR_MODELS, fillCount));
  }

  // Embaralha para não agrupar por categoria na UI
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected.map(buildOneCar);
}

/** Vendedores fictícios para o marketplace */
export const MARKETPLACE_SELLERS = [
  'Autopark Goiânia',
  'Revenda Norte',
  'Carlos Veículos',
  'Mega Auto Center',
  'Feira do Carro',
  'João Paulo Automóveis',
  'Estrela Motors',
  'Central Multimarcas',
  'Revenda Boa Vista',
  'Top Veículos',
  'JR Automóveis',
  'AutoShow Brasília',
];

export interface MarketplaceCar {
  id: string;
  modelId: string;
  variantId: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  fipePrice: number;
  condition: number;
  askingPrice: number;
  icon: string;
  category: CarCategory;
  seller: string;
  pendingOffer: number | null; // valor da oferta enviada (null = sem oferta)
}
