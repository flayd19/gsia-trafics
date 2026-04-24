// =====================================================================
// useCarGameLogic — lógica central do jogo de compra e venda de carros
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, OwnedCar } from '@/types/game';
import { ensureGameState } from '@/types/game';
import {
  GARAGE_SLOTS,
  buildMarketplaceInventory,
  type MarketplaceCar,
} from '@/data/cars';
import { REPAIR_TYPES } from '@/data/repairTypes';
import { spawnBuyer, evaluatePlayerOffer } from '@/data/carBuyers';
import { ensureReputation, addXp } from '@/lib/reputation';
import { supabase } from '@/integrations/supabase/client';

// ── Config ────────────────────────────────────────────────────────
const GAME_TICK_MS            = 1_000;
const GAME_MINUTES_PER_TICK   = 10;
const BUYER_SPAWN_INTERVAL_MS = 25_000;
const MAX_BUYERS              = 4;
const MARKETPLACE_REFRESH_MS  = 5 * 60_000;
const INTEREST_RATE           = 0.02;
const AUTO_SAVE_INTERVAL_MS   = 30_000;
const LOCAL_SAVE_KEY          = 'gsia_car_game_v1';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Estado inicial ────────────────────────────────────────────────
function buildInitialState(): GameState {
  return ensureGameState({
    money: 50_000,
    garage: [{ id: 1, unlocked: true, unlockCost: 0, car: undefined }],
    marketplaceCars: buildMarketplaceInventory(),
    marketplaceLastRefresh: Date.now(),
  });
}

// ── Prepara para salvar: remove dados transitórios grandes ─────────
function serializeForSave(state: GameState): object {
  return {
    ...state,
    marketplaceCars: [],  // regenerado no load
    carBuyers: state.carBuyers.filter(
      b => b.state === 'waiting' || b.state === 'thinking'
    ),
  };
}

