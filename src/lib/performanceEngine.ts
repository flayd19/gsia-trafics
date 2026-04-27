// =====================================================================
// performanceEngine — Motor de cálculo de performance dos carros
// =====================================================================
import type { OwnedCar } from '@/types/game';
import type { CarCategory } from '@/data/cars';
import { CAR_MODELS } from '@/data/cars';
import type { PerformanceStats, TuneType, TuneUpgrade, TractionType } from '@/types/performance';
import { TUNE_META } from '@/types/performance';

// ── Faixas por categoria ─────────────────────────────────────────
interface CategoryRange {
  hp:    [number, number];
  torqueNm: [number, number];
  weight:   [number, number];
  time0to100: [number, number];
  vmax:  [number, number];
  aero:  [number, number];
  stability: [number, number];
  grip:  [number, number];
  gearShift: [number, number];
  hasTurboChance: number; // 0-1
}

const CATEGORY_RANGES: Record<CarCategory, CategoryRange> = {
  popular: {
    hp: [80, 115], torqueNm: [100, 145], weight: [900, 1100],
    time0to100: [11, 16], vmax: [160, 190],
    aero: [30, 50], stability: [40, 60], grip: [35, 55], gearShift: [40, 60],
    hasTurboChance: 0.15,
  },
  medio: {
    hp: [110, 165], torqueNm: [140, 195], weight: [1100, 1350],
    time0to100: [8, 13], vmax: [185, 220],
    aero: [40, 60], stability: [45, 65], grip: [40, 60], gearShift: [45, 65],
    hasTurboChance: 0.40,
  },
  suv: {
    hp: [130, 220], torqueNm: [160, 280], weight: [1350, 1800],
    time0to100: [8, 14], vmax: [170, 230],
    aero: [35, 55], stability: [50, 70], grip: [45, 65], gearShift: [40, 60],
    hasTurboChance: 0.55,
  },
  pickup: {
    hp: [150, 220], torqueNm: [250, 450], weight: [1700, 2300],
    time0to100: [10, 16], vmax: [170, 200],
    aero: [25, 45], stability: [45, 65], grip: [40, 60], gearShift: [35, 55],
    hasTurboChance: 0.70,
  },
  esportivo: {
    hp: [220, 550], torqueNm: [220, 600], weight: [1200, 1650],
    time0to100: [3, 8], vmax: [230, 340],
    aero: [70, 90], stability: [70, 90], grip: [70, 90], gearShift: [65, 85],
    hasTurboChance: 0.60,
  },
  luxo: {
    hp: [180, 500], torqueNm: [200, 650], weight: [1500, 2300],
    time0to100: [4, 9], vmax: [200, 310],
    aero: [55, 75], stability: [60, 80], grip: [55, 75], gearShift: [60, 80],
    hasTurboChance: 0.75,
  },
  classico: {
    hp: [60, 120], torqueNm: [80, 160], weight: [800, 1200],
    time0to100: [12, 20], vmax: [140, 180],
    aero: [20, 40], stability: [30, 50], grip: [25, 45], gearShift: [25, 45],
    hasTurboChance: 0.05,
  },
  eletrico: {
    hp: [170, 450], torqueNm: [250, 700], weight: [1600, 2200],
    time0to100: [3, 8], vmax: [160, 260],
    aero: [60, 80], stability: [65, 85], grip: [60, 80], gearShift: [80, 95],
    hasTurboChance: 0.0,
  },
  jdm: {
    hp: [130, 580], torqueNm: [150, 640], weight: [900, 1600],
    time0to100: [3.5, 10], vmax: [190, 320],
    aero: [60, 90], stability: [60, 90], grip: [65, 92], gearShift: [60, 88],
    hasTurboChance: 0.70,
  },
  supercar: {
    hp: [480, 1200], torqueNm: [450, 1400], weight: [1050, 1900],
    time0to100: [2.0, 4.5], vmax: [280, 420],
    aero: [80, 98], stability: [75, 95], grip: [80, 98], gearShift: [75, 95],
    hasTurboChance: 0.75,
  },
};

// ── Overrides para modelos populares ────────────────────────────
interface ModelOverride {
  hp?: number;
  torqueNm?: number;
  weightKg?: number;
  time0to100?: number;
  topSpeedKmh?: number;
  hasTurbo?: boolean;
  engineType?: string;
}

