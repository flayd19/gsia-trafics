// =====================================================================
// useCarGameLogic — lógica central do jogo de compra e venda de carros
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, OwnedCar, GarageSlot, CarBuyerNPC } from '@/types/game';
import { ensureGameState } from '@/types/game';
import {
  CAR_MODELS, GARAGE_SLOTS, conditionValueFactor,
  buildMarketplaceInventory, getFipePrice, carFullName, carYear,
  findCarModel, findVariant,
  type MarketplaceCar,
} from '@/data/cars';
import { REPAIR_TYPES } from '@/data/repairTypes';
import { spawnBuyer, evaluatePlayerOffer, calculateBuyerOffer } from '@/data/carBuyers';
import { ensureReputation, addXp, MAX_LEVEL } from '@/lib/reputation';

// ── Config de timing ─────────────────────────────────────────────
const GAME_TICK_MS = 1_000;           // tick real
const GAME_MINUTES_PER_TICK = 10;    // minutos in-game por tick real
const BUYER_SPAWN_INTERVAL_MS = 25_000;  // a cada 25s real spawn novo comprador
const MAX_BUYERS = 4;
const MARKETPLACE_REFRESH_MS = 5 * 60_000; // 5 min
const INTEREST_RATE = 0.02; // 2% por dia de saldo negativo

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Estado inicial ─────────────────────────────────────────────
function buildInitialState(): GameState {
  return ensureGameState({
    money: 30_000, // Começa com R$30k
    garage: [{ id: 1, unlocked: true, unlockCost: 0, car: undefined }],
    marketplaceCars: buildMarketplaceInventory(),
    marketplaceLastRefresh: Date.now(),
  });
}

