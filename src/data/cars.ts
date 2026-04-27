// =====================================================================
// BANCO DE CARROS BRASILEIROS — 50 modelos com variações e preço FIPE
// =====================================================================

export type CarCategory = 'popular' | 'medio' | 'suv' | 'pickup' | 'esportivo' | 'eletrico' | 'classico' | 'luxo' | 'jdm' | 'supercar';
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

/**
 * Fator aplicado ao preço FIPE para calcular o valor de mercado de um carro.
 *
 *   condition ≥ 85  →  1.10  (110 % da FIPE — excelente estado)
 *   condition 60–84 →  0.97  ( 97 % da FIPE — bom / regular)
 *   condition < 60  →  0.65–0.83 da FIPE  (quanto pior, mais próximo de 0.65)
 *
 * Esta é a ÚNICA fórmula de valor de mercado do sistema.
 * Usada em: marketplace, compradores, negociações e exibição de preço.
 */
export function conditionValueFactor(condition: number): number {
  if (condition >= 85) return 1.10;
  if (condition >= 60) return 0.97;
  // Abaixo de 60: gravidade proporcional — condition 59 → 0.83, condition 0 → 0.65
  const ratio = condition / 59; // mapeia [0, 59] → [0, 1]
  return 0.65 + ratio * 0.18;
}

/** Piso mínimo de listagem na aba de compra — 88 % da FIPE. */
export const MIN_SALE_PRICE_RATIO = 0.88;

/**
 * Preço de listagem no marketplace de compra.
 *
 * A condição define uma janela deslizante de ≈ 8 % dentro do intervalo:
 *   condition   0 → faixa [0.82, 0.90]  (−18 % a −10 % da FIPE)
 *   condition  50 → faixa [0.90, 0.98]  (−10 % a  −2 % da FIPE)
 *   condition 100 → faixa [0.98, 1.06]  ( −2 % a  +6 % da FIPE)
 *
 * Piso absoluto: MIN_SALE_PRICE_RATIO (88 % da FIPE).
 */
