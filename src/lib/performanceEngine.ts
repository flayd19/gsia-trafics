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
  return Math.round(Math.min(100, Math.max(0, (hp - 60) / (1200 - 60) * 100)));
}
function rawToTorque(nm: number): number {
  return Math.round(Math.min(100, Math.max(0, (nm - 80) / (1400 - 80) * 100)));
}
function rawToWeight(kg: number): number {
  // Inverted: menor peso = score maior
  return Math.round(Math.min(100, Math.max(0, (2300 - kg) / (2300 - 800) * 100)));
}

// ── calcIgp — Pesos por setor do circuito F1 + fator de condição ─────
function calcIgp(s: Omit<PerformanceStats, 'igp'>, condition = 100): number {
  const tractionBonus =
    s.traction === 'AWD' ? 3.5 :
    s.traction === 'RWD' ? 1.5 : 0;

  // Setores do circuito F1
  const straightSector = s.topSpeed * 0.60 + s.power * 0.40;
  const accelSector    = s.acceleration * 0.65 + s.torque * 0.35;
  const chicSector     = s.aerodynamics * 0.40 + s.grip * 0.35 + s.gearShift * 0.25;
  const hairpinSector  = s.grip * 0.50 + s.stability * 0.30 + s.torque * 0.20;

  const raw =
    straightSector * 0.27 +
    accelSector    * 0.27 +
    chicSector     * 0.20 +
    hairpinSector  * 0.14 +
    s.aerodynamics * 0.06 +
    s.stability    * 0.04 +
    s.gearShift    * 0.02 +
    tractionBonus;

  const weightPenalty = (s.weight / 100) * 0.15;
  // Condição afeta IGP: carro a 0% tem 73% do IGP máximo; a 100% tem 100%
  const condFactor    = 0.73 + (Math.max(0, Math.min(100, condition)) / 100) * 0.27;
  const igp = raw * (1 - weightPenalty) * condFactor;
  return Math.round(Math.min(99, Math.max(1, igp)));
}

// ── generateBasePerformance ──────────────────────────────────────────
export function generateBasePerformance(
  car: Pick<OwnedCar, 'instanceId' | 'modelId' | 'fipePrice' | 'condition'>
): PerformanceStats {
  const model    = CAR_MODELS.find(m => m.id === car.modelId);
  const category = (model?.category ?? 'popular') as CarCategory;
  const ranges   = CATEGORY_RANGES[category];

  const rng    = seededRng(car.instanceId);
  const varRng = seededRng(car.instanceId + '_var');
  const variation = 0.95 + varRng() * 0.10; // ±5% por instância

  // Faixa de preço do modelo para interpolação
  const prices  = model?.variants.map(v => v.fipePrice) ?? [30_000, 500_000];
  const fipeMin = Math.min(...prices);
  const fipeMax = Math.max(...prices, fipeMin + 1);

  const override = MODEL_OVERRIDES[car.modelId];

  const rawHp   = override?.hp          ?? interpolate(car.fipePrice, fipeMin, fipeMax, ranges.hp[0],         ranges.hp[1],         rng);
  const rawNm   = override?.torqueNm    ?? interpolate(car.fipePrice, fipeMin, fipeMax, ranges.torqueNm[0],   ranges.torqueNm[1],   rng);
  const rawKg   = override?.weightKg    ?? interpolate(car.fipePrice, fipeMin, fipeMax, ranges.weight[0],     ranges.weight[1],     rng);
  const rawT100 = override?.time0to100  ?? interpolate(car.fipePrice, fipeMin, fipeMax, ranges.time0to100[0], ranges.time0to100[1], rng);
  const rawVmax = override?.topSpeedKmh ?? interpolate(car.fipePrice, fipeMin, fipeMax, ranges.vmax[0],       ranges.vmax[1],       rng);
  const rawAero = interpolate(car.fipePrice, fipeMin, fipeMax, ranges.aero[0],      ranges.aero[1],      rng);
  const rawStab = interpolate(car.fipePrice, fipeMin, fipeMax, ranges.stability[0], ranges.stability[1], rng);
  const rawGrip = interpolate(car.fipePrice, fipeMin, fipeMax, ranges.grip[0],      ranges.grip[1],      rng);
  const rawGear = interpolate(car.fipePrice, fipeMin, fipeMax, ranges.gearShift[0], ranges.gearShift[1], rng);

  const hasTurbo  = override?.hasTurbo !== undefined
    ? override.hasTurbo
    : rng() < ranges.hasTurboChance;
  const traction  = tractionFor(category, car.fipePrice);
  const condition = car.condition ?? 100;

  const stats: Omit<PerformanceStats, 'igp'> = {
    power:        Math.round(Math.min(99, Math.max(1, rawToPower(rawHp) * variation))),
    torque:       Math.round(Math.min(99, Math.max(1, rawToTorque(rawNm) * variation))),
    weight:       Math.round(Math.min(99, Math.max(1, rawToWeight(rawKg) * variation))),
    topSpeed:     Math.round(Math.min(99, Math.max(1, rawToTopSpeed(rawVmax) * variation))),
    acceleration: Math.round(Math.min(99, Math.max(1, rawToAcceleration(rawT100) * variation))),
    aerodynamics: Math.round(Math.min(99, Math.max(1, rawAero * variation))),
    stability:    Math.round(Math.min(99, Math.max(1, rawStab * variation))),
    grip:         Math.round(Math.min(99, Math.max(1, rawGrip * variation))),
    gearShift:    Math.round(Math.min(99, Math.max(1, rawGear * variation))),
    traction,
    _hp:          Math.round(rawHp),
    _torqueNm:    Math.round(rawNm),
    _weightKg:    Math.round(rawKg),
    _0to100:      Math.round(rawT100 * 10) / 10,
    _topSpeedKmh: Math.round(rawVmax),
    _hasTurbo:    hasTurbo,
    _engineType:  override?.engineType ?? (hasTurbo ? 'Turbinado' : 'Atmosférico'),
  };

  return { ...stats, igp: calcIgp(stats, condition) };
}

