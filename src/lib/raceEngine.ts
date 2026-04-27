// =====================================================================
// raceEngine — Motor de simulação de corridas baseado em performance
//
// Filosofia:
//   • 90% determinístico: tempo final é dominado pelos stats reais do carro
//     (top speed, aceleração, grip, stability, aero, gearShift) ponderados por
//     setor do circuito (reta, aceleração, chicane, hairpin).
//   • 10% ou menos de variabilidade: pequenos eventos de corrida (largada,
//     erros, sorte de "tração") que dão sabor sem comprometer o resultado
//     esperado pelo desempenho do carro.
//   • Reaproveita os mesmos pesos setoriais usados em `calcIgp` no
//     performanceEngine — um carro com IGP 80 sempre vence em média um
//     IGP 50, mas com variabilidade suficiente para fazer cada corrida
//     ser interessante de assistir.
//
// Determinismo:
//   • Ao receber um `seed`, o resultado é estável (reprodutível). Útil para
//     que todos os clientes vejam o mesmo resultado da mesma corrida quando
//     o backend não calcula centralmente.
// =====================================================================
import type { PerformanceStats } from '@/types/performance';

// ── Tipos públicos ────────────────────────────────────────────────

export type RaceSector = 'straight' | 'accel' | 'chicane' | 'hairpin';

export interface RaceEntrant {
  userId:    string;
  /** IGP base 0-100. Usado como fallback se `stats` não for fornecido. */
  igp:       number;
  /** Stats completos do carro (preferido). */
  stats?:    PerformanceStats;
  /** Condição mecânica 0-100. Default 100. Carros gastos têm mais variabilidade. */
  condition?: number;
}

export interface RaceEventLog {
  /** Tipo do evento — útil para narração. */
  type:       'great_start' | 'poor_start' | 'minor_mistake' | 'consistent_pace' | 'fastest_lap';
  /** Em qual volta aconteceu (1-N). */
  lap?:       number;
  /** Em qual setor aconteceu. */
  sector?:    RaceSector;
  /** Texto curto para exibição em log. */
  description: string;
  /** Impacto em segundos no tempo total (positivo = perdeu tempo, negativo = ganhou). */
  timeImpact: number;
}

export interface RaceEntrantResult {
  userId:        string;
  /** Score 0-100 final (compatível com `calcRaceTimeSec` do `RachaScreen`). */
  score:         number;
  /** Posição final (1, 2, 3, ...). */
  position:      number;
  /** Tempo total estimado da corrida em segundos. */
  totalTimeSec:  number;
  /** Tempo da volta mais rápida (segundos). */
  bestLapSec:    number;
  /** Tempos por setor (média ao longo das voltas). */
  sectorScores:  Record<RaceSector, number>;
  /** Eventos narrativos da corrida. */
  events:        RaceEventLog[];
}

export interface SimulateRaceOptions {
  /** Número de voltas. Default: 3. */
  laps?:   number;
  /** Comprimento da volta em metros (informativo). Default: 2000. */
  lapMeters?: number;
  /** Seed determinístico (recomendado em multiplayer). */
  seed?:   string;
  /**
   * Magnitude máxima de variabilidade aleatória final (0..0.10). Default 0.03 (3%).
   * Mantida baixa por design: o resultado deve refletir o desempenho real do
   * carro, não da sorte. Valores acima de 0.05 começam a inverter resultados
   * em IGPs próximos.
   */
  luckAmplitude?: number;
}

// ── Constantes de simulação ───────────────────────────────────────────

/**
 * Pesos por setor — quais stats importam mais em cada parte do circuito.
 * Soma de pesos por setor é normalizada (não precisa somar 1.0 exatamente
 * porque normalizamos depois).
 */
const SECTOR_WEIGHTS: Record<RaceSector, Partial<Record<keyof PerformanceStats, number>>> = {
  // Reta: top speed e potência dominam; aero ajuda
  straight: { topSpeed: 0.55, power: 0.30, aerodynamics: 0.15 },
  // Aceleração (saída de curva, arrancada): aceleração e torque
  accel:    { acceleration: 0.50, torque: 0.30, gearShift: 0.20 },
  // Chicane (curvas rápidas em sequência): aero, grip e câmbio rápido
  chicane:  { aerodynamics: 0.30, grip: 0.35, gearShift: 0.20, stability: 0.15 },
  // Hairpin (curva fechada): grip, estabilidade e tração na saída
  hairpin:  { grip: 0.45, stability: 0.30, torque: 0.25 },
};