const MODEL_OVERRIDES: Record<string, ModelOverride> = {
  gol:         { hp: 84,  torqueNm: 115, weightKg: 985,  time0to100: 14.5, topSpeedKmh: 168, hasTurbo: false, engineType: '1.0' },
  polo:        { hp: 128, torqueNm: 200, weightKg: 1105, time0to100: 9.2,  topSpeedKmh: 210, hasTurbo: true,  engineType: '1.0 TSI' },
  golf:        { hp: 150, torqueNm: 250, weightKg: 1300, time0to100: 8.5,  topSpeedKmh: 215, hasTurbo: true,  engineType: '1.4 TSI' },
  civic:       { hp: 173, torqueNm: 220, weightKg: 1380, time0to100: 7.9,  topSpeedKmh: 228, hasTurbo: true,  engineType: '1.5 Turbo' },
  mustang:     { hp: 460, torqueNm: 570, weightKg: 1840, time0to100: 4.3,  topSpeedKmh: 250, hasTurbo: false, engineType: '5.0 V8' },
  wrx_sti:     { hp: 300, torqueNm: 407, weightKg: 1490, time0to100: 5.2,  topSpeedKmh: 255, hasTurbo: true,  engineType: '2.5 Turbo' },
  supra:       { hp: 340, torqueNm: 500, weightKg: 1570, time0to100: 4.3,  topSpeedKmh: 250, hasTurbo: true,  engineType: '3.0 Turbo' },
  ferrari:     { hp: 660, torqueNm: 760, weightKg: 1525, time0to100: 2.9,  topSpeedKmh: 330, hasTurbo: true,  engineType: 'V8 Biturbo' },
  porsche:     { hp: 450, torqueNm: 550, weightKg: 1480, time0to100: 3.5,  topSpeedKmh: 296, hasTurbo: true,  engineType: '3.0 Turbo' },
  lamborghini: { hp: 770, torqueNm: 720, weightKg: 1590, time0to100: 2.8,  topSpeedKmh: 350, hasTurbo: false, engineType: 'V12' },
  tesla:       { hp: 450, torqueNm: 639, weightKg: 2100, time0to100: 3.7,  topSpeedKmh: 250, hasTurbo: false, engineType: 'Elétrico' },
  hilux:       { hp: 204, torqueNm: 500, weightKg: 2100, time0to100: 11.0, topSpeedKmh: 185, hasTurbo: true,  engineType: '2.8 Diesel' },
  ranger:      { hp: 213, torqueNm: 500, weightKg: 2100, time0to100: 10.5, topSpeedKmh: 188, hasTurbo: true,  engineType: '3.2 TDCi' },
  fusca:       { hp: 77,  torqueNm: 108, weightKg: 1055, time0to100: 14.0, topSpeedKmh: 165, hasTurbo: false, engineType: '1.6' },
  brasilia:    { hp: 65,  torqueNm: 100, weightKg: 900,  time0to100: 17.0, topSpeedKmh: 148, hasTurbo: false, engineType: '1.4' },
  kombi:       { hp: 58,  torqueNm: 95,  weightKg: 1100, time0to100: 20.0, topSpeedKmh: 130, hasTurbo: false, engineType: '1.4' },
  del_rey:     { hp: 88,  torqueNm: 118, weightKg: 1000, time0to100: 13.5, topSpeedKmh: 172, hasTurbo: false, engineType: '1.6' },

  // ── Muscle / American / Euro esportivos ──────────────────────────
  corvette_c8:        { hp: 495,  torqueNm: 637,  weightKg: 1527, time0to100: 2.9,  topSpeedKmh: 312, hasTurbo: false, engineType: '6.2 V8' },
  corvette_c7_z06:    { hp: 650,  torqueNm: 881,  weightKg: 1518, time0to100: 3.2,  topSpeedKmh: 306, hasTurbo: false, engineType: '6.2 SC V8' },
  camaro_ss:          { hp: 455,  torqueNm: 617,  weightKg: 1737, time0to100: 4.2,  topSpeedKmh: 271, hasTurbo: false, engineType: '6.2 V8' },
  camaro_zl1:         { hp: 650,  torqueNm: 881,  weightKg: 1799, time0to100: 3.5,  topSpeedKmh: 296, hasTurbo: false, engineType: '6.2 SC V8' },
  challenger_hellcat: { hp: 717,  torqueNm: 881,  weightKg: 2041, time0to100: 3.7,  topSpeedKmh: 328, hasTurbo: false, engineType: '6.2 SC V8' },
  charger_srt:        { hp: 485,  torqueNm: 637,  weightKg: 1977, time0to100: 4.4,  topSpeedKmh: 280, hasTurbo: false, engineType: '6.4 HEMI V8' },
  shelby_gt500:       { hp: 760,  torqueNm: 847,  weightKg: 1847, time0to100: 3.3,  topSpeedKmh: 298, hasTurbo: false, engineType: '5.2 SC V8' },
  bmw_m2:             { hp: 460,  torqueNm: 550,  weightKg: 1630, time0to100: 4.1,  topSpeedKmh: 285, hasTurbo: true,  engineType: '3.0 S58 Turbo' },
  bmw_m3:             { hp: 510,  torqueNm: 650,  weightKg: 1730, time0to100: 3.5,  topSpeedKmh: 290, hasTurbo: true,  engineType: '3.0 S58 Turbo' },
  bmw_m4:             { hp: 510,  torqueNm: 650,  weightKg: 1725, time0to100: 3.5,  topSpeedKmh: 290, hasTurbo: true,  engineType: '3.0 S58 Turbo' },
  mercedes_amg_a45:   { hp: 421,  torqueNm: 500,  weightKg: 1565, time0to100: 3.9,  topSpeedKmh: 270, hasTurbo: true,  engineType: '2.0 Turbo' },
  mercedes_amg_c63:   { hp: 671,  torqueNm: 1020, weightKg: 1980, time0to100: 3.4,  topSpeedKmh: 280, hasTurbo: true,  engineType: '2.0 Hybrid Turbo' },
  mercedes_amg_gt:    { hp: 557,  torqueNm: 700,  weightKg: 1615, time0to100: 3.7,  topSpeedKmh: 316, hasTurbo: true,  engineType: '4.0 Biturbo V8' },
  audi_rs3:           { hp: 400,  torqueNm: 500,  weightKg: 1570, time0to100: 3.8,  topSpeedKmh: 290, hasTurbo: true,  engineType: '2.5 TFSI' },
  audi_rs6:           { hp: 630,  torqueNm: 850,  weightKg: 2100, time0to100: 3.4,  topSpeedKmh: 305, hasTurbo: true,  engineType: '4.0 TFSI Turbo' },
  alfa_giulia_qv:     { hp: 510,  torqueNm: 600,  weightKg: 1524, time0to100: 3.9,  topSpeedKmh: 307, hasTurbo: true,  engineType: '2.9 V6 Biturbo' },
  renault_megane_rs:  { hp: 300,  torqueNm: 420,  weightKg: 1449, time0to100: 5.4,  topSpeedKmh: 270, hasTurbo: true,  engineType: '1.8 Turbo' },

  // ── JDM ──────────────────────────────────────────────────────────
  nissan_gtr_r35:     { hp: 570,  torqueNm: 637,  weightKg: 1770, time0to100: 2.7,  topSpeedKmh: 315, hasTurbo: true,  engineType: '3.8 Twin Turbo' },
  nissan_gtr_r34:     { hp: 280,  torqueNm: 392,  weightKg: 1540, time0to100: 5.0,  topSpeedKmh: 260, hasTurbo: true,  engineType: 'RB26DETT' },
  nissan_gtr_r33:     { hp: 276,  torqueNm: 363,  weightKg: 1530, time0to100: 5.4,  topSpeedKmh: 250, hasTurbo: true,  engineType: 'RB26DETT' },
  nissan_gtr_r32:     { hp: 276,  torqueNm: 368,  weightKg: 1430, time0to100: 5.6,  topSpeedKmh: 248, hasTurbo: true,  engineType: 'RB26DETT' },
  toyota_supra_mk4:   { hp: 320,  torqueNm: 441,  weightKg: 1570, time0to100: 5.1,  topSpeedKmh: 250, hasTurbo: true,  engineType: '2JZ-GTE Twin Turbo' },
  toyota_supra_mk5:   { hp: 387,  torqueNm: 500,  weightKg: 1570, time0to100: 4.3,  topSpeedKmh: 250, hasTurbo: true,  engineType: 'B58 3.0 Turbo' },
  mazda_rx7_fd:       { hp: 255,  torqueNm: 294,  weightKg: 1310, time0to100: 5.3,  topSpeedKmh: 255, hasTurbo: true,  engineType: '13B-REW Twin Turbo' },
  mazda_rx7_fc:       { hp: 185,  torqueNm: 230,  weightKg: 1270, time0to100: 7.5,  topSpeedKmh: 220, hasTurbo: true,  engineType: '13B-T Turbo' },
  mazda_rx8:          { hp: 238,  torqueNm: 216,  weightKg: 1370, time0to100: 6.4,  topSpeedKmh: 230, hasTurbo: false, engineType: '13B-MSP RENESIS' },
  honda_s2000:        { hp: 237,  torqueNm: 208,  weightKg: 1260, time0to100: 6.2,  topSpeedKmh: 240, hasTurbo: false, engineType: 'F20C VTEC' },
  honda_nsx_na1:      { hp: 274,  torqueNm: 284,  weightKg: 1370, time0to100: 5.5,  topSpeedKmh: 270, hasTurbo: false, engineType: 'C30A VTEC' },
  mitsubishi_evo9:    { hp: 280,  torqueNm: 392,  weightKg: 1420, time0to100: 4.5,  topSpeedKmh: 250, hasTurbo: true,  engineType: '4G63T Turbo AWD' },
  mitsubishi_evo10:   { hp: 291,  torqueNm: 366,  weightKg: 1480, time0to100: 4.5,  topSpeedKmh: 250, hasTurbo: true,  engineType: '4B11T Turbo AWD' },
  mitsubishi_evo8:    { hp: 275,  torqueNm: 380,  weightKg: 1400, time0to100: 5.0,  topSpeedKmh: 248, hasTurbo: true,  engineType: '4G63T Turbo AWD' },
  nissan_silvia_s15:  { hp: 250,  torqueNm: 274,  weightKg: 1240, time0to100: 5.8,  topSpeedKmh: 250, hasTurbo: true,  engineType: 'SR20DET Turbo' },
  nissan_180sx:       { hp: 205,  torqueNm: 275,  weightKg: 1195, time0to100: 6.5,  topSpeedKmh: 235, hasTurbo: true,  engineType: 'SR20DET Turbo' },
  honda_integra_type_r: { hp: 200, torqueNm: 193, weightKg: 1100, time0to100: 6.6, topSpeedKmh: 235, hasTurbo: false, engineType: 'K20A/B18C VTEC' },
  ae86:               { hp: 128,  torqueNm: 149,  weightKg: 940,  time0to100: 8.5,  topSpeedKmh: 195, hasTurbo: false, engineType: '4A-GE TWIN CAM' },
  celica_gt4:         { hp: 255,  torqueNm: 324,  weightKg: 1430, time0to100: 5.5,  topSpeedKmh: 240, hasTurbo: true,  engineType: '3S-GTE Turbo AWD' },
  subaru_brz:         { hp: 228,  torqueNm: 250,  weightKg: 1270, time0to100: 6.0,  topSpeedKmh: 226, hasTurbo: false, engineType: 'FA24 Flat-4' },
  mazda_mx5:          { hp: 184,  torqueNm: 205,  weightKg: 1015, time0to100: 6.5,  topSpeedKmh: 219, hasTurbo: false, engineType: '2.0 Skyactiv-G' },
  nissan_350z:        { hp: 306,  torqueNm: 363,  weightKg: 1460, time0to100: 5.4,  topSpeedKmh: 250, hasTurbo: false, engineType: 'VQ35HR' },
  nissan_370z:        { hp: 344,  torqueNm: 374,  weightKg: 1496, time0to100: 5.2,  topSpeedKmh: 250, hasTurbo: false, engineType: 'VQ37VHR' },
  nissan_z_rz34:      { hp: 405,  torqueNm: 475,  weightKg: 1572, time0to100: 4.5,  topSpeedKmh: 250, hasTurbo: true,  engineType: 'VR30DDTT Twin Turbo' },
  toyota_gr_yaris:    { hp: 261,  torqueNm: 360,  weightKg: 1280, time0to100: 5.5,  topSpeedKmh: 230, hasTurbo: true,  engineType: 'G16E-GTS Turbo AWD' },
  toyota_gr_corolla:  { hp: 300,  torqueNm: 370,  weightKg: 1320, time0to100: 5.0,  topSpeedKmh: 240, hasTurbo: true,  engineType: 'G16E-GTS Turbo AWD' },
  hyundai_elantra_n:  { hp: 276,  torqueNm: 392,  weightKg: 1510, time0to100: 5.3,  topSpeedKmh: 250, hasTurbo: true,  engineType: '2.0 T-GDi' },
  kia_stinger_gt:     { hp: 368,  torqueNm: 510,  weightKg: 1803, time0to100: 4.7,  topSpeedKmh: 270, hasTurbo: true,  engineType: '3.3 T-GDi V6' },

  // ── Supercars ─────────────────────────────────────────────────────
  lamborghini_huracan:  { hp: 640,  torqueNm: 600,  weightKg: 1422, time0to100: 2.9,  topSpeedKmh: 325, hasTurbo: false, engineType: '5.2 V10 NA' },
  lamborghini_aventador:{ hp: 740,  torqueNm: 690,  weightKg: 1575, time0to100: 2.9,  topSpeedKmh: 350, hasTurbo: false, engineType: '6.5 V12 NA' },
  ferrari_488:          { hp: 660,  torqueNm: 760,  weightKg: 1475, time0to100: 3.0,  topSpeedKmh: 330, hasTurbo: true,  engineType: '3.9 V8 Biturbo' },
  ferrari_f8:           { hp: 720,  torqueNm: 770,  weightKg: 1435, time0to100: 2.9,  topSpeedKmh: 340, hasTurbo: true,  engineType: '3.9 V8 Biturbo' },
  ferrari_296:          { hp: 830,  torqueNm: 740,  weightKg: 1470, time0to100: 2.9,  topSpeedKmh: 330, hasTurbo: true,  engineType: '2.9 V6 Turbo + Elétrico' },
  mclaren_720s:         { hp: 710,  torqueNm: 770,  weightKg: 1283, time0to100: 2.8,  topSpeedKmh: 341, hasTurbo: true,  engineType: '4.0 M840T Biturbo' },
  mclaren_570s:         { hp: 562,  torqueNm: 600,  weightKg: 1313, time0to100: 3.2,  topSpeedKmh: 328, hasTurbo: true,  engineType: '3.8 M838TE Biturbo' },
  porsche_911_gt3:      { hp: 510,  torqueNm: 470,  weightKg: 1418, time0to100: 3.4,  topSpeedKmh: 318, hasTurbo: false, engineType: '4.0 Flat-6 NA' },
  porsche_911_turbo_s:  { hp: 650,  torqueNm: 800,  weightKg: 1640, time0to100: 2.7,  topSpeedKmh: 330, hasTurbo: true,  engineType: '3.8 Biturbo Flat-6' },
  porsche_cayman_gt4:   { hp: 500,  torqueNm: 450,  weightKg: 1415, time0to100: 3.4,  topSpeedKmh: 315, hasTurbo: false, engineType: '4.0 Flat-6 NA' },
  audi_r8:              { hp: 610,  torqueNm: 560,  weightKg: 1650, time0to100: 3.1,  topSpeedKmh: 333, hasTurbo: false, engineType: '5.2 V10 NA' },
  honda_nsx_type_s:     { hp: 600,  torqueNm: 667,  weightKg: 1725, time0to100: 3.0,  topSpeedKmh: 308, hasTurbo: true,  engineType: 'V6 Hybrid AWD' },
  ford_gt_mk4:          { hp: 800,  torqueNm: 850,  weightKg: 1250, time0to100: 2.8,  topSpeedKmh: 350, hasTurbo: true,  engineType: '3.5 EcoBoost V6 Turbo' },
};

