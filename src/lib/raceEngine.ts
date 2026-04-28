// =====================================================================
// raceEngine — Motor de simulação de corridas baseado em performance
//
// Filosofia:
//   • ~85% determinístico: tempo final é dominado pelos stats reais do carro
//     (top speed, aceleração, grip, stability, aero, gearShift) ponderados
//     por setor do circuito (reta, aceleração, chicane, hairpin).
//   • ~15% drama controlado: o motor simula volta-a-volta, com degradação
//     de pneu, slipstream, batalhas entre pilotos próximos, ultrapassagens
//     dramáticas, comebacks e variabilidade aumentada na última volta.
//     O cap absoluto de impacto evita que sorte inverta corridas com gap
//     significativo de IGP.
//   • Reaproveita os mesmos pesos setoriais usados em `calcIgp` no
//     performanceEngine — um carro com IGP 80 sempre vence em média um
//     IGP 50, mas com narrativa rica suficiente para a corrida não ser
//     previsível em IGPs próximos.
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

export type RaceEventType =
  | 'great_start'
  | 'poor_start'
  | 'minor_mistake'
  | 'consistent_pace'
  | 'fastest_lap'
  | 'overtake'
  | 'defended_position'
  | 'close_battle'
  | 'late_brake'
  | 'slipstream_pass'
  | 'tire_struggle'
  | 'hot_lap'
  | 'comeback'
  | 'lost_grip'
  | 'last_lap_attack';

export interface RaceEventLog {
  /** Tipo do evento — útil para narração. */
  type:       RaceEventType;
  /** Em qual volta aconteceu (1-N). */
  lap?:       number;
  /** Em qual setor aconteceu. */
  sector?:    RaceSector;
  /** Texto curto para exibição em log. */
  description: string;
  /** Impacto em segundos no tempo total (positivo = perdeu tempo, negativo = ganhou). */
  timeImpact: number;
  /** Para eventos de batalha: userId do oponente envolvido. */
  opponentUserId?: string;
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
   * Magnitude máxima de variabilidade aleatória final (0..0.10). Default 0.04 (4%).
   * Mantida baixa por design: o resultado deve refletir o desempenho real do
   * carro, não da sorte. Valores acima de 0.06 começam a inverter resultados
   * em IGPs próximos.
   */
  luckAmplitude?: number;
}

// ── Constantes de simulação ───────────────────────────────────────────

/**
 * Pesos por setor — quais stats importam mais em cada parte do circuito.
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

/** Bônus por tipo de tração (idêntico ao do performanceEngine). */
const TRACTION_BONUS: Record<NonNullable<PerformanceStats['traction']>, number> = {
  AWD: 3.5,
  RWD: 1.5,
  FWD: 0,
};

/**
 * Cap absoluto de impacto agregado de eventos por piloto. Garante que
 * mesmo um carro azarado (várias largadas ruins, erros, perdas em batalha)
 * não tenha mais que ±2.5s de "drama" sobre o tempo determinístico.
 *
 * Calibração: para corridas de 80-180s, isso é 1.5-3% — não inverte
 * resultados entre carros com gap de IGP > 8.
 */
const MAX_TOTAL_EVENT_IMPACT_SEC = 2.5;

// ── Helpers ────────────────────────────────────────────────────────────

/** PRNG seedável (mulberry32) para reprodutibilidade. */
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
    weight:       50,
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
  if (totalW > 0) raw /= totalW;

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
 * Calibrado para volta de 2000m em circuito misto.
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

// ── Estado interno por piloto durante simulação volta-a-volta ──────────

interface DriverState {
  entrant:        RaceEntrant;
  stats:          PerformanceStats;
  condition:      number;
  baseLapTime:    number;
  sectorScores:   Record<RaceSector, number>;
  /** Tempo acumulado desde a largada (segundos). */
  totalTime:      number;
  /** Tempos individuais de cada volta. */
  lapTimes:       number[];
  /** Eventos narrativos coletados. */
  events:         RaceEventLog[];
  /** Posição na largada (1 = pole). Definida após primeira volta. */
  startingPos:    number;
  /** Posição corrente — recalculada após cada volta. */
  currentPos:     number;
  /** "Estilo" — estilo que o piloto/carro atacou nesta corrida. Influencia eventos. */
  aggression:     number; // 0-1
}

/**
 * Calcula coeficiente de degradação de pneu por volta. Carros com grip
 * baixo degradam mais rápido. Ajustado para somar até ~3-5% nas últimas
 * voltas de uma corrida de 3 voltas.
 */
