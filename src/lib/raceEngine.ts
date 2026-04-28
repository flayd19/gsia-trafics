// =====================================================================
// raceEngine — Motor de simulação de corridas baseado em performance
//
// Filosofia:
//   • ~85% determinístico: tempo final é dominado pelos stats reais do carro
//     (top speed, aceleração, grip, stability, aero, gearShift) ponderados
//     por setor do circuito (reta, aceleração, chicane, hairpin).
//   • ~15% drama controlado: simulação volta-a-volta com degradação de pneu,
//     economia de combustível, slipstream cumulativo, batalhas cabeça-a-cabeça,
//     ultrapassagens, defesas, erros em cascata, redemption, underdog moments,
//     pole advantage e drama crescente na última volta. Cap absoluto de
//     impacto evita que sorte inverta corridas com gap significativo de IGP.
//
// Determinismo:
//   • Ao receber `seed`, o resultado é estável e reprodutível em qualquer
//     cliente (multiplayer).
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
  | 'pole_advantage'
  | 'minor_mistake'
  | 'cascading_error'
  | 'redemption'
  | 'consistent_pace'
  | 'fastest_lap'
  | 'overtake'
  | 'position_lost'
  | 'defended_position'
  | 'close_battle'
  | 'side_by_side'
  | 'late_brake'
  | 'slipstream_pass'
  | 'big_slipstream'
  | 'tire_struggle'
  | 'hot_lap'
  | 'comeback'
  | 'late_comeback'
  | 'underdog'
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
  /** Score 0-100 final. */
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
   * Magnitude máxima de variabilidade aleatória final (0..0.06). Default 0.04 (4%).
   * Mantida baixa por design — o resultado deve refletir desempenho real.
   */
  luckAmplitude?: number;
}

// ── Constantes ───────────────────────────────────────────────────────

const SECTOR_WEIGHTS: Record<RaceSector, Partial<Record<keyof PerformanceStats, number>>> = {
  straight: { topSpeed: 0.55, power: 0.30, aerodynamics: 0.15 },
  accel:    { acceleration: 0.50, torque: 0.30, gearShift: 0.20 },
  chicane:  { aerodynamics: 0.30, grip: 0.35, gearShift: 0.20, stability: 0.15 },
  hairpin:  { grip: 0.45, stability: 0.30, torque: 0.25 },
};

const TRACTION_BONUS: Record<NonNullable<PerformanceStats['traction']>, number> = {
  AWD: 3.5, RWD: 1.5, FWD: 0,
};

/** Cap absoluto de impacto agregado de eventos por piloto (segundos). */
const MAX_TOTAL_EVENT_IMPACT_SEC = 2.5;

/** Gap máximo (s) considerado para batalhas/slipstream. */
const BATTLE_GAP_THRESHOLD = 1.2;
/** Gap máximo (s) para pegar vácuo. */
const SLIPSTREAM_GAP_THRESHOLD = 0.4;
/** Gap máximo (s) para evento "side-by-side". */
const SIDE_BY_SIDE_GAP = 0.2;

// ── Helpers ──────────────────────────────────────────────────────────

/** PRNG seedável (mulberry32). */
function createRng(seed: string | undefined): () => number {
  if (!seed) return Math.random;
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

function approximateStatsFromIgp(igp: number): PerformanceStats {
  const v = Math.max(1, Math.min(99, igp));
  return {
    topSpeed: v, acceleration: v, power: v, torque: v, weight: 50,
    aerodynamics: v, stability: v, grip: v, gearShift: v, traction: 'RWD',
    _hp: 0, _torqueNm: 0, _weightKg: 1300, _0to100: 0, _topSpeedKmh: 0,
    _hasTurbo: false, _engineType: '', igp: v,
  };
}

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
  const weightPenalty = sector === 'straight' ? 0
    : sector === 'accel'   ? (stats.weight / 100) * 0.10
    : sector === 'hairpin' ? (stats.weight / 100) * 0.12
    :                        (stats.weight / 100) * 0.08;
  const condFactor = 0.73 + (Math.max(0, Math.min(100, condition)) / 100) * 0.27;
  return Math.max(0, Math.min(100, raw * (1 - weightPenalty) * condFactor));
}

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

// ── Estado interno por piloto ─────────────────────────────────────────