// ── Aplica save carregado: regenera marketplace se vazio ───────────
function applyLoadedSave(raw: unknown): GameState {
  const saved = ensureGameState(raw as Partial<GameState>);
  if (!saved.marketplaceCars || saved.marketplaceCars.length === 0) {
    saved.marketplaceCars        = buildMarketplaceInventory();
    saved.marketplaceLastRefresh = Date.now();
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
async function saveSupabase(userId: string, state: GameState): Promise<boolean> {
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

    // Atualiza perfil para ranking (fire-and-forget)
    void (supabase as any)
      .from('player_profiles')
      .upsert(
        {
          user_id:         userId,
          total_patrimony: state.money,
          level:           state.reputation?.level ?? 1,
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
    const { hour, minute } = stateRef.current.gameTime;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
    const ok = await saveSupabase(user.id, state);
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

        // Finaliza reparos concluídos
        const pendingRepairs  = next.activeRepairs.filter(r => now < r.startedAt + r.durationSec * 1000);
        const finishedRepairs = next.activeRepairs.filter(r => now >= r.startedAt + r.durationSec * 1000);
        if (finishedRepairs.length > 0) {
          let updatedGarage = [...next.garage];
          finishedRepairs.forEach(rep => {
            updatedGarage = updatedGarage.map(slot => {
              if (!slot.car || slot.car.instanceId !== rep.carInstanceId) return slot;
              return {
                ...slot,
                car: {
                  ...slot.car,
                  condition:        Math.min(100, slot.car.condition + rep.conditionGain),
                  inRepair:         false,
                  repairCompletesAt: undefined,
                  repairTypeId:     undefined,
                  repairGain:       undefined,
                  completedRepairs: [...(slot.car.completedRepairs ?? []), rep.repairTypeId],
                },
              };
            });
          });
          next = { ...next, activeRepairs: pendingRepairs, garage: updatedGarage };
        }

        // Expira compradores
        const buyers = next.carBuyers
          .map(b => {
            if (b.state !== 'waiting' && b.state !== 'thinking') return b;
            if ((now - b.arrivedAt) / 1000 > b.patience) return { ...b, state: 'expired' as const };
            return b;
          })
          .filter(b => {
            if (b.state === 'expired' || b.state === 'rejected')
              return (now - b.arrivedAt) < (b.patience + 5) * 1000;
            if (b.state === 'accepted')
              return (now - (b.thinkingStartedAt ?? b.arrivedAt)) < 8000;
            return true;
          });

        // Finaliza quem estava "pensando" por mais de 10s
        const resolvedBuyers = buyers.map(b => {
          if (b.state !== 'thinking') return b;
          if ((now - (b.thinkingStartedAt ?? now)) / 1000 < 10) return b;
          if (!b.targetCarInstanceId || b.playerOffer === undefined)
            return { ...b, state: 'rejected' as const };
          return b;
        });
        next = { ...next, carBuyers: resolvedBuyers };

        // Spawn de novos compradores
        const realBuyers = next.carBuyers.filter(b => b.state === 'waiting' || b.state === 'thinking');
        if (realBuyers.length < MAX_BUYERS && now - next.lastBuyerGeneration > BUYER_SPAWN_INTERVAL_MS) {
          next = {
            ...next,
            carBuyers: [...next.carBuyers, spawnBuyer(generateId())],
            lastBuyerGeneration: now,
          };
        }

        // Atualiza marketplace a cada 5 min
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
      purchasePrice: car.askingPrice, purchasedAt: Date.now(),
      completedRepairs: [],
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

  const makeOfferOnMarketplace = useCallback((carId: string, offerValue: number): { success: boolean; message: string } => {
    const state = stateRef.current;
    const car = state.marketplaceCars.find(c => c.id === carId);
    if (!car)         return { success: false, message: 'Carro não encontrado.' };
    if (offerValue <= 0) return { success: false, message: 'Oferta inválida.' };

    const emptySlot = state.garage.find(s => s.unlocked && !s.car);
    if (!emptySlot) return { success: false, message: 'Garagem cheia!' };
    if (state.money - offerValue < state.overdraftLimit)
      return { success: false, message: 'Saldo insuficiente.' };

    const accepted =
      offerValue >= car.askingPrice * 0.80
        ? true
        : Math.random() < (offerValue / car.askingPrice) * 0.8;

    if (!accepted)
      return { success: false, message: `Oferta de ${formatMoney(offerValue)} recusada. Tente um valor maior.` };

    const owned: OwnedCar = {
      instanceId: generateId(),
      modelId: car.modelId, variantId: car.variantId,
      fullName: `${car.brand} ${car.model} ${car.trim}`,
      brand: car.brand, model: car.model, trim: car.trim,
      year: car.year, icon: car.icon,
      fipePrice: car.fipePrice, condition: car.condition,
      purchasePrice: offerValue, purchasedAt: Date.now(),
      completedRepairs: [],
    };

    setGameState(prev => ({
      ...prev,
      money:           prev.money - offerValue,
      garage:          prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
      marketplaceCars: prev.marketplaceCars.filter(c => c.id !== carId),
      totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
      totalSpent:      (prev.totalSpent ?? 0) + offerValue,
    }));

    setTimeout(() => void saveGame(), 400);
    const msg = offerValue >= car.askingPrice * 0.80
      ? `Oferta aceita! ${car.brand} ${car.model} na garagem.`
      : `Oferta com desconto! ${car.brand} ${car.model} na garagem por ${formatMoney(offerValue)}.`;
    return { success: true, message: msg };
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
    if (!slot?.car)  return { success: false, message: 'Carro não encontrado na garagem.' };
    if (slot.car.inRepair) return { success: false, message: 'Carro já está em reparo.' };
    if ((slot.car.completedRepairs ?? []).includes(repairTypeId))
      return { success: false, message: `${repairType.name} já foi realizada neste carro.` };
    if (repairType.maxCondition !== undefined && slot.car.condition >= repairType.maxCondition)
      return { success: false, message: 'O carro está em boas condições para esse tipo de reparo.' };
    if (repairType.minCondition !== undefined && slot.car.condition > repairType.minCondition)
      return { success: false, message: 'Condição mínima não atingida para esse reparo.' };
    if (state.money < repairType.baseCost)
      return { success: false, message: `Você precisa de ${formatMoney(repairType.baseCost)}.` };

    const now = Date.now();
    setGameState(prev => ({
      ...prev,
      money:  prev.money - repairType.baseCost,
      garage: prev.garage.map(s =>
        s.car?.instanceId === carInstanceId
          ? { ...s, car: { ...s.car!, inRepair: true, repairCompletesAt: now + repairType.durationSec * 1000, repairTypeId, repairGain: repairType.conditionGain } }
          : s
      ),
      activeRepairs: [
        ...prev.activeRepairs,
        { carInstanceId, repairTypeId, startedAt: now, durationSec: repairType.durationSec, conditionGain: repairType.conditionGain, cost: repairType.baseCost },
      ],
    }));

    setTimeout(() => void saveGame(), 400);
    return { success: true, message: `${repairType.name} iniciada! Pronto em ${repairType.durationSec}s.` };
  }, [saveGame]);

  const sendOfferToBuyer = useCallback((
    buyerId: string, carInstanceId: string,
    askingPrice: number, includeTradeIn: boolean,
  ): { success: boolean; message: string } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);
    if (!buyer || buyer.state !== 'waiting')
      return { success: false, message: 'Comprador não disponível.' };
    if (!state.garage.find(s => s.car?.instanceId === carInstanceId)?.car)
      return { success: false, message: 'Carro não encontrado.' };

    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.map(b =>
        b.id === buyerId
          ? { ...b, state: 'thinking' as const, thinkingStartedAt: Date.now(), playerOffer: askingPrice, playerIncludedTradeIn: includeTradeIn && !!b.tradeInCar, targetCarInstanceId: carInstanceId }
          : b
      ),
    }));
    return { success: true, message: 'Oferta enviada! O comprador está pensando...' };
  }, []);

  const resolveBuyerDecision = useCallback((buyerId: string): { success: boolean; accepted: boolean; message: string; finalPrice?: number } => {
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

    const car      = slot.car;
    const accepted = evaluatePlayerOffer(buyer, buyer.playerOffer, car.fipePrice, car.condition);

    if (!accepted) {
      setGameState(prev => ({ ...prev, carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b) }));
      return { success: true, accepted: false, message: `${buyer.name} recusou a oferta. Preço muito alto!` };
    }

    let finalPrice = buyer.playerOffer;
    let tradeInCar: OwnedCar | undefined;
    if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
      finalPrice = Math.max(0, buyer.playerOffer - buyer.tradeInValue);
      tradeInCar = { ...buyer.tradeInCar, completedRepairs: buyer.tradeInCar.completedRepairs ?? [] };
    }

    const profit     = buyer.playerOffer - car.purchasePrice;
    const saleRecord = {
      id: generateId(), carInstanceId: car.instanceId, fullName: car.fullName,
      purchasePrice: car.purchasePrice, salePrice: buyer.playerOffer,
      fipePrice: car.fipePrice, condition: car.condition,
      profit, soldAt: Date.now(), gameDay: state.gameTime.day,
    };

    setGameState(prev => {
      let garage = prev.garage.map(s =>
        s.car?.instanceId === car.instanceId ? { ...s, car: undefined } : s
      );
      if (tradeInCar) {
        const emptySlot = garage.find(s => s.unlocked && !s.car);
        if (emptySlot) garage = garage.map(s => s.id === emptySlot.id ? { ...s, car: tradeInCar } : s);
      }
      return {
        ...prev,
        money:           prev.money + finalPrice,
        garage,
        carBuyers:       prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'accepted' as const, finalPrice: buyer.playerOffer } : b),
        carSales:        [...prev.carSales, saleRecord],
        totalRevenue:    (prev.totalRevenue ?? 0) + buyer.playerOffer,
        salesHistory:    [...(prev.salesHistory ?? []), saleRecord],
        totalProfit:     (prev.totalProfit ?? 0) + profit,
        reputation:      addXp(prev.reputation, 3).reputation,
      };
    });

    setTimeout(() => void saveGame(), 400);
    return { success: true, accepted: true, message: `Venda confirmada! Lucro: ${formatMoney(profit)}` };
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
    makeOfferOnMarketplace,
    addCarFromGlobal,
    addOwnedCarToGarage,
    removeCarFromGarage,

    unlockGarageSlot,
    startRepair,

    sendOfferToBuyer,
    resolveBuyerDecision,
    dismissBuyer,

    refreshMarketplace,
    addMoney,
    spendMoney,
    saveGame,
    resetGame,

    repairTypes:    REPAIR_TYPES,
    garageSlotDefs: GARAGE_SLOTS,
  };
}

   