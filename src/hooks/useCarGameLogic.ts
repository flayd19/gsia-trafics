// =====================================================================
// useCarGameLogic — lógica central do jogo de compra e venda de carros
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
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
import { ensureReputation, addXp } from '@/lib/reputation';
import { supabase } from '@/integrations/supabase/client';

// ── Config ────────────────────────────────────────────────────────
const GAME_TICK_MS            = 1_000;
// 1 dia real = 3 min reais = 180 ticks × 8 min/tick = 1440 min = 24h in-game
const GAME_MINUTES_PER_TICK   = 8;
const MARKETPLACE_REFRESH_MS  = 24 * 60 * 60_000; // 24 horas reais
const INTEREST_RATE           = 0.02;
const AUTO_SAVE_INTERVAL_MS   = 30_000;
const LOCAL_SAVE_KEY          = 'gsia_car_game_v1';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  return {
    ...state,
    marketplaceCars: [],  // regenerado no load
    carBuyers: state.carBuyers.filter(
      b => b.state === 'waiting' || b.state === 'thinking' || b.state === 'countering'
    ),
  };
}

// ── Aplica save carregado: regenera marketplace + compradores se necessário ──
function applyLoadedSave(raw: unknown): GameState {
  const saved = ensureGameState(raw as Partial<GameState>);

  // Regenera marketplace se vazio
  if (!saved.marketplaceCars || saved.marketplaceCars.length === 0) {
    saved.marketplaceCars        = buildMarketplaceInventory();
    saved.marketplaceLastRefresh = Date.now();
  }

  // Regenera compradores apenas se o ciclo já encerrou (comparação por timestamp absoluto)
  const now = Date.now();
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
    const { error } = await (supabase as any)
      .from('game_progress')
      .upsert(
        {
          user_id:       userId,
          car_game_data: serializeForSave(state),
          money:         state.money,
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
      // Prefere cloud se for mais avançado (mais dias jogados)
      const useCloud = !local || cloud.gameTime.day >= local.gameTime.day;
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
        let next = { ...prev };

        // Avança tempo in-game
        let { day, hour, minute } = next.gameTime;
        minute += GAME_MINUTES_PER_TICK;
        while (minute >= 60) { minute -= 60; hour++; }
        while (hour   >= 24) { hour   -= 24; day++;  }
        next = { ...next, gameTime: { ...next.gameTime, day, hour, minute, lastUpdate: now } };

        // Juros do cheque especial
        if (next.money < 0 && day > next.lastInterestCalculation) {
          next = {
            ...next,
            money: next.money - Math.abs(next.money) * INTEREST_RATE,
            lastInterestCalculation: day,
          };
        }

        // Aluguel diário: cobrado apenas por vagas OCUPADAS (100 × 2^(slot-1) por dia)
        if (day > next.lastRentCharge) {
          const dailyRent = next.garage
            .filter(s => s.unlocked && s.car)
            .reduce((sum, slot) => sum + garageSlotDailyCost(slot.id), 0);
          next = {
            ...next,
            money:          next.money - dailyRent,
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
          const repairXp = finishedRepairs.length * 2;
          next = { ...next, activeRepairs: pendingRepairs, garage: updatedGarage, reputation: addXp(next.reputation, repairXp).reputation };
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

        // Atualiza marketplace a cada 24h
        if (now - next.marketplaceLastRefresh > MARKETPLACE_REFRESH_MS) {
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
    if (state.money - car.askingPrice < state.overdraftLimit)
      return { success: false, message: 'Saldo insuficiente.' };

    const owned: OwnedCar = {
      instanceId: generateId(),
      modelId: car.modelId, variantId: car.variantId,
      fullName: `${car.brand} ${car.model} ${car.trim}`,
      brand: car.brand, model: car.model, trim: car.trim,
      year: car.year, icon: car.icon,
      fipePrice: car.fipePrice, condition: car.condition,
      mileage: car.mileage,
      purchasePrice: car.askingPrice, purchasedAt: Date.now(),
      completedRepairs: [],
      attributes: generateAttributes(car.condition),
    };

    setGameState(prev => ({
      ...prev,
      money:          prev.money - car.askingPrice,
      garage:         prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
      reputation:     addXp(prev.reputation, 1).reputation,
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:     (prev.totalSpent ?? 0) + car.askingPrice,
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

    setGameState(prev => ({
      ...prev,
      money:  prev.money - slotDef.unlockCost,
      garage: prev.garage.some(s => s.id === slotId)
        ? prev.garage.map(s => s.id === slotId ? { ...s, unlocked: true } : s)
        : [...prev.garage, { id: slotId, unlocked: true, unlockCost: slotDef.unlockCost, car: undefined }],
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
    const cost    = repairType.isAlwaysAvailable
      ? repairType.baseCost
      : calcRepairCost(repairType.baseCost, attrVal);

    if (state.money - cost < state.overdraftLimit)
      return { success: false, message: `Você precisa de ${formatMoney(cost)}.` };

    const gain = Math.round(5 + Math.random() * 23); // RNG 5–28
    const now  = Date.now();

    setGameState(prev => ({
      ...prev,
      money: prev.money - cost,
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
      money: prev.money - DIAGNOSIS_COST,
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
    let finalPrice = buyer.playerOffer;
    let tradeInCar: OwnedCar | undefined;
    if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
      // Usa a valoração personalizada do jogador; se ausente, usa a do comprador.
      const rawValuation = buyer.playerTradeInValuation ?? buyer.tradeInValue;
      // Segurança em profundidade: cap em 95 % do valor de mercado do carro vendido.
      const carMarketValue = car.fipePrice * conditionValueFactor(car.condition);
      const safeTradeInValue = Math.min(rawValuation, carMarketValue * 0.95);
      finalPrice = Math.max(0, buyer.playerOffer - safeTradeInValue);
      tradeInCar = { ...buyer.tradeInCar, completedRepairs: buyer.tradeInCar.completedRepairs ?? [] };
    }

    const profit     = buyer.playerOffer - car.purchasePrice;
    const saleRecord = {
      id: generateId(), carInstanceId: car.instanceId, fullName: car.fullName,
      purchasePrice: car.purchasePrice, salePrice: buyer.playerOffer,
      fipePrice: car.fipePrice, condition: car.condition,
      profit, soldAt: Date.now(), gameDay: state.gameTime.day,
    };

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
        money:           prev.money + finalPrice,
        garage,
        // Remove reparos órfãos do carro vendido
        activeRepairs:   prev.activeRepairs.filter(r => r.carInstanceId !== car.instanceId),
        carBuyers:       prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'accepted' as const, finalPrice: buyer.playerOffer } : b),
        carSales:        [...prev.carSales, saleRecord],
        totalRevenue:    (prev.totalRevenue ?? 0) + buyer.playerOffer,
        salesHistory:    [...(prev.salesHistory ?? []), saleRecord],
        totalProfit:     (prev.totalProfit ?? 0) + profit,
        reputation:      addXp(prev.reputation, 3).reputation,
        buyerSlotLocks:  locks,
      };
    });

    setTimeout(() => void saveGame(), 400);
    return { success: true, accepted: true, message: `Venda confirmada! Lucro: ${formatMoney(profit)}` };
  }, [saveGame]);

  // ── Resposta do jogador à contraproposta do comprador ─────────────
  // Usa flushSync + setGameState(prev=>) para garantir que o estado lido
  // é sempre o mais recente (prev), eliminando bugs de stateRef stale.
  const resolveCounterOffer = useCallback((
    buyerId: string,
    accept: boolean,
  ): { success: boolean; message: string; accepted?: boolean; finalPrice?: number } => {
    // Resultado capturado de dentro do updater (executa de forma síncrona via flushSync)
    let result: { success: boolean; message: string; accepted?: boolean; finalPrice?: number } = {
      success: false,
      message: 'Nenhuma contraproposta pendente.',
    };

    flushSync(() => {
      setGameState(prev => {
        const buyer = prev.carBuyers.find(b => b.id === buyerId);
        if (!buyer || buyer.state !== 'countering' || buyer.counterOffer === undefined) {
          result = { success: false, message: 'Nenhuma contraproposta pendente.' };
          return prev;
        }

        const slotIdx   = buyer.slotIndex ?? -1;
        const lockEpoch = currentCycleEpoch();

        if (!accept) {
          const locks = [...(prev.buyerSlotLocks ?? [])];
          if (slotIdx >= 0) locks[slotIdx] = lockEpoch;
          result = { success: true, accepted: false, message: `${buyer.name} foi embora.` };
          return {
            ...prev,
            carBuyers:      prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
            buyerSlotLocks: locks,
          };
        }

        if (!buyer.targetCarInstanceId) {
          result = { success: false, message: 'Dados da contraproposta incompletos.' };
          return prev;
        }

        const slot = prev.garage.find(s => s.car?.instanceId === buyer.targetCarInstanceId);
        if (!slot?.car) {
          result = { success: false, message: 'Carro não encontrado na garagem.' };
          return {
            ...prev,
            carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
          };
        }

        const car          = slot.car;
        const counterPrice = buyer.counterOffer!;

        let finalPrice = counterPrice;
        let tradeInCar: OwnedCar | undefined;
        if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
          const rawValuation     = buyer.playerTradeInValuation ?? buyer.tradeInValue;
          const carMarketValue   = car.fipePrice * conditionValueFactor(car.condition);
          const safeTradeInValue = Math.min(rawValuation, carMarketValue * 0.95);
          finalPrice  = Math.max(0, counterPrice - safeTradeInValue);
          tradeInCar  = { ...buyer.tradeInCar, completedRepairs: buyer.tradeInCar.completedRepairs ?? [] };
        }

        const profit     = counterPrice - car.purchasePrice;
        const saleRecord = {
          id: generateId(), carInstanceId: car.instanceId, fullName: car.fullName,
          purchasePrice: car.purchasePrice, salePrice: counterPrice,
          fipePrice: car.fipePrice, condition: car.condition,
          profit, soldAt: Date.now(), gameDay: prev.gameTime.day,
        };

        let garage = prev.garage.map(s =>
          s.car?.instanceId === car.instanceId ? { ...s, car: undefined } : s
        );
        if (tradeInCar) {
          const emptySlot = garage.find(s => s.unlocked && !s.car);
          if (emptySlot) garage = garage.map(s => s.id === emptySlot.id ? { ...s, car: tradeInCar } : s);
        }

        const locks = [...(prev.buyerSlotLocks ?? [])];
        if (slotIdx >= 0) locks[slotIdx] = lockEpoch;

        result = {
          success:    true,
          accepted:   true,
          message:    `Contraproposta aceita! Lucro: ${formatMoney(profit)}`,
          finalPrice,
        };

        return {
          ...prev,
          money:          prev.money + finalPrice,
          garage,
          activeRepairs:  prev.activeRepairs.filter(r => r.carInstanceId !== car.instanceId),
          carBuyers:      prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'accepted' as const, finalPrice: counterPrice } : b),
          carSales:       [...prev.carSales, saleRecord],
          totalRevenue:   (prev.totalRevenue ?? 0) + counterPrice,
          salesHistory:   [...(prev.salesHistory ?? []), saleRecord],
          totalProfit:    (prev.totalProfit ?? 0) + profit,
          reputation:     addXp(prev.reputation, 3).reputation,
          buyerSlotLocks: locks,
        };
      });
    });

    setTimeout(() => void saveGame(), 400);
    return result;
  }, [saveGame]);

  const dismissBuyer = useCallback((buyerId: string) => {
    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.filter(b => b.id !== buyerId),
    }));
  }, []);

  const refreshMarketplace = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      marketplaceCars:        buildMarketplaceInventory(),
      marketplaceLastRefresh: Date.now(),
    }));
  }, []);

  const addMoney = useCallback((amount: number) => {
    setGameState(prev => ({ ...prev, money: prev.money + amount }));
  }, []);

  const spendMoney = useCallback((amount: number): boolean => {
    const state = stateRef.current;
    if (state.money - amount < state.overdraftLimit) return false;
    setGameState(prev => ({ ...prev, money: prev.money - amount }));
    return true;
  }, []);

  /** Incrementa contador de vitórias em rachas assíncronos */
  const addAsyncRaceWon = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      asyncRacesWon: (prev.asyncRacesWon ?? 0) + 1,
      reputation: addXp(prev.reputation, 10).reputation,
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
    if (state.money - finalPrice < state.overdraftLimit)
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
      purchasePrice: finalPrice,
      purchasedAt:   Date.now(),
      completedRepairs: [],
      attributes:    generateAttributes(car.condition),
    };

    setGameState(prev => ({
      ...prev,
      money:           prev.money - finalPrice,
      garage:          prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
      reputation:      addXp(prev.reputation, 1).reputation,
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:      (prev.totalSpent ?? 0) + finalPrice,
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
      reputation:      addXp(prev.reputation, 1).reputation,
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
      reputation: addXp(prev.reputation, 2).reputation,
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

    repairTypes:    REPAIR_TYPES,
    garageSlotDefs: GARAGE_SLOTS,
  };
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     