interface DriverState {
  entrant:        RaceEntrant;
  stats:          PerformanceStats;
  condition:      number;
  baseLapTime:    number;
  sectorScores:   Record<RaceSector, number>;
  totalTime:      number;
  lapTimes:       number[];
  events:         RaceEventLog[];
  startingPos:    number;
  /** Posição ao final de cada volta — index 0 = depois da volta 1. */
  positionAtLap:  number[];
  currentPos:     number;
  aggression:     number;
  /** Quantas voltas seguidas pegando vácuo do mesmo oponente. */
  slipstreamStreak: Map<string, number>;
  /** Voltou com erro na última? Aumenta chance de novo erro / redemption. */
  errorStreak:    number;
  /** Curtiu redemption nesta corrida? Bloqueia múltiplos. */
  hadRedemption:  boolean;
}

// ── Cálculos de evolução por volta ────────────────────────────────────

/**
 * BUG FIX: lapFactor agora começa em 0 na volta 1 (era 1/N). Antes a volta 1
 * já tinha 33% da degradação aplicada em corrida de 3 voltas.
 *
 * Carros com grip alto degradam menos. Grip 100 = 0.5% por volta cumulativo;
 * Grip 0 = 1.5% por volta. Aplica progressivamente: volta 1 = 0%, volta N = max.
 */
function tireDegradationAtLap(stats: PerformanceStats, lap: number, totalLaps: number): number {
  const baseDegradation = 0.015 - (stats.grip / 100) * 0.010;
  const lapFactor = (lap - 1) / Math.max(1, totalLaps - 1); // 0..1
  return baseDegradation * lapFactor;
}

/**
 * BUG FIX: também começa em 0 na volta 1.
 *
 * Aceleração extra nas últimas voltas pelo consumo de combustível.
 * Carros pesados se beneficiam mais (perdem mais peso relativo).
 */
function fuelSaveBonusAtLap(stats: PerformanceStats, lap: number, totalLaps: number): number {
  const baseBenefit = 0.003 + (stats.weight / 100) * 0.005;
  const lapFactor = (lap - 1) / Math.max(1, totalLaps - 1);
  return baseBenefit * lapFactor;
}

// ── Eventos individuais ──────────────────────────────────────────────

function rollStartEvent(stats: PerformanceStats, rng: () => number): RaceEventLog | null {
  const startBase = (stats.gearShift + stats.grip) / 2 + (TRACTION_BONUS[stats.traction] ?? 0);
  const startRoll = rng();
  const greatStartProb = 0.04 + Math.min(0.18, startBase / 600);
  const poorStartProb  = Math.max(0.02, 0.14 - startBase / 600);

  if (startRoll < greatStartProb) {
    return {
      type: 'great_start', lap: 1, sector: 'straight',
      description: 'Largada perfeita',
      timeImpact: -(0.3 + rng() * 0.4),
    };
  }
  if (startRoll > 1 - poorStartProb) {
    return {
      type: 'poor_start', lap: 1, sector: 'straight',
      description: 'Largada hesitante',
      timeImpact: +(0.3 + rng() * 0.4),
    };
  }
  return null;
}

