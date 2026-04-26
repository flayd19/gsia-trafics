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
  if (category === 'esportivo') return fipePrice > 200_000 ? 'RWD' : 'RWD';
  if (category === 'luxo') return fipePrice > 300_000 ? 'AWD' : 'RWD';
  if (category === 'suv') return fipePrice > 200_000 ? 'AWD' : 'FWD';
  if (category === 'pickup') return 'RWD';
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

// ── IGP ──────────────────────────────────────────────────────────
function calcIgp(s: Omit<PerformanceStats, 'igp'>): number {
  const raw =
    s.topSpeed      * 0.20 +
    s.acceleration  * 0.20 +
    s.power         * 0.15 +
    s.torque        * 0.10 +
    s.aerodynamics  * 0.10 +
    s.stability     * 0.10 +
    s.grip          * 0.10 +
    s.gearShift     * 0.05;

  const weightPenalty = (s.weight / 100) * 0.10;
  const igp = raw * (1 - weightPenalty);
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
  popular:   [40_000,  130_000],
  medio:     [80_000,  250_000],
  suv:       [90_000,  450_000],
  pickup:    [80_000,  500_000],
  esportivo: [150_000, 2_000_000],
  luxo:      [200_000, 2_500_000],
  classico:  [20_000,  200_000],
  eletrico:  [150_000, 1_500_000],
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

  const stats: Omit<PerformanceStats, 'igp'> = {
    topSpeed:     rawToTopSpeed(topSpeedKmh),
    acceleration: rawToAcceleration(time0to100),
    power:        rawToPower(hp),
    torque:       rawToTorque(torqueNm),
    weight:       rawToWeight(weightKg),
    aerodynamics: aero,
    stability,
    grip,
    gearShift,
    traction,
    _hp: Math.round(hp),
    _torqueNm: Math.round(torqueNm),
    _weightKg: Math.round(weightKg),
    _0to100: Math.round(time0to100 * 10) / 10,
    _topSpeedKmh: Math.round(topSpeedKmh),
    _hasTurbo: hasTurbo,
    _engineType: engineType,
  };

  return { ...stats, igp: calcIgp(stats) };
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

  return { ...s, igp: calcIgp(s) };
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