// ── Determinismo por instanceId ──────────────────────────────────
function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return ((h >>> 0) / 0xFFFFFFFF);
  };
}

// ── Interpolação por fipePrice dentro da faixa ──────────────────
function interpolate(fipePrice: number, minRange: number, maxRange: number, lo: number, hi: number, rng: () => number): number {
  // Usa fipe como qualidade + ruído pequeno
  const norm  = Math.min(1, Math.max(0, (fipePrice - minRange) / (maxRange - minRange)));
  const noise = (rng() - 0.5) * 0.12; // ±6% de ruído
  const t     = Math.min(1, Math.max(0, norm + noise));
  return lo + t * (hi - lo);
}

// ── Tração por categoria ─────────────────────────────────────────
function tractionFor(category: CarCategory, fipePrice: number): TractionType {
  if (category === 'eletrico') return 'AWD';
  if (category === 'esportivo') return 'RWD';
  if (category === 'luxo') return fipePrice > 300_000 ? 'AWD' : 'RWD';
  if (category === 'suv') return fipePrice > 200_000 ? 'AWD' : 'FWD';
  if (category === 'pickup') return 'RWD';
  // JDM: carros baratos (roadsters, Z-cars) = RWD; premium (GT-R, Evo) = AWD
  if (category === 'jdm') return fipePrice > 600_000 ? 'AWD' : 'RWD';
  // Supercars: maioria RWD; top-tier (>2M) tende ao AWD (Turbo S, R8, NSX)
  if (category === 'supercar') return fipePrice > 2_000_000 ? 'AWD' : 'RWD';
  return 'FWD'; // popular, medio, classico
}