function rollPerLapEvent(
  driver: DriverState,
  lap: number,
  totalLaps: number,
  isLastLap: boolean,
  rng: () => number,
): RaceEventLog | null {
  const stats = driver.stats;
  const stabilityFactor = stats.stability / 100;
  const gripFactor      = stats.grip / 100;

  // Erro em cascata: se errou na volta anterior, +50% chance de erro
  const recentlyMissed = driver.errorStreak > 0;

  // Probabilidade baseline de evento por volta — ~22%
  const eventRoll = rng();
  if (eventRoll > 0.22) return null;

  const typeRoll = rng();

  // ── ÚLTIMA VOLTA: drama crescente ──
  if (isLastLap) {
    if (typeRoll < 0.38) {
      // Last lap attack
      const success = rng() < (0.55 + gripFactor * 0.30);
      return success ? {
        type: 'last_lap_attack', lap,
        description: 'Atacou no limite na última volta',
        timeImpact: -(0.4 + rng() * 0.5),
      } : {
        type: 'lost_grip', lap,
        sector: rng() < 0.5 ? 'chicane' : 'hairpin',
        description: 'Tentou atacar e perdeu o controle',
        timeImpact: +(0.5 + rng() * 0.6),
      };
    }
    if (typeRoll < 0.65 && stats.power > 60) {
      return {
        type: 'hot_lap', lap,
        description: 'Volta excepcional, tudo perfeito',
        timeImpact: -(0.4 + rng() * 0.4),
      };
    }
    return null;
  }

  // ── VOLTAS NORMAIS ──

  // Redemption: depois de erro, chance de "voltar bem"
  if (recentlyMissed && !driver.hadRedemption && rng() < 0.35) {
    driver.hadRedemption = true;
    return {
      type: 'redemption', lap,
      description: 'Recuperou após erro com volta forte',
      timeImpact: -(0.25 + rng() * 0.35),
    };
  }

  // Erro pontual (com bonus se já está em cascade)
  if (typeRoll < 0.42) {
    const baseProb = 0.06 - stabilityFactor * 0.04;
    const mistakeProb = recentlyMissed ? baseProb * 1.5 : baseProb;
    if (rng() < mistakeProb) {
      const sectors: RaceSector[] = ['accel', 'chicane', 'hairpin'];
      const sector = sectors[Math.floor(rng() * sectors.length)] ?? 'chicane';
      const isCascade = recentlyMissed;
      return {
        type: isCascade ? 'cascading_error' : 'minor_mistake',
        lap, sector,
        description: isCascade
          ? 'Erro em sequência, perdeu confiança'
          : sector === 'hairpin' ? 'Travou na frenagem'
          : sector === 'chicane' ? 'Errou a apex'
          :                        'Patinou na saída',
        timeImpact: +(isCascade ? 0.25 + rng() * 0.30 : 0.15 + rng() * 0.25),
      };
    }
  }

  if (typeRoll < 0.60 && stats.stability > 70 && stats.grip > 70) {
    return {
      type: 'consistent_pace', lap,
      description: 'Mantém ritmo cirúrgico',
      timeImpact: -(0.15 + rng() * 0.20),
    };
  }

  if (typeRoll < 0.74 && stats.acceleration > 75) {
    return {
      type: 'late_brake', lap, sector: 'hairpin',
      description: 'Frenagem ousada na curva',
      timeImpact: -(0.15 + rng() * 0.25),
    };
  }

  // Voltas finais (não a última) com grip baixo: tire struggle
  if (lap >= totalLaps - 1 && stats.grip < 70 && rng() < 0.40) {
    return {
      type: 'tire_struggle', lap,
      description: 'Pneus desgastados, perdendo grip',
      timeImpact: +(0.2 + rng() * 0.3),
    };
  }

  return null;
}

// ── Eventos de batalha entre pilotos próximos ───────────────────────────

/**
 * BUG FIX: re-ordena os pilotos APÓS cada modificação de tempo, garantindo
 * que comparações sequenciais usem estado consistente.
 *
 * BUG FIX: descrição do slipstream agora referencia o oponente diretamente,
 * removendo o ternário sem sentido (`ahead === behind` nunca é true).
 *
 * BUG FIX: substituído `lost_grip` por `position_lost` quando piloto à frente
 * é ultrapassado — semanticamente correto.
 */