function tireDegradationPerLap(stats: PerformanceStats, lap: number, totalLaps: number): number {
  // Carros com grip alto degradam menos. Grip 100 = 0.5% por volta cumulativo;
  // Grip 0 = 1.5% por volta.
  const baseDegradation = 0.015 - (stats.grip / 100) * 0.010; // 0.005-0.015
  // Aumenta progressivamente — pneus piores no fim
  const lapFactor = lap / Math.max(1, totalLaps); // 0..1 ao longo da corrida
  return baseDegradation * lapFactor;
}

/**
 * Aceleração extra nas últimas voltas por causa do consumo de combustível.
 * Carros mais pesados se beneficiam mais (perdem mais peso relativo).
 */
function fuelSaveBonusPerLap(stats: PerformanceStats, lap: number, totalLaps: number): number {
  // Carro pesado (peso=80) ganha até 0.8% por volta no fim; leve (peso=20) ganha 0.3%.
  const baseBenefit = 0.003 + (stats.weight / 100) * 0.005; // 0.003-0.008
  const lapFactor = lap / Math.max(1, totalLaps);
  return baseBenefit * lapFactor;
}

// ── Eventos individuais (largada e variações por volta) ────────────────

function rollStartEvent(stats: PerformanceStats, rng: () => number): RaceEventLog | null {
  const startBase = (stats.gearShift + stats.grip) / 2 + (TRACTION_BONUS[stats.traction] ?? 0);
  const startRoll = rng();
  const greatStartProb = 0.04 + Math.min(0.18, startBase / 600);
  const poorStartProb  = Math.max(0.02, 0.14 - startBase / 600);

  if (startRoll < greatStartProb) {
    return {
      type: 'great_start',
      lap: 1,
      sector: 'straight',
      description: 'Largada perfeita',
      timeImpact: -(0.3 + rng() * 0.4),
    };
  }
  if (startRoll > 1 - poorStartProb) {
    return {
      type: 'poor_start',
      lap: 1,
      sector: 'straight',
      description: 'Largada hesitante',
      timeImpact: +(0.3 + rng() * 0.4),
    };
  }
  return null;
}

function rollPerLapEvent(
  stats: PerformanceStats,
  lap: number,
  totalLaps: number,
  isLastLap: boolean,
  rng: () => number,
): RaceEventLog | null {
  const stabilityFactor = stats.stability / 100;
  const gripFactor      = stats.grip / 100;

  // Probabilidade baseline de evento por volta — ~15-20% (cria ritmo narrativo)
  const eventRoll = rng();
  if (eventRoll > 0.20) return null;

  // Decide o TIPO de evento. Última volta tem distribuição diferente:
  // mais "last_lap_attack" e "hot_lap", menos erros bobos.
  const typeRoll = rng();

  // ── ÚLTIMA VOLTA: drama crescente ──
  if (isLastLap) {
    if (typeRoll < 0.35) {
      // Last lap attack: carro empurra o limite, ganha tempo se conseguir
      const success = rng() < (0.5 + gripFactor * 0.3);
      return success ? {
        type: 'last_lap_attack',
        lap,
        description: 'Atacou no limite na última volta',
        timeImpact: -(0.4 + rng() * 0.5),
      } : {
        type: 'lost_grip',
        lap,
        sector: rng() < 0.5 ? 'chicane' : 'hairpin',
        description: 'Tentou atacar e perdeu o controle',
        timeImpact: +(0.5 + rng() * 0.6),
      };
    }
    if (typeRoll < 0.60 && stats.power > 60) {
      return {
        type: 'hot_lap',
        lap,
        description: 'Volta excepcional, tudo perfeito',
        timeImpact: -(0.4 + rng() * 0.4),
      };
    }
    // Erro pontual mais raro na última volta
    if (typeRoll < 0.70) {
      const sectors: RaceSector[] = ['accel', 'chicane', 'hairpin'];
      const sector = sectors[Math.floor(rng() * sectors.length)] ?? 'chicane';
      return {
        type: 'minor_mistake',
        lap,
        sector,
        description: sector === 'hairpin' ? 'Travou na frenagem'
                   : sector === 'chicane' ? 'Errou a apex'
                   :                        'Patinou na saída',
        timeImpact: +(0.2 + rng() * 0.3),
      };
    }
    return null;
  }

  // ── VOLTAS NORMAIS ──
  if (typeRoll < 0.40) {
    // Erro pontual — mais provável em carros instáveis
    const mistakeProb = 0.06 - stabilityFactor * 0.04;
    if (rng() < mistakeProb) {
      const sectors: RaceSector[] = ['accel', 'chicane', 'hairpin'];
      const sector = sectors[Math.floor(rng() * sectors.length)] ?? 'chicane';
      return {
        type: 'minor_mistake',
        lap,
        sector,
        description: sector === 'hairpin' ? 'Travou na frenagem'
                   : sector === 'chicane' ? 'Errou a apex'
                   :                        'Patinou na saída',
        timeImpact: +(0.15 + rng() * 0.25),
      };
    }
  }

  if (typeRoll < 0.65 && stats.stability > 70 && stats.grip > 70) {
    return {
      type: 'consistent_pace',
      lap,
      description: 'Mantém ritmo cirúrgico',
      timeImpact: -(0.15 + rng() * 0.20),
    };
  }

  if (typeRoll < 0.78 && stats.acceleration > 75) {
    return {
      type: 'late_brake',
      lap,
      sector: 'hairpin',
      description: 'Frenagem ousada na curva',
      timeImpact: -(0.15 + rng() * 0.25),
    };
  }

  // Nas voltas finais (não a última), pode ter problemas de pneu
  if (lap >= totalLaps - 1 && stats.grip < 70 && rng() < 0.4) {
    return {
      type: 'tire_struggle',
      lap,
      description: 'Pneus desgastados, perdendo grip',
      timeImpact: +(0.2 + rng() * 0.3),
    };
  }

  return null;
}