// ── Conversão raw → 0-100 ────────────────────────────────────────
function rawToTopSpeed(vmax: number): number {
  return Math.round(Math.min(100, Math.max(0, (vmax - 140) / (340 - 140) * 100)));
}
function rawToAcceleration(t: number): number {
  return Math.round(Math.min(100, Math.max(0, (20 - t) / (20 - 3) * 100)));
}
function rawToPower(hp: number): number {
  return Math.round(Math.min(100, Math.max(0, (hp - 60) / (550 - 60) * 100)));
}
function rawToTorque(nm: number): number {
  return Math.round(Math.min(100, Math.max(0, (nm - 80) / (700 - 80) * 100)));
}
function rawToWeight(kg: number): number {
  return Math.round(Math.min(100, Math.max(0, (kg - 800) / (2300 - 800) * 100)));
}

// ── IGP com física realista para pista estilo F1 ─────────────────
// Circuito: reta longa + hairpin + chicane + curvas médias
// Pesos refletem o impacto de cada atributo no tempo de volta:
//   • Reta longa       → velocidade de ponta + potência
//   • Saída de curvas  → aceleração + torque + tração
//   • Chicane / curva  → grip + câmbio rápido + aerodinâmica
//   • Hairpin          → grip + estabilidade
//   • Geral            → peso é penalidade universal
function calcIgp(
  s: Omit<PerformanceStats, 'igp'>,
  condition = 100,
): number {
  // Bônus de tração no circuito
  const tractionBonus =
    s.traction === 'AWD' ? 3.5 :
    s.traction === 'RWD' ? 1.5 : 0;

  // Setores do circuito (cada setor tem pesos próprios)
  const straightSector  = s.topSpeed * 0.60 + s.power * 0.40;                         // Reta principal
  const accelSector     = s.acceleration * 0.65 + s.torque * 0.35;                     // Saídas de curva
  const chicSector      = s.aerodynamics * 0.40 + s.grip * 0.35 + s.gearShift * 0.25; // Chicane/setor técnico
  const hairpinSector   = s.grip * 0.50 + s.stability * 0.30 + s.torque * 0.20;       // Hairpin

  // Peso dos setores na volta total:
  const raw =
    straightSector  * 0.27 +
    accelSector     * 0.27 +
    chicSector      * 0.20 +
    hairpinSector   * 0.14 +
    s.aerodynamics  * 0.06 +
    s.stability     * 0.04 +
    s.gearShift     * 0.02 +
    tractionBonus;

  // Penalidade de peso: carro mais pesado perde até 15% de performance nas curvas
  const weightPenalty = (s.weight / 100) * 0.15;

  // Fator de condição do motor: degrada a performance física progressivamente
  // 100% condição → 1.00x | 50% → 0.88x | 20% → 0.79x
  const condFactor = 0.73 + (Math.max(0, Math.min(100, condition)) / 100) * 0.27;

  const igp = raw * (1 - weightPenalty) * condFactor;
  return Math.round(Math.min(99, Math.max(1, igp)));
}