function rollBattleEvents(
  drivers: DriverState[],
  lap: number,
  isLastLap: boolean,
  rng: () => number,
): void {
  // Coleta IDs e processa pares na ordem corrente, re-ordenando após cada evento
  const processedPairs = new Set<string>();
  // Limite de eventos de batalha por volta para evitar drama exagerado
  let battlesThisLap = 0;
  const maxBattlesPerLap = Math.max(1, Math.floor(drivers.length / 2));

  // Iteração — até `drivers.length` tentativas (pega múltiplas batalhas)
  for (let attempt = 0; attempt < drivers.length && battlesThisLap < maxBattlesPerLap; attempt++) {
    // Re-ordena a cada iteração para refletir mudanças
    const ordered = [...drivers].sort((a, b) => a.totalTime - b.totalTime);

    let foundBattle = false;
    for (let i = 0; i < ordered.length - 1; i++) {
      const ahead  = ordered[i];
      const behind = ordered[i + 1];
      if (!ahead || !behind) continue;

      const pairKey = `${ahead.entrant.userId}|${behind.entrant.userId}|${attempt}`;
      if (processedPairs.has(pairKey)) continue;

      const gap = behind.totalTime - ahead.totalTime;
      if (gap > BATTLE_GAP_THRESHOLD) continue;

      // Probabilidade de evento de batalha aumenta com proximidade
      const battleProb = (BATTLE_GAP_THRESHOLD - gap) / BATTLE_GAP_THRESHOLD * (isLastLap ? 0.70 : 0.45);
      if (rng() > battleProb) continue;

      processedPairs.add(pairKey);
      foundBattle = true;
      battlesThisLap++;

      const aheadStats   = ahead.stats;
      const behindStats  = behind.stats;
      const opponentName = ahead.entrant.userId; // ID — UI traduz pelo nome

      // ── SIDE-BY-SIDE: gap muito pequeno, só drama, sem mudar posição ──
      if (gap < SIDE_BY_SIDE_GAP && rng() < 0.55) {
        ahead.events.push({
          type: 'side_by_side', lap,
          description: 'Briga lado a lado, sem ceder',
          timeImpact: 0,
          opponentUserId: behind.entrant.userId,
        });
        behind.events.push({
          type: 'side_by_side', lap,
          description: 'Briga lado a lado, sem ceder',
          timeImpact: 0,
          opponentUserId: opponentName,
        });
        break; // próxima iteração re-ordena
      }

      // ── SLIPSTREAM (vácuo) ──
      if (gap < SLIPSTREAM_GAP_THRESHOLD) {
        const streakKey = ahead.entrant.userId;
        const prevStreak = behind.slipstreamStreak.get(streakKey) ?? 0;
        const newStreak  = prevStreak + 1;
        behind.slipstreamStreak.set(streakKey, newStreak);

        // Slipstream cumulativo: 2+ voltas seguidas = bonus dobrado
        if (newStreak >= 2 && rng() < 0.50) {
          const slipBonus = -(0.30 + rng() * 0.40);
          behind.totalTime += slipBonus;
          behind.events.push({
            type: 'big_slipstream', lap, sector: 'straight',
            description: 'Pegou vácuo prolongado e escapou',
            timeImpact: slipBonus,
            opponentUserId: opponentName,
          });
          break;
        }

        if (rng() < 0.55) {
          const slipBonus = -(0.15 + rng() * 0.25);
          behind.totalTime += slipBonus;
          behind.events.push({
            type: 'slipstream_pass', lap, sector: 'straight',
            description: 'Pegou o vácuo na reta',
            timeImpact: slipBonus,
            opponentUserId: opponentName,
          });
          break;
        }
      } else {
        // Reset streak: gap aumentou
        behind.slipstreamStreak.set(ahead.entrant.userId, 0);
      }

      // ── DUELO: ultrapassagem ou defesa ──
      const behindAttackPower = behindStats.acceleration * 0.5
        + behindStats.power * 0.3
        + (TRACTION_BONUS[behindStats.traction] ?? 0);
      const aheadDefense = aheadStats.stability * 0.4
        + aheadStats.grip * 0.4
        + aheadStats.gearShift * 0.2;

      const successThreshold = 0.50 + (behindAttackPower - aheadDefense) / 200;
      const attackRoll = rng();

      if (attackRoll < successThreshold) {
        // ── ULTRAPASSAGEM ──
        const overtakeGain = 0.30 + rng() * 0.50;
        behind.totalTime -= overtakeGain * 0.5;
        ahead.totalTime  += overtakeGain * 0.3;
        const sector: RaceSector = rng() < 0.45 ? 'straight'
                                 : rng() < 0.55 ? 'hairpin' : 'chicane';
        behind.events.push({
          type: 'overtake', lap, sector,
          description: sector === 'hairpin' ? 'Mergulhou por dentro na frenagem'
                     : sector === 'chicane' ? 'Forçou pelo exterior na sequência'
                     :                        'Ultrapassagem afiada na reta',
          timeImpact: -(overtakeGain * 0.5),
          opponentUserId: opponentName,
        });
        ahead.events.push({
          type: 'position_lost', lap, sector,
          description: 'Cedeu a posição na disputa',
          timeImpact: +(overtakeGain * 0.3),
          opponentUserId: behind.entrant.userId,
        });
      } else {
        // ── DEFESA ──
        const defenseLoss = 0.15 + rng() * 0.30;
        behind.totalTime += defenseLoss;
        const sector: RaceSector = rng() < 0.5 ? 'chicane' : 'hairpin';
        ahead.events.push({
          type: 'defended_position', lap, sector,
          description: 'Defendeu a posição com classe',
          timeImpact: -(defenseLoss * 0.2),
          opponentUserId: behind.entrant.userId,
        });
        behind.events.push({
          type: 'close_battle', lap,
          description: 'Disputou ferozmente, sem sucesso',
          timeImpact: +defenseLoss,
          opponentUserId: opponentName,
        });
      }

      break; // re-ordena na próxima iteração
    }

    if (!foundBattle) break;
  }
}