// ── Eventos de batalha entre pilotos próximos ───────────────────────────

/**
 * Detecta pilotos com tempos próximos numa volta e gera eventos de batalha
 * (ultrapassagens, defesas). Modifica os tempos para criar drama coerente.
 */
function rollBattleEvents(
  drivers: DriverState[],
  lap: number,
  isLastLap: boolean,
  rng: () => number,
): void {
  // Ordena por tempo acumulado (corrida atual)
  const ordered = [...drivers].sort((a, b) => a.totalTime - b.totalTime);

  for (let i = 0; i < ordered.length - 1; i++) {
    const ahead = ordered[i];
    const behind = ordered[i + 1];
    if (!ahead || !behind) continue;

    const gap = behind.totalTime - ahead.totalTime;
    // Considera "batalha" gap < 1.2s (próximos)
    if (gap > 1.2) continue;

    // Probabilidade de evento de batalha aumenta com proximidade
    // gap=0.0 → 50% chance, gap=1.2 → 0%
    const battleProb = (1.2 - gap) / 1.2 * (isLastLap ? 0.65 : 0.4);
    if (rng() > battleProb) continue;

    const aheadStats = ahead.stats;
    const behindStats = behind.stats;

    // Quem tem stats melhor para ataque (acceleration + power)?
    const behindAttackPower = behindStats.acceleration * 0.5 + behindStats.power * 0.3 + (TRACTION_BONUS[behindStats.traction] ?? 0);
    const aheadDefense      = aheadStats.stability * 0.4 + aheadStats.grip * 0.4 + aheadStats.gearShift * 0.2;

    // Slipstream: carro de trás ganha bonus na próxima reta se vem rebocado
    if (gap < 0.4 && rng() < 0.5) {
      const slipBonus = -(0.15 + rng() * 0.30);
      behind.totalTime += slipBonus;
      behind.events.push({
        type: 'slipstream_pass',
        lap,
        sector: 'straight',
        description: `Pegou vácuo de ${ahead.entrant.userId === behind.entrant.userId ? 'rival' : 'frente'}`,
        timeImpact: slipBonus,
        opponentUserId: ahead.entrant.userId,
      });
      continue;
    }

    // Decide se é ultrapassagem bem-sucedida ou defesa
    const attackRoll = rng();
    const successThreshold = 0.5 + (behindAttackPower - aheadDefense) / 200;

    if (attackRoll < successThreshold) {
      // ── ULTRAPASSAGEM bem-sucedida ──
      const overtakeGain = 0.3 + rng() * 0.5;
      behind.totalTime -= overtakeGain * 0.5;
      ahead.totalTime  += overtakeGain * 0.3;
      behind.events.push({
        type: 'overtake',
        lap,
        sector: rng() < 0.5 ? 'straight' : 'hairpin',
        description: 'Ultrapassagem afiada',
        timeImpact: -(overtakeGain * 0.5),
        opponentUserId: ahead.entrant.userId,
      });
      ahead.events.push({
        type: 'lost_grip',
        lap,
        description: 'Perdeu posição na disputa',
        timeImpact: +(overtakeGain * 0.3),
        opponentUserId: behind.entrant.userId,
      });
    } else {
      // ── DEFESA bem-sucedida ──
      const defenseLoss = 0.15 + rng() * 0.30;
      behind.totalTime += defenseLoss;
      ahead.events.push({
        type: 'defended_position',
        lap,
        sector: rng() < 0.5 ? 'chicane' : 'hairpin',
        description: 'Defendeu a posição com classe',
        timeImpact: -(defenseLoss * 0.2),
        opponentUserId: behind.entrant.userId,
      });
      behind.events.push({
        type: 'close_battle',
        lap,
        description: 'Disputou ferozmente, sem sucesso',
        timeImpact: +defenseLoss,
        opponentUserId: ahead.entrant.userId,
      });
    }
  }
}