export function calcMarketAskingPrice(fipePrice: number, condition: number): number {
  const low  = 0.82 + (condition / 100) * 0.16; // 0.82 → 0.98
  const high = 0.90 + (condition / 100) * 0.16; // 0.90 → 1.06
  const ratio = low + Math.random() * (high - low);
  return Math.max(
    Math.round(fipePrice * ratio),
    Math.round(fipePrice * MIN_SALE_PRICE_RATIO),
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
    id: 'golf',
    brand: 'Volkswagen',
    model: 'Golf',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'golf_14_tsi_comfortline', trim: '1.4 TSI Comfortline', year: 2022, fipePrice: 122_000 },
      { id: 'golf_14_tsi_highline',    trim: '1.4 TSI Highline',    year: 2022, fipePrice: 142_000 },
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
  {
    id: 'virtus',
    brand: 'Volkswagen',
    model: 'Virtus',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'virtus_10_tsi_comfortline', trim: '1.0 TSI Comfortline', year: 2023, fipePrice: 98_000 },
      { id: 'virtus_10_tsi_highline',    trim: '1.0 TSI Highline',    year: 2023, fipePrice: 112_000 },
      { id: 'virtus_16_msi_comfortline', trim: '1.6 MSI Comfortline', year: 2022, fipePrice: 88_000 },
    ],
  },
  {
    id: 'nivus',
    brand: 'Volkswagen',
    model: 'Nivus',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'nivus_10_tsi_comfortline', trim: '1.0 TSI Comfortline', year: 2023, fipePrice: 120_000 },
      { id: 'nivus_10_tsi_highline',    trim: '1.0 TSI Highline',    year: 2023, fipePrice: 135_000 },
    ],
  },
  {
    id: 'taos',
    brand: 'Volkswagen',
    model: 'Taos',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'taos_14_tsi_comfortline', trim: '1.4 TSI Comfortline', year: 2023, fipePrice: 155_000 },
      { id: 'taos_14_tsi_highline',    trim: '1.4 TSI Highline',    year: 2023, fipePrice: 172_000 },
    ],
  },
  {
    id: 'tiguan',
    brand: 'Volkswagen',
    model: 'Tiguan',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'tiguan_14_comfortline',  trim: '1.4 TSI Comfortline',    year: 2023, fipePrice: 198_000 },
      { id: 'tiguan_14_highline',     trim: '1.4 TSI Highline',        year: 2023, fipePrice: 225_000 },
      { id: 'tiguan_20_allspace',     trim: '2.0 TSI Allspace R-Line', year: 2023, fipePrice: 268_000 },
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
    id: 'doblo',
    brand: 'Fiat',
    model: 'Doblò',
    icon: '🚐',
    category: 'medio',
    variants: [
      { id: 'doblo_18_attractive', trim: '1.8 Attractive',    year: 2022, fipePrice: 102_000 },
      { id: 'doblo_18_essence',    trim: '1.8 Essence',       year: 2022, fipePrice: 115_000 },
      { id: 'doblo_18_adventure',  trim: '1.8 Adventure',     year: 2023, fipePrice: 125_000 },
    ],
  },
  {
    id: 'grand_siena',
    brand: 'Fiat',
    model: 'Grand Siena',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'grand_siena_14_attractive', trim: '1.4 Attractive', year: 2020, fipePrice: 62_000 },
      { id: 'grand_siena_16_essence',    trim: '1.6 Essence',    year: 2021, fipePrice: 72_000 },
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
  {
    id: 'cruze',
    brand: 'Chevrolet',
    model: 'Cruze',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'cruze_14_lt',      trim: '1.4 Turbo LT',      year: 2022, fipePrice: 142_000 },
      { id: 'cruze_14_ltz',     trim: '1.4 Turbo LTZ',     year: 2022, fipePrice: 162_000 },
      { id: 'cruze_14_premier', trim: '1.4 Turbo Premier', year: 2023, fipePrice: 182_000 },
    ],
  },
  {
    id: 'equinox',
    brand: 'Chevrolet',
    model: 'Equinox',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'equinox_15_lt',      trim: '1.5 Turbo LT',      year: 2023, fipePrice: 195_000 },
      { id: 'equinox_15_premier', trim: '1.5 Turbo Premier', year: 2023, fipePrice: 218_000 },
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
      { id: 'ranger_22_xls_4x2',  trim: '2.2 XLS 4x2',    year: 2022, fipePrice: 198_000 },
      { id: 'ranger_32_xlt_4x4',  trim: '3.2 XLT 4x4',    year: 2022, fipePrice: 265_000 },
      { id: 'ranger_32_ltd_4x4',  trim: '3.2 Limited 4x4', year: 2023, fipePrice: 305_000 },
    ],
  },
  {
    id: 'fiesta',
    brand: 'Ford',
    model: 'Fiesta',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'fiesta_15_se',       trim: '1.5 SE',        year: 2018, fipePrice: 52_000 },
      { id: 'fiesta_16_sel',      trim: '1.6 SEL',       year: 2020, fipePrice: 62_000 },
      { id: 'fiesta_15_titanium', trim: '1.5 Titanium',  year: 2020, fipePrice: 70_000 },
    ],
  },
  {
    id: 'focus',
    brand: 'Ford',
    model: 'Focus',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'focus_20_se',       trim: '2.0 SE',         year: 2019, fipePrice: 78_000 },
      { id: 'focus_20_se_plus',  trim: '2.0 SE Plus',    year: 2019, fipePrice: 88_000 },
      { id: 'focus_20_titanium', trim: '2.0 Titanium',   year: 2019, fipePrice: 98_000 },
    ],
  },
  {
    id: 'territory',
    brand: 'Ford',
    model: 'Territory',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'territory_15_se',       trim: '1.5 EcoBoost SE',       year: 2022, fipePrice: 148_000 },
      { id: 'territory_15_titanium', trim: '1.5 EcoBoost Titanium', year: 2023, fipePrice: 165_000 },
    ],
  },
  {
    id: 'maverick_ford',
    brand: 'Ford',
    model: 'Maverick',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'maverick_20_xlt',   trim: '2.0 EcoBoost XLT',   year: 2022, fipePrice: 195_000 },
      { id: 'maverick_20_lariat',trim: '2.0 EcoBoost Lariat', year: 2023, fipePrice: 218_000 },
    ],
  },
  {
    id: 'bronco_sport',
    brand: 'Ford',
    model: 'Bronco Sport',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'bronco_20_bigbend',  trim: '2.0 EcoBoost Big Bend',  year: 2023, fipePrice: 238_000 },
      { id: 'bronco_20_badlands', trim: '2.0 EcoBoost Badlands',  year: 2023, fipePrice: 268_000 },
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
  {
    id: 'corolla_cross',
    brand: 'Toyota',
    model: 'Corolla Cross',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'ccross_20_xre',        trim: '2.0 XRE',           year: 2023, fipePrice: 168_000 },
      { id: 'ccross_20_xrx',        trim: '2.0 XRX',           year: 2023, fipePrice: 185_000 },
      { id: 'ccross_18_hybrid_xrx', trim: '1.8 Hybrid XRX',    year: 2023, fipePrice: 208_000 },
    ],
  },
  {
    id: 'rav4',
    brand: 'Toyota',
    model: 'RAV4',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'rav4_20_dynamic',  trim: '2.0 Dynamic AWD',  year: 2023, fipePrice: 195_000 },
      { id: 'rav4_25_hybrid',   trim: '2.5 Hybrid AWD',   year: 2023, fipePrice: 248_000 },
    ],
  },
  {
    id: 'camry',
    brand: 'Toyota',
    model: 'Camry',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'camry_25_hybrid_xse', trim: '2.5 Hybrid XSE', year: 2023, fipePrice: 212_000 },
      { id: 'camry_25_hybrid_le',  trim: '2.5 Hybrid LE',  year: 2022, fipePrice: 195_000 },
    ],
  },
  {
    id: 'land_cruiser_prado',
    brand: 'Toyota',
    model: 'Land Cruiser Prado',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'prado_40_txl', trim: '4.0 TXL',  year: 2022, fipePrice: 448_000 },
      { id: 'prado_40_vx',  trim: '4.0 VX',   year: 2023, fipePrice: 498_000 },
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
  {
    id: 'city',
    brand: 'Honda',
    model: 'City',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'city_15_lx',    trim: '1.5 LX',    year: 2023, fipePrice: 88_000 },
      { id: 'city_15_sport', trim: '1.5 Sport',  year: 2023, fipePrice: 98_000 },
      { id: 'city_15_exl',   trim: '1.5 EXL',   year: 2023, fipePrice: 112_000 },
    ],
  },
  {
    id: 'wrv',
    brand: 'Honda',
    model: 'WR-V',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'wrv_15_ex',  trim: '1.5 EX',  year: 2023, fipePrice: 95_000 },
      { id: 'wrv_15_exl', trim: '1.5 EXL', year: 2023, fipePrice: 108_000 },
    ],
  },
  {
    id: 'accord',
    brand: 'Honda',
    model: 'Accord',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'accord_20_touring',  trim: '2.0 Touring',   year: 2023, fipePrice: 245_000 },
      { id: 'accord_20_sport',    trim: '2.0 Sport',     year: 2022, fipePrice: 218_000 },
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
      { id: 'hb20_10_sense',    trim: '1.0 Sense',    year: 2023, fipePrice: 70_000 },
      { id: 'hb20_10_vision',   trim: '1.0 Vision',   year: 2023, fipePrice: 78_000 },
      { id: 'hb20_10_platinum', trim: '1.0 Platinum', year: 2023, fipePrice: 86_000 },
    ],
  },
  {
    id: 'hb20s',
    brand: 'Hyundai',
    model: 'HB20S',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'hb20s_10_sense',    trim: '1.0 Sense',    year: 2023, fipePrice: 74_000 },
      { id: 'hb20s_10_vision',   trim: '1.0 Vision',   year: 2023, fipePrice: 82_000 },
      { id: 'hb20s_10_platinum', trim: '1.0 Platinum', year: 2023, fipePrice: 90_000 },
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
      { id: 'tucson_16_gls',     trim: '1.6 GLS',      year: 2022, fipePrice: 178_000 },
      { id: 'tucson_16_gls_nb',  trim: '1.6 GLS NBio', year: 2022, fipePrice: 168_000 },
    ],
  },
  {
    id: 'i30',
    brand: 'Hyundai',
    model: 'i30',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'i30_18_gls',  trim: '1.8 GLS',   year: 2019, fipePrice: 85_000 },
      { id: 'i30_20_gls',  trim: '2.0 GLS',   year: 2021, fipePrice: 105_000 },
    ],
  },
  {
    id: 'santa_fe',
    brand: 'Hyundai',
    model: 'Santa Fe',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'santafe_35_gls',   trim: '3.5 GLS AWD',        year: 2022, fipePrice: 278_000 },
      { id: 'santafe_20_turbo', trim: '2.0 GLS Turbo AWD',  year: 2023, fipePrice: 295_000 },
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
  {
    id: 'sentra',
    brand: 'Nissan',
    model: 'Sentra',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'sentra_20_sv',  trim: '2.0 SV CVT',  year: 2022, fipePrice: 105_000 },
      { id: 'sentra_20_sl',  trim: '2.0 SL CVT',  year: 2022, fipePrice: 118_000 },
    ],
  },
  {
    id: 'march',
    brand: 'Nissan',
    model: 'March',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'march_10_s',   trim: '1.0 S',   year: 2020, fipePrice: 46_000 },
      { id: 'march_16_sl',  trim: '1.6 SL',  year: 2020, fipePrice: 62_000 },
      { id: 'march_16_sv',  trim: '1.6 SV',  year: 2021, fipePrice: 55_000 },
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
      { id: 'duster_16_zen',    trim: '1.6 Zen 4x2',   year: 2022, fipePrice: 88_000 },
      { id: 'duster_16_iconic', trim: '1.6 Iconic',     year: 2023, fipePrice: 95_000 },
      { id: 'duster_20_iconic', trim: '2.0 Iconic 4x4', year: 2022, fipePrice: 110_000 },
    ],
  },
  {
    id: 'logan',
    brand: 'Renault',
    model: 'Logan',
    icon: '🚗',
    category: 'popular',
    variants: [
      { id: 'logan_16_life',  trim: '1.6 Life',  year: 2022, fipePrice: 72_000 },
      { id: 'logan_16_zen',   trim: '1.6 Zen',   year: 2022, fipePrice: 82_000 },
      { id: 'logan_16_iconic',trim: '1.6 Iconic', year: 2022, fipePrice: 92_000 },
    ],
  },
  {
    id: 'captur',
    brand: 'Renault',
    model: 'Captur',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'captur_13_zen',     trim: '1.3 Turbo Zen',     year: 2023, fipePrice: 108_000 },
      { id: 'captur_13_intense', trim: '1.3 Turbo Intense', year: 2023, fipePrice: 122_000 },
    ],
  },
  {
    id: 'kardian',
    brand: 'Renault',
    model: 'Kardian',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'kardian_10_life', trim: '1.0 Turbo Life', year: 2023, fipePrice: 82_000 },
      { id: 'kardian_10_zen',  trim: '1.0 Turbo Zen',  year: 2023, fipePrice: 95_000 },
    ],
  },
  {
    id: 'oroch',
    brand: 'Renault',
    model: 'Oroch',
    icon: '🛻',
    category: 'pickup',
    variants: [
      { id: 'oroch_16_outsider',  trim: '1.6 Outsider',  year: 2023, fipePrice: 82_000 },
      { id: 'oroch_20_dynamique', trim: '2.0 Dynamique', year: 2023, fipePrice: 98_000 },
    ],
  },

  // ── KIA ─────────────────────────────────────────────────────────
  {
    id: 'sportage',
    brand: 'Kia',
    model: 'Sportage',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'sportage_20_lx',    trim: '2.0 LX',     year: 2022, fipePrice: 145_000 },
      { id: 'sportage_20_ex',    trim: '2.0 EX',     year: 2022, fipePrice: 162_000 },
      { id: 'sportage_16_ex_nb', trim: '1.6 T-GDi EX NBio', year: 2023, fipePrice: 182_000 },
    ],
  },
  {
    id: 'cerato',
    brand: 'Kia',
    model: 'Cerato',
    icon: '🚗',
    category: 'medio',
    variants: [
      { id: 'cerato_16_sx',  trim: '1.6 SX',  year: 2021, fipePrice: 95_000 },
      { id: 'cerato_20_ex',  trim: '2.0 EX',  year: 2022, fipePrice: 108_000 },
    ],
  },
  {
    id: 'stonic',
    brand: 'Kia',
    model: 'Stonic',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'stonic_10_ex',  trim: '1.0 T-GDi EX',  year: 2023, fipePrice: 105_000 },
      { id: 'stonic_10_sx',  trim: '1.0 T-GDi SX',  year: 2023, fipePrice: 115_000 },
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
    id: 'peugeot2008',
    brand: 'Peugeot',
    model: '2008',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'p2008_12_allure',  trim: '1.2 Turbo Allure', year: 2023, fipePrice: 112_000 },
      { id: 'p2008_12_gt',      trim: '1.2 Turbo GT',     year: 2023, fipePrice: 128_000 },
    ],
  },
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
      { id: 'c3_10_feel',  trim: '1.0 Feel',  year: 2023, fipePrice: 75_000 },
      { id: 'c3_10_shine', trim: '1.0 Shine', year: 2023, fipePrice: 85_000 },
    ],
  },
  {
    id: 'c4_cactus',
    brand: 'Citroën',
    model: 'C4 Cactus',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'c4_16_feel',  trim: '1.6 Feel',  year: 2022, fipePrice: 88_000 },
      { id: 'c4_16_shine', trim: '1.6 Shine', year: 2023, fipePrice: 98_000 },
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


  // ── CLÁSSICOS BRASILEIROS (1992–2002) ───────────────────────────────
  {
    id: 'chevette',
    brand: 'Chevrolet',
    model: 'Chevette',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'chevette_10_sl',   trim: '1.0 SL',      year: 1993, fipePrice: 22_000 },
      { id: 'chevette_16_sle',  trim: '1.6 SL/E',    year: 1993, fipePrice: 29_000 },
      { id: 'chevette_16_sl',   trim: '1.6 SL Hatch', year: 1992, fipePrice: 26_000 },
    ],
  },
  {
    id: 'monza',
    brand: 'Chevrolet',
    model: 'Monza',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'monza_20_classic', trim: '2.0 Classic',  year: 1995, fipePrice: 33_000 },
      { id: 'monza_20_sle',     trim: '2.0 SL/E',     year: 1996, fipePrice: 41_000 },
      { id: 'monza_18_sedan',   trim: '1.8 Sedan',    year: 1994, fipePrice: 28_000 },
    ],
  },
  {
    id: 'kadett',
    brand: 'Chevrolet',
    model: 'Kadett',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'kadett_18_gl',   trim: '1.8 GL',   year: 1997, fipePrice: 25_000 },
      { id: 'kadett_18_gls',  trim: '1.8 GLS',  year: 1997, fipePrice: 31_000 },
      { id: 'kadett_20_gsi',  trim: '2.0 GSi',  year: 1998, fipePrice: 38_000 },
    ],
  },
  {
    id: 'gol_g1',
    brand: 'Volkswagen',
    model: 'Gol G1',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'golg1_10_cl',  trim: '1.0 CL',   year: 1994, fipePrice: 16_000 },
      { id: 'golg1_16_cl',  trim: '1.6 CL',   year: 1994, fipePrice: 22_000 },
      { id: 'golg1_16_gli', trim: '1.6 GLi',  year: 1993, fipePrice: 28_000 },
    ],
  },
  {
    id: 'gol_g2',
    brand: 'Volkswagen',
    model: 'Gol G2',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'golg2_10_mi',  trim: '1.0 Mi 8V', year: 1997, fipePrice: 20_000 },
      { id: 'golg2_16_mi',  trim: '1.6 Mi',    year: 1999, fipePrice: 26_000 },
      { id: 'golg2_20_gti', trim: '2.0 GTi',   year: 1998, fipePrice: 42_000 },
    ],
  },
  {
    id: 'santana',
    brand: 'Volkswagen',
    model: 'Santana',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'santana_18_gl',  trim: '1.8 GL',  year: 1995, fipePrice: 22_000 },
      { id: 'santana_20_gls', trim: '2.0 GLS', year: 1996, fipePrice: 30_000 },
    ],
  },
  {
    id: 'palio',
    brand: 'Fiat',
    model: 'Palio',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'palio_10_mpi', trim: '1.0 MPI',      year: 1997, fipePrice: 17_000 },
      { id: 'palio_16_elx', trim: '1.6 ELX MPI',  year: 2001, fipePrice: 24_000 },
      { id: 'palio_16_16v', trim: '1.6 16V',       year: 2000, fipePrice: 27_000 },
    ],
  },
  {
    id: 'uno_mille',
    brand: 'Fiat',
    model: 'Uno Mille',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'uno_mille_10_ep',   trim: '1.0 EP',   year: 1998, fipePrice: 14_000 },
      { id: 'uno_mille_10_sx',   trim: '1.0 SX',   year: 2000, fipePrice: 16_000 },
      { id: 'uno_mille_10_fire', trim: '1.0 Fire', year: 2002, fipePrice: 18_000 },
    ],
  },
  {
    id: 'tempra',
    brand: 'Fiat',
    model: 'Tempra',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'tempra_16_ie',    trim: '1.6 IE',       year: 1995, fipePrice: 24_000 },
      { id: 'tempra_20_turbo', trim: '2.0 IE Turbo', year: 1996, fipePrice: 38_000 },
    ],
  },
  {
    id: 'tipo',
    brand: 'Fiat',
    model: 'Tipo',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'tipo_16_mpi',  trim: '1.6 MPI',   year: 1995, fipePrice: 22_000 },
      { id: 'tipo_20_16v',  trim: '2.0 16V',   year: 1996, fipePrice: 32_000 },
    ],
  },
  {
    id: 'escort',
    brand: 'Ford',
    model: 'Escort',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'escort_16_gl',   trim: '1.6 GL',    year: 1997, fipePrice: 20_000 },
      { id: 'escort_18_xr3',  trim: '1.8 XR3',   year: 1996, fipePrice: 30_000 },
      { id: 'escort_20_gti',  trim: '2.0 GTi',   year: 1996, fipePrice: 44_000 },
    ],
  },
  {
    id: 'passat_classic',
    brand: 'Volkswagen',
    model: 'Passat',
    icon: '🚗',
    category: 'classico',
    variants: [
      { id: 'passat_20_gls',    trim: '2.0 GLS',    year: 1996, fipePrice: 34_000 },
      { id: 'passat_20_syncro', trim: '2.0 Syncro',  year: 1997, fipePrice: 48_000 },
    ],
  },

  // ── LUXO ──────────────────────────────────────────────────────────────
  {
    id: 'bmw_320i',
    brand: 'BMW',
    model: '320i',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'bmw320i_20_gp',     trim: '2.0 Turbo GP',      year: 2023, fipePrice: 248_000 },
      { id: 'bmw320i_20_msport', trim: '2.0 Turbo M Sport', year: 2023, fipePrice: 298_000 },
      { id: 'bmw320i_20_gp22',   trim: '2.0 Turbo GP',      year: 2022, fipePrice: 228_000 },
    ],
  },
  {
    id: 'bmw_530i',
    brand: 'BMW',
    model: '530i',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'bmw530i_20_msport',  trim: '2.0 Turbo M Sport', year: 2023, fipePrice: 435_000 },
      { id: 'bmw530i_20_touring', trim: '2.0 Touring',       year: 2022, fipePrice: 398_000 },
    ],
  },
  {
    id: 'bmw_x1',
    brand: 'BMW',
    model: 'X1',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'bmwx1_20_sdrive',  trim: 'sDrive20i 2.0',      year: 2023, fipePrice: 298_000 },
      { id: 'bmwx1_20_xdrive',  trim: 'xDrive25e Plug-in',  year: 2023, fipePrice: 348_000 },
    ],
  },
  {
    id: 'bmw_x3',
    brand: 'BMW',
    model: 'X3',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'bmwx3_20_xdrive',  trim: 'xDrive30i 2.0',      year: 2023, fipePrice: 395_000 },
      { id: 'bmwx3_20_msport',  trim: 'xDrive30i M Sport',  year: 2023, fipePrice: 435_000 },
    ],
  },
  {
    id: 'mercedes_c200',
    brand: 'Mercedes-Benz',
    model: 'C 200',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'mc200_15_avantgarde', trim: '1.5 EQ Boost Avantgarde', year: 2023, fipePrice: 298_000 },
      { id: 'mc200_15_amgline',    trim: '1.5 EQ Boost AMG Line',   year: 2023, fipePrice: 335_000 },
      { id: 'mc200_15_2022',       trim: '1.5 EQ Boost',            year: 2022, fipePrice: 275_000 },
    ],
  },
  {
    id: 'mercedes_c300',
    brand: 'Mercedes-Benz',
    model: 'C 300',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'mc300_20_4matic',  trim: '2.0 Turbo 4Matic',      year: 2023, fipePrice: 388_000 },
      { id: 'mc300_20_amgline', trim: '2.0 AMG Line 4Matic',   year: 2023, fipePrice: 425_000 },
    ],
  },
  {
    id: 'mercedes_gla',
    brand: 'Mercedes-Benz',
    model: 'GLA 200',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'mgla_13_avantgarde', trim: '1.3 Turbo Avantgarde', year: 2023, fipePrice: 305_000 },
      { id: 'mgla_13_amgline',    trim: '1.3 Turbo AMG Line',   year: 2023, fipePrice: 340_000 },
    ],
  },
  {
    id: 'mercedes_glc',
    brand: 'Mercedes-Benz',
    model: 'GLC 300',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'mglc_20_4matic', trim: '2.0 Turbo 4Matic',  year: 2023, fipePrice: 448_000 },
      { id: 'mglc_20_coupe',  trim: '2.0 Coupe 4Matic',  year: 2023, fipePrice: 498_000 },
    ],
  },
  {
    id: 'audi_a3',
    brand: 'Audi',
    model: 'A3 Sedan',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'a3_14_tfsi',      trim: '1.4 TFSI',        year: 2023, fipePrice: 215_000 },
      { id: 'a3_20_tfsi_sline',trim: '2.0 TFSI S Line', year: 2023, fipePrice: 248_000 },
      { id: 'a3_14_tfsi_22',   trim: '1.4 TFSI',        year: 2022, fipePrice: 195_000 },
    ],
  },
  {
    id: 'audi_q3',
    brand: 'Audi',
    model: 'Q3',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'q3_14_tfsi',       trim: '1.4 TFSI',         year: 2023, fipePrice: 292_000 },
      { id: 'q3_14_tfsi_sline', trim: '1.4 TFSI S Line',  year: 2023, fipePrice: 325_000 },
    ],
  },
  {
    id: 'audi_q5',
    brand: 'Audi',
    model: 'Q5',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'q5_20_tfsi',       trim: '2.0 TFSI',         year: 2023, fipePrice: 428_000 },
      { id: 'q5_20_tfsi_sline', trim: '2.0 TFSI S Line',  year: 2023, fipePrice: 468_000 },
    ],
  },
  {
    id: 'lr_evoque',
    brand: 'Land Rover',
    model: 'Range Rover Evoque',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'evoque_20_p200',  trim: 'P200 2.0 S',       year: 2023, fipePrice: 398_000 },
      { id: 'evoque_20_rdyn',  trim: 'P200 R-Dynamic',   year: 2023, fipePrice: 448_000 },
    ],
  },
  {
    id: 'lr_discovery_sport',
    brand: 'Land Rover',
    model: 'Discovery Sport',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'disc_sport_p200_s', trim: 'P200 S',          year: 2023, fipePrice: 378_000 },
      { id: 'disc_sport_p200_r', trim: 'P200 R-Dynamic',  year: 2023, fipePrice: 428_000 },
    ],
  },
  {
    id: 'lr_defender',
    brand: 'Land Rover',
    model: 'Defender 110',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'defender_p300_s',   trim: 'P300 S',  year: 2023, fipePrice: 695_000 },
      { id: 'defender_p400_x',   trim: 'P400 X',  year: 2023, fipePrice: 848_000 },
    ],
  },
  {
    id: 'volvo_xc40',
    brand: 'Volvo',
    model: 'XC40',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'xc40_b5_rdesign',  trim: 'B5 R-Design AWD',       year: 2023, fipePrice: 345_000 },
      { id: 'xc40_recharge',    trim: 'Recharge Pure Electric', year: 2024, fipePrice: 395_000 },
    ],
  },
  {
    id: 'volvo_xc60',
    brand: 'Volvo',
    model: 'XC60',
    icon: '🚙',
    category: 'luxo',
    variants: [
      { id: 'xc60_b5_ultim',  trim: 'B5 Ultimate AWD',    year: 2023, fipePrice: 448_000 },
      { id: 'xc60_recharge',  trim: 'Recharge Ultimate',  year: 2024, fipePrice: 498_000 },
    ],
  },
  {
    id: 'porsche_macan',
    brand: 'Porsche',
    model: 'Macan',
    icon: '🏎️',
    category: 'luxo',
    variants: [
      { id: 'macan_20_base', trim: '2.0 Turbo',      year: 2023, fipePrice: 545_000 },
      { id: 'macan_s_29',    trim: 'S 2.9 Biturbo',  year: 2023, fipePrice: 698_000 },
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
  {
    id: 'golf_gti',
    brand: 'Volkswagen',
    model: 'Golf GTI',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'gti_20_tsi',    trim: '2.0 TSI GTI',             year: 2021, fipePrice: 185_000 },
      { id: 'gti_20_perf',   trim: '2.0 TSI GTI Performance', year: 2022, fipePrice: 210_000 },
    ],
  },
  {
    id: 'wrx_sti',
    brand: 'Subaru',
    model: 'WRX STI',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'wrx_25_sti',   trim: '2.5 Turbo STI',         year: 2018, fipePrice: 195_000 },
      { id: 'wrx_25_sport', trim: '2.5 Turbo S-Sport AWD', year: 2020, fipePrice: 225_000 },
    ],
  },
  {
    id: 'i30n',
    brand: 'Hyundai',
    model: 'i30 N',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'i30n_20_performance', trim: '2.0 T-GDi N Performance', year: 2022, fipePrice: 205_000 },
    ],
  },

  // ── MUSCLE / AMERICAN SPORTS ─────────────────────────────────────
  {
    id: 'corvette_c8',
    brand: 'Chevrolet',
    model: 'Corvette C8',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'c8_stingray_3lt',  trim: 'Stingray 3LT',        year: 2023, fipePrice: 895_000 },
      { id: 'c8_z51_3lt',       trim: 'Stingray Z51 3LT',    year: 2023, fipePrice: 985_000 },
    ],
  },
  {
    id: 'corvette_c7_z06',
    brand: 'Chevrolet',
    model: 'Corvette C7 Z06',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'c7z06_62_lt4',     trim: '6.2 LT4 Supercharged', year: 2019, fipePrice: 648_000 },
      { id: 'c7z06_62_z07',     trim: '6.2 Z07 Package',      year: 2019, fipePrice: 698_000 },
    ],
  },
  {
    id: 'camaro_ss',
    brand: 'Chevrolet',
    model: 'Camaro SS',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'camaro_62_ss',     trim: '6.2 V8 SS',            year: 2023, fipePrice: 485_000 },
      { id: 'camaro_62_ss_1le', trim: '6.2 V8 SS 1LE',        year: 2023, fipePrice: 528_000 },
    ],
  },
  {
    id: 'camaro_zl1',
    brand: 'Chevrolet',
    model: 'Camaro ZL1',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'camaro_zl1_62',    trim: '6.2 LT4 ZL1',          year: 2023, fipePrice: 698_000 },
      { id: 'camaro_zl1_le',    trim: '6.2 LT4 ZL1 1LE',      year: 2023, fipePrice: 748_000 },
    ],
  },
  {
    id: 'challenger_hellcat',
    brand: 'Dodge',
    model: 'Challenger SRT Hellcat',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'hellcat_62_wd',    trim: '6.2 Widebody',          year: 2023, fipePrice: 895_000 },
      { id: 'hellcat_62_jailbreak', trim: '6.2 Jailbreak',     year: 2023, fipePrice: 985_000 },
    ],
  },
  {
    id: 'charger_srt',
    brand: 'Dodge',
    model: 'Charger SRT 392',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'charger_64_srt',   trim: '6.4 HEMI SRT 392',      year: 2023, fipePrice: 698_000 },
    ],
  },
  {
    id: 'shelby_gt500',
    brand: 'Ford',
    model: 'Shelby GT500',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'gt500_52_sc',      trim: '5.2 Supercharged',       year: 2023, fipePrice: 895_000 },
      { id: 'gt500_52_cftp',    trim: '5.2 Carbon Fiber Track', year: 2023, fipePrice: 985_000 },
    ],
  },

  // ── BMW M ────────────────────────────────────────────────────────
  {
    id: 'bmw_m2',
    brand: 'BMW',
    model: 'M2',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'bmwm2_30_g87',     trim: '3.0 S58 G87',           year: 2023, fipePrice: 498_000 },
      { id: 'bmwm2_30_g87_comp',trim: '3.0 S58 Competition',   year: 2024, fipePrice: 548_000 },
    ],
  },
  {
    id: 'bmw_m3',
    brand: 'BMW',
    model: 'M3 Competition',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'bmwm3_30_comp',    trim: '3.0 Competition',        year: 2023, fipePrice: 698_000 },
      { id: 'bmwm3_30_xdrive',  trim: '3.0 xDrive Competition', year: 2023, fipePrice: 758_000 },
    ],
  },
  {
    id: 'bmw_m4',
    brand: 'BMW',
    model: 'M4 Competition',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'bmwm4_30_comp',    trim: '3.0 Competition',        year: 2023, fipePrice: 758_000 },
      { id: 'bmwm4_30_csl',     trim: '3.0 CSL',                year: 2023, fipePrice: 1_195_000 },
    ],
  },

  // ── MERCEDES-AMG ─────────────────────────────────────────────────
  {
    id: 'mercedes_amg_a45',
    brand: 'Mercedes-AMG',
    model: 'A 45 S',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'a45s_20_4matic',   trim: '2.0 4MATIC+',            year: 2023, fipePrice: 398_000 },
    ],
  },
  {
    id: 'mercedes_amg_c63',
    brand: 'Mercedes-AMG',
    model: 'C 63 S E Performance',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'c63s_20_ephev',    trim: '2.0 Turbo E Performance', year: 2023, fipePrice: 748_000 },
    ],
  },
  {
    id: 'mercedes_amg_gt',
    brand: 'Mercedes-AMG',
    model: 'AMG GT',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'amggt_40_s',       trim: '4.0 S',                  year: 2022, fipePrice: 1_195_000 },
      { id: 'amggt_40_r',       trim: '4.0 R',                  year: 2022, fipePrice: 1_385_000 },
    ],
  },

  // ── AUDI S/RS ────────────────────────────────────────────────────
  {
    id: 'audi_rs3',
    brand: 'Audi',
    model: 'RS3 Sportback',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'rs3_25_tfsi',      trim: '2.5 TFSI',               year: 2023, fipePrice: 498_000 },
      { id: 'rs3_25_performance',trim: '2.5 TFSI Performance',  year: 2023, fipePrice: 548_000 },
    ],
  },
  {
    id: 'audi_rs6',
    brand: 'Audi',
    model: 'RS6 Avant',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'rs6_40_tfsi',      trim: '4.0 TFSI',               year: 2023, fipePrice: 895_000 },
      { id: 'rs6_40_performance',trim: '4.0 TFSI Performance',  year: 2023, fipePrice: 985_000 },
    ],
  },

  // ── ALFA ROMEO / RENAULT ─────────────────────────────────────────
  {
    id: 'alfa_giulia_qv',
    brand: 'Alfa Romeo',
    model: 'Giulia Quadrifoglio',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'giulia_qv_29',     trim: '2.9 V6 Biturbo',         year: 2023, fipePrice: 528_000 },
    ],
  },
  {
    id: 'renault_megane_rs',
    brand: 'Renault',
    model: 'Mégane RS Trophy-R',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'megane_rs_18_tr',  trim: '1.8 Turbo Trophy-R',     year: 2022, fipePrice: 298_000 },
    ],
  },

  // ── JDM ──────────────────────────────────────────────────────────
  {
    id: 'nissan_gtr_r35',
    brand: 'Nissan',
    model: 'GT-R R35',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'gtr_r35_premium',  trim: '3.8 Premium',            year: 2023, fipePrice: 895_000 },
      { id: 'gtr_r35_nismo',    trim: '3.8 NISMO',              year: 2022, fipePrice: 1_550_000 },
      { id: 'gtr_r35_2017',     trim: '3.8 Premium',            year: 2017, fipePrice: 748_000 },
    ],
  },
  {
    id: 'nissan_gtr_r34',
    brand: 'Nissan',
    model: 'Skyline GT-R R34',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'r34_vspec',        trim: 'V-Spec II Nür',           year: 2002, fipePrice: 1_250_000 },
      { id: 'r34_base',         trim: 'GT-R',                   year: 1999, fipePrice: 895_000 },
    ],
  },
  {
    id: 'nissan_gtr_r33',
    brand: 'Nissan',
    model: 'Skyline GT-R R33',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'r33_vspec',        trim: 'V-Spec',                 year: 1997, fipePrice: 545_000 },
      { id: 'r33_base',         trim: 'GT-R',                   year: 1996, fipePrice: 385_000 },
    ],
  },
  {
    id: 'nissan_gtr_r32',
    brand: 'Nissan',
    model: 'Skyline GT-R R32',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'r32_vspec',        trim: 'V-Spec II',              year: 1994, fipePrice: 448_000 },
      { id: 'r32_base',         trim: 'GT-R',                   year: 1992, fipePrice: 298_000 },
    ],
  },
  {
    id: 'toyota_supra_mk4',
    brand: 'Toyota',
    model: 'Supra MK4',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'supra_mk4_rz',     trim: 'RZ 3.0 Twin Turbo',     year: 1998, fipePrice: 985_000 },
      { id: 'supra_mk4_sz_r',   trim: 'SZ-R 3.0 Non-Turbo',   year: 1997, fipePrice: 748_000 },
    ],
  },
  {
    id: 'toyota_supra_mk5',
    brand: 'Toyota',
    model: 'Supra MK5 A90',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'supra_mk5_30',     trim: '3.0 Turbo',             year: 2023, fipePrice: 748_000 },
      { id: 'supra_mk5_gr',     trim: 'GR 3.0 Turbo',         year: 2023, fipePrice: 895_000 },
    ],
  },
  {
    id: 'mazda_rx7_fd',
    brand: 'Mazda',
    model: 'RX-7 FD',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'rx7_fd_type_r',    trim: 'Type R Bathurst',        year: 2002, fipePrice: 545_000 },
      { id: 'rx7_fd_spirit_r',  trim: 'Spirit R',               year: 2002, fipePrice: 698_000 },
      { id: 'rx7_fd_base',      trim: '13B-REW Turbo',          year: 1997, fipePrice: 295_000 },
    ],
  },
  {
    id: 'mazda_rx7_fc',
    brand: 'Mazda',
    model: 'RX-7 FC',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'rx7_fc_turbo',     trim: 'FC3S Turbo',             year: 1991, fipePrice: 148_000 },
      { id: 'rx7_fc_na',        trim: 'FC3S NA',                year: 1989, fipePrice: 98_000 },
    ],
  },
  {
    id: 'mazda_rx8',
    brand: 'Mazda',
    model: 'RX-8',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'rx8_type_s',       trim: 'Type S',                 year: 2008, fipePrice: 125_000 },
      { id: 'rx8_type_rs',      trim: 'Spirit R',               year: 2011, fipePrice: 165_000 },
    ],
  },
  {
    id: 'honda_s2000',
    brand: 'Honda',
    model: 'S2000',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 's2000_ap1',        trim: 'AP1 F20C',               year: 2001, fipePrice: 195_000 },
      { id: 's2000_ap2',        trim: 'AP2 F22C1',              year: 2006, fipePrice: 248_000 },
    ],
  },
  {
    id: 'honda_nsx_na1',
    brand: 'Honda',
    model: 'NSX NA1',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'nsx_na1_base',     trim: 'C30A VTEC',              year: 1993, fipePrice: 485_000 },
      { id: 'nsx_na1_type_r',   trim: 'Type R',                 year: 1999, fipePrice: 895_000 },
    ],
  },
  {
    id: 'mitsubishi_evo9',
    brand: 'Mitsubishi',
    model: 'Lancer Evo IX',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'evo9_mr',          trim: 'MR SE',                  year: 2007, fipePrice: 215_000 },
      { id: 'evo9_gsr',         trim: 'GSR',                    year: 2006, fipePrice: 185_000 },
    ],
  },
  {
    id: 'mitsubishi_evo10',
    brand: 'Mitsubishi',
    model: 'Lancer Evo X',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'evo10_final_mr',   trim: 'Final Edition MR',       year: 2015, fipePrice: 295_000 },
      { id: 'evo10_gsr',        trim: 'GSR',                    year: 2011, fipePrice: 245_000 },
    ],
  },
  {
    id: 'mitsubishi_evo8',
    brand: 'Mitsubishi',
    model: 'Lancer Evo VIII',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'evo8_mr',          trim: 'MR',                     year: 2004, fipePrice: 165_000 },
      { id: 'evo8_gsr',         trim: 'GSR',                    year: 2003, fipePrice: 148_000 },
    ],
  },
  {
    id: 'nissan_350z',
    brand: 'Nissan',
    model: '350Z',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: '350z_nismo',       trim: 'NISMO',                  year: 2008, fipePrice: 168_000 },
      { id: '350z_track',       trim: 'Track',                  year: 2006, fipePrice: 145_000 },
    ],
  },
  {
    id: 'nissan_370z',
    brand: 'Nissan',
    model: '370Z',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: '370z_nismo',       trim: 'NISMO',                  year: 2019, fipePrice: 315_000 },
      { id: '370z_base',        trim: 'Sport',                  year: 2019, fipePrice: 285_000 },
    ],
  },
  {
    id: 'nissan_z_rz34',
    brand: 'Nissan',
    model: 'Z RZ34',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'z_rz34_sport',     trim: '3.0 Sport',              year: 2024, fipePrice: 385_000 },
      { id: 'z_rz34_nismo',     trim: '3.0 NISMO',              year: 2024, fipePrice: 545_000 },
    ],
  },
  {
    id: 'nissan_silvia_s15',
    brand: 'Nissan',
    model: 'Silvia S15',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 's15_spec_r',       trim: 'Spec-R Autech',          year: 2001, fipePrice: 398_000 },
      { id: 's15_spec_s',       trim: 'Spec-S',                 year: 2000, fipePrice: 295_000 },
    ],
  },
  {
    id: 'nissan_180sx',
    brand: 'Nissan',
    model: '180SX Type X',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: '180sx_type_x',     trim: 'Type X SR20DET',         year: 1995, fipePrice: 128_000 },
      { id: '180sx_type_iii',   trim: 'Type III SR20DET',       year: 1993, fipePrice: 98_000 },
    ],
  },
  {
    id: 'honda_integra_type_r',
    brand: 'Honda',
    model: 'Integra Type R DC5',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'dc5_type_r',       trim: 'K20A VTEC',              year: 2004, fipePrice: 248_000 },
      { id: 'dc2_type_r',       trim: 'DC2 B18C VTEC',          year: 1998, fipePrice: 195_000 },
    ],
  },
  {
    id: 'ae86',
    brand: 'Toyota',
    model: 'AE86 Trueno',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'ae86_trueno_2t',   trim: '3-door 4A-GE',           year: 1986, fipePrice: 185_000 },
      { id: 'ae86_corolla',     trim: 'Corolla Levin GT-Apex',  year: 1985, fipePrice: 148_000 },
    ],
  },
  {
    id: 'celica_gt4',
    brand: 'Toyota',
    model: 'Celica GT-Four',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'celica_st205',     trim: 'ST205 Turbo AWD',        year: 1994, fipePrice: 198_000 },
      { id: 'celica_st185',     trim: 'ST185 Carlos Sainz',     year: 1993, fipePrice: 178_000 },
    ],
  },
  {
    id: 'subaru_brz',
    brand: 'Subaru',
    model: 'BRZ',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'brz_24_sport',     trim: '2.4 Sport',              year: 2023, fipePrice: 285_000 },
      { id: 'brz_24_ts',        trim: '2.4 tS',                 year: 2023, fipePrice: 318_000 },
    ],
  },
  {
    id: 'mazda_mx5',
    brand: 'Mazda',
    model: 'MX-5 ND',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'mx5_20_sport',     trim: '2.0 Sport',              year: 2023, fipePrice: 278_000 },
      { id: 'mx5_20_rf',        trim: '2.0 RF GT',              year: 2023, fipePrice: 318_000 },
    ],
  },
  {
    id: 'mitsubishi_eclipse_gsx',
    brand: 'Mitsubishi',
    model: 'Eclipse GSX',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'eclipse_2g_gsx',   trim: '2G 4G63T AWD',          year: 1999, fipePrice: 85_000 },
      { id: 'eclipse_3g_gt',    trim: '3G GT V6',               year: 2003, fipePrice: 68_000 },
    ],
  },
  {
    id: 'toyota_gr_yaris',
    brand: 'Toyota',
    model: 'GR Yaris',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'gr_yaris_circuit', trim: '1.6 Circuit Pack AWD',   year: 2023, fipePrice: 265_000 },
      { id: 'gr_yaris_morizo',  trim: '1.6 Morizo Edition',     year: 2024, fipePrice: 395_000 },
    ],
  },
  {
    id: 'toyota_gr_corolla',
    brand: 'Toyota',
    model: 'GR Corolla',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'gr_corolla_core',  trim: '1.6 GR-FOUR Core',       year: 2024, fipePrice: 345_000 },
      { id: 'gr_corolla_morizo',trim: '1.6 Morizo Edition',     year: 2024, fipePrice: 485_000 },
    ],
  },
  {
    id: 'hyundai_elantra_n',
    brand: 'Hyundai',
    model: 'Elantra N',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'elantra_n_20',     trim: '2.0 T-GDi DCT',         year: 2023, fipePrice: 285_000 },
    ],
  },
  {
    id: 'kia_stinger_gt',
    brand: 'Kia',
    model: 'Stinger GT',
    icon: '🏎️',
    category: 'jdm',
    variants: [
      { id: 'stinger_36_rwd',   trim: '3.3 T-GDi RWD',         year: 2023, fipePrice: 395_000 },
      { id: 'stinger_36_awd',   trim: '3.3 T-GDi AWD',         year: 2023, fipePrice: 445_000 },
    ],
  },

  // ── SUPERCAR ─────────────────────────────────────────────────────
  {
    id: 'lamborghini_huracan',
    brand: 'Lamborghini',
    model: 'Huracán EVO',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'huracan_evo_52',   trim: '5.2 V10 RWD',           year: 2023, fipePrice: 1_850_000 },
      { id: 'huracan_evo_awd',  trim: '5.2 V10 AWD',           year: 2023, fipePrice: 2_150_000 },
    ],
  },
  {
    id: 'lamborghini_aventador',
    brand: 'Lamborghini',
    model: 'Aventador S',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'aventador_s_65',   trim: '6.5 V12 LP 740-4',      year: 2022, fipePrice: 2_850_000 },
      { id: 'aventador_svj',    trim: '6.5 V12 SVJ',           year: 2022, fipePrice: 4_250_000 },
    ],
  },
  {
    id: 'ferrari_488',
    brand: 'Ferrari',
    model: '488 GTB',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'f488_gtb',         trim: '3.9 V8 Biturbo GTB',    year: 2019, fipePrice: 1_850_000 },
      { id: 'f488_pista',       trim: '3.9 V8 Pista',          year: 2019, fipePrice: 2_450_000 },
    ],
  },
  {
    id: 'ferrari_f8',
    brand: 'Ferrari',
    model: 'F8 Tributo',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'f8_tributo',       trim: '3.9 V8 Biturbo',        year: 2023, fipePrice: 2_250_000 },
      { id: 'f8_spider',        trim: '3.9 V8 Spider',         year: 2023, fipePrice: 2_550_000 },
    ],
  },
  {
    id: 'ferrari_296',
    brand: 'Ferrari',
    model: '296 GTB',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'ferrari296_gtb',   trim: '2.9 V6 Assetto Fiorano', year: 2023, fipePrice: 2_850_000 },
    ],
  },
  {
    id: 'mclaren_720s',
    brand: 'McLaren',
    model: '720S',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'mc720s_40',        trim: '4.0 M840T V8',           year: 2023, fipePrice: 2_550_000 },
      { id: 'mc720s_spider',    trim: '4.0 M840T Spider',       year: 2023, fipePrice: 2_850_000 },
    ],
  },
  {
    id: 'mclaren_570s',
    brand: 'McLaren',
    model: '570S',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'mc570s_38',        trim: '3.8 M838TE V8',          year: 2019, fipePrice: 1_550_000 },
    ],
  },
  {
    id: 'porsche_911_gt3',
    brand: 'Porsche',
    model: '911 GT3 RS',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'gt3_rs_40',        trim: '4.0 Flat-6 RS',         year: 2023, fipePrice: 1_850_000 },
      { id: 'gt3_40_touring',   trim: '4.0 GT3 Touring',       year: 2023, fipePrice: 1_550_000 },
    ],
  },
  {
    id: 'porsche_911_turbo_s',
    brand: 'Porsche',
    model: '911 Turbo S',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'p911_turbo_s_38',  trim: '3.8 Biturbo',            year: 2023, fipePrice: 1_985_000 },
      { id: 'p911_turbo_s_cab', trim: '3.8 Biturbo Cabriolet',  year: 2023, fipePrice: 2_185_000 },
    ],
  },
  {
    id: 'porsche_cayman_gt4',
    brand: 'Porsche',
    model: '718 Cayman GT4 RS',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'gt4_rs_40',        trim: '4.0 Flat-6 GT4 RS',     year: 2023, fipePrice: 1_285_000 },
    ],
  },
  {
    id: 'audi_r8',
    brand: 'Audi',
    model: 'R8 V10',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'r8_v10_52',        trim: '5.2 V10 Plus',           year: 2023, fipePrice: 1_550_000 },
      { id: 'r8_v10_perf',      trim: '5.2 V10 Performance',    year: 2023, fipePrice: 1_850_000 },
    ],
  },
  {
    id: 'honda_nsx_type_s',
    brand: 'Honda',
    model: 'NSX Type S',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'nsx_ts_hybrid',    trim: 'Type S Hybrid AWD',      year: 2022, fipePrice: 2_250_000 },
    ],
  },
  {
    id: 'ford_gt_mk4',
    brand: 'Ford',
    model: 'GT MkIV',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'ford_gt_mkiv',     trim: '3.5 EcoBoost V6 MkIV',  year: 2022, fipePrice: 4_250_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // PORSCHE — linha completa
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'porsche_718_cayman',
    brand: 'Porsche',
    model: '718 Cayman',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'p718_cay_20',      trim: '2.0 Turbo',              year: 2023, fipePrice:   615_000 },
      { id: 'p718_cay_s',       trim: '2.5 S',                  year: 2023, fipePrice:   745_000 },
      { id: 'p718_cay_gts_40',  trim: '4.0 GTS Flat-6',         year: 2023, fipePrice:   895_000 },
    ],
  },
  {
    id: 'porsche_718_boxster',
    brand: 'Porsche',
    model: '718 Boxster',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'p718_box_20',      trim: '2.0 Turbo Cabrio',       year: 2023, fipePrice:   645_000 },
      { id: 'p718_box_gts_40',  trim: '4.0 GTS Flat-6',         year: 2023, fipePrice:   925_000 },
    ],
  },
  {
    id: 'porsche_911_gt3_rs',
    brand: 'Porsche',
    model: '911 GT3 RS',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'p911_gt3_rs_40',   trim: '4.0 Flat-6 NA RS',       year: 2023, fipePrice: 2_295_000 },
      { id: 'p911_gt3_rs_wp',   trim: '4.0 RS Weissach Pack',   year: 2023, fipePrice: 2_585_000 },
    ],
  },
  {
    id: 'porsche_911_gt2_rs',
    brand: 'Porsche',
    model: '911 GT2 RS',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'p911_gt2_rs_38',   trim: '3.8 Biturbo GT2 RS',     year: 2019, fipePrice: 2_650_000 },
    ],
  },
  {
    id: 'porsche_911_carrera',
    brand: 'Porsche',
    model: '911 Carrera',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'p911_carrera',     trim: '3.0 Carrera',            year: 2023, fipePrice:   985_000 },
      { id: 'p911_carrera_s',   trim: '3.0 Carrera S',          year: 2023, fipePrice: 1_185_000 },
      { id: 'p911_carrera_gts', trim: '3.0 Carrera GTS',        year: 2023, fipePrice: 1_385_000 },
    ],
  },
  {
    id: 'porsche_911_targa',
    brand: 'Porsche',
    model: '911 Targa 4',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'p911_targa_4',     trim: '3.0 Targa 4',            year: 2023, fipePrice: 1_295_000 },
      { id: 'p911_targa_4s',    trim: '3.0 Targa 4S',           year: 2023, fipePrice: 1_485_000 },
    ],
  },
  {
    id: 'porsche_911_sport_classic',
    brand: 'Porsche',
    model: '911 Sport Classic',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'p911_sp_classic',  trim: '3.7 Biturbo Sport Classic', year: 2023, fipePrice: 2_185_000 },
    ],
  },
  {
    id: 'porsche_911_dakar',
    brand: 'Porsche',
    model: '911 Dakar',
    icon: '🏜️',
    category: 'supercar',
    variants: [
      { id: 'p911_dakar',       trim: '3.0 Biturbo Dakar Off-Road', year: 2023, fipePrice: 1_785_000 },
    ],
  },
  {
    id: 'porsche_taycan',
    brand: 'Porsche',
    model: 'Taycan',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'taycan_4s',        trim: '4S Performance Plus',    year: 2023, fipePrice: 1_195_000 },
      { id: 'taycan_turbo',     trim: 'Turbo',                  year: 2023, fipePrice: 1_485_000 },
      { id: 'taycan_turbo_s',   trim: 'Turbo S',                year: 2023, fipePrice: 1_785_000 },
    ],
  },
  {
    id: 'porsche_panamera',
    brand: 'Porsche',
    model: 'Panamera',
    icon: '🚗',
    category: 'luxo',
    variants: [
      { id: 'panamera_4s',      trim: '4S 2.9 Biturbo V6',      year: 2023, fipePrice:   985_000 },
      { id: 'panamera_turbo_s', trim: 'Turbo S 4.0 Biturbo V8', year: 2023, fipePrice: 1_585_000 },
    ],
  },
  {
    id: 'porsche_cayenne_coupe',
    brand: 'Porsche',
    model: 'Cayenne Coupe',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'cayenne_coupe_turbo', trim: 'Turbo GT 4.0 V8',    year: 2023, fipePrice: 1_385_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // LAMBORGHINI
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'lambo_revuelto',
    brand: 'Lamborghini',
    model: 'Revuelto',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'revuelto_v12',     trim: '6.5 V12 HPEV Hybrid',    year: 2024, fipePrice: 4_950_000 },
    ],
  },
  {
    id: 'lambo_urus_performante',
    brand: 'Lamborghini',
    model: 'Urus',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'urus_performante', trim: 'Performante 4.0 V8 Biturbo', year: 2023, fipePrice: 2_650_000 },
      { id: 'urus_se',          trim: 'SE Hybrid Plug-in',      year: 2024, fipePrice: 2_985_000 },
    ],
  },
  {
    id: 'lambo_sian',
    brand: 'Lamborghini',
    model: 'Sián FKP 37',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'sian_fkp37',       trim: 'FKP 37 V12 Hybrid',      year: 2021, fipePrice: 19_500_000 },
    ],
  },
  {
    id: 'lambo_countach_lpi',
    brand: 'Lamborghini',
    model: 'Countach LPI 800-4',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'countach_lpi',     trim: 'LPI 800-4 V12 Hybrid',   year: 2022, fipePrice: 14_500_000 },
    ],
  },
  {
    id: 'lambo_diablo',
    brand: 'Lamborghini',
    model: 'Diablo',
    icon: '🏎️',
    category: 'classico',
    variants: [
      { id: 'diablo_vt',        trim: 'VT 5.7 V12',             year: 1998, fipePrice: 3_850_000 },
      { id: 'diablo_se30',      trim: 'SE30 Jota',              year: 1995, fipePrice: 6_250_000 },
    ],
  },
  {
    id: 'lambo_murcielago',
    brand: 'Lamborghini',
    model: 'Murciélago',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'murci_lp640',      trim: 'LP640 6.5 V12',          year: 2008, fipePrice: 2_950_000 },
      { id: 'murci_sv',         trim: 'LP670-4 SuperVeloce',    year: 2010, fipePrice: 4_650_000 },
    ],
  },
  {
    id: 'lambo_gallardo',
    brand: 'Lamborghini',
    model: 'Gallardo',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'gallardo_lp560',   trim: 'LP560-4',                year: 2010, fipePrice: 1_385_000 },
      { id: 'gallardo_sl',      trim: 'Superleggera',           year: 2011, fipePrice: 1_685_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // FERRARI
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ferrari_sf90',
    brand: 'Ferrari',
    model: 'SF90 Stradale',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'sf90_stradale',    trim: '4.0 V8 PHEV Stradale',   year: 2023, fipePrice: 5_485_000 },
      { id: 'sf90_xx',          trim: '4.0 V8 PHEV XX Stradale', year: 2024, fipePrice: 8_185_000 },
    ],
  },
  {
    id: 'ferrari_laferrari',
    brand: 'Ferrari',
    model: 'LaFerrari',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'laferrari_v12',    trim: '6.3 V12 HY-KERS',        year: 2015, fipePrice: 18_500_000 },
      { id: 'laferrari_aperta', trim: 'Aperta Targa',           year: 2017, fipePrice: 26_500_000 },
    ],
  },
  {
    id: 'ferrari_roma',
    brand: 'Ferrari',
    model: 'Roma',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'roma_v8',          trim: '3.9 V8 Biturbo',         year: 2023, fipePrice: 2_485_000 },
      { id: 'roma_spider',      trim: '3.9 V8 Spider',          year: 2024, fipePrice: 2_785_000 },
    ],
  },
  {
    id: 'ferrari_portofino_m',
    brand: 'Ferrari',
    model: 'Portofino M',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'portofino_m_v8',   trim: '3.9 V8 Biturbo M',       year: 2023, fipePrice: 2_185_000 },
    ],
  },
  {
    id: 'ferrari_812_superfast',
    brand: 'Ferrari',
    model: '812 Superfast',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: '812_superfast',    trim: '6.5 V12 NA',             year: 2022, fipePrice: 3_985_000 },
    ],
  },
  {
    id: 'ferrari_812_competizione',
    brand: 'Ferrari',
    model: '812 Competizione',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: '812_comp',         trim: '6.5 V12 NA Competizione', year: 2022, fipePrice: 8_985_000 },
      { id: '812_comp_a',       trim: '6.5 V12 Competizione A',  year: 2023, fipePrice: 11_500_000 },
    ],
  },
  {
    id: 'ferrari_daytona_sp3',
    brand: 'Ferrari',
    model: 'Daytona SP3',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'daytona_sp3',      trim: '6.5 V12 Icona',          year: 2023, fipePrice: 18_500_000 },
    ],
  },
  {
    id: 'ferrari_monza_sp2',
    brand: 'Ferrari',
    model: 'Monza SP2',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'monza_sp2',        trim: '6.5 V12 Speedster',      year: 2021, fipePrice: 12_500_000 },
    ],
  },
  {
    id: 'ferrari_purosangue',
    brand: 'Ferrari',
    model: 'Purosangue',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'purosangue_v12',   trim: '6.5 V12 NA SUV',         year: 2024, fipePrice: 4_485_000 },
    ],
  },
  {
    id: 'ferrari_f12',
    brand: 'Ferrari',
    model: 'F12 Berlinetta',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'f12_berlinetta',   trim: '6.3 V12 NA',             year: 2017, fipePrice: 2_850_000 },
      { id: 'f12_tdf',          trim: '6.3 V12 Tour de France', year: 2017, fipePrice: 5_650_000 },
    ],
  },
  {
    id: 'ferrari_f40',
    brand: 'Ferrari',
    model: 'F40',
    icon: '🏎️',
    category: 'classico',
    variants: [
      { id: 'f40_v8',           trim: '2.9 V8 Biturbo',         year: 1990, fipePrice: 12_500_000 },
    ],
  },
  {
    id: 'ferrari_f50',
    brand: 'Ferrari',
    model: 'F50',
    icon: '🏎️',
    category: 'classico',
    variants: [
      { id: 'f50_v12',          trim: '4.7 V12 NA',             year: 1996, fipePrice: 18_500_000 },
    ],
  },
  {
    id: 'ferrari_enzo',
    brand: 'Ferrari',
    model: 'Enzo',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'enzo_v12',         trim: '6.0 V12 NA',             year: 2004, fipePrice: 22_500_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // McLAREN
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'mclaren_artura',
    brand: 'McLaren',
    model: 'Artura',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'artura_v6',        trim: '3.0 V6 PHEV',            year: 2023, fipePrice: 2_185_000 },
      { id: 'artura_spider',    trim: '3.0 V6 PHEV Spider',     year: 2024, fipePrice: 2_385_000 },
    ],
  },
  {
    id: 'mclaren_765lt',
    brand: 'McLaren',
    model: '765LT',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: '765lt_coupe',      trim: '4.0 V8 Biturbo',         year: 2022, fipePrice: 3_485_000 },
      { id: '765lt_spider',     trim: '4.0 V8 Spider',          year: 2022, fipePrice: 3_685_000 },
    ],
  },
  {
    id: 'mclaren_senna',
    brand: 'McLaren',
    model: 'Senna',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'senna_v8',         trim: '4.0 V8 Biturbo',         year: 2020, fipePrice: 8_985_000 },
      { id: 'senna_gtr',        trim: '4.0 V8 GTR Track',       year: 2020, fipePrice: 12_500_000 },
    ],
  },
  {
    id: 'mclaren_p1',
    brand: 'McLaren',
    model: 'P1',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'p1_hybrid',        trim: '3.8 V8 Hybrid',          year: 2015, fipePrice: 14_500_000 },
      { id: 'p1_gtr',           trim: '3.8 V8 GTR Track-Only',  year: 2016, fipePrice: 22_500_000 },
    ],
  },
  {
    id: 'mclaren_speedtail',
    brand: 'McLaren',
    model: 'Speedtail',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'speedtail_hyper',  trim: '4.0 V8 Hybrid 3-Seater', year: 2021, fipePrice: 19_500_000 },
    ],
  },
  {
    id: 'mclaren_gt',
    brand: 'McLaren',
    model: 'GT',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'mclaren_gt_v8',    trim: '4.0 V8 Biturbo GT',      year: 2022, fipePrice: 1_985_000 },
    ],
  },
  {
    id: 'mclaren_elva',
    brand: 'McLaren',
    model: 'Elva',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'elva_roadster',    trim: '4.0 V8 Speedster',       year: 2021, fipePrice: 11_500_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // ASTON MARTIN
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'aston_vantage',
    brand: 'Aston Martin',
    model: 'Vantage',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'vantage_v8',       trim: '4.0 V8 Biturbo',         year: 2023, fipePrice: 1_985_000 },
      { id: 'vantage_f1',       trim: '4.0 V8 F1 Edition',      year: 2023, fipePrice: 2_285_000 },
    ],
  },
  {
    id: 'aston_db12',
    brand: 'Aston Martin',
    model: 'DB12',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'db12_v8',          trim: '4.0 V8 Biturbo',         year: 2024, fipePrice: 2_385_000 },
      { id: 'db12_volante',     trim: '4.0 V8 Volante',         year: 2024, fipePrice: 2_585_000 },
    ],
  },
  {
    id: 'aston_dbs',
    brand: 'Aston Martin',
    model: 'DBS Superleggera',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'dbs_superleggera', trim: '5.2 V12 Biturbo',        year: 2023, fipePrice: 3_485_000 },
    ],
  },
  {
    id: 'aston_valhalla',
    brand: 'Aston Martin',
    model: 'Valhalla',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'valhalla_phev',    trim: '4.0 V8 PHEV Mid-engine', year: 2024, fipePrice: 5_985_000 },
    ],
  },
  {
    id: 'aston_valkyrie',
    brand: 'Aston Martin',
    model: 'Valkyrie',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'valkyrie_v12',     trim: '6.5 V12 Hybrid Hyper',   year: 2022, fipePrice: 24_500_000 },
      { id: 'valkyrie_amr',     trim: '6.5 V12 AMR Pro Track',  year: 2023, fipePrice: 38_000_000 },
    ],
  },
  {
    id: 'aston_dbx707',
    brand: 'Aston Martin',
    model: 'DBX707',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'dbx707_v8',        trim: '4.0 V8 Biturbo 707',     year: 2023, fipePrice: 1_985_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // BUGATTI
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'bugatti_chiron',
    brand: 'Bugatti',
    model: 'Chiron',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'chiron_w16',       trim: '8.0 W16 Quad Turbo',     year: 2022, fipePrice: 22_500_000 },
      { id: 'chiron_super_sport', trim: '8.0 W16 Super Sport 300+', year: 2023, fipePrice: 32_000_000 },
      { id: 'chiron_pur_sport', trim: '8.0 W16 Pur Sport',      year: 2022, fipePrice: 28_500_000 },
    ],
  },
  {
    id: 'bugatti_bolide',
    brand: 'Bugatti',
    model: 'Bolide',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'bolide_w16',       trim: '8.0 W16 Track-Only',     year: 2024, fipePrice: 38_000_000 },
    ],
  },
  {
    id: 'bugatti_veyron_ss',
    brand: 'Bugatti',
    model: 'Veyron Super Sport',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'veyron_ss',        trim: '8.0 W16 Super Sport',    year: 2012, fipePrice: 18_500_000 },
      { id: 'veyron_grandsport', trim: '8.0 W16 Grand Sport',   year: 2013, fipePrice: 14_500_000 },
    ],
  },
  {
    id: 'bugatti_centodieci',
    brand: 'Bugatti',
    model: 'Centodieci',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'centodieci_w16',   trim: '8.0 W16 EB110 Tribute',  year: 2022, fipePrice: 45_000_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // KOENIGSEGG
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'koenigsegg_jesko',
    brand: 'Koenigsegg',
    model: 'Jesko',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'jesko_v8',         trim: '5.0 V8 Twin Turbo',      year: 2023, fipePrice: 18_500_000 },
      { id: 'jesko_absolut',    trim: '5.0 V8 Absolut Top Speed', year: 2023, fipePrice: 24_500_000 },
    ],
  },
  {
    id: 'koenigsegg_regera',
    brand: 'Koenigsegg',
    model: 'Regera',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'regera_phev',      trim: '5.0 V8 PHEV Direct Drive', year: 2022, fipePrice: 14_500_000 },
    ],
  },
  {
    id: 'koenigsegg_gemera',
    brand: 'Koenigsegg',
    model: 'Gemera',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'gemera_v8',        trim: '5.0 V8 Hybrid 4-Seater', year: 2024, fipePrice: 16_500_000 },
    ],
  },
  {
    id: 'koenigsegg_agera_rs',
    brand: 'Koenigsegg',
    model: 'Agera RS',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'agera_rs_v8',      trim: '5.0 V8 Twin Turbo RS',   year: 2017, fipePrice: 12_500_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // PAGANI
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'pagani_huayra',
    brand: 'Pagani',
    model: 'Huayra',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'huayra_bc',        trim: '6.0 V12 BC Biturbo',     year: 2018, fipePrice: 18_500_000 },
      { id: 'huayra_r',         trim: '6.0 V12 R Track-Only',   year: 2022, fipePrice: 24_500_000 },
    ],
  },
  {
    id: 'pagani_utopia',
    brand: 'Pagani',
    model: 'Utopia',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'utopia_v12',       trim: '6.0 V12 Biturbo Manual', year: 2024, fipePrice: 22_500_000 },
    ],
  },
  {
    id: 'pagani_zonda',
    brand: 'Pagani',
    model: 'Zonda Cinque',
    icon: '🏎️',
    category: 'classico',
    variants: [
      { id: 'zonda_cinque',     trim: '7.3 V12 NA Cinque',      year: 2010, fipePrice: 14_500_000 },
      { id: 'zonda_revolucion', trim: '6.0 V12 Revolución',     year: 2013, fipePrice: 22_000_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // LOTUS
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'lotus_evija',
    brand: 'Lotus',
    model: 'Evija',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'evija_ev',         trim: 'EV Hyper-GT 2000hp',     year: 2023, fipePrice: 12_500_000 },
    ],
  },
  {
    id: 'lotus_emira',
    brand: 'Lotus',
    model: 'Emira',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'emira_i4',         trim: '2.0 i4 Turbo',           year: 2023, fipePrice:   685_000 },
      { id: 'emira_v6',         trim: '3.5 V6 Supercharged',    year: 2023, fipePrice:   885_000 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // MASERATI / RIMAC / CZINGER / AMG / BMW / AUDI
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'maserati_mc20',
    brand: 'Maserati',
    model: 'MC20',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'mc20_nettuno',     trim: '3.0 V6 Nettuno Biturbo', year: 2023, fipePrice: 2_185_000 },
      { id: 'mc20_cielo',       trim: '3.0 V6 Cielo Spyder',    year: 2024, fipePrice: 2_485_000 },
    ],
  },
  {
    id: 'rimac_nevera',
    brand: 'Rimac',
    model: 'Nevera',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'nevera_ev',        trim: 'EV Quad Motor 1914hp',   year: 2024, fipePrice: 14_500_000 },
    ],
  },
  {
    id: 'czinger_21c',
    brand: 'Czinger',
    model: '21C',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'czinger_21c',      trim: '2.88 V8 Hybrid Tandem',  year: 2024, fipePrice: 16_500_000 },
    ],
  },
  {
    id: 'amg_one',
    brand: 'Mercedes-AMG',
    model: 'ONE',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'amg_one_f1',       trim: '1.6 V6 F1 Hybrid',       year: 2023, fipePrice: 18_500_000 },
    ],
  },
  {
    id: 'amg_gt_black_series',
    brand: 'Mercedes-AMG',
    model: 'GT Black Series',
    icon: '🏎️',
    category: 'supercar',
    variants: [
      { id: 'amg_gt_bs',        trim: '4.0 V8 Biturbo Black',   year: 2022, fipePrice: 3_985_000 },
    ],
  },
  {
    id: 'amg_sl63',
    brand: 'Mercedes-AMG',
    model: 'SL 63',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'sl63_v8',          trim: '4.0 V8 Biturbo 4MATIC+', year: 2023, fipePrice: 1_485_000 },
    ],
  },
  {
    id: 'bmw_m5_cs',
    brand: 'BMW',
    model: 'M5 CS',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'm5_cs_v8',         trim: '4.4 V8 Biturbo CS',      year: 2022, fipePrice: 1_185_000 },
    ],
  },
  {
    id: 'bmw_m8_competition',
    brand: 'BMW',
    model: 'M8 Competition',
    icon: '🏎️',
    category: 'esportivo',
    variants: [
      { id: 'm8_comp_coupe',    trim: '4.4 V8 Biturbo Comp.',   year: 2023, fipePrice: 1_385_000 },
      { id: 'm8_comp_grand',    trim: '4.4 V8 Gran Coupe Comp.', year: 2023, fipePrice: 1_485_000 },
    ],
  },
  {
    id: 'audi_rsq8',
    brand: 'Audi',
    model: 'RS Q8',
    icon: '🚙',
    category: 'suv',
    variants: [
      { id: 'rsq8_v8',          trim: '4.0 V8 Biturbo Performance', year: 2023, fipePrice: 1_385_000 },
    ],
  },
  {
    id: 'audi_rs_etron_gt',
    brand: 'Audi',
    model: 'RS e-tron GT',
    icon: '⚡',
    category: 'eletrico',
    variants: [
      { id: 'rs_etron_gt',      trim: 'RS Performance EV',      year: 2023, fipePrice: 1_185_000 },
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
/** Mínimo de veículos gerados por ciclo de 24h. */
const MARKET_MIN_BATCH = 500;
/** Máximo de veículos gerados por ciclo de 24h. */
const MARKET_MAX_BATCH = 600;
/** Proporção mínima de veículos populares no mercado. */
const POPULAR_MIN_RATIO = 0.40;
/** Quantas vezes o mesmo modelo pode aparecer no mesmo ciclo. */
const MAX_SAME_MODEL = 4;

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

  // Quilometragem baseada na idade do veículo (~15.000 km/ano) com variação ±60%
  // Carros em pior condição tendem a ter mais km
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - variant.year);
  const conditionMultiplier = condition >= 70 ? 0.6 : condition >= 40 ? 1.0 : 1.5;
  const rawKm = age === 0
    ? Math.floor(Math.random() * 5_000)           // 0–5k para 0 km
    : age * 15_000 * conditionMultiplier * (0.5 + Math.random() * 1.0);
  // Arredonda a 1.000 km (mínimo 1.000 para carros usados)
  const mileage = age === 0 ? Math.round(rawKm / 500) * 500 : Math.max(1_000, Math.round(rawKm / 1_000) * 1_000);

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
    mileage,
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
 * Gera o inventário do mercado global para um ciclo de 24h.
 *
 * Distribuição por ciclo:
 *   • Total: 500–600 veículos (aleatório)
 *   • ≥ 40 % populares
 *   • 1 garantido de cada outra categoria (medio / suv / pickup / esportivo / eletrico / jdm / supercar)
 *   • Restante: preenchimento aleatório de qualquer categoria
 *   • Máximo de 4 aparições do mesmo modelo por ciclo
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
    ['medio', 'suv', 'pickup', 'esportivo', 'eletrico', 'classico', 'luxo', 'jdm', 'supercar'] as CarCategory[]
  ).filter(c => byCategory.has(c));

  // Total do ciclo: 80–110
  const total = MARKET_MIN_BATCH
    + Math.floor(Math.random() * (MARKET_MAX_BATCH - MARKET_MIN_BATCH + 1));

  // Quota de populares (mínimo 40 %)
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
  'Dieguin da Revisa',
  'Galeguinho Motos',
  'Guilherme Sol Quente',
  'Summer Veículos',
  'Douguinha da Contorno',
  'Tumate Veículos',
  'Adir Veículos',
  'Repasse Santa Rita',
  'Pedro Multimarcas',
  'Fabinho Veículos',
  'California Veículos',
  'Paulo Afonso Veículos',
  'Paulo Vitor',
  'Eduardo Veículos',
  'Claudio Veículos',
  'Feira da Marreta',
  'Mal Preço Veículos',
  'Amarelinhas Veículos',
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
  /** Quilometragem do veículo */
  mileage: number;
  askingPrice: number;
  icon: string;
  category: CarCategory;
  seller: string;
  pendingOffer: number | null; // valor da oferta enviada (null = sem oferta)
}

/** Formata quilometragem no padrão brasileiro: "45.000 km" */
export function fmtKm(km: number): string {
  return new Intl.NumberFormat('pt-BR').format(km) + ' km';
}
