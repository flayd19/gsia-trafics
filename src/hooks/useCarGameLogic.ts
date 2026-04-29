// =====================================================================
// useCarGameLogic — lógica central do jogo de compra e venda de carros
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, OwnedCar, CarAttributes, AttributeKey, DiagnosisResult } from '@/types/game';
import { ensureGameState } from '@/types/game';
import type { TuneUpgrade } from '@/types/performance';
import {
  GARAGE_SLOTS,
  buildMarketplaceInventory,
  garageSlotDailyCost,
  CAR_MODELS,
  conditionValueFactor,
  type MarketplaceCar,
} from '@/data/cars';
import { REPAIR_TYPES } from '@/data/repairTypes';
import {
  evaluatePlayerOffer,
  calculateBuyerOffer,
  COUNTER_OFFER_RATIO,
  currentCycleEpoch,
  secondsUntilNextCycle,
  nextCycleTimestamp,
  maxBuyerSlots,
  generateCycleBuyers,
} from '@/data/carBuyers';
import { ensureReputation, addXp, reconstructReputation, XP_REWARDS } from '@/lib/reputation';
import {
  EMPLOYEES_CATALOG,
  totalDailyStaffCost,
  calcSellerPrice,
  SELLER_COMMISSION_RATE,
  type EmployeeId,
  type EmployeeConfig,
  type HiredEmployee,
} from '@/types/employees';
import {
  WARRANTY_MIN_LEVEL,
  WARRANTY_CONDITION_THRESHOLD,
  warrantyClaimChance,
  type WarrantyClaim,
} from '@/types/warranty';
import { supabase } from '@/integrations/supabase/client';

// ── Config ────────────────────────────────────────────────────────
const GAME_TICK_MS            = 1_000;
// 1 dia real = 3 min reais = 180 ticks × 8 min/tick = 1440 min = 24h in-game
const GAME_MINUTES_PER_TICK   = 8;
const MARKETPLACE_REFRESH_MS  =  6 * 60 * 60_000; // 6 horas reais entre refreshes
const INTEREST_RATE           = 0.02;
const AUTO_SAVE_INTERVAL_MS   = 30_000;
const LOCAL_SAVE_KEY          = 'gsia_car_game_v1';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decide se uma venda dispara claim de garantia e, em caso positivo,
 * gera o claim pronto para ser persistido. Retorna `null` se:
 *   • Jogador abaixo do nível mínimo (Lv 8)
 *   • Carro tinha condição ≥ 60% (chance 0%)
 *   • RNG não premiou
 *   • Não há reparos disponíveis no atributo afetado
 *
 * Probabilidade escala com a condição:
 *   • 60% → 0% chance
 *   • 40% → 50% chance (linear)
 *   • 20% → 100% chance (garantido)
 *
 * O claim expira no PRÓXIMO ciclo de compradores (nextBuyerCycleAt) —
 * sincroniza a renovação dos NPCs com a renovação dos claims.
 */
function maybeGenerateWarrantyClaim(
  car: OwnedCar,
  buyerName: string,
  salePrice: number,
  playerLevel: number,
  nextCycleAt: number,
): WarrantyClaim | null {
  if (playerLevel < WARRANTY_MIN_LEVEL) return null;
  if (car.condition >= WARRANTY_CONDITION_THRESHOLD) return null;

  const chance = warrantyClaimChance(car.condition);
  if (chance <= 0) return null;
  if (Math.random() >= chance) return null;

  // Pega reparo aleatório disponível (não conta lavagem)
  const availableRepairs = REPAIR_TYPES.filter(r => !r.isAlwaysAvailable);
  if (availableRepairs.length === 0) return null;
  const picked = availableRepairs[Math.floor(Math.random() * availableRepairs.length)]!;

  return {
    id:           generateId(),
    createdAt:    Date.now(),
    status:       'pending',
    buyerName,
    car:          { ...car }, // snapshot
    salePrice,
    repairTypeId: picked.id,
    repairName:   picked.name,
    repairIcon:   picked.icon,
    repairCost:   picked.baseCost,
    attribute:    picked.attribute,
    // Sincroniza com o próximo ciclo de compradores
    expiresAt:    nextCycleAt,
  };
}

/**
 * BUG FIX: garante que o saldo nunca vire NaN/Infinity. Usado em todos os
 * caminhos de mutação de `money`. Se entrada for inválida, mantém o saldo
 * anterior (preservando progresso do jogador).
 */
function safeMoney(prev: number, next: number): number {
  if (typeof next === 'number' && Number.isFinite(next)) return next;
  return Number.isFinite(prev) ? prev : 15_000;
}

/** Trata um valor de operação (preço, custo, etc.) — fallback 0 se inválido. */
function safeAmount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ── Helpers do sistema de atributos ──────────────────────────────
const ATTR_LABELS: Record<AttributeKey, string> = {
  body:       'Lataria',
  mechanical: 'Mecânica',
  electrical: 'Elétrica',
  interior:   'Interior',
};

/** Gera atributos iniciais distribuídos em torno da condição geral (±15) */
function generateAttributes(condition: number): CarAttributes {
  const spread = 15;
  const rand = () => Math.round(condition + (Math.random() * spread * 2 - spread));
  return {
    body:       Math.min(100, Math.max(0, rand())),
    mechanical: Math.min(100, Math.max(0, rand())),
    electrical: Math.min(100, Math.max(0, rand())),
    interior:   Math.min(100, Math.max(0, rand())),
  };
}

/** Condição geral = média dos 4 atributos */
function avgCondition(attrs: CarAttributes): number {
  return Math.round((attrs.body + attrs.mechanical + attrs.electrical + attrs.interior) / 4);
}

/** Custo dinâmico: atributo mais baixo = reparo mais caro (+25% a -15%) */
function calcRepairCost(baseCost: number, attrCondition: number): number {
  let multiplier = 1.0;
  if      (attrCondition < 30) multiplier = 1.25;
  else if (attrCondition < 45) multiplier = 1.20;
  else if (attrCondition < 58) multiplier = 1.05;
  else                         multiplier = 0.85;
  return Math.round(baseCost * multiplier);
}

// ── Estado inicial ────────────────────────────────────────────────
function buildInitialState(): GameState {
  const epoch      = currentCycleEpoch();
  const level      = 1;
  const totalSlots = maxBuyerSlots(level);
  return ensureGameState({
    money:                  50_000,
    garage:                 [{ id: 1, unlocked: true, unlockCost: 0, car: undefined }],
    marketplaceCars:        buildMarketplaceInventory(),
    marketplaceLastRefresh: Date.now(),
    lastRentCharge:         1,
    carBuyers:              generateCycleBuyers(level, []),
    buyerCycleEpoch:        epoch,
    buyerSlotLocks:         new Array(totalSlots).fill(-1),
    nextBuyerCycleAt:       nextCycleTimestamp(),
  });
}

// ── Prepara para salvar: remove dados transitórios grandes ─────────
function serializeForSave(state: GameState): object {
  // BUG FIX: garante que money nunca é persistido como NaN/Infinity. Isso
  // protege contra um save corrompido que, ao recarregar, produziria NaN
  // em todas as operações subsequentes.
  const safeMoneyValue =
    typeof state.money === 'number' && Number.isFinite(state.money) ? state.money : 15_000;

  // FIX: persistir o marketplaceCars enquanto a janela de 24h ainda
  // não fechou. Se já passou, esvaziamos para que o load regenere.
  // Isso garante que recarregar o app NÃO troca o mercado — só o tempo
  // (cycle de 24h) regenera. Sem isso, todo reload gerava lista nova.
  const now = Date.now();
  const refreshAge = now - (state.marketplaceLastRefresh ?? 0);
  const cycleStillFresh = refreshAge < MARKETPLACE_REFRESH_MS;
  const persistedMarket = cycleStillFresh ? state.marketplaceCars : [];

  return {
    ...state,
    money: safeMoneyValue,
    marketplaceCars: persistedMarket,
    carBuyers: state.carBuyers.filter(
      b => b.state === 'waiting' || b.state === 'thinking' || b.state === 'countering'
    ),
  };
}