// ── Soft cap ─────────────────────────────────────────────────────
function softCapMultiplier(current: number): number {
  if (current < 70) return 1.0;
  if (current < 85) return 0.7;
  if (current < 95) return 0.4;
  return 0.15;
}

// ── Ganho por nível ───────────────────────────────────────────────
function gainForLevel(level: number): number {
  const gains = [0, 6, 5, 4, 3, 2];
  return gains[Math.min(5, Math.max(1, level))] ?? 2;
}

// ── Clamp 0-100 ───────────────────────────────────────────────────
function clamp(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)));
}

// ── Faixa de FIPE por categoria (para interpolação) ──────────────
const FIPE_RANGES: Record<CarCategory, [number, number]> = {
  popular:   [40_000,   130_000],
  medio:     [80_000,   250_000],
  suv:       [90_000,   450_000],
  pickup:    [80_000,   500_000],
  esportivo: [150_000,  2_000_000],
  luxo:      [200_000,  2_500_000],
  classico:  [20_000,   200_000],
  eletrico:  [150_000,  1_500_000],
  jdm:       [75_000,   4_000_000],
  supercar:  [1_000_000, 15_000_000],
};

// ── Geração base ─────────────────────────────────────────────────
export function generateBasePerformance(car: OwnedCar): PerformanceStats {
  const rng = seededRng(car.instanceId + car.modelId);

  // Busca categoria
  const carModel = CAR_MODELS.find(m => m.id === car.modelId);
  const category: CarCategory = (carModel?.category ?? 'popular') as CarCategory;
  const ranges = CATEGORY_RANGES[category];
  const fipeRange = FIPE_RANGES[category];

  // Overrides específicos
  const override = MODEL_OVERRIDES[car.modelId];

  const hp = override?.hp ??
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.hp[0], ranges.hp[1], rng);
  const torqueNm = override?.torqueNm ??
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.torqueNm[0], ranges.torqueNm[1], rng);
  const weightKg = override?.weightKg ??
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.weight[0], ranges.weight[1], rng);
  const time0to100 = override?.time0to100 ??
    // carros mais caros dentro da categoria = mais rápidos (invertido)
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.time0to100[1], ranges.time0to100[0], rng);
  const topSpeedKmh = override?.topSpeedKmh ??
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.vmax[0], ranges.vmax[1], rng);

  const hasTurbo = override?.hasTurbo ??
    (rng() < ranges.hasTurboChance);

  const engineType = override?.engineType ?? (hasTurbo ? 'Turbo' : 'Aspirado');

  const aero = clamp(
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.aero[0], ranges.aero[1], rng)
  );
  const stability = clamp(
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.stability[0], ranges.stability[1], rng)
  );
  const grip = clamp(
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.grip[0], ranges.grip[1], rng)
  );
  const gearShift = clamp(
    interpolate(car.fipePrice, fipeRange[0], fipeRange[1], ranges.gearShift[0], ranges.gearShift[1], rng)
  );

  const traction = tractionFor(category, car.fipePrice);

  // ── Variação de performance por instância (±5%) ──────────────────
  // Pequena variação para dar personalidade ao carro sem ser injusto.
  // O seed usa instanceId independente do modelId para garantir determinismo.
  const varRng = seededRng(car.instanceId + '_var');
  const variation = 0.95 + varRng() * 0.10; // 0.95 → 1.05

  const vary = (v: number) => clamp(Math.round(v * variation));

  const stats: Omit<PerformanceStats, 'igp'> = {
    topSpeed:     vary(rawToTopSpeed(topSpeedKmh)),
    acceleration: vary(rawToAcceleration(time0to100)),
    power:        vary(rawToPower(hp)),
    torque:       vary(rawToTorque(torqueNm)),
    weight:       rawToWeight(weightKg), // peso é propriedade física — não varia
    aerodynamics: vary(aero),
    stability:    vary(stability),
    grip:         vary(grip),
    gearShift:    vary(gearShift),
    traction,
    _hp: Math.round(hp),
    _torqueNm: Math.round(torqueNm),
    _weightKg: Math.round(weightKg),
    _0to100: Math.round(time0to100 * 10) / 10,
    _topSpeedKmh: Math.round(topSpeedKmh),
    _hasTurbo: hasTurbo,
    _engineType: engineType,
  };

  // Passa condição para calcIgp: carro em mau estado perde performance
  return { ...stats, igp: calcIgp(stats, car.condition) };
}