// ── Bônus de stat por nível de tunagem ───────────────────────────────
const TUNE_BONUS_PER_LEVEL: Partial<Record<TuneType, number>> = {
  engine:          4.0,
  turbo:           5.0,
  intercooler:     3.0,
  exhaust:         2.5,
  injection:       3.5,
  ecu:             3.0,
  transmission:    3.0,
  clutch:          2.5,
  suspension:      3.5,
  sway_bar:        2.5,
  differential:    3.0,
  geometry:        2.5,
  aerodynamics:    4.0,
  wing:            3.0,
  diffuser:        2.5,
  tires:           3.0,
  light_rims:      2.5,
  weight_reduction: 3.5,
  carbon_parts:    4.0,
};

// ── applyTuneUpgrades ────────────────────────────────────────────────
export function applyTuneUpgrades(
  base: PerformanceStats,
  upgrades: TuneUpgrade[],
  condition = 100,
): PerformanceStats {
  const s = { ...base };
  const clamp = (v: number) => Math.round(Math.min(99, Math.max(1, v)));

  for (const upgrade of upgrades) {
    const bonus = upgrade.level * (TUNE_BONUS_PER_LEVEL[upgrade.type as TuneType] ?? 3.0);
    switch (upgrade.type as TuneType) {
      case 'engine':
        s.power        = clamp(s.power        + bonus);
        s.torque       = clamp(s.torque       + bonus * 0.6);
        break;
      case 'turbo':
        s.power        = clamp(s.power        + bonus);
        s.torque       = clamp(s.torque       + bonus * 0.8);
        s.acceleration = clamp(s.acceleration + bonus * 0.4);
        s._hasTurbo    = true;
        break;
      case 'intercooler':
        s.power        = clamp(s.power        + bonus * 0.7);
        s.torque       = clamp(s.torque       + bonus * 0.5);
        break;
      case 'exhaust':
        s.power        = clamp(s.power        + bonus * 0.6);
        s.gearShift    = clamp(s.gearShift    + bonus * 0.5);
        break;
      case 'injection':
        s.power        = clamp(s.power        + bonus * 0.8);
        s.torque       = clamp(s.torque       + bonus * 0.7);
        break;
      case 'ecu':
        s.gearShift    = clamp(s.gearShift    + bonus);
        s.torque       = clamp(s.torque       + bonus * 0.5);
        break;
      case 'transmission':
        s.gearShift    = clamp(s.gearShift    + bonus);
        s.acceleration = clamp(s.acceleration + bonus * 0.5);
        break;
      case 'clutch':
        s.gearShift    = clamp(s.gearShift    + bonus * 0.8);
        s.acceleration = clamp(s.acceleration + bonus * 0.4);
        break;
      case 'suspension':
        s.stability    = clamp(s.stability    + bonus);
        s.grip         = clamp(s.grip         + bonus * 0.5);
        break;
      case 'sway_bar':
        s.stability    = clamp(s.stability    + bonus);
        break;
      case 'differential':
        s.grip         = clamp(s.grip         + bonus * 0.7);
        s.stability    = clamp(s.stability    + bonus * 0.5);
        break;
      case 'geometry':
        s.grip         = clamp(s.grip         + bonus);
        break;
      case 'aerodynamics':
        s.aerodynamics = clamp(s.aerodynamics + bonus);
        s.topSpeed     = clamp(s.topSpeed     + bonus * 0.3);
        break;
      case 'wing':
        s.aerodynamics = clamp(s.aerodynamics + bonus * 0.8);
        s.stability    = clamp(s.stability    + bonus * 0.5);
        break;
      case 'diffuser':
        s.aerodynamics = clamp(s.aerodynamics + bonus * 0.7);
        s.stability    = clamp(s.stability    + bonus * 0.4);
        break;
      case 'tires':
        s.grip         = clamp(s.grip         + bonus);
        s.acceleration = clamp(s.acceleration + bonus * 0.3);
        break;
      case 'light_rims':
        s.grip         = clamp(s.grip         + bonus * 0.5);
        s.acceleration = clamp(s.acceleration + bonus * 0.5);
        break;
      case 'weight_reduction':
        s.acceleration = clamp(s.acceleration + bonus * 0.8);
        s.topSpeed     = clamp(s.topSpeed     + bonus * 0.4);
        break;
      case 'carbon_parts':
        s.acceleration = clamp(s.acceleration + bonus * 0.7);
        s.topSpeed     = clamp(s.topSpeed     + bonus * 0.5);
        break;
    }
  }

  // Recalcula IGP com condição atual
  const { igp: _igp, ...rest } = s;
  return { ...rest, igp: calcIgp(rest, condition) };
}

// ── getFullPerformance — ponto de entrada principal ──────────────────
export function getFullPerformance(car: OwnedCar): PerformanceStats {
  const condition = car.condition ?? 100;
  // Usa cache de stats base (seeded/determinístico), recalcula IGP com condição atual
  const base = car.performance ?? generateBasePerformance(car);

  if (!car.tuneUpgrades || car.tuneUpgrades.length === 0) {
    const { igp: _igp, ...stats } = base;
    return { ...stats, igp: calcIgp(stats, condition) };
  }

  return applyTuneUpgrades(base, car.tuneUpgrades, condition);
}