// ── Hook ───────────────────────────────────────────────────────
export function useCarGameLogic() {
  const [gameState, setGameState] = useState<GameState>(buildInitialState);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // ── Helpers ────────────────────────────────────────────────────

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const formatGameTime = useCallback(() => {
    const { hour, minute } = stateRef.current.gameTime;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }, []);

  // ── Game tick ──────────────────────────────────────────────────
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
        while (hour >= 24) { hour -= 24; day++; }
        next = { ...next, gameTime: { ...next.gameTime, day, hour, minute, lastUpdate: now } };

        // ── Juros do cheque especial (1x por dia in-game) ──────────
        if (next.money < 0 && day > next.lastInterestCalculation) {
          const interest = Math.abs(next.money) * INTEREST_RATE;
          next = {
            ...next,
            money: next.money - interest,
            lastInterestCalculation: day,
          };
        }

        // ── Finaliza reparos concluídos ─────────────────────────────
        const pendingRepairs = next.activeRepairs.filter(r => now < r.startedAt + r.durationSec * 1000);
        const finishedRepairs = next.activeRepairs.filter(r => now >= r.startedAt + r.durationSec * 1000);
        if (finishedRepairs.length > 0) {
          let updatedGarage = [...next.garage];
          finishedRepairs.forEach(rep => {
            updatedGarage = updatedGarage.map(slot => {
              if (!slot.car || slot.car.instanceId !== rep.carInstanceId) return slot;
              const newCondition = Math.min(100, slot.car.condition + rep.conditionGain);
              return {
                ...slot,
                car: {
                  ...slot.car,
                  condition: newCondition,
                  inRepair: false,
                  repairCompletesAt: undefined,
                  repairTypeId: undefined,
                  repairGain: undefined,
                },
              };
            });
          });
          next = { ...next, activeRepairs: pendingRepairs, garage: updatedGarage };
        }

        // ── Expira compradores com patience vencida ─────────────────
        const buyers = next.carBuyers.map(b => {
          if (b.state !== 'waiting' && b.state !== 'thinking') return b;
          const elapsed = (now - b.arrivedAt) / 1000;
          if (elapsed > b.patience) return { ...b, state: 'expired' as const };
          return b;
        });
        // Remove expired/decided depois de 5s
        const activeBuyers = buyers.filter(b => {
          if (b.state === 'expired' || b.state === 'rejected') {
            return (now - b.arrivedAt) < (b.patience + 5) * 1000;
          }
          if (b.state === 'accepted') {
            return (now - (b.thinkingStartedAt ?? b.arrivedAt)) < 8000;
          }
          return true;
        });

        // ── Finaliza compradores que estavam "pensando" ─────────────
        const resolvedBuyers = activeBuyers.map(b => {
          if (b.state !== 'thinking') return b;
          const thinkElapsed = (now - (b.thinkingStartedAt ?? now)) / 1000;
          if (thinkElapsed < 10) return b; // ainda pensando
          // Hora de decidir
          if (!b.targetCarInstanceId || b.playerOffer === undefined) {
            return { ...b, state: 'rejected' as const };
          }
          // Busca carro na garagem pelo instanceId
          return b; // resultado real é aplicado em sellCarToBuyer
        });

        next = { ...next, carBuyers: resolvedBuyers };

        // ── Spawn de novos compradores ──────────────────────────────
        const realBuyers = next.carBuyers.filter(b => b.state === 'waiting' || b.state === 'thinking');
        if (realBuyers.length < MAX_BUYERS && now - next.lastBuyerGeneration > BUYER_SPAWN_INTERVAL_MS) {
          const newBuyer = spawnBuyer(generateId());
          next = {
            ...next,
            carBuyers: [...next.carBuyers, newBuyer],
            lastBuyerGeneration: now,
          };
        }

        // ── Atualiza marketplace a cada 5 min ────────────────────────
        if (now - next.marketplaceLastRefresh > MARKETPLACE_REFRESH_MS) {
          next = {
            ...next,
            marketplaceCars: buildMarketplaceInventory(),
            marketplaceLastRefresh: now,
          };
        }

        return next;
      });
    }, GAME_TICK_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [gameLoaded]);

  // ── Hydrate (carrega save) ──────────────────────────────────────
  const hydrateGameState = useCallback((saved: Partial<GameState>) => {
    setGameState(ensureGameState(saved));
    setGameLoaded(true);
  }, []);

  useEffect(() => {
    // Sem backend de save por enquanto — só inicia o jogo
    setGameLoaded(true);
  }, []);

  // ── AÇÕES DO JOGADOR ──────────────────────────────────────────

  /** Compra um carro do marketplace */
  const buyCarFromMarketplace = useCallback((car: MarketplaceCar): { success: boolean; message: string } => {
    const state = stateRef.current;
    // Verifica vaga na garagem
    const emptySlot = state.garage.find(s => s.unlocked && !s.car);
    if (!emptySlot) {
      return { success: false, message: 'Garagem cheia! Compre mais vagas.' };
    }
    // Verifica dinheiro
    const newBalance = state.money - car.askingPrice;
    if (newBalance < state.overdraftLimit) {
      return { success: false, message: 'Saldo insuficiente.' };
    }
    // Cria instância do carro
    const owned: OwnedCar = {
      instanceId: generateId(),
      modelId: car.modelId,
      variantId: car.variantId,
      fullName: `${car.brand} ${car.model} ${car.trim}`,
      brand: car.brand,
      model: car.model,
      trim: car.trim,
      year: car.year,
      icon: car.icon,
      fipePrice: car.fipePrice,
      condition: car.condition,
      purchasePrice: car.askingPrice,
      purchasedAt: Date.now(),
    };
    // Remove do marketplace + coloca na garagem
    setGameState(prev => {
      const garage = prev.garage.map(s =>
        s.id === emptySlot.id ? { ...s, car: owned } : s
      );
      // Ganha XP por compra
      const rep = addXp(prev.reputation, 1).reputation;
      return {
        ...prev,
        money: newBalance,
        garage,
        reputation: rep,
        totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
        totalSpent: (prev.totalSpent ?? 0) + car.askingPrice,
        marketplaceCars: prev.marketplaceCars.filter(c => c.id !== car.id),
      };
    });
    return { success: true, message: `${car.brand} ${car.model} adicionado à garagem!` };
  }, []);

  /** Faz oferta em carro do marketplace */
  const makeOfferOnMarketplace = useCallback((carId: string, offerValue: number): { success: boolean; message: string } => {
    const state = stateRef.current;
    const car = state.marketplaceCars.find(c => c.id === carId);
    if (!car) return { success: false, message: 'Carro não encontrado.' };
    if (offerValue <= 0) return { success: false, message: 'Oferta inválida.' };

    // Se oferta >= 80% do asking price, aceita automaticamente
    const acceptThreshold = car.askingPrice * 0.80;
    if (offerValue >= acceptThreshold) {
      // Tenta comprar direto com o valor da oferta
      const emptySlot = state.garage.find(s => s.unlocked && !s.car);
      if (!emptySlot) return { success: false, message: 'Garagem cheia!' };
      const newBalance = state.money - offerValue;
      if (newBalance < state.overdraftLimit) return { success: false, message: 'Saldo insuficiente.' };

      const owned: OwnedCar = {
        instanceId: generateId(),
        modelId: car.modelId,
        variantId: car.variantId,
        fullName: `${car.brand} ${car.model} ${car.trim}`,
        brand: car.brand,
        model: car.model,
        trim: car.trim,
        year: car.year,
        icon: car.icon,
        fipePrice: car.fipePrice,
        condition: car.condition,
        purchasePrice: offerValue,
        purchasedAt: Date.now(),
      };
      setGameState(prev => ({
        ...prev,
        money: newBalance,
        garage: prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
        marketplaceCars: prev.marketplaceCars.filter(c => c.id !== carId),
        totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
        totalSpent: (prev.totalSpent ?? 0) + offerValue,
      }));
      return { success: true, message: `Oferta aceita! ${car.brand} ${car.model} na garagem.` };
    }

    // Oferta baixa: marca como pendente (ficará 30s, pode ser recusada)
    const acceptChance = (offerValue / car.askingPrice) * 0.8; // chance baseada no % da oferta
    const accepted = Math.random() < acceptChance;

    if (accepted) {
      const emptySlot = state.garage.find(s => s.unlocked && !s.car);
      if (!emptySlot) return { success: false, message: 'Garagem cheia!' };
      const newBalance = state.money - offerValue;
      if (newBalance < state.overdraftLimit) return { success: false, message: 'Saldo insuficiente.' };
      const owned: OwnedCar = {
        instanceId: generateId(),
        modelId: car.modelId,
        variantId: car.variantId,
        fullName: `${car.brand} ${car.model} ${car.trim}`,
        brand: car.brand,
        model: car.model,
        trim: car.trim,
        year: car.year,
        icon: car.icon,
        fipePrice: car.fipePrice,
        condition: car.condition,
        purchasePrice: offerValue,
        purchasedAt: Date.now(),
      };
      setGameState(prev => ({
        ...prev,
        money: newBalance,
        garage: prev.garage.map(s => s.id === emptySlot.id ? { ...s, car: owned } : s),
        marketplaceCars: prev.marketplaceCars.filter(c => c.id !== carId),
        totalCarsBought: (prev.totalCarsBought ?? 0) + 1,
        totalSpent: (prev.totalSpent ?? 0) + offerValue,
      }));
      return { success: true, message: `Oferta aceita com desconto! ${car.brand} ${car.model} na garagem por ${formatMoney(offerValue)}.` };
    } else {
      return { success: false, message: `Oferta de ${formatMoney(offerValue)} recusada. Tente um valor maior.` };
    }
  }, []);

  /** Desbloqueia slot da garagem */
  const unlockGarageSlot = useCallback((slotId: number): { success: boolean; message: string } => {
    const state = stateRef.current;
    const slotDef = GARAGE_SLOTS.find(s => s.id === slotId);
    if (!slotDef) return { success: false, message: 'Slot inválido.' };
    const existing = state.garage.find(s => s.id === slotId);
    if (existing?.unlocked) return { success: false, message: 'Slot já desbloqueado.' };
    if (state.money < slotDef.unlockCost) {
      return { success: false, message: `Você precisa de ${formatMoney(slotDef.unlockCost)}.` };
    }
    setGameState(prev => ({
      ...prev,
      money: prev.money - slotDef.unlockCost,
      garage: prev.garage.some(s => s.id === slotId)
        ? prev.garage.map(s => s.id === slotId ? { ...s, unlocked: true } : s)
        : [...prev.garage, { id: slotId, unlocked: true, unlockCost: slotDef.unlockCost, car: undefined }],
    }));
    return { success: true, message: `Vaga ${slotId} desbloqueada!` };
  }, []);

  /** Inicia reparo de um carro */
  const startRepair = useCallback((carInstanceId: string, repairTypeId: string): { success: boolean; message: string } => {
    const state = stateRef.current;
    const repairType = REPAIR_TYPES.find(r => r.id === repairTypeId);
    if (!repairType) return { success: false, message: 'Tipo de reparo inválido.' };

    // Encontra o carro
    const slot = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car) return { success: false, message: 'Carro não encontrado na garagem.' };
    if (slot.car.inRepair) return { success: false, message: 'Carro já está em reparo.' };

    // Verifica se reparo faz sentido (condição max)
    if (repairType.maxCondition !== undefined && slot.car.condition >= repairType.maxCondition) {
      return { success: false, message: 'O carro está em boas condições para esse tipo de reparo.' };
    }
    if (repairType.minCondition !== undefined && slot.car.condition > repairType.minCondition) {
      return { success: false, message: 'Condição mínima não atingida para esse reparo.' };
    }
    if (state.money < repairType.baseCost) {
      return { success: false, message: `Você precisa de ${formatMoney(repairType.baseCost)}.` };
    }

    const now = Date.now();
    setGameState(prev => ({
      ...prev,
      money: prev.money - repairType.baseCost,
      garage: prev.garage.map(s =>
        s.car?.instanceId === carInstanceId
          ? {
              ...s,
              car: {
                ...s.car!,
                inRepair: true,
                repairCompletesAt: now + repairType.durationSec * 1000,
                repairTypeId,
                repairGain: repairType.conditionGain,
              },
            }
          : s
      ),
      activeRepairs: [
        ...prev.activeRepairs,
        {
          carInstanceId,
          repairTypeId,
          startedAt: now,
          durationSec: repairType.durationSec,
          conditionGain: repairType.conditionGain,
          cost: repairType.baseCost,
        },
      ],
    }));
    return { success: true, message: `${repairType.name} iniciada! Pronto em ${repairType.durationSec}s.` };
  }, []);

  /** Envia oferta para um comprador NPC */
  const sendOfferToBuyer = useCallback((
    buyerId: string,
    carInstanceId: string,
    askingPrice: number,
    includeTradeIn: boolean,
  ): { success: boolean; message: string } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);
    if (!buyer || buyer.state !== 'waiting') {
      return { success: false, message: 'Comprador não disponível.' };
    }
    const slot = state.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car) return { success: false, message: 'Carro não encontrado.' };

    // Muda estado do comprador para "pensando"
    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.map(b =>
        b.id === buyerId
          ? {
              ...b,
              state: 'thinking' as const,
              thinkingStartedAt: Date.now(),
              playerOffer: askingPrice,
              playerIncludedTradeIn: includeTradeIn && !!b.tradeInCar,
              targetCarInstanceId: carInstanceId,
            }
          : b
      ),
    }));
    return { success: true, message: 'Oferta enviada! O comprador está pensando...' };
  }, []);

  /** Resolve a venda depois dos 10s de "pensando" */
  const resolveBuyerDecision = useCallback((buyerId: string): { success: boolean; accepted: boolean; message: string; finalPrice?: number } => {
    const state = stateRef.current;
    const buyer = state.carBuyers.find(b => b.id === buyerId);
    if (!buyer || buyer.state !== 'thinking') {
      return { success: false, accepted: false, message: 'Comprador não está pensando.' };
    }
    if (!buyer.targetCarInstanceId || buyer.playerOffer === undefined) {
      return { success: false, accepted: false, message: 'Dados incompletos.' };
    }

    const slot = state.garage.find(s => s.car?.instanceId === buyer.targetCarInstanceId);
    if (!slot?.car) {
      setGameState(prev => ({
        ...prev,
        carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
      }));
      return { success: false, accepted: false, message: 'Carro não encontrado.' };
    }

    const car = slot.car;
    const accepted = evaluatePlayerOffer(buyer, buyer.playerOffer, car.fipePrice, car.condition);

    if (!accepted) {
      setGameState(prev => ({
        ...prev,
        carBuyers: prev.carBuyers.map(b => b.id === buyerId ? { ...b, state: 'rejected' as const } : b),
      }));
      return { success: true, accepted: false, message: `${buyer.name} recusou a oferta. Preço muito alto!` };
    }

    // Venda realizada!
    let finalPrice = buyer.playerOffer;
    let tradeInCar: OwnedCar | undefined;

    if (buyer.playerIncludedTradeIn && buyer.tradeInCar && buyer.tradeInValue) {
      finalPrice = Math.max(0, buyer.playerOffer - buyer.tradeInValue);
      tradeInCar = buyer.tradeInCar;
    }

    const profit = buyer.playerOffer - car.purchasePrice;
    const saleRecord = {
      id: generateId(),
      carInstanceId: car.instanceId,
      fullName: car.fullName,
      purchasePrice: car.purchasePrice,
      salePrice: buyer.playerOffer,
      fipePrice: car.fipePrice,
      condition: car.condition,
      profit,
      soldAt: Date.now(),
      gameDay: state.gameTime.day,
    };

    setGameState(prev => {
      // Remove carro da garagem
      let garage = prev.garage.map(s =>
        s.car?.instanceId === car.instanceId ? { ...s, car: undefined } : s
      );
      // Adiciona carro de trade-in (se houver e tiver vaga)
      if (tradeInCar) {
        const emptySlot = garage.find(s => s.unlocked && !s.car);
        if (emptySlot) {
          garage = garage.map(s => s.id === emptySlot.id ? { ...s, car: tradeInCar } : s);
        }
      }
      const rep = addXp(prev.reputation, 3).reputation;
      return {
        ...prev,
        money: prev.money + finalPrice,
        garage,
        carBuyers: prev.carBuyers.map(b =>
          b.id === buyerId
            ? { ...b, state: 'accepted' as const, finalPrice: buyer.playerOffer }
            : b
        ),
        carSales: [...prev.carSales, saleRecord],
        totalRevenue: (prev.totalRevenue ?? 0) + buyer.playerOffer,
        totalCarsSold: (prev.totalCarsSold ?? 0) + 1,
        completedOrders: (prev.completedOrders ?? 0) + 1,
        reputation: rep,
      };
    });

    return {
      success: true,
      accepted: true,
      finalPrice: buyer.playerOffer,
      message: `${buyer.name} comprou o carro por ${formatMoney(buyer.playerOffer)}! Lucro: ${formatMoney(profit)}`,
    };
  }, []);

  /** Remove comprador da lista */
  const dismissBuyer = useCallback((buyerId: string) => {
    setGameState(prev => ({
      ...prev,
      carBuyers: prev.carBuyers.filter(b => b.id !== buyerId),
    }));
  }, []);

  /** Atualiza o marketplace */
  const refreshMarketplace = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      marketplaceCars: buildMarketplaceInventory(),
      marketplaceLastRefresh: Date.now(),
    }));
  }, []);

  // Getters calculados
  const garageCarCount = gameState.garage.filter(s => s.car).length;
  const totalGarageSlots = gameState.garage.filter(s => s.unlocked).length;
  const nextSlotToUnlock = GARAGE_SLOTS.find(s => !gameState.garage.some(gs => gs.id === s.id && gs.unlocked));
  const reputation = ensureReputation(gameState.reputation);

  return {
    gameState,
    gameLoaded,
    isSyncing,
    formatGameTime,
    formatMoney,
    reputation,
    garageCarCount,
    totalGarageSlots,
    nextSlotToUnlock,

    // Ações
    buyCarFromMarketplace,
    makeOfferOnMarketplace,
    unlockGarageSlot,
    startRepair,
    sendOfferToBuyer,
    resolveBuyerDecision,
    dismissBuyer,
    refreshMarketplace,
    hydrateGameState,

    // Dados
    repairTypes: REPAIR_TYPES,
    garageSlotDefs: GARAGE_SLOTS,
  };
}