// Versão atual do schema de migração de reputação. Incrementar quando
// quisermos forçar uma nova reconstrução para todos os jogadores —
// por exemplo, quando a fórmula de XP por nível muda.
//
// Histórico:
//   v1 — primeira migração: corrigia saves bugados em Lv 1 com totalXp baixo.
//   v2 — fórmula de XP reduzida em 75% (xpRequiredForLevel: 10×2^(N-2) → 2.5×2^(N-2)).
//        Com a fórmula nova, o mesmo totalXp produz nível maior, então
//        recalculamos o nível para todos os jogadores no próximo load.
//   v3 — redução adicional de 35% no XP do Lv 5+. Recalculamos para
//        jogadores que estavam travados em Lv 5–10 ganharem boost.
//   v4 — plateau de 104 XP fixo a partir do Lv 8 (até Lv 100). Jogadores
//        que tinham totalXp alto e estavam travados em níveis intermediários
//        sobem múltiplos níveis automaticamente.
const REPUTATION_MIGRATION_VERSION = 4;

/**
 * Migração automática da reputação. Roda uma vez por jogador por versão
 * — quando a versão é incrementada (ex.: mudança de fórmula de XP), todos
 * os saves passam por `reconstructReputation` que:
 *   1. Combina `totalXp` salvo com XP estimado do histórico (vendas, compras,
 *      rachas) — pega o maior, nunca perde progresso.
 *   2. Recalcula `level + xp` aplicando a fórmula ATUAL de `xpRequiredForLevel`.
 *   3. Nunca rebaixa: usa `Math.max(current.level, reconstructed.level)`.
 *
 * Isso garante que mudanças de fórmula propagam automaticamente — jogadores
 * que tinham 70 totalXp e estavam em Lv 4 (fórmula antiga) sobem para Lv 6
 * com a nova fórmula, sem ação manual.
 */
function migrateReputationIfNeeded(saved: GameState): GameState {
  if (saved._reputationMigrationVersion === REPUTATION_MIGRATION_VERSION) {
    return saved;
  }

  const reconstructed = reconstructReputation(saved);
  return {
    ...saved,
    reputation: reconstructed,
    _reputationMigrationVersion: REPUTATION_MIGRATION_VERSION,
  };
}

// ── Aplica save carregado: regenera marketplace + compradores se necessário ──
function applyLoadedSave(raw: unknown): GameState {
  let saved = ensureGameState(raw as Partial<GameState>);

  // Migração automática de reputação (corrige saves bugados de versões antigas)
  saved = migrateReputationIfNeeded(saved);

  // Regenera marketplace SOMENTE quando passou 24h desde o último refresh.
  // Caso contrário, mantém a lista persistida para que recarregar o app não
  // produza um mercado diferente dentro da mesma janela de 24h.
  const now = Date.now();
  const cycleExpired =
    !saved.marketplaceLastRefresh ||
    now - saved.marketplaceLastRefresh >= MARKETPLACE_REFRESH_MS;
  const marketEmpty =
    !saved.marketplaceCars || saved.marketplaceCars.length === 0;

  if (marketEmpty && cycleExpired) {
    saved.marketplaceCars        = buildMarketplaceInventory();
    saved.marketplaceLastRefresh = now;
  } else if (marketEmpty) {
    // Edge case: lista vazia mas dentro do ciclo (save inconsistente).
    // Regenera mas mantém o marketplaceLastRefresh existente para não
    // resetar a contagem do próximo ciclo.
    saved.marketplaceCars = buildMarketplaceInventory();
  }

  // Regenera compradores apenas se o ciclo já encerrou (comparação por timestamp absoluto)
  if (now >= saved.nextBuyerCycleAt) {
    const level      = saved.reputation.level;
    const totalSlots = maxBuyerSlots(level);
    saved.carBuyers       = generateCycleBuyers(level, []);
    saved.buyerCycleEpoch = currentCycleEpoch();
    saved.buyerSlotLocks  = new Array(totalSlots).fill(-1);
    saved.nextBuyerCycleAt = nextCycleTimestamp();
  }

  return saved;
}

// ── localStorage helpers ──────────────────────────────────────────
function saveLocal(state: GameState): void {
  try {
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(serializeForSave(state)));
  } catch { /* quota exceeded — ignora */ }
}

function loadLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) return null;
    return applyLoadedSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ── Supabase helpers: tabela direta, sem RPC ──────────────────────