// ── Caps e ajustes finais ──────────────────────────────────────────────

/**
 * Aplica cap ao impacto agregado de eventos de UM piloto. Se passar de
 * ±2.5s, escala TODOS os eventos proporcionalmente para caber no cap.
 */
function capDriverEventImpact(driver: DriverState): void {
  const totalImpact = driver.events.reduce((sum, ev) => sum + ev.timeImpact, 0);
  if (Math.abs(totalImpact) <= MAX_TOTAL_EVENT_IMPACT_SEC) return;

  const ratio = MAX_TOTAL_EVENT_IMPACT_SEC / Math.abs(totalImpact);
  for (const ev of driver.events) {
    ev.timeImpact *= ratio;
  }
  const newTotalImpact = driver.events.reduce((sum, ev) => sum + ev.timeImpact, 0);
  driver.totalTime += (newTotalImpact - totalImpact);
}

// ── API principal ──────────────────────────────────────────────────────

/**
 * Simula uma corrida volta-a-volta com mecânica rica e drama coerente.
 *
 * Mecânicas implementadas:
 *   • Stats setoriais (reta, aceleração, chicane, hairpin) — base do tempo
 *   • Degradação de pneus progressiva (carros sem grip degradam mais)
 *   • Economia de combustível (carros pesados ganham mais nas últimas voltas)
 *   • Pole position advantage — quem larga em P1 ganha pequeno bonus
 *   • Eventos por volta: erros, paces consistentes, late brakings, hot laps
 *   • Erros em cascata (errou na volta passada → +50% chance na próxima)
 *   • Redemption (35% chance de "voltar bem" depois de erro)
 *   • Eventos de batalha entre pilotos próximos (gap < 1.2s):
 *     - Side-by-side (gap < 0.2s, drama sem mudar posição)
 *     - Slipstream/vácuo na reta (gap < 0.4s)
 *     - Big slipstream (vácuo cumulativo por 2+ voltas)
 *     - Ultrapassagens com base em acceleration vs stability
 *     - Defesas bem-sucedidas
 *   • Drama crescente na última volta (ataques arriscados, voltas perfeitas)
 *   • Detecção de comebacks (e late comebacks que rolaram só na última volta)
 *   • Detecção de underdog (carro com IGP baixo performando bem)
 *   • Cap absoluto de ±2.5s em impacto de eventos por piloto
 */