/** Peso de cada setor no score TOTAL da corrida. Soma = 1.0. */
const SECTOR_WEIGHT_IN_TOTAL: Record<RaceSector, number> = {
  straight: 0.30,
  accel:    0.25,
  chicane:  0.25,
  hairpin:  0.20,
};

/** Bônus por tipo de tração (idêntico ao do performanceEngine). */
const TRACTION_BONUS: Record<NonNullable<PerformanceStats['traction']>, number> = {
  AWD: 3.5,
  RWD: 1.5,
  FWD: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────

/** PRNG seedável simples (mulberry32) para reprodutibilidade. */
function createRng(seed: string | undefined): () => number {
  if (!seed) {
    return Math.random;
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h |= 0;
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Quando o jogador não tem PerformanceStats completo (raro), aproxima a
 * partir do IGP isolado. Distribui linearmente nos campos relevantes.
 */
function approximateStatsFromIgp(igp: number): PerformanceStats {
  const v = Math.max(1, Math.min(99, igp));
  return {
    topSpeed:     v,
    acceleration: v,
    power:        v,
    torque:       v,
    weight:       50, // neutro
    aerodynamics: v,
    stability:    v,
    grip:         v,
    gearShift:    v,
    traction:     'RWD',
    _hp:          0,
    _torqueNm:    0,
    _weightKg:    1300,
    _0to100:      0,
    _topSpeedKmh: 0,
    _hasTurbo:    false,
    _engineType:  '',
    igp:          v,
  };
}

/** Score por setor 0-100 a partir dos stats e da condição mecânica. */
function calcSectorScore(stats: PerformanceStats, sector: RaceSector, condition: number): number {
  const weights = SECTOR_WEIGHTS[sector];
  let raw = 0;
  let totalW = 0;
  for (const [key, w] of Object.entries(weights) as Array<[keyof PerformanceStats, number]>) {
    const statValue = stats[key];
    if (typeof statValue !== 'number') continue;
    raw += statValue * w;
    totalW += w;
  }
  if (totalW > 0) raw /= totalW; // normaliza para 0-100

  // Penalidade de peso: carros pesados perdem em hairpin/accel; menos em reta
  const weightPenalty = sector === 'straight' ? 0
    : sector === 'accel'   ? (stats.weight / 100) * 0.10
    : sector === 'hairpin' ? (stats.weight / 100) * 0.12
    :                        (stats.weight / 100) * 0.08;

  // Condição: a 100% sem penalidade, a 0% reduz 27% do score
  const condFactor = 0.73 + (Math.max(0, Math.min(100, condition)) / 100) * 0.27;

  return Math.max(0, Math.min(100, raw * (1 - weightPenalty) * condFactor));
}

/**
 * Converte score 0-100 em tempo de setor (segundos por volta).
 * Tempos calibrados para uma volta típica de 2000m (2 km) em circuito misto.
 * Gera velocidades médias de 130-260 km/h por volta:
 *   • Reta principal (~700m): 12s (top) → 25s (fundo) — 100-210 km/h média
 *   • Aceleração saída de curva (~250m): 4s (top) → 9s (fundo)
 *   • Chicane (~400m): 5s (top) → 11s (fundo)
 *   • Hairpin + reta curta (~650m): 7s (top) → 15s (fundo)
 *
 * Volta total:
 *   • Top performer (score 100): ~28s/volta → ~257 km/h média
 *   • Mid performer (score 50):  ~42s/volta → ~171 km/h média
 *   • Bottom (score 0):          ~60s/volta → ~120 km/h média
 */
function sectorScoreToTime(score: number, sector: RaceSector): number {
  const s = Math.max(0, Math.min(100, score));
  const t = 1 - s / 100;
  switch (sector) {
    case 'straight': return 12 + t * 13;
    case 'accel':    return 4  + t * 5;
    case 'chicane':  return 5  + t * 6;
    case 'hairpin':  return 7  + t * 8;
  }
}

// ── Eventos narrativos (sorte controlada e baixa) ─────────────────────

/**
 * Retorna eventos extras de corrida — largada, erros pontuais — junto com
 * o impacto em tempo. Probabilidades reduzidas e impactos capeados para
 * que eventos sejam SABOR e não decidam o resultado entre carros distantes.
 *
 * Cap total dos eventos: ±1.5s no tempo da corrida. Para corridas de 80-180s,
 * isso é ~1-2% — não consegue inverter um resultado entre carros com IGP
 * minimamente distantes.
 */
function rollRaceEvents(
  stats: PerformanceStats,
  laps: number,
  rng: () => number,
): RaceEventLog[] {
  const events: RaceEventLog[] = [];

  // ── Largada (start) — depende de gearShift + grip + tração ──
  const startBase = (stats.gearShift + stats.grip) / 2 + (TRACTION_BONUS[stats.traction] ?? 0);
  const startRoll = rng();
  // P(great_start) varia de ~3% (ruim) a ~18% (excelente)
  const greatStartProb = 0.03 + Math.min(0.15, startBase / 700);
  // P(poor_start) varia de ~10% (ruim) a ~2% (excelente)
  const poorStartProb  = Math.max(0.02, 0.12 - startBase / 700);

  if (startRoll < greatStartProb) {
    events.push({
      type:        'great_start',
      lap:         1,
      sector:      'straight',
      description: 'Largada perfeita',
      timeImpact:  -(0.2 + rng() * 0.3), // ganha 0.2-0.5s
    });
  } else if (startRoll > 1 - poorStartProb) {
    events.push({
      type:        'poor_start',
      lap:         1,
      sector:      'straight',
      description: 'Largada hesitante',
      timeImpact:  +(0.2 + rng() * 0.3), // perde 0.2-0.5s
    });
  }

  // ── Erros pontuais — probabilidade reduzida ──
  const stabilityFactor = stats.stability / 100;
  for (let lap = 1; lap <= laps; lap++) {
    const mistakeRoll = rng();
    // P varia de ~2% (carro estável) a ~6% (instável)
    const mistakeProb = 0.06 - stabilityFactor * 0.04;
    if (mistakeRoll < mistakeProb) {
      const sectors: RaceSector[] = ['accel', 'chicane', 'hairpin'];
      const sector = sectors[Math.floor(rng() * sectors.length)] ?? 'chicane';
      events.push({
        type:        'minor_mistake',
        lap,
        sector,
        description: sector === 'hairpin' ? 'Travou na frenagem' :
                     sector === 'chicane' ? 'Errou a apex' :
                                            'Patinou na saída',
        timeImpact:  +(0.1 + rng() * 0.2), // perde 0.1-0.3s
      });
    }
  }

  // ── Pace consistente: bonus para carros com stability + grip altos ──
  if (stats.stability > 75 && stats.grip > 75 && rng() < 0.25) {
    events.push({
      type:        'consistent_pace',
      description: 'Ritmo cirúrgico ao longo da corrida',
      timeImpact:  -(0.15 + rng() * 0.25), // ganha 0.15-0.4s
    });
  }

  return events;
}

/**
 * Caps o impacto agregado dos eventos para garantir que não invertam
 * resultados entre carros com diferença significativa de desempenho.
 * Limite: ±1.5s no tempo total da corrida.
 */
function capEventImpact(rawImpact: number): number {
  const MAX_IMPACT_SEC = 1.5;
  return Math.max(-MAX_IMPACT_SEC, Math.min(MAX_IMPACT_SEC, rawImpact));
}

// ── API principal ──────────────────────────────────────────────────────

/**
 * Simula uma corrida e retorna resultados ordenados por tempo.
 *
 * Distribuição típica de variabilidade:
 *   • 90%+ do resultado vem dos stats setoriais reais (determinístico).
 *   • ~5% vem de eventos de corrida (largada, erros) — calibrados pelos
 *     próprios stats do carro (carro mais estável erra menos, etc.).
 *   • ~5% vem de "luck" pura (`luckAmplitude`).
 *
 * Em valores de IGP muito próximos (diferença < 5), a aleatoriedade pode
 * decidir o vencedor — exatamente como em uma corrida real. Em IGPs muito
 * distantes (> 15), o melhor carro vence em quase 100% das simulações.
 */
export function simulateRace(
  entrants: ReadonlyArray<RaceEntrant>,
  opts: SimulateRaceOptions = {},
): RaceEntrantResult[] {
  const laps          = opts.laps          ?? 3;
  // Sorte capeada em 5%. Default 3% — resultados ficam bem alinhados ao IGP.
  const luckAmplitude = Math.max(0, Math.min(0.05, opts.luckAmplitude ?? 0.03));
  const rng           = createRng(opts.seed);

  const interim = entrants.map(e => {
    const stats     = e.stats ?? approximateStatsFromIgp(e.igp);
    const condition = e.condition ?? 100;

    // Score por setor (determinístico, baseado em stats)
    const sectorScores: Record<RaceSector, number> = {
      straight: calcSectorScore(stats, 'straight', condition),
      accel:    calcSectorScore(stats, 'accel',    condition),
      chicane:  calcSectorScore(stats, 'chicane',  condition),
      hairpin:  calcSectorScore(stats, 'hairpin',  condition),
    };

    // Tempo de uma volta sem ruído
    const lapTimeBase =
      sectorScoreToTime(sectorScores.straight, 'straight') +
      sectorScoreToTime(sectorScores.accel,    'accel') +
      sectorScoreToTime(sectorScores.chicane,  'chicane') +
      sectorScoreToTime(sectorScores.hairpin,  'hairpin');

    // Variabilidade por volta — ±1.5% por padrão, aumenta se carro mal cuidado
    const conditionFactor = 1 + (1 - condition / 100) * 0.03; // até +3% extra para carro 0%
    const lapTimes: number[] = [];
    for (let lap = 0; lap < laps; lap++) {
      const noisePerLap = (rng() - 0.5) * 0.03 * conditionFactor; // ±1.5% por volta
      lapTimes.push(lapTimeBase * (1 + noisePerLap));
    }

    // Eventos de corrida (largada + erros) — impacto em segundos, CAPEADO
    const events       = rollRaceEvents(stats, laps, rng);
    const eventTimeMod = capEventImpact(
      events.reduce((sum, ev) => sum + ev.timeImpact, 0),
    );

    // Sorte pura (luck amplitude) — afeta o tempo total
    const luckRoll = (rng() - 0.5) * 2 * luckAmplitude; // [-luckAmp, +luckAmp]

    const totalTimeBase = lapTimes.reduce((a, b) => a + b, 0);
    const totalTime     = totalTimeBase * (1 + luckRoll) + eventTimeMod;
    const bestLap       = Math.min(...lapTimes);

    return { entrant: e, stats, sectorScores, totalTime, bestLap, events, lapTimes };
  });

  // Ordena por menor tempo
  interim.sort((a, b) => a.totalTime - b.totalTime);

  // Tempo do líder serve para normalizar score em 0-100
  const fastest = interim[0]?.totalTime ?? 1;
  const slowest = interim[interim.length - 1]?.totalTime ?? fastest;
  const range   = Math.max(0.001, slowest - fastest);

  // Marca a volta mais rápida da corrida
  const overallFastestLap = Math.min(...interim.map(r => r.bestLap));
  const fastestLapHolder  = interim.find(r => r.bestLap === overallFastestLap);
  if (fastestLapHolder) {
    fastestLapHolder.events.push({
      type:        'fastest_lap',
      description: 'Volta mais rápida da corrida',
      timeImpact:  0,
    });
  }

  return interim.map((r, i) => {
    // Score: 100 para o vencedor, decai linearmente até ~50 para o último
    // Garante diferença de score visível entre 1º e último mesmo com tempos próximos.
    const relGap = (r.totalTime - fastest) / range;
    const score  = Math.round(Math.max(20, 100 - relGap * 50));

    return {
      userId:       r.entrant.userId,
      score,
      position:     i + 1,
      totalTimeSec: Math.round(r.totalTime * 100) / 100,
      bestLapSec:   Math.round(r.bestLap * 100) / 100,
      sectorScores: {
        straight: Math.round(r.sectorScores.straight),
        accel:    Math.round(r.sectorScores.accel),
        chicane:  Math.round(r.sectorScores.chicane),
        hairpin:  Math.round(r.sectorScores.hairpin),
      },
      events:       r.events,
    };
  });
}