// ── Aplica tuning ────────────────────────────────────────────────
export function applyTuneUpgrades(base: PerformanceStats, upgrades: TuneUpgrade[]): PerformanceStats {
  // Trabalha com cópia mutável interna
  let s = { ...base };

  for (const upgrade of upgrades) {
    const gainBase = gainForLevel(upgrade.level);

    const applyGain = (stat: keyof PerformanceStats, multiplier: number) => {
      const cur = s[stat] as number;
      const gain = Math.round(gainBase * multiplier * softCapMultiplier(cur));
      (s as Record<string, number>)[stat as string] = clamp(cur + gain);
    };

    switch (upgrade.type) {
      case 'engine':
        // Maior efeito se não tem turbo (aspirado ganha mais do kit motor)
        applyGain('power',  s._hasTurbo ? 1.0 : 1.4);
        applyGain('torque', s._hasTurbo ? 0.9 : 1.2);
        break;
      case 'turbo':
        // Mais eficiente em base já turbinada
        applyGain('power',        s._hasTurbo ? 1.4 : 1.0);
        applyGain('acceleration', s._hasTurbo ? 1.2 : 0.8);
        applyGain('torque',       s._hasTurbo ? 1.0 : 0.7);
        break;
      case 'ecu':
        applyGain('gearShift', 1.3);
        applyGain('torque',    0.8);
        break;
      case 'transmission':
        applyGain('gearShift',    1.2);
        applyGain('acceleration', 1.0);
        break;
      case 'suspension':
        applyGain('grip',      1.0);
        applyGain('stability', 1.0);
        break;
      case 'tires':
        applyGain('grip',      1.5);
        applyGain('stability', 0.8);
        break;
      case 'weight_reduction': {
        // Reduz o atributo weight (menor = melhor), com maior impacto se carro pesado
        const cur = s.weight;
        const heavyBonus = cur > 60 ? 1.4 : 1.0;
        const reduction = Math.round(gainBase * heavyBonus * softCapMultiplier(100 - cur));
        s = { ...s, weight: clamp(cur - reduction) };
        break;
      }
      case 'aerodynamics': {
        // Maior impacto em carro rápido
        const speedBonus = s.topSpeed > 60 ? 1.3 : 1.0;
        applyGain('aerodynamics', speedBonus);
        applyGain('stability',    0.8);
        break;
      }
      case 'intercooler':
        // Só eficiente com turbo — multiplica ganho se hasTurbo
        applyGain('power',  s._hasTurbo ? 1.3 : 0.5);
        applyGain('torque', s._hasTurbo ? 1.1 : 0.4);
        break;
      case 'exhaust':
        applyGain('power',     1.0);
        applyGain('gearShift', 1.1);
        break;
      case 'injection':
        applyGain('power',  1.2);
        applyGain('torque', 1.0);
        break;
      case 'clutch':
        applyGain('gearShift',    1.2);
        applyGain('acceleration', 0.9);
        break;
      case 'sway_bar':
        applyGain('stability', 1.4);
        break;
      case 'differential':
        applyGain('grip',      1.1);
        applyGain('stability', 1.0);
        break;
      case 'geometry':
        applyGain('grip', 1.6);
        break;
      case 'wing':
        applyGain('aerodynamics', 1.0);
        applyGain('stability',    1.2);
        break;
      case 'diffuser':
        applyGain('aerodynamics', 1.1);
        applyGain('stability',    1.0);
        break;
      case 'light_rims':
        applyGain('grip',         1.0);
        applyGain('acceleration', 0.9);
        // leve redução de peso também
        s = { ...s, weight: clamp(s.weight - Math.round(gainBase * 0.5)) };
        break;
      case 'carbon_parts': {
        // Grande redução de peso, similar a weight_reduction mas mais agressiva
        const cur = s.weight;
        const reduction = Math.round(gainBase * 1.6 * softCapMultiplier(100 - cur));
        s = { ...s, weight: clamp(cur - reduction) };
        applyGain('acceleration', 0.6);
        applyGain('topSpeed',     0.5);
        break;
      }
    }
  }

  // Após tunagem, recalcula com condição preservada (upgrades não alteram condição)
  return { ...s, igp: calcIgp(s, 100) };
}

// ── Custo do tuning ──────────────────────────────────────────────
export function calcTuneCost(type: TuneType, level: number, _base: PerformanceStats): number {
  const meta = TUNE_META[type];
  // Custo sobe exponencialmente com o nível (×1.8 por nível)
  return Math.round(meta.baseCost * Math.pow(1.8, level - 1));
}

// ── Full performance (base + upgrades) ──────────────────────────
export function getFullPerformance(car: OwnedCar): PerformanceStats {
  const base     = generateBasePerformance(car);
  const upgrades = car.tuneUpgrades ?? [];
  if (upgrades.length === 0) return base;
  return applyTuneUpgrades(base, upgrades);
}