export function simulateRace(
  entrants: ReadonlyArray<RaceEntrant>,
  opts: SimulateRaceOptions = {},
): RaceEntrantResult[] {
  const laps          = opts.laps          ?? 3;
  const luckAmplitude = Math.max(0, Math.min(0.06, opts.luckAmplitude ?? 0.04));
  const rng           = createRng(opts.seed);

  // ── Setup inicial ────────────────────────────────────────────────
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
    return {
      entrant: e, stats, condition, baseLapTime, sectorScores,
      totalTime: 0, lapTimes: [], events: [],
      startingPos: 0, currentPos: 0,
      positionAtLap: [],
      aggression: (stats.power + stats.acceleration) / 200,
      slipstreamStreak: new Map<string, number>(),
      errorStreak: 0,
      hadRedemption: false,
    };
  });

  // ── Largada: ordena por IGP (simulação de classificação) ─────────
  const sortedByIgp = [...drivers].sort((a, b) => b.stats.igp - a.stats.igp);
  sortedByIgp.forEach((d, i) => {
    d.startingPos = i + 1;
    d.currentPos  = i + 1;
    const startEv = rollStartEvent(d.stats, rng);
    if (startEv) {
      d.events.push(startEv);
      d.totalTime += startEv.timeImpact;
    }
    // Pole advantage: P1 ganha pequena vantagem na 1ª volta (ar limpo)
    if (i === 0 && rng() < 0.55) {
      const poleBonus = -(0.10 + rng() * 0.20);
      d.totalTime += poleBonus;
      d.events.push({
        type: 'pole_advantage', lap: 1, sector: 'straight',
        description: 'Largou com ar limpo na pole',
        timeImpact: poleBonus,
      });
    }
  });

  // ── Simulação volta-a-volta ──────────────────────────────────────
  for (let lap = 1; lap <= laps; lap++) {
    const isLastLap = lap === laps;

    // 1. Cada piloto roda sua volta
    for (const d of drivers) {
      const degradation = tireDegradationAtLap(d.stats, lap, laps);
      const fuelBonus   = fuelSaveBonusAtLap(d.stats, lap, laps);
      const noisePerLap = (rng() - 0.5) * 0.025;
      const lastLapDrama = isLastLap ? (rng() - 0.5) * 0.030 : 0;
      const lapTime = d.baseLapTime * (1 + degradation - fuelBonus + noisePerLap + lastLapDrama);
      d.lapTimes.push(lapTime);
      d.totalTime += lapTime;
    }

    // 2. Eventos individuais por volta
    for (const d of drivers) {
      const ev = rollPerLapEvent(d, lap, laps, isLastLap, rng);
      if (ev) {
        d.events.push(ev);
        d.totalTime += ev.timeImpact;
        // Atualiza errorStreak
        if (ev.type === 'minor_mistake' || ev.type === 'cascading_error' || ev.type === 'lost_grip') {
          d.errorStreak += 1;
        } else if (ev.type === 'redemption' || ev.type === 'consistent_pace' || ev.type === 'hot_lap') {
          d.errorStreak = 0;
        }
      } else {
        // Sem evento — relaxa o streak gradualmente
        d.errorStreak = Math.max(0, d.errorStreak - 1);
      }
    }

    // 3. Eventos de batalha entre pilotos próximos
    rollBattleEvents(drivers, lap, isLastLap, rng);

    // 4. Atualiza posição corrente e snapshot por volta
    const orderedNow = [...drivers].sort((a, b) => a.totalTime - b.totalTime);
    orderedNow.forEach((d, i) => {
      d.currentPos = i + 1;
    });
    for (const d of drivers) {
      d.positionAtLap.push(d.currentPos);
    }
  }

  // ── Sorte pura final (luck amplitude) ─────────────────────────────
  for (const d of drivers) {
    const luckRoll = (rng() - 0.5) * 2 * luckAmplitude;
    d.totalTime *= (1 + luckRoll * 0.5);
  }

  // ── Caps de eventos + detecção de comebacks/underdogs ─────────────
  // IGP médio para detectar underdogs
  const avgIgp = drivers.reduce((s, d) => s + d.stats.igp, 0) / drivers.length;
  const topIgp = Math.max(...drivers.map(d => d.stats.igp));

  for (const d of drivers) {
    capDriverEventImpact(d);

    const positionsGained = d.startingPos - d.currentPos;
    if (positionsGained >= 2) {
      // Late comeback: subiu nas últimas 1-2 voltas?
      const posBeforeLastLap = d.positionAtLap[laps - 2] ?? d.startingPos;
      const lateGain = posBeforeLastLap - d.currentPos;
      if (lateGain >= 2 && laps >= 2) {
        d.events.push({
          type: 'late_comeback',
          description: `Recuperou ${lateGain} posição(ões) na volta final`,
          timeImpact: 0,
        });
      } else {
        d.events.push({
          type: 'comeback',
          description: `Recuperou ${positionsGained} posições`,
          timeImpact: 0,
        });
      }
    }

    // Underdog: IGP > 10 abaixo do top E terminou no top metade
    const igpGap = topIgp - d.stats.igp;
    const halfPoint = Math.ceil(drivers.length / 2);
    if (igpGap >= 10 && d.currentPos <= halfPoint && d.stats.igp < avgIgp) {
      d.events.push({
        type: 'underdog',
        description: 'Performance acima do esperado para o carro',
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

  // ── Score 0-100 normalizado ───────────────────────────────────────
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
