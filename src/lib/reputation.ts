/**
 * Sistema de Reputação (nível) do jogador.
 *
 * Recompensas (XP_REWARDS — dobradas em relação à versão anterior):
 *   • 2 XP por compra de carro
 *   • 6 XP por venda de carro
 *   • 4 XP por reparo concluído na oficina
 *   • 4 XP por tunagem aplicada
 *   • 4 XP por lavagem concluída
 *   • 20 XP por vitória em 1º lugar em racha
 *
 * Custo por nível:
 *   • XP necessário dobra a cada nível: 2.5 × 2^(N-2)
 *   • Lv 2 = 3, Lv 3 = 5, Lv 4 = 10, Lv 5 = 20...
 *   • Level máximo = 100.
 *
 * Mantemos esse módulo puro (sem React/hooks) pra poder reusar em
 * `useGameLogic`, nas telas e em testes.
 */

import type { Reputation } from '@/types/game';

export const MAX_LEVEL = 100;

/**
 * Recompensas de XP por ação. Centralizado para facilitar ajustes globais
 * (ex.: eventos "XP dobrado") sem precisar caçar callsites.
 */
export const XP_REWARDS = {
  /** Comprar um carro (marketplace global ou P2P). */
  carPurchase:  2,
  /** Vender um carro para um NPC (incl. contraproposta aceita). */
  carSale:      6,
  /** Reparo ou lavagem concluído na oficina. */
  repair:       4,
  /** Aplicar uma tunagem em um carro. */
  tune:         4,
  /** Vencer uma corrida assíncrona em 1º lugar. */
  raceWin:      20,
} as const;

/** Estado inicial de reputação (level 1, 0 xp). */
export const INITIAL_REPUTATION: Reputation = {
  level: 1,
  xp: 0,
  totalXp: 0,
};

/**
 * XP necessário para subir de `level-1` pra `level`.
 *
 * Fórmula: 2.5 × 2^(level-2) — ainda dobra a cada nível, mas reduzida em
 * 75% em relação à versão anterior (era 10 × 2^(level-2)) para tornar
 * a progressão mais ágil:
 *   • Lv 2 = 3   (era 10)
 *   • Lv 3 = 5   (era 20)
 *   • Lv 4 = 10  (era 40)
 *   • Lv 5 = 20  (era 80)
 *   • Lv 6 = 40  (era 160)
 *   • Lv 10 = 640 (era 2.560)
 *
 * Pra level <= 1 retorna 0 (não existe "subir pro level 1").
 * Pra level > MAX_LEVEL retorna Infinity.
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return Infinity;
  const raw = 2.5 * Math.pow(2, level - 2);
  // Proteção contra overflow em níveis absurdos (>50)
  if (!Number.isFinite(raw) || raw > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  // Mínimo de 1 XP — garante progresso mesmo com arredondamento.
  return Math.max(1, Math.round(raw));
}

/**
 * Garante que temos um objeto Reputation válido.
 * Usado pra lidar com saves antigos que não têm o campo.
 */
export function ensureReputation(rep: Reputation | undefined | null): Reputation {
  if (!rep || typeof rep.level !== 'number') {
    return { ...INITIAL_REPUTATION };
  }
  return {
    level: Math.max(1, Math.min(MAX_LEVEL, rep.level)),
    xp: Math.max(0, rep.xp ?? 0),
    totalXp: Math.max(0, rep.totalXp ?? 0),
  };
}

export interface AddXpResult {
  /** Estado de reputação após a soma. */
  reputation: Reputation;
  /** Quantos levels subiu neste `addXp` (0 = nenhum). */
  levelsGained: number;
  /** Lista dos levels que foram atingidos (útil pra toast "Subiu pro Lv X"). */
  newLevels: number[];
}

/**
 * Soma `amount` XP e processa possíveis level-ups em cascata.
 *
 * Por ex.: se você está em Lv 1 com 15 xp e ganha 30 xp de uma vez,
 * precisa de 20 pra Lv 2 (sobra 25) e 40 pra Lv 3 (ainda faltam 15),
 * então acaba em Lv 2 com 25 xp.
 */