// ── Caps e ajustes finais ──────────────────────────────────────────────

/**
 * Aplica cap ao impacto agregado de eventos de UM piloto. Mantém drama
 * mas evita inversão de resultado para diferenças grandes de IGP.
 */
function capDriverEventImpact(driver: DriverState): void {
  const totalImpact = driver.events.reduce((sum, ev) => sum + ev.timeImpact, 0);
  if (Math.abs(totalImpact) <= MAX_TOTAL_EVENT_IMPACT_SEC) return;

  const ratio = MAX_TOTAL_EVENT_IMPACT_SEC / Math.abs(totalImpact);
  // Reduz proporcionalmente o impacto de cada evento
  for (const ev of driver.events) {
    ev.timeImpact *= ratio;
  }
  // Recalcula `totalTime` ajustado
  const newTotalImpact = driver.events.reduce((sum, ev) => sum + ev.timeImpact, 0);
  driver.totalTime += (newTotalImpact - totalImpact);
}

// ── API principal ──────────────────────────────────────────────────────

/**
 * Simula uma corrida volta-a-volta e retorna resultados ordenados por tempo.
 *
 * Mecânicas implementadas:
 *   • Stats setoriais (reta, aceleração, chicane, hairpin) — base do tempo
 *   • Degradação de pneus progressiva (carros sem grip degradam mais)
 *   • Economia de combustível (carros pesados ganham mais nas últimas voltas)
 *   • Eventos por volta: erros, paces consistentes, late brakings, hot laps
 *   • Eventos de batalha entre pilotos próximos (gap < 1.2s):
 *     - Slipstream/vácuo na reta
 *     - Ultrapassagens com base em acceleration vs stability
 *     - Defesas bem-sucedidas
 *   • Drama crescente na última volta (ataques arriscados, voltas perfeitas)
 *   • Detecção de comebacks (ganhou várias posições)
 *   • Cap absoluto de ±2.5s em impacto de eventos por piloto
 */