// Usa supabase.from() em vez de .rpc() para não depender dos tipos gerados
async function saveSupabase(userId: string, displayName: string, state: GameState): Promise<boolean> {
  try {
    const safeMoneyValue =
      typeof state.money === 'number' && Number.isFinite(state.money) ? state.money : 15_000;
    const { error } = await (supabase as any)
      .from('game_progress')
      .upsert(
        {
          user_id:       userId,
          car_game_data: serializeForSave(state),
          money:         safeMoneyValue,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) return false;

    // Atualiza perfil para ranking — patrimônio real: saldo + valor de mercado dos carros
    const carValue = (state.garage ?? [])
      .filter(s => s.car)
      .reduce((sum, s) => sum + s.car!.fipePrice * conditionValueFactor(s.car!.condition), 0);
    const totalPatrimony = state.money + carValue;

    const racesWon =
      (state.asyncRacesWon ?? 0) +
      (state.garage ?? [])
        .filter(s => s.car?.raceHistory)
        .reduce((sum, s) => sum + (s.car!.raceHistory!.filter(r => r.won).length), 0);

    void (supabase as any)
      .from('player_profiles')
      .upsert(
        {
          user_id:         userId,
          display_name:    displayName,
          total_patrimony: Math.round(totalPatrimony),
          level:           state.reputation?.level ?? 1,
          races_won:       racesWon,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    return true;
  } catch {
    return false;
  }
}

async function loadSupabase(userId: string): Promise<GameState | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('game_progress')
      .select('car_game_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.car_game_data) return null;
    return applyLoadedSave(data.car_game_data);
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────
export function useCarGameLogic() {
  const [gameState, setGameState]   = useState<GameState>(buildInitialState);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [isSyncing, setIsSyncing]   = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef    = useRef(gameState);
  stateRef.current  = gameState;

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const formatGameTime = useCallback(() => {
    return `Dia ${stateRef.current.gameTime.day}`;
  }, []);

  // ── saveGame: local primeiro (garantido) depois cloud ─────────
  const saveGame = useCallback(async (): Promise<boolean> => {
    const state = stateRef.current;

    // 1) Salva local — sempre funciona, instantâneo
    saveLocal(state);

    // 2) Tenta cloud
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // sem usuário: local já basta

    setSaveStatus('saving');
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Jogador';
    const ok = await saveSupabase(user.id, displayName, state);
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), ok ? 2000 : 3000);
    return ok;
  }, []);

  // ── loadGame: local instantâneo + sync cloud ──────────────────
  const loadGame = useCallback(async () => {
    // 1) Carrega local imediatamente (sem esperar rede)
    const local = loadLocal();
    if (local) {
      setGameState(local);
      setGameLoaded(true);
    }

    // 2) Tenta buscar do Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (!local) {
        setGameState(buildInitialState());
        setGameLoaded(true);
      }
      return;
    }

    setIsSyncing(true);
    const cloud = await loadSupabase(user.id);
    setIsSyncing(false);

    if (cloud) {
      // BUG FIX: usar critério mais robusto que apenas o dia in-game.
      // Se ambos estão no mesmo dia, escolhe quem tem mais patrimônio
      // (dinheiro + valor dos carros) para evitar perder progresso quando
      // o jogador comprou/vendeu vários carros no mesmo dia.
      const calcPatrimony = (s: GameState) => {
        const carValue = (s.garage ?? [])
          .filter(slot => slot.car)
          .reduce((sum, slot) => sum + slot.car!.fipePrice * conditionValueFactor(slot.car!.condition), 0);
        return s.money + carValue;
      };
      const useCloud =
        !local ||
        cloud.gameTime.day > local.gameTime.day ||
        (cloud.gameTime.day === local.gameTime.day &&
          calcPatrimony(cloud) >= calcPatrimony(local));
      if (useCloud) {
        setGameState(cloud);
        saveLocal(cloud); // sincroniza local com cloud
      }
    } else if (!local) {
      setGameState(buildInitialState());
    }

    setGameLoaded(true);
  }, []);

  // ── resetGame ────────────────────────────────────────────────
  const resetGame = useCallback(async () => {
    localStorage.removeItem(LOCAL_SAVE_KEY);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase as any)
        .from('game_progress')
        .update({ car_game_data: null, money: 50000, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
    setGameState(buildInitialState());
  }, []);

  // ── Mount: carrega + inicia auto-save ─────────────────────────
  useEffect(() => { void loadGame(); }, [loadGame]);

  useEffect(() => {
    if (!gameLoaded) return;
    autoSaveRef.current = setInterval(() => void saveGame(), AUTO_SAVE_INTERVAL_MS);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [gameLoaded, saveGame]);

  // ── Game tick ────────────────────────────────────────────────
  useEffect(() => {
    if (!gameLoaded) return;
    tickRef.current = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        // Sanitiza money corrompido (NaN) para não propagar em toda a sessão
        let next = { ...prev, money: isFinite(prev.money) ? prev.money : 15_000 };

        // Avança tempo in-game
        let { day, hour, minute } = next.gameTime;
        minute += GAME_MINUTES_PER_TICK;
        while (minute >= 60) { minute -= 60; hour++; }
        while (hour   >= 24) { hour   -= 24; day++;  }
        next = { ...next, gameTime: { ...next.gameTime, day, hour, minute, lastUpdate: now } };

        // Juros do cheque especial
        if (next.money < 0 && day > next.lastInterestCalculation) {
          const interest = Math.abs(next.money) * INTEREST_RATE;
          next = {
            ...next,
            money: safeMoney(next.money, next.money - safeAmount(interest)),
            lastInterestCalculation: day,
          };
        }

        // Aluguel diário: cobrado apenas por vagas OCUPADAS (100 × 2^(slot-1) por dia)
        if (day > next.lastRentCharge) {
          const dailyRent = next.garage
            .filter(s => s.unlocked && s.car)
            .reduce((sum, slot) => sum + safeAmount(garageSlotDailyCost(slot.id)), 0);
          next = {
            ...next,
            money:          safeMoney(next.money, next.money - safeAmount(dailyRent)),
            lastRentCharge: day,
          };
        }

        // Finaliza reparos concluídos
        const pendingRepairs  = next.activeRepairs.filter(r => now < r.startedAt + r.durationSec * 1000);
        const finishedRepairs = next.activeRepairs.filter(r => now >= r.startedAt + r.durationSec * 1000);
        if (finishedRepairs.length > 0) {
          let updatedGarage = [...next.garage];
          finishedRepairs.forEach(rep => {
            updatedGarage = updatedGarage.map(slot => {
              if (!slot.car || slot.car.instanceId !== rep.carInstanceId) return slot;
              const car      = slot.car;
              const oldAttrs = car.attributes ?? generateAttributes(car.condition);
              const attr     = (rep.targetAttribute ?? 'mechanical') as AttributeKey;
              const newAttrs: CarAttributes = {
                ...oldAttrs,
                [attr]: Math.min(100, oldAttrs[attr] + rep.conditionGain),
              };
              return {
                ...slot,
                car: {
                  ...car,
                  attributes:        newAttrs,
                  condition:         avgCondition(newAttrs),
                  inRepair:          false,
                  repairCompletesAt: undefined,
                  repairTypeId:      undefined,
                  repairGain:        undefined,
                },
              };
            });
          });
          // XP por reparos/lavagens concluídos
          const repairXp = finishedRepairs.length * XP_REWARDS.repair;
          next = { ...next, activeRepairs: pendingRepairs, garage: updatedGarage, reputation: addXp(next.reputation, repairXp).reputation };
        }

        // ── Funcionários: salário diário ──────────────────────────
        const employees = next.employees ?? [];
        if (employees.length > 0 && day > (next.lastEmployeePayDay ?? 0)) {
          const totalSalary = totalDailyStaffCost(employees);
          if (totalSalary > 0) {
            next = {
              ...next,
              money: safeMoney(next.money, next.money - totalSalary),
              lastEmployeePayDay: day,
            };
          } else {
            next = { ...next, lastEmployeePayDay: day };
          }
        }

        // ── Garantias: auto-recusa de claims expirados ─────────────
        // Quando o jogador ignora um claim além do prazo, é tratado como recusa:
        // valor da venda é debitado e o carro volta para a garagem.
        const pendingClaims = (next.warrantyClaims ?? []).filter(c => c.status === 'pending');
        const expiredClaims = pendingClaims.filter(c => now >= c.expiresAt);
        if (expiredClaims.length > 0) {
          let updatedGarage = next.garage;
          let updatedMoney  = next.money;
          for (const claim of expiredClaims) {
            updatedMoney = safeMoney(updatedMoney, updatedMoney - claim.salePrice);
            const emptySlot = updatedGarage.find(s => s.unlocked && !s.car);
            if (emptySlot) {
              updatedGarage = updatedGarage.map(s =>
                s.id === emptySlot.id ? { ...s, car: { ...claim.car } } : s,
              );
            }
          }
          next = {
            ...next,
            money:  updatedMoney,
            garage: updatedGarage,
            warrantyClaims: (next.warrantyClaims ?? []).map(c =>
              expiredClaims.find(e => e.id === c.id)
                ? { ...c, status: 'refused' as const }
                : c
            ),
          };
        }

        // ── Funcionário: Lavador (lava 1 carro/tick por slot livre) ──
        const hasWasher = employees.some(e => e.id === 'washer');
        if (hasWasher) {
          // Limite: lava só 1 carro por tick para não saturar (cada lavagem
          // dura 20s e precisa do carro fora de reparo)
          const candidate = next.garage.find(s =>
            s.unlocked &&
            s.car &&
            !s.car.inRepair &&
            !(s.car.completedRepairs ?? []).includes('lavagem_completa')
          );
          if (candidate?.car) {
            const car = candidate.car;
            const washType = REPAIR_TYPES.find(r => r.id === 'lavagem_completa');
            if (washType) {
              const gain = Math.round(5 + Math.random() * 23);
              const newRepair = {
                carInstanceId: car.instanceId,
                repairTypeId:  'lavagem_completa',
                startedAt:     now,
                durationSec:   washType.durationSec,
                conditionGain: gain,
                cost:          0, // lavador faz de graça (jogador paga o salário)
                targetAttribute: washType.attribute,
              };
              next = {
                ...next,
                garage: next.garage.map(s => {
                  if (s.car?.instanceId !== car.instanceId) return s;
                  return {
                    ...s,
                    car: {
                      ...s.car!,
                      inRepair:          true,
                      repairCompletesAt: now + washType.durationSec * 1000,
                      repairTypeId:      'lavagem_completa',
                      repairGain:        gain,
                      completedRepairs:  [...(s.car!.completedRepairs ?? []), 'lavagem_completa'],
                    },
                  };
                }),
                activeRepairs: [...next.activeRepairs, newRepair],
              };
            }
          }
        }

        // ── Funcionário: Vendedor (envia ofertas automáticas) ───────
        const sellerEmployee = employees.find(e => e.id === 'seller');
        if (sellerEmployee) {
          const sellerCfg = sellerEmployee.config ?? {};
          // Procura compradores aguardando + carro compatível
          const waitingBuyers = next.carBuyers.filter(b => b.state === 'waiting');
          for (const buyer of waitingBuyers) {
            // Se já enviou oferta neste buyer (state mudaria para thinking)
            // ou já foi processado no mesmo tick, pula
            if (buyer.state !== 'waiting') continue;

            // Acha um carro compatível na garagem (sem reparo, não em uso)
            const compatibleSlot = next.garage.find(slot => {
              if (!slot.car || slot.car.inRepair) return false;
              const car = slot.car;
              // Carro não pode estar em outra negociação
              const isInNegotiation = next.carBuyers.some(b =>
                b.targetCarInstanceId === car.instanceId &&
                (b.state === 'thinking' || b.state === 'countering')
              );
              if (isInNegotiation) return false;
              // Verifica compatibilidade com o pedido do buyer
              if (buyer.requirementType === 'model' && buyer.targetModelId) {
                return car.modelId === buyer.targetModelId;
              }
              if (buyer.requirementType === 'category' && buyer.targetCategories.length > 0) {
                const carModel = CAR_MODELS.find(m => m.id === car.modelId);
                return !!carModel && buyer.targetCategories.includes(carModel.category);
              }
              return false;
            });

            if (compatibleSlot?.car) {
              const car = compatibleSlot.car;
              const askingPrice = calcSellerPrice(car.fipePrice, sellerCfg);
              // Envia oferta colocando o buyer em "thinking" e MARCANDO que
              // a oferta veio do funcionário (para cobrar comissão depois).
              next = {
                ...next,
                carBuyers: next.carBuyers.map(b =>
                  b.id === buyer.id
                    ? {
                        ...b,
                        state: 'thinking' as const,
                        thinkingStartedAt: now,
                        thinkDuration: Math.floor(Math.random() * 8) + 3,
                        playerOffer: askingPrice,
                        playerIncludedTradeIn: false,
                        targetCarInstanceId: car.instanceId,
                        offerSentByEmployee: true,
                      }
                    : b
                ),
              };
            }
          }
        }

        // ── Expansão imediata de slots ao subir de nível ──────────
        // Garante que novos slots aparecem assim que o nível aumenta,
        // sem esperar o próximo ciclo de 10 min.
        {
          const expectedSlots = maxBuyerSlots(next.reputation.level);
          if ((next.buyerSlotLocks ?? []).length < expectedSlots) {
            const extra = expectedSlots - (next.buyerSlotLocks ?? []).length;
            next = {
              ...next,
              buyerSlotLocks: [...(next.buyerSlotLocks ?? []), ...new Array(extra).fill(-1)],
            };
          }
        }

        // ── Ciclo de compradores (10 min) ─────────────────────────
        if (now >= next.nextBuyerCycleAt) {
          // Novo ciclo: regenera todos os slots (nenhum bloqueado no início do ciclo)
          const level      = next.reputation.level;
          const totalSlots = maxBuyerSlots(level);
          next = {
            ...next,
            carBuyers:        generateCycleBuyers(level, []),
            buyerCycleEpoch:  currentCycleEpoch(),
            buyerSlotLocks:   new Array(totalSlots).fill(-1),
            nextBuyerCycleAt: nextCycleTimestamp(),
          };
        }

        // Marca compradores cujo ciclo acabou como expirados (UX feedback)
        const buyersAfterExpiry = next.carBuyers.map(b => {
          if (b.state !== 'waiting' && b.state !== 'thinking') return b;
          const elapsed = (now - b.arrivedAt) / 1_000;
          if (elapsed > b.patience) return { ...b, state: 'expired' as const };
          return b;
        });

        // Finaliza compradores "pensando" quando o tempo sorteado acabar (auto-resolve)
        const buyersResolved = buyersAfterExpiry.map(b => {
          if (b.state !== 'thinking') return b;
          if ((now - (b.thinkingStartedAt ?? now)) / 1_000 < (b.thinkDuration ?? 10)) return b;
          if (!b.targetCarInstanceId || b.playerOffer === undefined)
            return { ...b, state: 'rejected' as const };
          return b;
        });

        // Remove compradores expirados/rejeitados após breve grace period (UX)
        const buyersFinal = buyersResolved.filter(b => {
          if (b.state === 'expired' || b.state === 'rejected')
            return (now - b.arrivedAt) < (b.patience + 5) * 1_000;
          if (b.state === 'accepted')
            return (now - (b.thinkingStartedAt ?? b.arrivedAt)) < 8_000;
          return true;
        });

        next = { ...next, carBuyers: buyersFinal };

        // Atualiza marketplace SOMENTE quando passa 24h desde o último refresh.
        // Esse é o ÚNICO ponto onde `marketplaceCars` é regenerado em runtime.
        if (now - next.marketplaceLastRefresh >= MARKETPLACE_REFRESH_MS) {
          next = { ...next, marketplaceCars: buildMarketplaceInventory(), marketplaceLastRefresh: now };
        }

        return next;
      });
    }, GAME_TICK_MS);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [gameLoaded]);

  // ── AÇÕES DO JOGADOR ─────────────────────────────────────────

  const buyCarFromMarketplace = useCallback((car: MarketplaceCar): { success: boolean; message: string } => {
    const state = stateRef.current;
    const emptySlot = state.garage.find(s => s.unlocked && !s.car);
    if (!emptySlot) return { success: false, message: 'Garagem cheia! Compre mais vagas.' };
    const askingPrice = safeAmount(car.askingPrice);
    if (state.money - askingPrice < state.overdraftLimit)
      return { success: false, message: 'Saldo insuficiente.' };

    const owned: OwnedCar = {
      instanceId: generateId(),
      modelId: car.modelId, variantId: car.variantId,
      fullName: `${car.brand} ${car.model} ${car.trim}`,
      brand: car.brand, model: car.model, trim: car.trim,
      year: car.year, icon: car.icon,
      fipePrice: car.fipePrice, condition: car.condition,
      mileage: car.mileage,
      purchasePrice: askingPrice, purchasedAt: Date.now(),
      completedRepairs: [],
      attributes: generateAttributes(car.condition),
    };

    setGameState(prev => ({
      ...prev,
      money:          safeMoney(prev.money, prev.money - askingPrice),
      garage:         prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
      reputation:     addXp(prev.reputation, XP_REWARDS.carPurchase).reputation,
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:     (prev.totalSpent ?? 0) + askingPrice,
      marketplaceCars: prev.marketplaceCars.filter(c => c.id !== car.id),
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${car.brand} ${car.model} adicionado à garagem!` };
  }, [saveGame]);

  const unlockGarageSlot = useCallback((slotId: number): { success: boolean; message: string } => {
    const state = stateRef.current;
    const slotDef = GARAGE_SLOTS.find(s => s.id === slotId);
    if (!slotDef) return { success: false, message: 'Slot inválido.' };
    if (state.garage.find(s => s.id === slotId)?.unlocked)
      return { success: false, message: 'Slot já desbloqueado.' };
    if (state.money < slotDef.unlockCost)
      return { success: false, message: `Você precisa de ${formatMoney(slotDef.unlockCost)}.` };

    const unlockCost = safeAmount(slotDef.unlockCost);
    setGameState(prev => ({
      ...prev,
      money:  safeMoney(prev.money, prev.money - unlockCost),
      garage: prev.garage.some(s => s.id === slotId)
        ? prev.garage.map(s => s.id === slotId ? { ...s, unlocked: true } : s)
        : [...prev.garage, { id: slotId, unlocked: true, unlockCost: unlockCost, car: undefined }],
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `Vaga ${slotId} desbloqueada!` };
  }, [saveGame]);

  const startRepair = useCallback((carInstanceId: string, repairTypeId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    const repairType = REPAIR_TYPES.find(r => r.id === repairTypeId);
    if (!repairType) return { success: false, message: 'Tipo de reparo inválido.' };

    const slot = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car)    return { success: false, message: 'Carro não encontrado na garagem.' };
    if (slot.car.inRepair) return { success: false, message: 'Carro já está em reparo.' };

    const car   = slot.car;
    const attrs = car.attributes ?? generateAttributes(car.condition);

    if (repairType.isAlwaysAvailable) {
      // Lavagem: permitida apenas uma vez por veículo
      if ((car.completedRepairs ?? []).includes(repairTypeId))
        return { success: false, message: 'Este carro já foi lavado.' };
    } else {
      // Reparos comuns: atributo alvo deve estar abaixo de 60
      const attrVal = attrs[repairType.attribute];
      if (attrVal >= 60)
        return { success: false, message: `${ATTR_LABELS[repairType.attribute]} já está em boas condições (${attrVal}%).` };
    }

    const attrVal = attrs[repairType.attribute];
    const cost    = safeAmount(repairType.isAlwaysAvailable
      ? repairType.baseCost
      : calcRepairCost(repairType.baseCost, attrVal));

    if (state.money - cost < state.overdraftLimit)
      return { success: false, message: `Você precisa de ${formatMoney(cost)}.` };

    const gain = Math.round(5 + Math.random() * 23); // RNG 5–28
    const now  = Date.now();

    setGameState(prev => ({
      ...prev,
      money: safeMoney(prev.money, prev.money - cost),
      garage: prev.garage.map(s => {
        if (s.car?.instanceId !== carInstanceId) return s;
        return {
          ...s,
          car: {
            ...s.car!,
            attributes:        attrs,
            inRepair:          true,
            repairCompletesAt: now + repairType.durationSec * 1000,
            repairTypeId,
            repairGain:        gain,
            totalRepairCost:   (s.car!.totalRepairCost ?? 0) + cost,
            diagnosisResult:   (s.car!.diagnosisResult ?? []).filter(d => d.repairTypeId !== repairTypeId),
            completedRepairs:  [...(s.car!.completedRepairs ?? []), repairTypeId],
          },
        };
      }),
      activeRepairs: [
        ...prev.activeRepairs,
        {
          carInstanceId,
          repairTypeId,
          startedAt:       now,
          durationSec:     repairType.durationSec,
          conditionGain:   gain,
          cost,
          targetAttribute: repairType.attribute,
        },
      ],
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${repairType.name} iniciada! Pronto em ${repairType.durationSec}s.` };
  }, [saveGame]);

  const DIAGNOSIS_COST = 400;

  const runDiagnosis = useCallback((carInstanceId: string): { success: boolean; message: string; results?: DiagnosisResult[] } => {
    const state = stateRef.current;
    const slot  = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car)        return { success: false, message: 'Carro não encontrado.' };
    if (slot.car.inRepair) return { success: false, message: 'Carro está em reparo.' };

    const car   = slot.car;
    const attrs = car.attributes ?? generateAttributes(car.condition);

    // Diagnóstico só é bloqueado quando TODOS os atributos estão saudáveis (≥ 60)
    const allHealthy = (Object.values(attrs) as number[]).every(v => v >= 60);
    if (allHealthy)
      return { success: false, message: 'Todos os atributos estão em boas condições. Nenhum reparo necessário.' };

    if (state.money < DIAGNOSIS_COST)
      return { success: false, message: `Saldo insuficiente. Diagnóstico custa ${formatMoney(DIAGNOSIS_COST)}.` };

    // Coleta TODOS os reparos disponíveis para TODOS os atributos com problema (< 60)
    const results: DiagnosisResult[] = [];
    (Object.keys(attrs) as AttributeKey[]).forEach(attr => {
      if (attrs[attr] >= 60) return;
      REPAIR_TYPES
        .filter(r => r.attribute === attr && !r.isAlwaysAvailable)
        .forEach(repair => {
          results.push({
            attribute:      attr,
            attributeLabel: ATTR_LABELS[attr],
            repairTypeId:   repair.id,
            repairName:     repair.name,
            repairIcon:     repair.icon,
          });
        });
    });

    // Sempre persiste o resultado ([] = sem problemas) e desconta o custo
    setGameState(prev => ({
      ...prev,
      money: safeMoney(prev.money, prev.money - DIAGNOSIS_COST),
      garage: prev.garage.map(s =>
        s.car?.instanceId === carInstanceId
          ? { ...s, car: { ...s.car!, attributes: attrs, diagnosisResult: results } }
          : s
      ),
    }));

    setTimeout(() => void saveGame(), 400);

    if (results.length === 0)
      return { success: true, message: 'Nenhum tipo de reparo disponível para os atributos com problema.', results: [] };

    const brokenLabels = [...new Set(results.map(r => r.attributeLabel))].join(', ');
    return {
      success: true,
      message: `${results.length} reparo(s) identificado(s): ${brokenLabels}.`,
      results,
    };
  }, [saveGame]);

  const sendOfferToBuyer = useCallback((
    buyerId: string, carInstanceId: string,
    askingPrice: number, includeTradeIn: boolean,
    playerTradeInValuation?: number,
  ): { success: boolean; message: string } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);
    if (!buyer || buyer.state !== 'waiting')
      return { success: false, message: 'Comprador não disponível.' };

    const slot = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car) return { success: false, message: 'Carro não encontrado.' };

    const car = slot.car;

    // Valida compatibilidade do carro com o requisito do comprador
    if (buyer.requirementType === 'model' && buyer.targetModelId) {
      if (car.modelId !== buyer.targetModelId) {
        return {
          success: false,
          message: `Este comprador só aceita: ${buyer.targetModelName ?? 'modelo específico'}.`,
        };
      }
    } else if (buyer.requirementType === 'category' && buyer.targetCategories.length > 0) {
      const carModel = CAR_MODELS.find(m => m.id === car.modelId);
      if (!carModel || !buyer.targetCategories.includes(carModel.category)) {
        return {
          success: false,
          message: `Este comprador só aceita carros da categoria: ${buyer.targetCategories.join(', ')}.`,
        };
      }
    }

    // Validações de trade-in ──────────────────────────────────────────
    // Regra 1: comprador com trade-in DEVE ter pedido de modelo específico.
    // Se o requirementType for 'category', a troca é inválida e é ignorada.
    if (includeTradeIn && buyer.tradeInCar && buyer.requirementType !== 'model') {
      return {
        success: false,
        message: 'Troca inválida: o comprador deve solicitar um modelo específico para incluir um veículo na troca.',
      };
    }

    // Regra 2: FIPE do trade-in deve ser inferior à FIPE do carro vendido.
    // Garante que a troca representa um upgrade lógico para o comprador.
    if (includeTradeIn && buyer.tradeInCar) {
      if (buyer.tradeInCar.fipePrice >= car.fipePrice) {
        return {
          success: false,
          message: 'O carro de troca tem valor FIPE igual ou superior ao que está sendo vendido. Troca não permitida.',
        };
      }

      // Valida valoração customizada do trade-in (se fornecida)
      if (playerTradeInValuation !== undefined) {
        if (playerTradeInValuation < 0) {
          return { success: false, message: 'Valoração do trade-in não pode ser negativa.' };
        }
        const tradeInMarketValue = buyer.tradeInCar.fipePrice * conditionValueFactor(buyer.tradeInCar.condition);
        if (playerTradeInValuation > tradeInMarketValue * 1.05) {
          return {
            success: false,
            message: 'Valoração do trade-in não pode superar o valor de mercado do veículo.',
          };
        }
      }
    }

    const effectiveTradeInValuation =
      includeTradeIn && buyer.tradeInCar && playerTradeInValuation !== undefined
        ? playerTradeInValuation
        : undefined;

    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.map(b =>
        b.id === buyerId
          ? {
              ...b,
              state: 'thinking' as const,
              thinkingStartedAt: Date.now(),
              thinkDuration: Math.floor(Math.random() * 8) + 3, // 3–10 s aleatório
              playerOffer: askingPrice,
              playerIncludedTradeIn: includeTradeIn && !!b.tradeInCar,
              playerTradeInValuation: effectiveTradeInValuation,
              targetCarInstanceId: carInstanceId,
            }
          : b
      ),
    }));
    return { success: true, message: 'Oferta enviada! O comprador está pensando...' };
  }, []);

  const resolveBuyerDecision = useCallback((buyerId: string): { success: boolean; accepted: boolean; message: string; finalPrice?: number; counterOffer?: number } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);
    if (!buyer || buyer.state !== 'thinking')
      return { success: false, accepted: false, message: 'Comprador não está pensando.' };
    if (!buyer.targetCarInstanceId || buyer.playerOffer === undefined)
      return { success: false, accepted: false, message: 'Dados incompletos.' };

    const slot = state.garage.find(s => s.car?.instanceId === buyer.targetCarInstanceId);
    if (!slot?.car) {
      setGameState(prev => ({ ...prev, carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b) }));
      return { success: false, accepted: false, message: 'Carro não encontrado.' };
    }

    const car         = slot.car;
    const playerOffer = buyer.playerOffer;

    // ── Avaliação: aceita, faz contraproposta ou rejeita ────────────
    const buyerMax = calculateBuyerOffer(buyer, car.fipePrice, car.condition);
    const accepted = evaluatePlayerOffer(buyer, playerOffer, car.fipePrice, car.condition);

    if (!accepted) {
      // Contraproposta: só uma por negociação e apenas se oferta não estiver longe demais
      const jaFezContra = buyer.state === 'countering' || buyer.counterOffer !== undefined;
      const dentroDoRange = playerOffer <= buyerMax * COUNTER_OFFER_RATIO;

      if (!jaFezContra && dentroDoRange) {
        // Contra = o máximo real que o comprador pagaria
        const counterValue = buyerMax;
        setGameState(prev => ({
          ...prev,
          carBuyers: prev.carBuyers.map(b =>
            b.id === buyerId
              ? { ...b, state: 'countering' as const, counterOffer: counterValue }
              : b
          ),
        }));
        return {
          success:      true,
          accepted:     false,
          counterOffer: counterValue,
          message:      `${buyer.name} fez uma contraoferta de ${formatMoney(counterValue)}.`,
        };
      }

      // ── Rejeição direta ──────────────────────────────────────────
      const slotIdx   = buyer.slotIndex ?? -1;
      const lockEpoch = currentCycleEpoch();
      setGameState(prev => {
        const locks = [...(prev.buyerSlotLocks ?? [])];
        if (slotIdx >= 0) locks[slotIdx] = lockEpoch;
        return {
          ...prev,
          carBuyers:      prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
          buyerSlotLocks: locks,
        };
      });
      return { success: true, accepted: false, message: `${buyer.name} recusou a oferta. Preço muito alto!` };
    }

    // ── Aceite ────────────────────────────────────────────────────────
    const playerOfferSafe = safeAmount(buyer.playerOffer);
    const purchasePriceSafe = safeAmount(car.purchasePrice);
    let finalPrice = playerOfferSafe;
    let tradeInCar: OwnedCar | undefined;
    if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
      // Usa a valoração personalizada do jogador; se ausente, usa a do comprador.
      const rawValuation = safeAmount(buyer.playerTradeInValuation ?? buyer.tradeInValue);
      // Segurança em profundidade: cap em 95 % do valor de mercado do carro vendido.
      const carMarketValue = safeAmount(car.fipePrice) * conditionValueFactor(car.condition);
      const safeTradeInValue = Math.min(rawValuation, carMarketValue * 0.95);
      finalPrice = Math.max(0, playerOfferSafe - safeTradeInValue);
      tradeInCar = { ...buyer.tradeInCar, completedRepairs: buyer.tradeInCar.completedRepairs ?? [] };
    }
    finalPrice = safeAmount(finalPrice);

    // Comissão do vendedor (3% sobre o valor TOTAL da venda) quando a oferta
    // foi enviada pelo funcionário automaticamente. Aplicada sobre o
    // playerOffer (valor total que o comprador paga), não sobre o lucro.
    const sellerCommission = buyer.offerSentByEmployee
      ? Math.round(playerOfferSafe * SELLER_COMMISSION_RATE)
      : 0;
    const moneyReceived = Math.max(0, finalPrice - sellerCommission);

    const profit     = playerOfferSafe - purchasePriceSafe - sellerCommission;
    const saleRecord = {
      id: generateId(), carInstanceId: car.instanceId, fullName: car.fullName,
      purchasePrice: purchasePriceSafe, salePrice: playerOfferSafe,
      fipePrice: car.fipePrice, condition: car.condition,
      profit, soldAt: Date.now(), gameDay: state.gameTime.day,
    };

    // Garantia: chance de claim se carro tinha condição < 60% e jogador Lv 8+
    const warrantyClaim = maybeGenerateWarrantyClaim(
      car, buyer.name, playerOfferSafe, state.reputation?.level ?? 1, state.nextBuyerCycleAt,
    );

    const slotIdx   = buyer.slotIndex ?? -1;
    const lockEpoch = currentCycleEpoch();

    setGameState(prev => {
      let garage = prev.garage.map(s =>
        s.car?.instanceId === car.instanceId ? { ...s, car: undefined } : s
      );
      if (tradeInCar) {
        const emptySlot = garage.find(s => s.unlocked && !s.car);
        if (emptySlot) garage = garage.map(s => s.id === emptySlot.id ? { ...s, car: tradeInCar } : s);
      }
      const locks = [...(prev.buyerSlotLocks ?? [])];
      if (slotIdx >= 0) locks[slotIdx] = lockEpoch;
      return {
        ...prev,
        money:           safeMoney(prev.money, prev.money + moneyReceived),
        garage,
        // Remove reparos órfãos do carro vendido
        activeRepairs:   prev.activeRepairs.filter(r => r.carInstanceId !== car.instanceId),
        carBuyers:       prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'accepted' as const, finalPrice: playerOfferSafe } : b),
        carSales:        [...prev.carSales, saleRecord],
        totalRevenue:    (prev.totalRevenue ?? 0) + playerOfferSafe,
        salesHistory:    [...(prev.salesHistory ?? []), saleRecord],
        totalProfit:     (prev.totalProfit ?? 0) + profit,
        reputation:      addXp(prev.reputation, XP_REWARDS.carSale).reputation,
        buyerSlotLocks:  locks,
        warrantyClaims:  warrantyClaim
          ? [...(prev.warrantyClaims ?? []), warrantyClaim]
          : (prev.warrantyClaims ?? []),
      };
    });

    setTimeout(() => void saveGame(), 400);
    const msg = sellerCommission > 0
      ? `Venda fechada pelo Vendedor! Lucro: ${formatMoney(profit)} (comissão: ${formatMoney(sellerCommission)})`
      : `Venda confirmada! Lucro: ${formatMoney(profit)}`;
    return { success: true, accepted: true, message: msg };
  }, [saveGame]);

  // ── Resposta do jogador à contraproposta do comprador ─────────────
  //
  // BUG FIX: a versão anterior usava flushSync + mutação de variável externa
  // dentro do updater do setState. Em React StrictMode (dev), updaters de
  // setState rodam DUAS VEZES para detectar efeitos colaterais — na 2ª
  // execução, o `prev` já estava com o buyer em 'accepted', a guarda
  // `buyer.state !== 'countering'` falhava e sobrescrevia `result` para
  // "Nenhuma contraproposta pendente". O usuário via toast de erro mesmo
  // a venda tendo sido aplicada por baixo, e ficava preso na UI.
  //
  // Solução: ler o estado de forma idempotente via stateRef.current FORA
  // do updater, calcular tudo, e usar setGameState apenas para aplicar
  // a transição já decidida — o updater agora é puro e seguro para rodar
  // múltiplas vezes.
  const resolveCounterOffer = useCallback((
    buyerId: string,
    accept: boolean,
  ): { success: boolean; message: string; accepted?: boolean; finalPrice?: number } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);

    if (!buyer || buyer.state !== 'countering' || buyer.counterOffer === undefined) {
      return { success: false, message: 'Nenhuma contraproposta pendente.' };
    }

    const slotIdx   = buyer.slotIndex ?? -1;
    const lockEpoch = currentCycleEpoch();

    // ── Recusa ─────────────────────────────────────────────────────────
    if (!accept) {
      setGameState(prev => {
        const target = prev.carBuyers.find(b => b.id === buyerId);
        if (!target || target.state !== 'countering') return prev;
        const locks = [...(prev.buyerSlotLocks ?? [])];
        if (slotIdx >= 0) locks[slotIdx] = lockEpoch;
        return {
          ...prev,
          carBuyers:      prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
          buyerSlotLocks: locks,
        };
      });
      setTimeout(() => void saveGame(), 400);
      return { success: true, accepted: false, message: `${buyer.name} foi embora.` };
    }

    // ── Aceite — validações ────────────────────────────────────────────
    if (!buyer.targetCarInstanceId) {
      return { success: false, message: 'Dados da contraproposta incompletos.' };
    }

    const slot = state.garage.find(s => s.car?.instanceId === buyer.targetCarInstanceId);
    if (!slot?.car) {
      setGameState(prev => ({
        ...prev,
        carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
      }));
      return { success: false, message: 'Carro não encontrado na garagem.' };
    }

    // ── Cálculos puros (idempotentes) ──────────────────────────────────
    const car               = slot.car;
    const counterPrice      = safeAmount(buyer.counterOffer);
    const purchasePriceSafe = safeAmount(car.purchasePrice);

    let finalPrice = counterPrice;
    let tradeInCar: OwnedCar | undefined;
    if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
      const rawValuation     = safeAmount(buyer.playerTradeInValuation ?? buyer.tradeInValue);
      const carMarketValue   = safeAmount(car.fipePrice) * conditionValueFactor(car.condition);
      const safeTradeInValue = Math.min(rawValuation, carMarketValue * 0.95);
      finalPrice = Math.max(0, counterPrice - safeTradeInValue);
      tradeInCar = { ...buyer.tradeInCar, completedRepairs: buyer.tradeInCar.completedRepairs ?? [] };
    }
    finalPrice = safeAmount(finalPrice);

    // Comissão do vendedor (3% sobre venda total) se a oferta original veio
    // do funcionário. Aplica sobre o valor da contraproposta aceita.
    const sellerCommission = buyer.offerSentByEmployee
      ? Math.round(counterPrice * SELLER_COMMISSION_RATE)
      : 0;
    const moneyReceived = Math.max(0, finalPrice - sellerCommission);

    const profit     = counterPrice - purchasePriceSafe - sellerCommission;
    const saleRecord = {
      id: generateId(),
      carInstanceId: car.instanceId,
      fullName: car.fullName,
      purchasePrice: purchasePriceSafe,
      salePrice: counterPrice,
      fipePrice: car.fipePrice,
      condition: car.condition,
      profit,
      soldAt: Date.now(),
      gameDay: state.gameTime.day,
    };

    // Garantia: chance de claim se carro tinha condição < 60% e jogador Lv 8+
    const warrantyClaim = maybeGenerateWarrantyClaim(
      car, buyer.name, counterPrice, state.reputation?.level ?? 1, state.nextBuyerCycleAt,
    );

    // ── Aplicação do estado (updater puro) ─────────────────────────────
    setGameState(prev => {
      // Guarda contra dupla aplicação em StrictMode: se o buyer já está em
      // 'accepted' (1ª execução já rodou), apenas retorna prev inalterado.
      const target = prev.carBuyers.find(b => b.id === buyerId);
      if (!target || target.state === 'accepted' || target.state === 'rejected') {
        return prev;
      }

      let garage = prev.garage.map(s =>
        s.car?.instanceId === car.instanceId ? { ...s, car: undefined } : s,
      );
      if (tradeInCar) {
        const emptySlot = garage.find(s => s.unlocked && !s.car);
        if (emptySlot) {
          garage = garage.map(s => s.id === emptySlot.id ? { ...s, car: tradeInCar } : s);
        }
      }

      const locks = [...(prev.buyerSlotLocks ?? [])];
      if (slotIdx >= 0) locks[slotIdx] = lockEpoch;

      return {
        ...prev,
        money:          safeMoney(prev.money, prev.money + moneyReceived),
        garage,
        activeRepairs:  prev.activeRepairs.filter(r => r.carInstanceId !== car.instanceId),
        carBuyers:      prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'accepted' as const, finalPrice: counterPrice } : b),
        carSales:       [...prev.carSales, saleRecord],
        totalRevenue:   (prev.totalRevenue ?? 0) + counterPrice,
        salesHistory:   [...(prev.salesHistory ?? []), saleRecord],
        totalProfit:    (prev.totalProfit ?? 0) + profit,
        warrantyClaims: warrantyClaim
          ? [...(prev.warrantyClaims ?? []), warrantyClaim]
          : (prev.warrantyClaims ?? []),
        reputation:     addXp(prev.reputation, XP_REWARDS.carSale).reputation,
        buyerSlotLocks: locks,
      };
    });

    setTimeout(() => void saveGame(), 400);
    const counterMsg = sellerCommission > 0
      ? `Contraproposta aceita pelo Vendedor! Lucro: ${formatMoney(profit)} (comissão: ${formatMoney(sellerCommission)})`
      : `Contraproposta aceita! Lucro: ${formatMoney(profit)}`;
    return {
      success:    true,
      accepted:   true,
      message:    counterMsg,
      finalPrice,
    };
  }, [saveGame]);

  const dismissBuyer = useCallback((buyerId: string) => {
    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.filter(b => b.id !== buyerId),
    }));
  }, []);

  const refreshMarketplace = useCallback(() => {
    // RESPEITA o intervalo de 24h. Se a janela ainda não fechou, é no-op.
    setGameState(prev => {
      const now = Date.now();
      const lastRefresh = prev.marketplaceLastRefresh ?? 0;
      if (now - lastRefresh < MARKETPLACE_REFRESH_MS) {
        return prev;
      }
      return {
        ...prev,
        marketplaceCars:        buildMarketplaceInventory(),
        marketplaceLastRefresh: now,
      };
    });
  }, []);

  const addMoney = useCallback((amount: number) => {
    const safe = isFinite(amount) ? amount : 0;
    setGameState(prev => ({ ...prev, money: isFinite(prev.money) ? prev.money + safe : safe }));
  }, []);

  const spendMoney = useCallback((amount: number): boolean => {
    if (!isFinite(amount) || amount <= 0) return false;
    const state = stateRef.current;
    const currentMoney = isFinite(state.money) ? state.money : 0;
    if (currentMoney - amount < state.overdraftLimit) return false;
    setGameState(prev => ({
      ...prev,
      money: (isFinite(prev.money) ? prev.money : 0) - amount,
    }));
    return true;
  }, []);

  /** Incrementa contador de vitórias em rachas assíncronos */
  const addAsyncRaceWon = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      asyncRacesWon: (prev.asyncRacesWon ?? 0) + 1,
      reputation: addXp(prev.reputation, XP_REWARDS.raceWin).reputation,
    }));
  }, []);

  /**
   * addCarFromGlobal — adiciona carro comprado no marketplace global à garagem.
   * Chamado APÓS a compra ser confirmada no Supabase (buy_marketplace_car RPC).
   */
  const addCarFromGlobal = useCallback((car: MarketplaceCar, finalPrice: number): { success: boolean; message: string } => {
    const state    = stateRef.current;
    const emptySlot = state.garage.find(s => s.unlocked && !s.car);
    if (!emptySlot) return { success: false, message: 'Garagem cheia! Libere uma vaga primeiro.' };
    const safePrice = safeAmount(finalPrice);
    if (state.money - safePrice < state.overdraftLimit)
      return { success: false, message: 'Saldo insuficiente.' };

    const owned: OwnedCar = {
      instanceId:    generateId(),
      modelId:       car.modelId,
      variantId:     car.variantId,
      fullName:      `${car.brand} ${car.model} ${car.trim}`,
      brand:         car.brand,
      model:         car.model,
      trim:          car.trim,
      year:          car.year,
      icon:          car.icon,
      fipePrice:     car.fipePrice,
      condition:     car.condition,
      purchasePrice: safePrice,
      purchasedAt:   Date.now(),
      completedRepairs: [],
      attributes:    generateAttributes(car.condition),
    };

    setGameState(prev => ({
      ...prev,
      money:           safeMoney(prev.money, prev.money - safePrice),
      garage:          prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
      reputation:      addXp(prev.reputation, XP_REWARDS.carPurchase).reputation,
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:      (prev.totalSpent ?? 0) + safePrice,
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${car.brand} ${car.model} adicionado à garagem!` };
  }, [saveGame]);

  /**
   * addOwnedCarToGarage — adiciona um OwnedCar existente (vindo do P2P) à garagem.
   * NÃO desconta dinheiro (o dinheiro já foi descontado antes via spendMoney).
   * Gera novo instanceId para o comprador.
   */
  const addOwnedCarToGarage = useCallback((car: OwnedCar, paidPrice: number): { success: boolean; message: string } => {
    const state     = stateRef.current;
    const emptySlot = state.garage.find(s => s.unlocked && !s.car);
    if (!emptySlot) return { success: false, message: 'Garagem cheia! Libere uma vaga primeiro.' };

    const carToAdd: OwnedCar = {
      ...car,
      instanceId:       generateId(),      // nova instância para o comprador
      purchasePrice:    paidPrice,
      purchasedAt:      Date.now(),
      completedRepairs: car.completedRepairs ?? [],
      inRepair:         undefined,          // remove estado de reparo do vendedor
      attributes:       car.attributes ?? generateAttributes(car.condition),
    };

    setGameState(prev => ({
      ...prev,
      garage:          prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: carToAdd } : s),
      reputation:      addXp(prev.reputation, XP_REWARDS.carPurchase).reputation,
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:      (prev.totalSpent ?? 0) + paidPrice,
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${car.brand} ${car.model} adicionado à garagem!` };
  }, [saveGame]);

  /**
   * applyCarTune — salva upgrades de tunagem no carro da garagem.
   * O desconto de dinheiro é feito pelo chamador (DesempenhoPanel via onSpendMoney).
   */
  const applyCarTune = useCallback((carInstanceId: string, upgrades: TuneUpgrade[]): { success: boolean; message: string } => {
    const state = stateRef.current;
    const slot  = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car) return { success: false, message: 'Carro não encontrado.' };

    setGameState(prev => ({
      ...prev,
      garage: prev.garage.map(s =>
        s.car?.instanceId === carInstanceId
          ? { ...s, car: { ...s.car!, tuneUpgrades: upgrades } }
          : s
      ),
      reputation: addXp(prev.reputation, XP_REWARDS.tune).reputation,
    }));
    setTimeout(() => void saveGame(), 400);
    return { success: true, message: 'Tunagem aplicada!' };
  }, [saveGame]);

  /**
   * removeCarFromGarage — remove um carro da garagem pelo instanceId.
   * Usado quando uma listagem P2P do vendedor é marcada como vendida.
   */
  const removeCarFromGarage = useCallback((instanceId: string): void => {
    setGameState(prev => ({
      ...prev,
      garage: prev.garage.map(s =>
        s.car?.instanceId === instanceId ? { ...s, car: undefined } : s
      ),
    }));
    setTimeout(() => void saveGame(), 400);
  }, [saveGame]);

  // ─────────────────────────────────────────────────────────────────
  // Funcionários (staff) — contratar / demitir / configurar
  // ─────────────────────────────────────────────────────────────────

  const hireEmployee = useCallback((id: EmployeeId, config: EmployeeConfig = {}): { success: boolean; message: string } => {
    const state = stateRef.current;
    const meta = EMPLOYEES_CATALOG[id];
    if (!meta) return { success: false, message: 'Funcionário desconhecido.' };
    if ((state.employees ?? []).some(e => e.id === id)) {
      return { success: false, message: 'Esse funcionário já está contratado.' };
    }
    // Não exige saldo positivo na contratação — salário só é cobrado no
    // próximo dia in-game.
    const newEmployee: HiredEmployee = {
      id,
      hiredAt:     Date.now(),
      config:      { ...config },
      lastPaidDay: state.gameTime.day,
    };
    setGameState(prev => ({
      ...prev,
      employees: [...(prev.employees ?? []), newEmployee],
    }));
    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${meta.name} contratado!` };
  }, [saveGame]);

  const fireEmployee = useCallback((id: EmployeeId): { success: boolean; message: string } => {
    const meta = EMPLOYEES_CATALOG[id];
    if (!meta) return { success: false, message: 'Funcionário desconhecido.' };
    setGameState(prev => ({
      ...prev,
      employees: (prev.employees ?? []).filter(e => e.id !== id),
    }));
    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${meta.name} demitido.` };
  }, [saveGame]);

  const updateEmployeeConfig = useCallback((id: EmployeeId, config: EmployeeConfig): { success: boolean; message: string } => {
    const meta = EMPLOYEES_CATALOG[id];
    if (!meta) return { success: false, message: 'Funcionário desconhecido.' };
    setGameState(prev => ({
      ...prev,
      employees: (prev.employees ?? []).map(e =>
        e.id === id ? { ...e, config: { ...e.config, ...config } } : e
      ),
    }));
    setTimeout(() => void saveGame(), 400);
    return { success: true, message: 'Configuração atualizada.' };
  }, [saveGame]);

  // ─────────────────────────────────────────────────────────────────
  // Garantias — pagar reparo do cliente ou recusar (carro volta)
  // ─────────────────────────────────────────────────────────────────

  const payWarrantyClaim = useCallback((claimId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    const claim = (state.warrantyClaims ?? []).find(c => c.id === claimId);
    if (!claim) return { success: false, message: 'Claim não encontrado.' };
    if (claim.status !== 'pending') return { success: false, message: 'Claim já resolvido.' };
    if (state.money - claim.repairCost < state.overdraftLimit) {
      return { success: false, message: `Saldo insuficiente para pagar ${formatMoney(claim.repairCost)}.` };
    }

    setGameState(prev => ({
      ...prev,
      money:          safeMoney(prev.money, prev.money - claim.repairCost),
      warrantyClaims: (prev.warrantyClaims ?? []).map(c =>
        c.id === claimId ? { ...c, status: 'paid' as const } : c
      ),
    }));
    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `Reparo pago: ${formatMoney(claim.repairCost)}` };
  }, [saveGame]);

  const refuseWarrantyClaim = useCallback((claimId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    const claim = (state.warrantyClaims ?? []).find(c => c.id === claimId);
    if (!claim) return { success: false, message: 'Claim não encontrado.' };
    if (claim.status !== 'pending') return { success: false, message: 'Claim já resolvido.' };

    setGameState(prev => {
      // Subtrai o valor da venda do saldo
      const newMoney = safeMoney(prev.money, prev.money - claim.salePrice);
      // Tenta colocar o carro de volta na garagem (slot livre)
      const emptySlot = prev.garage.find(s => s.unlocked && !s.car);
      const garage = emptySlot
        ? prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: { ...claim.car } } : s)
        : prev.garage;
      return {
        ...prev,
        money:          newMoney,
        garage,
        warrantyClaims: (prev.warrantyClaims ?? []).map(c =>
          c.id === claimId ? { ...c, status: 'refused' as const } : c
        ),
      };
    });
    setTimeout(() => void saveGame(), 400);
    return {
      success: true,
      message: `Recusou: -${formatMoney(claim.salePrice)} e ${claim.car.brand} ${claim.car.model} de volta na garagem`,
    };
  }, [saveGame]);

  const dismissWarrantyClaim = useCallback((claimId: string): void => {
    setGameState(prev => ({
      ...prev,
      warrantyClaims: (prev.warrantyClaims ?? []).filter(c => c.id !== claimId),
    }));
    setTimeout(() => void saveGame(), 400);
  }, [saveGame]);


  // ── Derived values ────────────────────────────────────────────
  const garageCarCount = gameState.garage.filter(s => s.car).length;
  const reputation     = gameState.reputation;

  // ── Expõe estado e ações ──────────────────────────────────────
  return {
    gameState,
    gameLoaded,
    isSyncing,
    saveStatus,
    formatGameTime,
    reputation,
    garageCarCount,

    buyCarFromMarketplace,
    addCarFromGlobal,
    addOwnedCarToGarage,
    removeCarFromGarage,

    unlockGarageSlot,
    startRepair,
    runDiagnosis,
    applyCarTune,

    sendOfferToBuyer,
    resolveBuyerDecision,
    resolveCounterOffer,
    dismissBuyer,

    refreshMarketplace,
    addMoney,
    spendMoney,
    addAsyncRaceWon,
    saveGame,
    resetGame,

    // Funcionários
    hireEmployee,
    fireEmployee,
    updateEmployeeConfig,

    // Garantias
    payWarrantyClaim,
    refuseWarrantyClaim,
    dismissWarrantyClaim,

    repairTypes:    REPAIR_TYPES,
    garageSlotDefs: GARAGE_SLOTS,
  };
}