export function addXp(
  rep: Reputation | undefined,
  amount: number
): AddXpResult {
  const start = ensureReputation(rep);
  if (amount <= 0 || start.level >= MAX_LEVEL) {
    // No MAX_LEVEL a gente ainda acumula totalXp mas não mais o xp de nível
    return {
      reputation: {
        ...start,
        totalXp: start.totalXp + Math.max(0, amount),
      },
      levelsGained: 0,
      newLevels: [],
    };
  }

  let level = start.level;
  let xp = start.xp + amount;
  const newLevels: number[] = [];

  // Level-up em cascata enquanto o XP acumulado exceder o requisito
  while (level < MAX_LEVEL) {
    const need = xpRequiredForLevel(level + 1);
    if (xp < need) break;
    xp -= need;
    level += 1;
    newLevels.push(level);
  }

  // Ao bater o MAX_LEVEL, trava o xp do nível em 0 (progresso infinito)
  if (level >= MAX_LEVEL) {
    xp = 0;
  }

  return {
    reputation: {
      level,
      xp,
      totalXp: start.totalXp + amount,
    },
    levelsGained: newLevels.length,
    newLevels,
  };
}

/** Progresso (0..1) rumo ao próximo level. No MAX_LEVEL retorna 1. */
export function levelProgress(rep: Reputation | undefined): number {
  const r = ensureReputation(rep);
  if (r.level >= MAX_LEVEL) return 1;
  const need = xpRequiredForLevel(r.level + 1);
  if (need <= 0) return 0;
  return Math.max(0, Math.min(1, r.xp / need));
}

/** Checa se `level` atual satisfaz o requisito mínimo. */
export function meetsLevelRequirement(
  currentLevel: number | undefined,
  required: number | undefined
): boolean {
  if (!required || required <= 1) return true;
  return (currentLevel ?? 1) >= required;
}

/**
 * Estima o XP total que um jogador deveria ter, a partir de evidências
 * persistidas no save (vendas, compras, rachas vencidos, reparos visíveis).
 * Usado pela migração automática quando a reputação atual está claramente
 * inconsistente com o histórico.
 *
 * Regras (devem permanecer alinhadas com `addXp` callsites):
 *   • +3 XP por venda registrada (salesHistory ou carSales)
 *   • +1 XP por compra registrada (totalCarsBought)
 *   • +10 XP por racha assíncrono vencido (asyncRacesWon)
 *   • +2 XP por reparo concluído visível (garage[].car.completedRepairs)
 */
export function estimateTotalXpFromHistory(state: {
  salesHistory?: ReadonlyArray<unknown>;
  carSales?: ReadonlyArray<unknown>;
  totalCarsBought?: number;
  asyncRacesWon?: number;
  garage?: ReadonlyArray<{ car?: { completedRepairs?: ReadonlyArray<unknown> } | undefined }>;
}): number {
  const sales = Math.max(state.salesHistory?.length ?? 0, state.carSales?.length ?? 0);
  const buys = Math.max(0, state.totalCarsBought ?? 0);
  const races = Math.max(0, state.asyncRacesWon ?? 0);
  const repairs = (state.garage ?? []).reduce(
    (sum, slot) => sum + (slot.car?.completedRepairs?.length ?? 0),
    0,
  );
  return sales * 3 + buys * 1 + races * 10 + repairs * 2;
}

/** Calcula o `level` e o `xp` residual a partir de um `totalXp` acumulado. */
export function levelFromTotalXp(totalXp: number): { level: number; xp: number } {
  let remaining = Math.max(0, totalXp);
  let level = 1;
  while (level < MAX_LEVEL) {
    const need = xpRequiredForLevel(level + 1);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }
  return { level, xp: level >= MAX_LEVEL ? 0 : remaining };
}

/**
 * Reconstrói a reputação do jogador combinando:
 *   1. O `totalXp` salvo (se existir e for confiável)
 *   2. O XP estimado a partir de evidências do save
 *
 * Pega o **maior** dos dois — assim nunca rebaixamos um jogador que tinha
 * progresso legítimo, e recuperamos jogadores cujo `totalXp` foi zerado
 * por bugs anteriores.
 */
export function reconstructReputation(state: {
  reputation?: Reputation;
  salesHistory?: ReadonlyArray<unknown>;
  carSales?: ReadonlyArray<unknown>;
  totalCarsBought?: number;
  asyncRacesWon?: number;
  garage?: ReadonlyArray<{ car?: { completedRepairs?: ReadonlyArray<unknown> } | undefined }>;
}): Reputation {
  const current = ensureReputation(state.reputation);
  const estimated = estimateTotalXpFromHistory(state);
  const trustedTotalXp = Math.max(current.totalXp, estimated);
  const { level, xp } = levelFromTotalXp(trustedTotalXp);
  // Se o nível atual armazenado for maior que o reconstruído, prefere o atual
  // (jogador pode ter ganhado XP por canais não rastreados aqui).
  const finalLevel = Math.max(current.level, level);
  return {
    level: Math.min(MAX_LEVEL, finalLevel),
    xp: finalLevel === level ? xp : current.xp,
    totalXp: trustedTotalXp,
  };
}