export function simulateRace(
  entrants: ReadonlyArray<RaceEntrant>,
  opts: SimulateRaceOptions = {},
): RaceEntrantResult[] {
  const laps          = opts.laps          ?? 3;
  const luckAmplitude = Math.max(0, Math.min(0.06, opts.luckAmplitude ?? 0.04));
  const rng           = createRng(opts.seed);

  // ── Setup inicial dos pilotos ────────────────────────────────────
  const drivers: DriverState[] = entrants.map(e => {
    const stats     = e.stats ?? approximateStatsFromIgp(e.igp);
    const condition = e.condition ?? 100;
    const sectorScores: Record<RaceSector, number> = {
      straight: calcSectorScore(stats, 'straight', condition),
      accel:    calcSectorScore(stats, 'accel',    condition),
      chicane:  calcSectorScore(stats, 'chicane',  condition),
      hairpin:  calcSectorScore(stats, 'hairpin',  condition),
    };
    const baseLapTime =
      sectorScoreToTime(sectorScores.straight, 'straight') +
      sectorScoreToTime(sectorScores.accel,    'accel') +
      sectorScoreToTime(sectorScores.chicane,  'chicane') +
      sectorScoreToTime(sectorScores.hairpin,  'hairpin');

    // Aggression: carros com mais power+acceleration tendem a atacar mais
    const aggression = (stats.power + stats.acceleration) / 200; // 0..1

    return {
      entrant: e,
      stats,
      condition,
      baseLapTime,
      sectorScores,
      totalTime: 0,
      lapTimes: [],
      events: [],
      startingPos: 0,
      currentPos: 0,
      aggression,
    };
  });

  // ── Largada (definir posição inicial e gerar evento de start) ────
  // Posição de largada baseada em IGP — simula resultado de classificação
  const sortedByIgp = [...drivers].sort((a, b) => b.stats.igp - a.stats.igp);
  sortedByIgp.forEach((d, i) => {
    d.startingPos = i + 1;
    d.currentPos = i + 1;
    const startEv = rollStartEvent(d.stats, rng);
    if (startEv) {
      d.events.push(startEv);
      d.totalTime += startEv.timeImpact;
    }
  });

  // ── Simulação volta-a-volta ──────────────────────────────────────
  for (let lap = 1; lap <= laps; lap++) {
    const isLastLap = lap === laps;

    // 1. Cada piloto roda sua volta
    for (const d of drivers) {
      // Tempo base + degradação + bonus combustível
      const degradation = tireDegradationPerLap(d.stats, lap, laps);
      const fuelBonus   = fuelSaveBonusPerLap(d.stats, lap, laps);
      const noisePerLap = (rng() - 0.5) * 0.025; // ±1.25% por volta
      const lastLapDrama = isLastLap ? (rng() - 0.5) * 0.025 : 0; // extra ±1.25% na última

      const lapTime = d.baseLapTime * (1 + degradation - fuelBonus + noisePerLap + lastLapDrama);
      d.lapTimes.push(lapTime);
      d.totalTime += lapTime;
    }

    // 2. Eventos por volta (erros, hot laps, late brakings)
    for (const d of drivers) {
      const ev = rollPerLapEvent(d.stats, lap, laps, isLastLap, rng);
      if (ev) {
        d.events.push(ev);
        d.totalTime += ev.timeImpact;
      }
    }

    // 3. Eventos de batalha entre pilotos próximos
    rollBattleEvents(drivers, lap, isLastLap, rng);

    // 4. Atualiza posição corrente
    const orderedNow = [...drivers].sort((a, b) => a.totalTime - b.totalTime);
    orderedNow.forEach((d, i) => { d.currentPos = i + 1; });
  }

  // ── Sorte pura final (luck amplitude) — pequena variação no tempo ──
  for (const d of drivers) {
    const luckRoll = (rng() - 0.5) * 2 * luckAmplitude;
    d.totalTime *= (1 + luckRoll * 0.5); // metade do luck amplitude no tempo total
  }

  // ── Caps e detecção de comebacks ──────────────────────────────────
  for (const d of drivers) {
    capDriverEventImpact(d);

    const positionsGained = d.startingPos - d.currentPos;
    if (positionsGained >= 2) {
      d.events.push({
        type: 'comeback',
        description: `Recuperou ${positionsGained} posições`,
        timeImpact: 0,
      });
    }
  }

  // ── Ordenação final + volta mais rápida ───────────────────────────
  drivers.sort((a, b) => a.totalTime - b.totalTime);

  const fastestLapDriver = drivers.reduce((best, d) => {
    const bestLap = Math.min(...d.lapTimes);
    if (!best || bestLap < best.bestLap) return { driver: d, bestLap };
    return best;
  }, null as { driver: DriverState; bestLap: number } | null);

  if (fastestLapDriver) {
    fastestLapDriver.driver.events.push({
      type: 'fastest_lap',
      description: 'Volta mais rápida da corrida',
      timeImpact: 0,
    });
  }

  // ── Score 0-100 normalizado para compatibilidade com UI ───────────
  const fastest = drivers[0]?.totalTime ?? 1;
  const slowest = drivers[drivers.length - 1]?.totalTime ?? fastest;
  const range   = Math.max(0.001, slowest - fastest);

  return drivers.map((d, i) => {
    const relGap = (d.totalTime - fastest) / range;
    const score  = Math.round(Math.max(20, 100 - relGap * 50));
    const bestLap = Math.min(...d.lapTimes);

    return {
      userId:       d.entrant.userId,
      score,
      position:     i + 1,
      totalTimeSec: Math.round(d.totalTime * 100) / 100,
      bestLapSec:   Math.round(bestLap * 100) / 100,
      sectorScores: {
        straight: Math.round(d.sectorScores.straight),
        accel:    Math.round(d.sectorScores.accel),
        chicane:  Math.round(d.sectorScores.chicane),
        hairpin:  Math.round(d.sectorScores.hairpin),
      },
      events:       d.events,
    };
  });
}
