import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameState, Product, Vehicle, Driver, Stock, Warehouse, PoliceInterception, VehicleSale, PendingPickup, ProductStats } from '@/types/game';
import { INITIAL_GAME_STATE, PRODUCTS, MARKETPLACE_VEHICLES, MARKETPLACE_DRIVERS, WAREHOUSES } from '@/data/gameData';
import { INITIAL_STORES } from '@/data/stores';
import {
  SUPPLIERS,
  getSupplierById,
  getSupplierItem,
  computeSupplierPrice,
} from '@/data/suppliers';
import { toast } from '@/hooks/use-toast';
import {
  TIER_1_BUYERS,
  TIER_2_BUYERS,
  TIER_3_BUYERS,
  TIER_4_BUYERS,
  ILLICIT_SPECIALISTS,
  Buyer,
  BuyerOrder,
  DEFAULT_PATIENCE_RANGE,
  DEFAULT_BARGAIN_BONUS_RANGE,
  DEFAULT_CATCH_PHRASE,
  BARGAIN_ACCEPT_CHANCE,
} from '@/data/buyers';
import { GAME_FEATURES, isFeatureEnabled } from '@/config/gameFeatures';
import { calculateTripRisks, rollBreakdownCheck, rollSeizureCheck } from '@/utils/tripRisks';
import { useAudio } from '@/hooks/useAudio';
import { updateProductPrices, shouldUpdatePrices } from '@/utils/priceVariation';
import { addXp, ensureReputation, INITIAL_REPUTATION, MAX_LEVEL, meetsLevelRequirement } from '@/lib/reputation';

// Declaração global para acessar gameLogic durante logout
declare global {
  interface Window {
    gameLogicInstance?: {
      gameState: GameState;
      clearAllTripTimeouts: () => void;
      forceResetVehicle: (vehicleId: string) => boolean;
    };
  }
}

/* ----------------------------------------------------------------
 * Box decomposition helpers
 *
 * Um produto pode ser uma CAIXA (tem `boxContents`). Quando isso
 * acontece:
 *  - Ocupa `boxContents.units` slots no veículo/galpão (não 1).
 *  - Ao chegar no estoque, se desmembra em N unidades do produto base.
 *
 * Essas funções ficam fora do hook porque PRODUCTS é estático.
 * ---------------------------------------------------------------- */

/** Quantas unidades de espaço (no veículo/galpão) uma quantidade de produto ocupa. */
const getOccupiedUnits = (productId: string, qty: number): number => {
  const product = PRODUCTS.find((p) => p.id === productId);
  const unitsPerItem = product?.boxContents?.units ?? 1;
  return qty * unitsPerItem;
};

/**
 * Converte (productId, qty) em entradas pra somar no stock, desmembrando
 * caixas no produto base. Retorna array de {productId, quantity}.
 *
 * Ex: decomposeStockDelta('caixa_starlinks', 2) → [{productId:'starlinks', quantity:10}]
 *     decomposeStockDelta('pods', 3)            → [{productId:'pods', quantity:3}]
 */
const decomposeStockDelta = (
  productId: string,
  qty: number
): Array<{ productId: string; quantity: number }> => {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (product?.boxContents) {
    return [
      {
        productId: product.boxContents.productId,
        quantity: qty * product.boxContents.units,
      },
    ];
  }
  return [{ productId, quantity: qty }];
};

export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameState>({
    ...INITIAL_GAME_STATE,
    buyers: [] // Inicializar com lista vazia
  });
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [gameLoaded, setGameLoaded] = useState(true);
  const gameStateRef = useRef(gameState);
  const buyersRef = useRef(buyers);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const user = null;
  const { playMoneySound } = useAudio();

  /* ----------------------------------------------------------------
   * Reputação: helper `awardXp(amount)`
   * Atualiza reputation no gameState e dispara toast em level-up.
   * ---------------------------------------------------------------- */
  const awardXp = useCallback(
    (amount: number, reason?: string) => {
      if (!amount || amount <= 0) return;
      setGameState((prev) => {
        const result = addXp(prev.reputation, amount);

        // Disparar toast fora do updater (level-ups só)
        if (result.levelsGained > 0) {
          const newLevel = result.reputation.level;
          // Executar no próximo tick pra não causar warning
          queueMicrotask(() => {
            toast({
              title: `⭐ Nível ${newLevel}!`,
              description:
                newLevel >= MAX_LEVEL
                  ? 'Reputação máxima atingida — lenda do corre.'
                  : result.levelsGained > 1
                    ? `Você subiu ${result.levelsGained} níveis de reputação!`
                    : 'Sua reputação no corre subiu. Novos recursos podem ter sido desbloqueados.',
            });
          });
        }

        return { ...prev, reputation: result.reputation };
      });
    },
    []
  );

  // Atualizar refs quando o estado mudar
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    buyersRef.current = buyers;
  }, [buyers]);

  // Inicializar o jogo com estado padrão
  useEffect(() => {
    setGameState(INITIAL_GAME_STATE);
    setBuyers([]);
  }, []);

  // Sistema de limpeza de timeouts de viagens
  const tripTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Função para limpar timeout de viagem específica
  const clearTripTimeout = useCallback((vehicleId: string) => {
    const timeout = tripTimeoutsRef.current.get(vehicleId);
    if (timeout) {
      clearTimeout(timeout);
      tripTimeoutsRef.current.delete(vehicleId);
      console.log(`🧹 [TRIP CLEANUP] Timeout limpo para veículo ${vehicleId}`);
    }
  }, []);
  
  // Função para limpar todos os timeouts de viagens
  const clearAllTripTimeouts = useCallback(() => {
    tripTimeoutsRef.current.forEach((timeout, vehicleId) => {
      clearTimeout(timeout);
      console.log(`🧹 [TRIP CLEANUP] Timeout limpo para veículo ${vehicleId}`);
    });
    tripTimeoutsRef.current.clear();
    console.log('🧹 [TRIP CLEANUP] Todos os timeouts de viagens foram limpos');
  }, []);
  
  // Limpar timeouts quando componente desmonta
  useEffect(() => {
    return () => {
      clearAllTripTimeouts();
    };
  }, [clearAllTripTimeouts]);

  // =========================================================
  // JITTER DE PREÇOS DOS FORNECEDORES (±10% dinâmico)
  // =========================================================
  // Mantemos um map supplierId → productId → fator (0.90..1.10) em memória.
  // Atualiza a cada SUPPLIER_JITTER_REFRESH_MS pra simular mercado oscilando.
  // NÃO persiste — é efêmero: ao recarregar o jogo o mercado se reorganiza.
  const SUPPLIER_JITTER_REFRESH_MS = 45_000;
  const [supplierJitter, setSupplierJitter] = useState<
    Record<string, Record<string, number>>
  >({});

  const regenerateSupplierJitter = useCallback(() => {
    const next: Record<string, Record<string, number>> = {};
    SUPPLIERS.forEach((supplier) => {
      const inner: Record<string, number> = {};
      supplier.catalog.forEach((item) => {
        // ±10% uniforme
        inner[item.productId] = 0.9 + Math.random() * 0.2;
      });
      next[supplier.id] = inner;
    });
    setSupplierJitter(next);
  }, []);

  // Inicializar + rotacionar
  useEffect(() => {
    regenerateSupplierJitter();
    const id = setInterval(regenerateSupplierJitter, SUPPLIER_JITTER_REFRESH_MS);
    return () => clearInterval(id);
  }, [regenerateSupplierJitter]);

  /**
   * Preço final de uma unidade no fornecedor, JÁ com jitter de mercado.
   * Usar esse getter em vez do computeSupplierPrice bruto sempre que o
   * jogador for fazer uma transação ou ver preço.
   */
  const getSupplierUnitPrice = useCallback(
    (supplierId: string, productId: string): number => {
      const supplier = getSupplierById(supplierId);
      const product = products.find((p) => p.id === productId);
      if (!supplier || !product) return 0;
      const item = getSupplierItem(supplier, productId);
      if (!item) return 0;
      const base = computeSupplierPrice(item, product.baseCost);
      const jitter = supplierJitter[supplierId]?.[productId] ?? 1;
      return Math.round(base * jitter);
    },
    [products, supplierJitter]
  );

  // =========================================================
  // HELPER: atualizar stats agregadas por produto
  // =========================================================
  const updateProductStats = useCallback(
    (
      kind: 'buy' | 'sell',
      productId: string,
      quantity: number,
      unitPrice: number,
      at: number = Date.now()
    ) => {
      if (quantity <= 0 || unitPrice <= 0) return;
      setGameState((prev) => {
        const prevStats =
          prev.productStats?.[productId] ??
          ({
            totalBought: 0,
            totalSpent: 0,
            totalSold: 0,
            totalRevenue: 0,
            lastPurchasePrice: 0,
            lastSalePrice: 0,
          } as ProductStats);

        const updated: ProductStats =
          kind === 'buy'
            ? {
                ...prevStats,
                totalBought: prevStats.totalBought + quantity,
                totalSpent: prevStats.totalSpent + unitPrice * quantity,
                lastPurchasePrice: unitPrice,
                lastPurchaseAt: at,
              }
            : {
                ...prevStats,
                totalSold: prevStats.totalSold + quantity,
                totalRevenue: prevStats.totalRevenue + unitPrice * quantity,
                lastSalePrice: unitPrice,
                lastSaleAt: at,
              };

        return {
          ...prev,
          productStats: {
            ...(prev.productStats || {}),
            [productId]: updated,
          },
        };
      });
    },
    []
  );

  // Sistema de atualização automática de preços
  useEffect(() => {
    const priceUpdateInterval = setInterval(() => {
      const currentTime = Date.now();

      if (shouldUpdatePrices(gameState.lastPriceUpdate, currentTime)) {
        // Atualizar preços dos produtos
        const updatedProducts = updateProductPrices(products);
        setProducts(updatedProducts);

        // Atualizar timestamp da última atualização
        setGameState(prev => ({
          ...prev,
          lastPriceUpdate: currentTime
        }));

        console.log('💰 [PRICE UPDATE] Preços dos produtos atualizados com variação aleatória');
      }
    }, 5000); // Verifica a cada 5 segundos

    return () => {
      clearInterval(priceUpdateInterval);
    };
  }, [gameState.lastPriceUpdate, products]);

  // =========================================================
  // INVARIANTE: motoristas e veículos sem viagem real ficam idle
  // =========================================================
  // Garante que todo driver.assigned=true tem um vehicle.driverId
  // apontando pra ele. Qualquer divergência vira idle. Isso elimina
  // o bug de motorista "fantasma" que some da lista de disponíveis
  // mas também não aparece em nenhum veículo.
  useEffect(() => {
    const vehiclesWithDriver = new Set(
      (gameState.vehicles || [])
        .map((v) => v.driverId)
        .filter(Boolean) as string[]
    );

    const hasOrphanDriver = (gameState.drivers || []).some(
      (d) => d.assigned && !vehiclesWithDriver.has(d.id)
    );
    const hasOrphanVehicle = (gameState.vehicles || []).some(
      (v) =>
        v.driverId &&
        !(gameState.drivers || []).some((d) => d.id === v.driverId)
    );

    if (!hasOrphanDriver && !hasOrphanVehicle) return;

    setGameState((prev) => {
      const driverIds = new Set((prev.drivers || []).map((d) => d.id));
      const vehsWithDriver = new Set(
        (prev.vehicles || [])
          .map((v) => v.driverId)
          .filter((id) => id && driverIds.has(id as string)) as string[]
      );

      const nextDrivers = (prev.drivers || []).map((d) => {
        if (d.assigned && !vehsWithDriver.has(d.id)) {
          console.log(
            `🔧 [INVARIANT] Motorista "${d.name}" marcado assigned=true sem veículo. Voltando pra idle.`
          );
          return { ...d, assigned: false, vehicleId: undefined };
        }
        return d;
      });

      const nextVehicles = (prev.vehicles || []).map((v) => {
        if (v.driverId && !driverIds.has(v.driverId)) {
          console.log(
            `🔧 [INVARIANT] Veículo "${v.name}" aponta pra driverId inexistente. Liberando.`
          );
          return { ...v, driverId: undefined, assigned: false };
        }
        return v;
      });

      return { ...prev, drivers: nextDrivers, vehicles: nextVehicles };
    });
  }, [gameState.drivers, gameState.vehicles]);

  // =========================================================
  // INVARIANTE: loja sem estoque nunca pode ficar travada
  // =========================================================
  // Independente do caminho (venda manual, venda auto, load legado),
  // esse watcher garante que qualquer loja com 0 produtos volta a
  // isLocked=false em até um tick. Isso torna o botão manual
  // "Desbloquear lojas" obsoleto.
  useEffect(() => {
    const stuck = (gameState.stores || []).some((store) => {
      const total = (store.products || []).reduce(
        (s, p) => s + (p.quantity || 0),
        0
      );
      return store.isLocked && total === 0;
    });
    if (!stuck) return;

    setGameState((prev) => ({
      ...prev,
      stores: (prev.stores || []).map((store) => {
        const total = (store.products || []).reduce(
          (s, p) => s + (p.quantity || 0),
          0
        );
        if (store.isLocked && total === 0) {
          console.log(
            `🔓 [INVARIANT] Auto-destravando "${store.name}" (estoque zerado)`
          );
          return { ...store, isLocked: false, products: [] };
        }
        return store;
      }),
    }));
  }, [gameState.stores]);
  





  // Função para recusar comprador
  const rejectBuyer = useCallback((buyerId: string) => {
    const buyer = buyers.find(b => b.id === buyerId);
    if (!buyer) {
      toast({
        title: "Erro",
        description: "Comprador não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Remover comprador da lista — o sistema drip cuida de spawnar o próximo
    setBuyers(prev => prev.filter(b => b.id !== buyerId));

    toast({
      title: "Pedido recusado",
      description: `Você recusou o pedido de ${buyer.name}`,
      duration: 2000
    });

    return true;
  }, [buyers]);

  /**
   * Tentativa de pechincha: o jogador pede mais. Apenas 1 tentativa.
   * - Aceita com chance baseada na reliability (baixa=72%, média=60%, alta=45%).
   * - Em caso de sucesso, todos os preços do pedido sobem por bônus aleatório dentro de bargainBonusRange.
   * - Em caso de recusa, o card "marca" como recusado e em ~3.5s o buyer vai embora.
   */
  const tryBargain = useCallback((buyerId: string): { accepted: boolean; bonus: number } | null => {
    const buyer = buyersRef.current.find(b => b.id === buyerId);
    if (!buyer) return null;
    if (buyer.bargainAttempted) return null;
    if (!buyer.negotiationFlexibility || buyer.negotiationFlexibility <= 0) return null;

    const acceptChance = BARGAIN_ACCEPT_CHANCE[buyer.reliability] ?? 0.5;
    const accepted = Math.random() < acceptChance;
    const [bMin, bMax] = buyer.bargainBonusRange || DEFAULT_BARGAIN_BONUS_RANGE;
    const bonus = bMin + Math.random() * (bMax - bMin);

    setBuyers(prev => prev.map(b => {
      if (b.id !== buyerId) return b;
      if (accepted) {
        const newOrders = b.orders.map(o => {
          const base = o.basePricePerUnit ?? o.pricePerUnit;
          const newPrice = Math.round(base * (1 + bonus) * 100) / 100;
          return { ...o, basePricePerUnit: base, pricePerUnit: newPrice };
        });
        return {
          ...b,
          orders: newOrders,
          bargainAttempted: true,
          bargainAccepted: true,
          bargainBonusApplied: bonus,
        };
      } else {
        // Recusou — marcar e dar 3.5s antes de sair
        return {
          ...b,
          bargainAttempted: true,
          bargainAccepted: false,
          bargainBonusApplied: null,
          // Acelera saída: deadline passa a ser agora + 3.5s, se ainda não tiver expirado antes
          patienceDeadline: Math.min(b.patienceDeadline ?? Date.now() + 3500, Date.now() + 3500),
        };
      }
    }));

    if (accepted) {
      toast({
        title: '💰 Pechincha aceita!',
        description: `${buyer.name} topou pagar +${(bonus * 100).toFixed(1)}% por unidade.`,
        duration: 3000,
      });
    } else {
      toast({
        title: '😤 Pechincha recusada',
        description: `${buyer.name} não topou e tá saindo.`,
        variant: 'destructive',
        duration: 3000,
      });
    }

    return { accepted, bonus };
  }, []);

  // (antigo checkBuyerGeneration em lote foi substituído pelo sistema drip + patience mais adiante)

  // Timer para verificar geração de compradores (removido - foi movido)

  // Função para verificar e debitar custos semanais
  const checkWeeklyCosts = useCallback((currentDay: number, lastWeeklyCostPaid: number, currentMoney: number) => {
    // Verificar se o dia atual é múltiplo de 7 (7, 14, 21, 28, etc.) e ainda não foi pago
    if (currentDay % 7 === 0 && currentDay > lastWeeklyCostPaid) {
      const currentWarehouse = WAREHOUSES.find(w => w.id === gameState.currentWarehouse);
      const warehouseCost = currentWarehouse ? currentWarehouse.weeklyCost : 0;
      
      if (warehouseCost > 0) {
        console.log(`💸 [WEEKLY COSTS] Dia ${currentDay} - Debitando aluguel do galpão: R$ ${warehouseCost.toLocaleString()}`);
        
        return {
          money: currentMoney - warehouseCost,
          lastWeeklyCostPaid: currentDay,
          showToast: {
            title: "🏢 Aluguel Debitado",
            description: `Dia ${currentDay} - R$ ${warehouseCost.toLocaleString()} de aluguel do galpão foram debitados`,
            variant: "destructive" as const,
            duration: 5000
          }
        };
      }
    }
    return null;
  }, [gameState.currentWarehouse]);

  // Game Time Update Function
  const updateGameTime = useCallback(() => {
    setGameState(prev => {
      const now = Date.now();
      
      // 50 segundos por dia = 50000ms ÷ 24 horas ÷ 60 minutos = ~35ms por minuto no jogo
      // Executado a cada 35ms, então a cada execução avança 1 minuto no jogo
      if (now - prev.gameTime.lastUpdate >= 35) { // 35ms reais = 1 minuto no jogo
        const newMinute = prev.gameTime.minute + 1;
        const newHour = newMinute >= 60 ? prev.gameTime.hour + 1 : prev.gameTime.hour;
        const newDay = newHour >= 24 ? prev.gameTime.day + 1 : prev.gameTime.day;
        
        let updatedState = {
          ...prev,
          gameTime: {
            day: newDay,
            hour: newHour >= 24 ? 0 : newHour,
            minute: newMinute >= 60 ? 0 : newMinute,
            lastUpdate: now
          }
        };
        
        // Verificar custos semanais quando o dia muda
        if (newDay !== prev.gameTime.day) {
          const weeklyCostUpdate = checkWeeklyCosts(newDay, prev.lastWeeklyCostPaid, updatedState.money);
          if (weeklyCostUpdate) {
            updatedState = {
              ...updatedState,
              money: weeklyCostUpdate.money,
              lastWeeklyCostPaid: weeklyCostUpdate.lastWeeklyCostPaid
            };
            
            // Exibir toast após o setState
            setTimeout(() => {
              toast(weeklyCostUpdate.showToast);
            }, 0);
          }
        }
        
        return updatedState;
      }
      
      return prev;
    });
  }, [checkWeeklyCosts]);

  // Sistema de listas progressivas de compradores baseado em pedidos completados
  const getBuyersByTier = useCallback(() => {
    const completedOrders = gameState.completedOrders || 0;
    
    // Determinar quais tiers estão disponíveis baseado na progressão
    const availableTiers = [];
    
    // Tier 1: Sempre disponível (0+ pedidos completados)
    availableTiers.push({ buyers: TIER_1_BUYERS, weight: 1.0 });
    
    // Tier 2: Disponível após 6 pedidos completados
    if (completedOrders >= 6) {
      availableTiers.push({ buyers: TIER_2_BUYERS, weight: 0.8 });
    }
    
    // Tier 3: Disponível após 16 pedidos completados
    if (completedOrders >= 16) {
      availableTiers.push({ buyers: TIER_3_BUYERS, weight: 0.6 });
    }
    
    // Tier 4: Disponível após 31 pedidos completados
    if (completedOrders >= 31) {
      availableTiers.push({ buyers: TIER_4_BUYERS, weight: 0.4 });
    }
    
    // Especialistas em Ilícitos: Disponível após 25 pedidos completados
    if (completedOrders >= 25) {
      availableTiers.push({ buyers: ILLICIT_SPECIALISTS, weight: 0.3 });
    }
    
    return availableTiers;
  }, [gameState.completedOrders]);
  
  // ─────────────────────────────────────────────────────────────
  // Sistema novo: geração drip (gotejamento) + paciência + pechincha
  // ─────────────────────────────────────────────────────────────

  /** Seleciona 1 buyer template aleatório dos tiers disponíveis, ponderado. Exclui por NOME (não ID). */
  const pickRandomBuyerTemplate = useCallback((excludeNames: Set<string> = new Set()): Buyer | null => {
    const availableTiers = getBuyersByTier();
    const weightedPool: Buyer[] = [];
    availableTiers.forEach(tier => {
      tier.buyers.forEach(buyer => {
        if (excludeNames.has(buyer.name)) return;
        const copies = Math.ceil(tier.weight * 10);
        for (let i = 0; i < copies; i++) {
          weightedPool.push(buyer);
        }
      });
    });
    if (weightedPool.length === 0) {
      // Fallback: pegar de qualquer tier disponível mesmo que já usado
      const all = availableTiers.flatMap(t => t.buyers);
      if (all.length === 0) return null;
      return all[Math.floor(Math.random() * all.length)];
    }
    return weightedPool[Math.floor(Math.random() * weightedPool.length)];
  }, [getBuyersByTier]);

  /** Gera pedidos aleatórios para um buyer, ignorando o estoque do jogador. */
  const generateRandomOrdersForBuyer = useCallback((buyer: Buyer): BuyerOrder[] => {
    const tier = buyer.tier || 1;
    const pool = (buyer.productPool && buyer.productPool.length > 0)
      ? buyer.productPool.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean) as Product[]
      : PRODUCTS;

    if (pool.length === 0) return [];

    // 2-4 produtos distintos
    const orderCount = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, orderCount);

    return chosen.map(product => {
      // Quantidade escala por tier: T1 = 1-5, T2 = 3-10, T3 = 8-25, T4 = 15-60
      const qRanges: Record<number, [number, number]> = {
        1: [1, 5],
        2: [3, 10],
        3: [8, 25],
        4: [15, 60],
      };
      const [qMin, qMax] = qRanges[tier] || qRanges[1];
      // Para produtos caros (>1000), baixar a quantidade
      const expensive = product.baseStreetPrice > 1000;
      const qCap = expensive ? Math.max(1, Math.ceil(qMax / 10)) : qMax;
      const quantity = Math.floor(Math.random() * (qCap - qMin + 1)) + qMin;

      // ⚖️ Balance: escalar o markup global dos compradores.
      // Ex: priceMultiplier 1.40 (40% acima do preço base) com scale 0.65 vira:
      //    1 + (1.40 - 1) * 0.65 = 1.26 (apenas 26% de markup efetivo)
      // Assim endurecemos o jogo sem precisar editar cada buyer individualmente.
      const CLIENT_MARKUP_SCALE = 0.65;
      const effectiveMultiplier =
        1 + Math.max(0, buyer.priceMultiplier - 1) * CLIENT_MARKUP_SCALE;

      // Variação aleatória menor (0.97..1.03) — o preço base do cliente já fica
      // apertado, variação grande torna a média imprevisível.
      const variation = 0.97 + Math.random() * 0.06;
      const pricePerUnit = Math.round(
        product.baseStreetPrice * effectiveMultiplier * variation * 100
      ) / 100;

      return {
        productId: product.id,
        quantity,
        pricePerUnit,
        basePricePerUnit: pricePerUnit,
      } as BuyerOrder;
    });
  }, []);

  /** Cria uma instância runtime de um buyer com paciência, pedidos aleatórios e estado de pechincha inicial. */
  const generateBuyerInstance = useCallback((excludeIds: Set<string> = new Set()): Buyer | null => {
    const template = pickRandomBuyerTemplate(excludeIds);
    if (!template) return null;

    const [pMin, pMax] = template.patienceRange || DEFAULT_PATIENCE_RANGE;
    const patienceSeconds = Math.floor(Math.random() * (pMax - pMin + 1)) + pMin;
    const patienceTotalMs = patienceSeconds * 1000;
    const now = Date.now();

    const orders = generateRandomOrdersForBuyer(template);

    const catchPhrase = template.catchPhrase || DEFAULT_CATCH_PHRASE;

    return {
      ...template,
      id: `buyer_${now}_${Math.floor(Math.random() * 1_000_000)}`,
      orders,
      catchPhrase,
      patienceRange: template.patienceRange || DEFAULT_PATIENCE_RANGE,
      negotiationFlexibility: template.negotiationFlexibility ?? 0,
      bargainBonusRange: template.bargainBonusRange || DEFAULT_BARGAIN_BONUS_RANGE,
      patienceDeadline: now + patienceTotalMs,
      patienceTotalMs,
      bargainAttempted: false,
      bargainAccepted: null,
      bargainBonusApplied: null,
      leavingAt: undefined,
    };
  }, [pickRandomBuyerTemplate, generateRandomOrdersForBuyer]);

  /** Gera N buyers iniciais ignorando templates repetidos. */
  const generateInitialBuyers = useCallback((count: number = 4): Buyer[] => {
    const out: Buyer[] = [];
    const usedTemplateIds = new Set<string>();
    for (let i = 0; i < count; i++) {
      const b = generateBuyerInstance(usedTemplateIds);
      if (!b) break;
      // Dedupe por template id original (antes do runtime id sobrescrever)
      // — pickRandomBuyerTemplate já retorna o template; precisamos rastrear por name
      usedTemplateIds.add(b.name);
      out.push(b);
    }
    return out;
  }, [generateBuyerInstance]);

  // ─── Constantes do sistema drip ───
  /**
   * Slots máximos de compradores simultâneos — escala com reputação:
   *   Lv 1-4:   2 slots
   *   Lv 5-9:   3 slots
   *   Lv 10-14: 4 slots
   *   ...
   *   Lv 30+:   8 slots (máximo)
   */
  const MAX_BUYERS = useMemo(() => {
    const level = ensureReputation(gameState.reputation).level;
    return Math.min(8, 2 + Math.floor(level / 5));
  }, [gameState.reputation]);
  /** Mínimo desejado antes de spawnar imediato. */
  const MIN_BUYERS = 2;
  /** Intervalo entre chegadas em ms (~28s). */
  const DRIP_INTERVAL_MS = 28_000;

  // ─── Constantes do sistema de fornecedores ───
  /**
   * Tempo máximo (em ms) que um PendingPickup pode ficar aguardando
   * retirada antes de expirar: o fornecedor cancela, devolve o produto
   * ao estoque da loja e reembolsa o dinheiro do jogador.
   */
  const PICKUP_EXPIRATION_MS = 3 * 60 * 1000; // 3 minutos

  // Timestamp do último spawn. Usamos ref pra não re-criar o interval quando muda.
  const lastSpawnRef = useRef<number>(Date.now());

  // Inicializar compradores quando o jogo carrega
  useEffect(() => {
    if (gameLoaded && buyers.length === 0) {
      console.log('✅ [BUYERS] Gerando compradores iniciais (drip)');
      const initialBuyers = generateInitialBuyers(MAX_BUYERS);
      setBuyers(initialBuyers);
      lastSpawnRef.current = Date.now();
      // Limpar flags legadas de espera em lote
      setGameState(prev => ({
        ...prev,
        isWaitingForNewBuyers: false,
        newBuyersTimerStart: 0,
        completedSalesInCycle: 0,
      }));
    }
  }, [gameLoaded, buyers.length, generateInitialBuyers]);

  // Tick unificado: paciência expirada + drip de novos buyers.
  //
  // IMPORTANTE: tanto expiração quanto drip operam DENTRO do updater de
  // setBuyers(prev => ...). Isso evita leitura stale via buyersRef e
  // elimina o bug de "lista travada" onde o drip deixava de spawnar
  // porque o ref ainda apontava pra uma lista cheia de buyers expirados.
  useEffect(() => {
    if (!gameLoaded) return;
    const interval = setInterval(() => {
      const now = Date.now();

      // 1) Expirar paciência atomicamente
      setBuyers(prev => {
        if (prev.length === 0) return prev;
        const expired = prev.filter(
          b => b.patienceDeadline !== undefined && now >= (b.patienceDeadline as number)
        );
        if (expired.length === 0) return prev;
        expired.forEach(b => {
          toast({
            title: `${b.name} foi embora`,
            description: 'Esperou demais e desistiu do pedido.',
            duration: 2500,
          });
        });
        return prev.filter(b => !expired.some(e => e.id === b.id));
      });

      // 2) Drip: spawn se abaixo de MIN, ou passou o intervalo.
      // Usa updater atômico pra ler o estado mais recente.
      setBuyers(prev => {
        const shouldDrip =
          prev.length < MAX_BUYERS &&
          (prev.length < MIN_BUYERS ||
            now - lastSpawnRef.current >= DRIP_INTERVAL_MS);
        if (!shouldDrip) return prev;

        const used = new Set<string>(prev.map(b => b.name));
        const next = generateBuyerInstance(used);
        if (!next) return prev;

        lastSpawnRef.current = now;
        return [...prev, next];
      });
    }, 1000); // Tick de 1s para smooth patience + drip

    return () => clearInterval(interval);
  }, [gameLoaded, generateBuyerInstance, MAX_BUYERS]);

  // Gerar comprador aleatório com pedidos variados baseado na progressão
  const generateRandomBuyer = useCallback(() => {
    const availableTiers = getBuyersByTier();
    
    // Selecionar tier aleatório baseado nos disponíveis
    const randomTierIndex = Math.floor(Math.random() * availableTiers.length);
    const selectedTier = availableTiers[randomTierIndex];
    
    // Selecionar comprador aleatório do tier
    const randomBuyer = selectedTier.buyers[Math.floor(Math.random() * selectedTier.buyers.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 unidades
    
    return {
      id: `buyer_${Date.now()}_${Math.random()}`,
      name: randomBuyer.name,
      description: randomBuyer.description,
      photo: randomBuyer.photo,
      reliability: randomBuyer.reliability,
      orders: [{
        productId: product.id,
        quantity,
        pricePerUnit: product.baseStreetPrice
      }]
    };
  }, [products, getBuyersByTier]);





  // Função para vender para compradores - VERSÃO MELHORADA
  const sellToBuyer = useCallback((buyerId: string, productId: string, quantity: number, pricePerUnit: number) => {
    // Validações iniciais
    const buyer = buyers.find(b => b.id === buyerId);
    if (!buyer) {
      toast({
        title: "Erro na venda",
        description: "Comprador não encontrado",
        variant: "destructive"
      });
      return false;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      toast({
        title: "Erro na venda",
        description: "Produto não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Verificar se o pedido existe
    const orderExists = buyer.orders.some(order => 
      order.productId === productId && 
      order.quantity === quantity && 
      order.pricePerUnit === pricePerUnit
    );

    if (!orderExists) {
      toast({
        title: "Erro na venda",
        description: "Pedido não encontrado ou já foi processado",
        variant: "destructive"
      });
      return false;
    }

    // Verificar estoque disponível
    const availableStock = gameState.stock[productId] || 0;
    if (availableStock < quantity) {
      toast({
        title: "Estoque insuficiente",
        description: `Você tem apenas ${availableStock}x ${product.displayName} em estoque. Necessário: ${quantity}x`,
        variant: "destructive"
      });
      return false;
    }

    // Validar quantidade e preço
    if (quantity <= 0) {
      toast({
        title: "Erro na venda",
        description: "Quantidade deve ser maior que zero",
        variant: "destructive"
      });
      return false;
    }

    if (pricePerUnit <= 0) {
      toast({
        title: "Erro na venda",
        description: "Preço deve ser maior que zero",
        variant: "destructive"
      });
      return false;
    }

    const totalValue = quantity * pricePerUnit;
    const profit = totalValue - (product.baseCost * quantity);
    const profitMargin = ((profit / totalValue) * 100).toFixed(1);

    // Transação atômica - atualizar estado do jogo
    setGameState(prev => {
      // Criar registro da venda
      const saleRecord = {
        id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        productName: product.displayName,
        quantity,
        totalValue,
        profit,
        gameDay: prev.gameTime.day,
        soldAt: Date.now()
      };

      // Tocar som de dinheiro quando ganhar dinheiro
      if (totalValue > 0) {
        playMoneySound();
      }

      return {
        ...prev,
        money: prev.money + totalValue,
        stock: {
          ...prev.stock,
          [productId]: Math.max(0, (prev.stock[productId] || 0) - quantity)
        },
        completedOrders: prev.completedOrders + 1,
        completedSalesInCycle: prev.completedSalesInCycle + 1,
        productSales: [...prev.productSales, saleRecord]
      };
    });

    // +1 XP de reputação por venda concluída
    awardXp(1, 'venda');

    // Atualizar lista de compradores
    setBuyers(prev => {
      const updatedBuyers = prev.map(b => {
        if (b.id === buyerId) {
          const updatedOrders = b.orders.filter(order =>
            !(order.productId === productId &&
              order.quantity === quantity &&
              order.pricePerUnit === pricePerUnit)
          );
          return { ...b, orders: updatedOrders };
        }
        return b;
      });

      // Remover compradores sem pedidos
      return updatedBuyers.filter(b => b.orders.length > 0);
    });

    // Estatísticas agregadas (avg sell, last price, etc.)
    updateProductStats('sell', productId, quantity, pricePerUnit);

    // Feedback melhorado para o usuário
    const isGoodDeal = profit > 0;
    const dealQuality = profit > (product.baseCost * quantity * 0.5) ? "excelente" :
                       profit > (product.baseCost * quantity * 0.2) ? "boa" : "regular";

    toast({
      title: "✅ Venda realizada com sucesso!",
      description: `Vendeu ${quantity}x ${product.displayName} para ${buyer.name}\n💰 Valor: R$ ${totalValue.toLocaleString()}\n📈 Lucro: R$ ${profit.toLocaleString()} (${profitMargin}%)\n🎯 Negócio ${dealQuality}`,
      variant: isGoodDeal ? "default" : "destructive"
    });

    return true;
  }, [buyers, gameState.stock, products, updateProductStats]);

  // Função para atualizar o estado do jogo
  const updateState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState(prev => {
      const newState = updater(prev);
      // Salvar automaticamente após atualização
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        // Estado salvo localmente
      }, 1000);
      return newState;
    });
  }, []);

  // Outras funções do jogo...
  const assignVehicle = useCallback((vehicleId: string, productId: string, quantity: number) => {
    try {
      updateState(prev => {
        const vehicle = prev.vehicles.find(v => v.id === vehicleId);
        if (!vehicle || vehicle.status !== 'idle') {
          console.warn('Veículo não disponível para atribuição:', vehicleId);
          return prev;
        }

        const updatedVehicles = prev.vehicles.map(v => 
          v.id === vehicleId 
            ? { ...v, status: 'assigned', assignedProduct: productId, assignedQuantity: quantity }
            : v
        );

        return { ...prev, vehicles: updatedVehicles };
      });
      return true;
    } catch (error) {
      console.error('Erro ao atribuir veículo:', error);
      return false;
    }
  }, [updateState]);



  const unassignVehicle = useCallback((vehicleId: string) => {
    try {
      updateState(prev => {
        const updatedVehicles = prev.vehicles.map(v => 
          v.id === vehicleId 
            ? { ...v, status: 'idle', assignedProduct: undefined, assignedQuantity: undefined }
            : v
        );

        return { ...prev, vehicles: updatedVehicles };
      });
      return true;
    } catch (error) {
      console.error('Erro ao desatribuir veículo:', error);
      return false;
    }
  }, [updateState]);



  const assignDriver = useCallback((vehicleId: string, driverId: string) => {
    setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(vehicle => 
        vehicle.id === vehicleId 
          ? { ...vehicle, driverId }
          : vehicle
      ),
      drivers: prev.drivers.map(driver => 
        driver.id === driverId 
          ? { ...driver, assigned: true }
          : driver
      )
    }));
    
    toast({
      title: "Motorista atribuído!",
      description: "Motorista foi atribuído ao veículo com sucesso.",
      variant: "default"
    });
    
    return true;
  }, []);

  const unassignDriver = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle || !vehicle.driverId) return false;
    
    setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId 
          ? { ...v, driverId: undefined }
          : v
      ),
      drivers: prev.drivers.map(driver => 
        driver.id === vehicle.driverId 
          ? { ...driver, assigned: false }
          : driver
      )
    }));
    
    toast({
      title: "Motorista removido!",
      description: "Motorista foi removido do veículo.",
      variant: "default"
    });
    
    return true;
  }, [gameState.vehicles]);

  // Função para verificar se pode aceitar viagem
  const canAcceptTrip = useCallback((productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    
    const totalSpace = product.space * quantity;
    const currentStock = Object.values(gameState.stock).reduce((sum, qty) => sum + qty, 0);
    return currentStock + totalSpace <= gameState.warehouseCapacity;
  }, [products, gameState.stock, gameState.warehouseCapacity]);

  // Função para calcular custo da viagem (compatibilidade)
  const calculateTripCost = useCallback((vehicleId: string, productId: string, quantity: number) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    const product = products.find(p => p.id === productId);
    
    if (!vehicle || !product) return 0;
    
    // Custo base da viagem (combustível, desgaste, etc.)
    const baseCost = vehicle.operationalCost || 100;
    
    // Custo adicional baseado na quantidade e distância
    const quantityCost = quantity * 10;
    
    // Custo dos produtos
    const productCost = product.baseCost * quantity;
    
    // Salário do motorista
    const driver = gameState.drivers.find(d => d.id === vehicle.driverId);
    const driverWage = driver?.dailyWage || 0;
    
    return baseCost + quantityCost + productCost + driverWage;
  }, [gameState.vehicles, gameState.drivers, products]);

  // Função para calcular custo da viagem com múltiplos produtos
  const calculateTripCostForMultipleProducts = useCallback((vehicleId: string, selectedProducts: { productId: string; quantity: number }[]) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    
    if (!vehicle || selectedProducts.length === 0) return 0;
    
    // Custo base da viagem (combustível, desgaste, etc.)
    const baseCost = vehicle.operationalCost || 100;
    
    // Custo adicional baseado na quantidade total de produtos
    const totalQuantity = selectedProducts.reduce((total, sp) => total + sp.quantity, 0);
    const quantityCost = totalQuantity * 10;
    
    // Custo dos produtos
    const productsCost = selectedProducts.reduce((total, sp) => {
      const product = products.find(p => p.id === sp.productId);
      return total + (product ? product.baseCost * sp.quantity : 0);
    }, 0);
    
    // Salário do motorista
    const driver = gameState.drivers.find(d => d.id === vehicle.driverId);
    const driverWage = driver?.dailyWage || 0;
    
    return baseCost + quantityCost + productsCost + driverWage;
  }, [gameState.vehicles, gameState.drivers, products]);

  // Função para fazer viagem
  const makeTrip = useCallback((vehicleId: string, productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    
    // BUG FIX: Verificar se veículo já está ativo para evitar múltiplas viagens simultâneas
    if (!product || !vehicle || vehicle.active || !canAcceptTrip(productId, quantity)) return false;
    
    const tripCost = calculateTripCost(vehicleId, productId, quantity);
    if (gameState.money < tripCost) return false;
    
    // Limpar timeout anterior se existir
    clearTripTimeout(vehicleId);
    
    // Iniciar viagem com duração
    const now = Date.now();
    const tripDurationMs = (vehicle.tripDuration || 22.5) * 1000; // Converter segundos para ms
    
    setGameState(prev => ({
      ...prev,
      money: prev.money - tripCost,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId ? { 
          ...v, 
          active: true,
          tripStartTime: now,
          productId,
          quantity
        } : v
      )
    }));
    
    // Completar viagem após a duração
    const tripTimeout = setTimeout(() => {
      // Remover timeout do mapa quando executado
      tripTimeoutsRef.current.delete(vehicleId);
      
      console.log(`🏁 [TRIP COMPLETION] Finalizando viagem para veículo ${vehicleId}`);
      
      // Obter dados do motorista para cálculos de risco
      const driver = gameState.drivers.find(d => d.id === vehicle.driverId);
      const productData = products.find(p => p.id === productId);
      
      // Calcular riscos da viagem
      const risks = calculateTripRisks(vehicle, productData ? [productData] : [], driver);
      
      // Testar quebra do veículo
      const vehicleBrokeDown = rollBreakdownCheck(risks.breakdownChance);
      
      // Testar apreensão de mercadorias (só para produtos ilícitos)
      const merchandiseSeized = risks.hasIllicitProducts && rollSeizureCheck(risks.seizureChance);
      
      setGameState(prev => {
        // Verificação de segurança: confirmar se veículo ainda está ativo
        const currentVehicle = prev.vehicles.find(v => v.id === vehicleId);
        if (!currentVehicle || !currentVehicle.active) {
          console.log(`⚠️ [TRIP COMPLETION] Veículo ${vehicleId} já foi resetado, cancelando conclusão`);
          return prev;
        }
        
        let updatedState = { ...prev };
        
        // Processar quebra do veículo
        if (vehicleBrokeDown) {
          console.log(`🔧 [BREAKDOWN] Veículo ${vehicleId} quebrou durante a viagem`);
          // Mesmo com a quebra, os produtos chegam ao estoque
          updatedState = {
            ...prev,
            stock: {
              ...prev.stock,
              [productId]: (prev.stock[productId] || 0) + quantity
            },
            vehicles: prev.vehicles.map(v => 
              v.id === vehicleId ? { 
                ...v, 
                active: false,
                broken: true,
                tripStartTime: undefined,
                productId: undefined,
                quantity: undefined,
                breakdownsCount: (v.breakdownsCount || 0) + 1,
                tripsCompleted: (v.tripsCompleted || 0) + 1
              } : v
            )
          };
          
          toast({
            title: "Veículo quebrou!",
            description: `${vehicle.name} quebrou durante a viagem, mas os produtos chegaram ao estoque. Chame o guincho para consertar o veículo.`,
            variant: "destructive"
          });
          return updatedState;
        }
        
        // Processar apreensão de mercadorias
        if (merchandiseSeized) {
          console.log(`🚔 [SEIZURE] Mercadorias do veículo ${vehicleId} foram apreendidas`);
          updatedState.vehicles = prev.vehicles.map(v => 
            v.id === vehicleId ? { 
              ...v, 
              active: false,
              seized: true,
              tripStartTime: undefined,
              productId: undefined,
              quantity: undefined,
              seizuresCount: (v.seizuresCount || 0) + 1
            } : v
          );
          
          toast({
            title: "Mercadoria apreendida!",
            description: `A polícia apreendeu as mercadorias de ${vehicle.name}. Pague o advogado para recuperar o veículo.`,
            variant: "destructive"
          });
          return updatedState;
        }
        
        // Viagem bem-sucedida - adicionar produtos ao estoque
        updatedState = {
          ...prev,
          stock: {
            ...prev.stock,
            [productId]: (prev.stock[productId] || 0) + quantity
          },
          vehicles: prev.vehicles.map(v => 
            v.id === vehicleId ? { 
              ...v, 
              active: false,
              tripStartTime: undefined,
              productId: undefined,
              quantity: undefined,
              tripsCompleted: (v.tripsCompleted || 0) + 1
            } : v
          )
        };
        
        console.log(`🏁 [TRIP COMPLETION] Estado atualizado - veículo ${vehicleId} agora inativo`);
        return updatedState;
      });
      
      // Toast apenas para viagem bem-sucedida (outros casos já têm toast)
      if (!vehicleBrokeDown && !merchandiseSeized) {
        toast({
          title: "Viagem concluída!",
          description: `${vehicle.name} voltou com ${quantity} ${product.name}`,
        });
        // +1 XP por viagem completada sem quebra nem apreensão
        awardXp(1, 'viagem-ok');
      }

      console.log(`✅ [TRIP] Viagem processada para veículo ${vehicleId}. Quebra: ${vehicleBrokeDown}, Apreensão: ${merchandiseSeized}`);
    }, tripDurationMs);
    
    // Armazenar timeout para limpeza posterior
    tripTimeoutsRef.current.set(vehicleId, tripTimeout);
    
    toast({
      title: "Viagem iniciada!",
      description: `${vehicle.name} saiu para entregar ${quantity} ${product.name}. Duração: ${vehicle.tripDuration}s`,
    });
    
    console.log(`🚛 [TRIP] Viagem iniciada para veículo ${vehicleId}, duração: ${tripDurationMs}ms`);
    
    return true;
  }, [gameState.vehicles, gameState.money, products, canAcceptTrip, calculateTripCost, clearTripTimeout]);

  // Função para fazer viagem com múltiplos produtos
  const makeTripWithMultipleProducts = useCallback((vehicleId: string, selectedProducts: { productId: string; quantity: number }[]) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    
    // BUG FIX: Verificar se veículo já está ativo para evitar múltiplas viagens simultâneas
    if (!vehicle || vehicle.active || selectedProducts.length === 0) return false;
    
    // Verificar se todos os produtos são válidos
    const validProducts = selectedProducts.every(sp => {
      const product = products.find(p => p.id === sp.productId);
      return product && canAcceptTrip(sp.productId, sp.quantity);
    });
    
    if (!validProducts) return false;
    
    const tripCost = calculateTripCostForMultipleProducts(vehicleId, selectedProducts);
    if (gameState.money < tripCost) return false;
    
    // Limpar timeout anterior se existir
    clearTripTimeout(vehicleId);
    
    // Iniciar viagem com duração
    const now = Date.now();
    const tripDurationMs = (vehicle.tripDuration || 22.5) * 1000; // Converter segundos para ms
    
    setGameState(prev => ({
      ...prev,
      money: prev.money - tripCost,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId ? { 
          ...v, 
          active: true,
          tripStartTime: now,
          selectedProducts // Armazenar múltiplos produtos
        } : v
      )
    }));
    
    // Completar viagem após a duração
    const tripTimeout = setTimeout(() => {
      // Remover timeout do mapa quando executado
      tripTimeoutsRef.current.delete(vehicleId);
      
      console.log(`🏁 [TRIP COMPLETION] Finalizando viagem múltipla para veículo ${vehicleId}`);
      
      // Obter dados do motorista e produtos para cálculos de risco
      const driver = gameState.drivers.find(d => d.id === vehicle.driverId);
      const tripProducts = selectedProducts.map(sp => products.find(p => p.id === sp.productId)).filter(Boolean) as Product[];
      
      // Calcular riscos da viagem
      const risks = calculateTripRisks(vehicle, tripProducts, driver);
      
      // Testar quebra do veículo
      const vehicleBrokeDown = rollBreakdownCheck(risks.breakdownChance);
      
      // Testar apreensão de mercadorias (só para produtos ilícitos)
      const merchandiseSeized = risks.hasIllicitProducts && rollSeizureCheck(risks.seizureChance);
      
      setGameState(prev => {
        // Verificação de segurança: confirmar se veículo ainda está ativo
        const currentVehicle = prev.vehicles.find(v => v.id === vehicleId);
        if (!currentVehicle || !currentVehicle.active) {
          console.log(`⚠️ [TRIP COMPLETION] Veículo ${vehicleId} já foi resetado, cancelando conclusão múltipla`);
          return prev;
        }
        
        let updatedState = { ...prev };
        
        // Processar quebra do veículo
        if (vehicleBrokeDown) {
          console.log(`🔧 [BREAKDOWN] Veículo ${vehicleId} quebrou durante a viagem múltipla`);
          // Mesmo com a quebra, os produtos chegam ao estoque
          const updatedStock = { ...prev.stock };
          selectedProducts.forEach(sp => {
            updatedStock[sp.productId] = (updatedStock[sp.productId] || 0) + sp.quantity;
          });
          
          updatedState = {
            ...prev,
            stock: updatedStock,
            vehicles: prev.vehicles.map(v => 
              v.id === vehicleId ? { 
                ...v, 
                active: false,
                broken: true,
                tripStartTime: undefined,
                selectedProducts: undefined,
                breakdownsCount: (v.breakdownsCount || 0) + 1,
                tripsCompleted: (v.tripsCompleted || 0) + 1
              } : v
            )
          };
          
          const productNames = selectedProducts.map(sp => {
            const product = products.find(p => p.id === sp.productId);
            return `${sp.quantity}x ${product?.name || 'Produto'}`;
          }).join(', ');
          
          toast({
            title: "Veículo quebrou!",
            description: `${vehicle.name} quebrou durante a viagem com: ${productNames}. Produtos foram adicionados ao estoque.`,
            variant: "destructive"
          });
          return updatedState;
        }
        
        // Processar apreensão de mercadorias
        if (merchandiseSeized) {
          console.log(`🚔 [SEIZURE] Mercadorias do veículo ${vehicleId} foram apreendidas (viagem múltipla)`);
          updatedState.vehicles = prev.vehicles.map(v => 
            v.id === vehicleId ? { 
              ...v, 
              active: false,
              seized: true,
              tripStartTime: undefined,
              selectedProducts: undefined,
              seizuresCount: (v.seizuresCount || 0) + 1
            } : v
          );
          
          const productNames = selectedProducts.map(sp => {
            const product = products.find(p => p.id === sp.productId);
            return `${sp.quantity}x ${product?.name || 'Produto'}`;
          }).join(', ');
          
          toast({
            title: "Mercadoria apreendida!",
            description: `A polícia apreendeu: ${productNames} de ${vehicle.name}. Pague o advogado.`,
            variant: "destructive"
          });
          return updatedState;
        }
        
        // Viagem bem-sucedida - adicionar produtos ao estoque
        const updatedStock = { ...prev.stock };
        selectedProducts.forEach(sp => {
          updatedStock[sp.productId] = (updatedStock[sp.productId] || 0) + sp.quantity;
        });
        
        updatedState = {
          ...prev,
          stock: updatedStock,
          vehicles: prev.vehicles.map(v => 
            v.id === vehicleId ? { 
              ...v, 
              active: false,
              tripStartTime: undefined,
              selectedProducts: undefined,
              tripsCompleted: (v.tripsCompleted || 0) + 1
            } : v
          )
        };
        
        console.log(`🏁 [TRIP COMPLETION] Estado atualizado - veículo ${vehicleId} agora inativo (múltiplos produtos)`);
        return updatedState;
      });
      
      // Toast apenas para viagem bem-sucedida (outros casos já têm toast)
      if (!vehicleBrokeDown && !merchandiseSeized) {
        const productNames = selectedProducts.map(sp => {
          const product = products.find(p => p.id === sp.productId);
          return `${sp.quantity}x ${product?.name || 'Produto'}`;
        }).join(', ');

        toast({
          title: "Viagem concluída!",
          description: `${vehicle.name} voltou com: ${productNames}`,
        });
        // +1 XP por viagem completada sem quebra nem apreensão
        awardXp(1, 'viagem-ok');
      }

      console.log(`✅ [TRIP] Viagem múltipla processada para veículo ${vehicleId}. Quebra: ${vehicleBrokeDown}, Apreensão: ${merchandiseSeized}`);
    }, tripDurationMs);
    
    // Armazenar timeout para limpeza posterior
    tripTimeoutsRef.current.set(vehicleId, tripTimeout);
    
    const productNames = selectedProducts.map(sp => {
      const product = products.find(p => p.id === sp.productId);
      return `${sp.quantity}x ${product?.name || 'Produto'}`;
    }).join(', ');
    
    toast({
      title: "Viagem iniciada!",
      description: `${vehicle.name} saiu para buscar: ${productNames}. Duração: ${vehicle.tripDuration}s`,
    });
    
    console.log(`🚛 [TRIP] Viagem múltipla iniciada para veículo ${vehicleId}, duração: ${tripDurationMs}ms`);
    
    return true;
  }, [gameState.vehicles, gameState.money, products, canAcceptTrip, calculateTripCostForMultipleProducts, clearTripTimeout]);

  const startTrip = useCallback((vehicleId: string, productId?: string, quantity?: number) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle || vehicle.active) return false;

    // Se não especificou produto, usar os dados já atribuídos ao veículo
    const tripProductId = productId || vehicle.productId;
    const tripQuantity = quantity || vehicle.quantity;

    if (!tripProductId || !tripQuantity) {
      toast({
        title: "Erro",
        description: "Produto e quantidade devem ser especificados para a viagem.",
        variant: "destructive"
      });
      return false;
    }

    return makeTrip(vehicleId, tripProductId, tripQuantity);
  }, [gameState.vehicles, makeTrip]);

  // =========================================================
  // SISTEMA DE FORNECEDORES (SUPPLIERS) + PICKUP POOL
  // =========================================================

  /**
   * Compra mercadoria de um fornecedor.
   * - Debita o dinheiro na hora
   * - Adiciona um PendingPickup ao pool global
   * - A mercadoria só chega ao estoque quando um veículo for buscar
   */
  const buyFromSupplier = useCallback((
    supplierId: string,
    productId: string,
    quantity: number
  ): boolean => {
    try {
      if (quantity <= 0) return false;

      const supplier = getSupplierById(supplierId);
      if (!supplier) {
        toast({
          title: 'Fornecedor não encontrado',
          description: 'Esse fornecedor não existe.',
          variant: 'destructive',
        });
        return false;
      }

      // Gate por nível de reputação
      const currentLevel = ensureReputation(gameStateRef.current.reputation).level;
      const requiredLevel = supplier.levelRequirement ?? 1;
      if (!meetsLevelRequirement(currentLevel, requiredLevel)) {
        toast({
          title: '🔒 Fornecedor bloqueado',
          description: `${supplier.name} requer Nível ${requiredLevel}. Seu nível atual: ${currentLevel}.`,
          variant: 'destructive',
        });
        return false;
      }

      const item = getSupplierItem(supplier, productId);
      if (!item) {
        toast({
          title: 'Produto indisponível',
          description: `${supplier.name} não vende esse produto.`,
          variant: 'destructive',
        });
        return false;
      }

      const product = products.find((p) => p.id === productId);
      if (!product) return false;

      // Preço com jitter dinâmico (±10%). Se o jitter ainda não populou
      // (primeira renderização), cai no preço base do fornecedor.
      const jitterPrice = getSupplierUnitPrice(supplierId, productId);
      const unitPrice =
        jitterPrice > 0 ? jitterPrice : computeSupplierPrice(item, product.baseCost);
      const totalCost = unitPrice * quantity;

      // Checar saldo (permite usar cheque especial até o overdraftLimit).
      // overdraftLimit já é armazenado como valor NEGATIVO (ex.: -30000),
      // então a comparação é direta: saldo pós-compra não pode cair abaixo dele.
      const current = gameStateRef.current;
      if (current.money - totalCost < current.overdraftLimit) {
        toast({
          title: 'Saldo insuficiente',
          description: `Você precisa de R$ ${totalCost.toLocaleString('pt-BR')}.`,
          variant: 'destructive',
        });
        return false;
      }

      const pickup: PendingPickup = {
        id: `pickup_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        productId,
        quantity,
        unitCost: unitPrice,
        supplierId,
        purchasedAt: Date.now(),
      };

      setGameState((prev) => ({
        ...prev,
        money: prev.money - totalCost,
        pendingPickups: [...(prev.pendingPickups || []), pickup],
      }));

      // Atualiza estatísticas agregadas (avg buy, last price, etc.)
      updateProductStats('buy', productId, quantity, unitPrice);

      playMoneySound?.();

      toast({
        title: 'Compra realizada!',
        description: `${quantity}x ${product.displayName} por R$ ${totalCost.toLocaleString('pt-BR')} em ${supplier.name}. Aguardando retirada.`,
      });

      return true;
    } catch (error) {
      console.error('❌ [SUPPLIER BUY] Erro na compra:', error);
      return false;
    }
  }, [products, playMoneySound, getSupplierUnitPrice, updateProductStats]);

  /**
   * Retorna o total de unidades pendentes (em todos os fornecedores).
   */
  const getTotalPendingPickupUnits = useCallback((): number => {
    return (gameState.pendingPickups || []).reduce((sum, p) => sum + p.quantity, 0);
  }, [gameState.pendingPickups]);

  /**
   * Cancela uma compra pendente de fornecedor.
   * - Reembolsa `unitCost * quantity` ao saldo
   * - Remove o PendingPickup do pool
   *
   * Usado tanto no botão manual "Cancelar" da sub-aba Retirada
   * quanto pelo timer automático de expiração (3 min).
   */
  const cancelPendingPickup = useCallback((
    pickupId: string,
    opts?: { silent?: boolean; reason?: 'expired' | 'manual' }
  ): boolean => {
    const current = gameStateRef.current;
    const pickup = (current.pendingPickups || []).find((p) => p.id === pickupId);
    if (!pickup) return false;

    const refund = pickup.unitCost * pickup.quantity;
    const product = products.find((p) => p.id === pickup.productId);
    const supplier = getSupplierById(pickup.supplierId);

    setGameState((prev) => ({
      ...prev,
      money: prev.money + refund,
      pendingPickups: (prev.pendingPickups || []).filter((p) => p.id !== pickupId),
    }));

    if (!opts?.silent) {
      const isExpired = opts?.reason === 'expired';
      toast({
        title: isExpired ? 'Retirada expirou' : 'Compra cancelada',
        description: `${pickup.quantity}x ${product?.displayName || pickup.productId} em ${supplier?.name || 'fornecedor'} · R$ ${refund.toLocaleString('pt-BR')} reembolsado${isExpired ? ' (3 min sem retirada)' : ''}.`,
        variant: isExpired ? 'destructive' : 'default',
      });
    }

    return true;
  }, [products]);

  // =========================================================
  // INVARIANTE: PendingPickup expira em 3 min sem retirada
  // =========================================================
  // Varre o pool a cada segundo e cancela pickups que passaram do
  // prazo. Usa gameStateRef pra não re-criar o interval toda vez
  // que pendingPickups muda.
  useEffect(() => {
    if (!gameLoaded) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expired = (gameStateRef.current.pendingPickups || []).filter(
        (p) => now - p.purchasedAt >= PICKUP_EXPIRATION_MS
      );
      if (expired.length === 0) return;
      expired.forEach((p) => {
        cancelPendingPickup(p.id, { reason: 'expired' });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameLoaded, cancelPendingPickup]);

  /**
   * Calcula quais pickups um veículo vai pegar numa retirada
   * (FIFO do pool, até encher capacidade).
   * Devolve tb o resumo por fornecedor pro cálculo de distância.
   */
  const computePickupLoadForVehicle = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return null;

    const capacity = vehicle.capacity ?? 0;
    const pool = [...(gameState.pendingPickups || [])].sort(
      (a, b) => a.purchasedAt - b.purchasedAt
    );

    let remaining = capacity;
    const taken: Array<{ pickup: PendingPickup; qty: number }> = [];

    for (const pickup of pool) {
      if (remaining <= 0) break;
      // Cada item pode ser caixa (ocupa N slots). Respeita os slots disponíveis.
      const slotsPerItem = getOccupiedUnits(pickup.productId, 1);
      if (slotsPerItem <= 0) continue;
      const maxByCapacity = Math.floor(remaining / slotsPerItem);
      if (maxByCapacity <= 0) continue;
      const take = Math.min(pickup.quantity, maxByCapacity);
      taken.push({ pickup, qty: take });
      remaining -= take * slotsPerItem;
    }

    // totalQty = unidades após desmembramento (1 caixa de 5 un = 5)
    const totalQty = taken.reduce(
      (s, t) => s + getOccupiedUnits(t.pickup.productId, t.qty),
      0
    );
    const supplierIds = Array.from(new Set(taken.map((t) => t.pickup.supplierId)));

    // Distância = maior distância entre fornecedores da rota
    const maxDistance = supplierIds.reduce((max, sid) => {
      const s = getSupplierById(sid);
      return s ? Math.max(max, s.distanceKm) : max;
    }, 0);

    return { vehicle, taken, totalQty, supplierIds, maxDistance };
  }, [gameState.vehicles, gameState.pendingPickups]);

  /**
   * Custo de despachar um veículo pra buscar os pendentes:
   * combustível (baseado em distância + operationalCost do veículo)
   * + salário diário do motorista (se tiver).
   *
   * NÃO inclui o custo da mercadoria — esse já foi debitado na compra.
   */
  const calculatePickupCost = useCallback((vehicleId: string): number => {
    const load = computePickupLoadForVehicle(vehicleId);
    if (!load) return 0;

    const { vehicle, maxDistance } = load;

    const baseOperational = vehicle.operationalCost ?? 100;
    // Fator de distância: >50km começa a pesar mais
    const distanceFactor = Math.max(1, maxDistance / 50);
    const fuelCost = Math.round(baseOperational * distanceFactor);

    const driver = gameState.drivers.find((d) => d.id === vehicle.driverId);
    const driverWage = driver?.dailyWage ?? 0;

    return fuelCost + driverWage;
  }, [computePickupLoadForVehicle, gameState.drivers]);

  /**
   * Despacha o veículo pro pool de pickups:
   * - pega FIFO até encher capacidade
   * - remove os pickups do pool (parciais ficam com quantidade reduzida)
   * - debita gasolina + salário do motorista na hora
   * - ao terminar a viagem, adiciona mercadoria ao estoque
   */
  const dispatchPickupVehicle = useCallback((vehicleId: string): boolean => {
    try {
      const vehicle = gameState.vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) return false;

      if (vehicle.active) {
        toast({
          title: 'Veículo ocupado',
          description: `${vehicle.name} já está em viagem.`,
          variant: 'destructive',
        });
        return false;
      }

      if (vehicle.broken || vehicle.seized) {
        toast({
          title: 'Veículo indisponível',
          description: `${vehicle.name} está ${vehicle.broken ? 'quebrado' : 'apreendido'}.`,
          variant: 'destructive',
        });
        return false;
      }

      const load = computePickupLoadForVehicle(vehicleId);
      if (!load || load.totalQty === 0) {
        toast({
          title: 'Nada pra buscar',
          description: 'Não há mercadorias pendentes nos fornecedores.',
          variant: 'destructive',
        });
        return false;
      }

      // Verificar espaço no armazém
      const currentStockTotal = Object.values(gameState.stock).reduce(
        (a, b) => a + (b as number),
        0
      );
      if (currentStockTotal + load.totalQty > gameState.warehouseCapacity) {
        toast({
          title: 'Armazém sem espaço',
          description: `Espaço livre: ${gameState.warehouseCapacity - currentStockTotal} / Necessário: ${load.totalQty}`,
          variant: 'destructive',
        });
        return false;
      }

      const pickupCost = calculatePickupCost(vehicleId);
      // overdraftLimit é negativo; checagem direta.
      const current = gameStateRef.current;
      if (current.money - pickupCost < current.overdraftLimit) {
        toast({
          title: 'Saldo insuficiente',
          description: `Gasolina + motorista: R$ ${pickupCost.toLocaleString('pt-BR')}.`,
          variant: 'destructive',
        });
        return false;
      }

      // Limpar timeout anterior
      clearTripTimeout(vehicleId);

      // Construir novo pool com quantidades atualizadas
      const takenIds = new Set(load.taken.map((t) => t.pickup.id));
      const updatedPool = (gameState.pendingPickups || [])
        .map((p) => {
          const match = load.taken.find((t) => t.pickup.id === p.id);
          if (!match) return p;
          const remainingQty = p.quantity - match.qty;
          return remainingQty > 0 ? { ...p, quantity: remainingQty } : null;
        })
        .filter((p): p is PendingPickup => p !== null);

      // Produtos consolidados que o veículo vai trazer (pra mostrar na UI)
      const consolidated = new Map<string, number>();
      load.taken.forEach((t) => {
        consolidated.set(
          t.pickup.productId,
          (consolidated.get(t.pickup.productId) || 0) + t.qty
        );
      });
      const selectedProducts = Array.from(consolidated.entries()).map(
        ([productId, quantity]) => ({ productId, quantity })
      );

      // Duração da viagem baseada na distância
      // Base: tripDuration do veículo (padrão 22.5s) escalada por distância
      const baseDuration = vehicle.tripDuration || 22.5;
      const scaledDuration = Math.max(
        baseDuration,
        baseDuration * Math.max(1, load.maxDistance / 100)
      );
      const tripDurationMs = scaledDuration * 1000;
      const now = Date.now();

      setGameState((prev) => ({
        ...prev,
        money: prev.money - pickupCost,
        pendingPickups: updatedPool,
        vehicles: prev.vehicles.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                active: true,
                tripStartTime: now,
                tripDuration: scaledDuration,
                selectedProducts,
                productId: undefined,
                quantity: load.totalQty,
              }
            : v
        ),
      }));

      // Snapshot para uso no timeout (evita stale closure)
      const driver = gameState.drivers.find((d) => d.id === vehicle.driverId);
      const tripProductsSnapshot = selectedProducts
        .map((sp) => products.find((p) => p.id === sp.productId))
        .filter(Boolean) as Product[];

      const tripTimeout = setTimeout(() => {
        tripTimeoutsRef.current.delete(vehicleId);

        // Calcular riscos
        const risks = calculateTripRisks(vehicle, tripProductsSnapshot, driver);
        const vehicleBrokeDown = rollBreakdownCheck(risks.breakdownChance);
        const merchandiseSeized =
          risks.hasIllicitProducts && rollSeizureCheck(risks.seizureChance);

        setGameState((prev) => {
          const currentVehicle = prev.vehicles.find((v) => v.id === vehicleId);
          if (!currentVehicle || !currentVehicle.active) {
            return prev;
          }

          let updatedState = { ...prev };

          if (vehicleBrokeDown) {
            // Mesmo com quebra, os produtos chegam ao estoque
            // Caixas se desmembram em unidades do produto base.
            const updatedStock = { ...prev.stock };
            selectedProducts.forEach((sp) => {
              decomposeStockDelta(sp.productId, sp.quantity).forEach((d) => {
                updatedStock[d.productId] =
                  (updatedStock[d.productId] || 0) + d.quantity;
              });
            });

            updatedState = {
              ...prev,
              stock: updatedStock,
              vehicles: prev.vehicles.map((v) =>
                v.id === vehicleId
                  ? {
                      ...v,
                      active: false,
                      broken: true,
                      tripStartTime: undefined,
                      selectedProducts: undefined,
                      productId: undefined,
                      quantity: undefined,
                      breakdownsCount: (v.breakdownsCount || 0) + 1,
                      tripsCompleted: (v.tripsCompleted || 0) + 1,
                    }
                  : v
              ),
            };

            toast({
              title: 'Veículo quebrou!',
              description: `${vehicle.name} quebrou trazendo ${load.totalQty} unidades. Produtos chegaram ao estoque.`,
              variant: 'destructive',
            });
            return updatedState;
          }

          if (merchandiseSeized) {
            updatedState.vehicles = prev.vehicles.map((v) =>
              v.id === vehicleId
                ? {
                    ...v,
                    active: false,
                    seized: true,
                    tripStartTime: undefined,
                    selectedProducts: undefined,
                    productId: undefined,
                    quantity: undefined,
                    seizuresCount: (v.seizuresCount || 0) + 1,
                  }
                : v
            );

            toast({
              title: 'Mercadoria apreendida!',
              description: `A polícia apreendeu a carga de ${vehicle.name}. Pague o advogado.`,
              variant: 'destructive',
            });
            return updatedState;
          }

          // Sucesso — adicionar mercadoria ao estoque
          // Caixas se desmembram em unidades do produto base.
          const updatedStock = { ...prev.stock };
          selectedProducts.forEach((sp) => {
            decomposeStockDelta(sp.productId, sp.quantity).forEach((d) => {
              updatedStock[d.productId] =
                (updatedStock[d.productId] || 0) + d.quantity;
            });
          });

          updatedState = {
            ...prev,
            stock: updatedStock,
            vehicles: prev.vehicles.map((v) =>
              v.id === vehicleId
                ? {
                    ...v,
                    active: false,
                    tripStartTime: undefined,
                    selectedProducts: undefined,
                    productId: undefined,
                    quantity: undefined,
                    tripsCompleted: (v.tripsCompleted || 0) + 1,
                  }
                : v
            ),
          };

          return updatedState;
        });

        if (!vehicleBrokeDown && !merchandiseSeized) {
          const summary = selectedProducts
            .map((sp) => {
              const p = products.find((pp) => pp.id === sp.productId);
              return `${sp.quantity}x ${p?.displayName || 'item'}`;
            })
            .join(', ');

          toast({
            title: 'Retirada concluída!',
            description: `${vehicle.name} trouxe: ${summary}`,
          });
          // +1 XP por viagem completada sem quebra nem apreensão
          awardXp(1, 'retirada-ok');
        }
      }, tripDurationMs);

      tripTimeoutsRef.current.set(vehicleId, tripTimeout);

      toast({
        title: 'Veículo despachado!',
        description: `${vehicle.name} saiu para buscar ${load.totalQty} unidades. Custo: R$ ${pickupCost.toLocaleString('pt-BR')}.`,
      });

      return true;
    } catch (error) {
      console.error('❌ [PICKUP] Erro ao despachar:', error);
      return false;
    }
  }, [
    gameState.vehicles,
    gameState.drivers,
    gameState.pendingPickups,
    gameState.stock,
    gameState.warehouseCapacity,
    products,
    computePickupLoadForVehicle,
    calculatePickupCost,
    clearTripTimeout,
  ]);

  const buyVehicle = useCallback((vehicleItem: any) => {
    try {
      // Validar entrada
      if (!vehicleItem || typeof vehicleItem.price !== 'number' || vehicleItem.price <= 0) {
        toast({
          title: "Erro na compra",
          description: "Dados do veículo inválidos",
          variant: "destructive"
        });
        return false;
      }

      // Gate por nível de reputação
      const currentLevel = ensureReputation(gameState.reputation).level;
      const requiredLevel = vehicleItem.levelRequirement ?? 1;
      if (!meetsLevelRequirement(currentLevel, requiredLevel)) {
        toast({
          title: "🔒 Nível insuficiente",
          description: `Este veículo requer Nível ${requiredLevel}. Seu nível atual: ${currentLevel}.`,
          variant: "destructive"
        });
        return false;
      }

      // Verificar se pode usar cheque especial
      const newBalance = gameState.money - vehicleItem.price;
      if (newBalance < gameState.overdraftLimit) {
        const availableAmount = gameState.money - gameState.overdraftLimit;
        toast({
          title: "Limite de cheque especial atingido",
          description: `Você pode gastar até R$ ${availableAmount.toLocaleString()} (incluindo cheque especial). Custo do veículo: R$ ${vehicleItem.price.toLocaleString()}`,
          variant: "destructive"
        });
        return false;
      }

      // Aviso quando usar cheque especial
      if (newBalance < 0 && gameState.money >= 0) {
        toast({
          title: "⚠️ Usando cheque especial",
          description: `Esta compra usará R$ ${Math.abs(newBalance).toLocaleString()} do seu cheque especial`,
          variant: "default"
        });
      }

    // Criar o novo veículo baseado no item do marketplace
    const newVehicle: Vehicle = {
      id: `${vehicleItem.id}-${Date.now()}`, // ID único
      name: vehicleItem.name,
      capacity: vehicleItem.specs.capacity,
      fuelCost: vehicleItem.specs.fuelCost,
      tripDuration: vehicleItem.specs.tripDuration,
      price: vehicleItem.price, // Preço original para cálculo de venda
      assigned: false,
      active: false,
      seized: false,
      broken: false,
      lawyerPaid: false,
      towTruckPaid: false,
      towTruckPaidForBreakdown: false,
      tripsCompleted: 0,
      seizuresCount: 0,
      breakdownsCount: 0,
      breakdownChance: vehicleItem.specs.breakdownChance || 0.05 // Chance base padrão de 5%
    };

    // Atualizar o estado do jogo
    setGameState(prev => ({
      ...prev,
      money: prev.money - vehicleItem.price,
      vehicles: [...prev.vehicles, newVehicle]
    }));

    toast({
      title: "Veículo comprado!",
      description: `${vehicleItem.name} foi adicionado à sua frota`,
      variant: "default"
    });

    return true;
    } catch (error) {
      console.error('❌ Erro ao comprar veículo:', error);
      toast({
        title: "Erro na compra",
        description: "Ocorreu um erro inesperado ao comprar o veículo",
        variant: "destructive"
      });
      return false;
    }
  }, [gameState.money, gameState.vehicles, gameState.overdraftLimit, gameState.reputation]);



  const buyDriver = useCallback((driverId: string) => {
    try {
      const driver = MARKETPLACE_DRIVERS.find(d => d.id === driverId);
      if (!driver) {
        console.warn('Motorista não encontrado:', driverId);
        return false;
      }

      if (gameState.money < driver.price) {
        console.warn('Dinheiro insuficiente para contratar motorista');
        return false;
      }

      updateState(prev => ({
        ...prev,
        money: prev.money - driver.price,
        drivers: [...prev.drivers, { 
          ...driver, 
          hired: true, 
          assigned: false,
          dailyWage: (driver as any).dailyWage || 100,
          repairDiscount: (driver as any).repairDiscount || 0,
          experience: (driver as any).experience || 'iniciante'
        }]
      }));
      return true;
    } catch (error) {
      console.error('Erro ao contratar motorista:', error);
      return false;
    }
  }, [gameState.money, updateState]);

  const sellVehicle = useCallback((vehicleId: string) => {
    try {
      let soldVehicle: Vehicle | null = null;
      let sellPrice = 0;
      
      updateState(prev => {
        const vehicle = prev.vehicles.find(v => v.id === vehicleId);
        if (!vehicle) {
          console.warn('Veículo não encontrado:', vehicleId);
          toast({
            title: "Erro na venda",
            description: "Veículo não encontrado",
            variant: "destructive"
          });
          return prev;
        }

        if (vehicle.active) {
          console.warn('Não é possível vender veículo em uso:', vehicleId);
          toast({
            title: "Venda não permitida",
            description: "Não é possível vender um veículo que está em viagem",
            variant: "destructive"
          });
          return prev;
        }

        soldVehicle = vehicle;
        sellPrice = Math.floor(vehicle.price * 0.5); // 50% do valor original (conforme UI)
        const updatedVehicles = prev.vehicles.filter(v => v.id !== vehicleId);

        // Desassociar motorista se houver um atribuído ao veículo
        let updatedDrivers = prev.drivers;
        if (vehicle.driverId) {
          updatedDrivers = prev.drivers.map(driver => 
            driver.id === vehicle.driverId 
              ? { ...driver, assigned: false }
              : driver
          );
        }

        // Criar registro da venda
        const saleRecord: VehicleSale = {
          id: `sale-${vehicleId}-${Date.now()}`,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          vehicleType: 'vehicle',
          salePrice: sellPrice,
          originalPrice: vehicle.price,
          soldAt: Date.now(),
          gameDay: prev.gameTime?.day || 1
        };

        return {
          ...prev,
          vehicles: updatedVehicles,
          drivers: updatedDrivers,
          money: prev.money + sellPrice,
          vehicleSales: [...(prev.vehicleSales || []), saleRecord]
        };
      });
      
      if (soldVehicle) {
        toast({
          title: "✅ Veículo vendido!",
          description: `${soldVehicle.name} foi vendido por R$ ${sellPrice.toLocaleString()}`,
          variant: "default"
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao vender veículo:', error);
      toast({
        title: "Erro na venda",
        description: "Ocorreu um erro inesperado ao vender o veículo",
        variant: "destructive"
      });
      return false;
    }
   }, [updateState]);





  const upgradeWarehouse = useCallback((warehouseId: string) => {
    const targetWarehouse = WAREHOUSES.find(w => w.id === warehouseId);
    if (!targetWarehouse) {
      toast({
        title: "Erro",
        description: "Galpão não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Gate por nível de reputação
    const currentLevel = ensureReputation(gameState.reputation).level;
    const requiredLevel = targetWarehouse.levelRequirement ?? 1;
    if (!meetsLevelRequirement(currentLevel, requiredLevel)) {
      toast({
        title: "🔒 Nível insuficiente",
        description: `Este galpão requer Nível ${requiredLevel}. Seu nível atual: ${currentLevel}.`,
        variant: "destructive"
      });
      return false;
    }

    // Verificar se pode usar cheque especial
    const newBalance = gameState.money - targetWarehouse.unlockRequirement;
    if (newBalance < gameState.overdraftLimit) {
      const availableAmount = gameState.money - gameState.overdraftLimit;
      toast({
        title: "Limite de cheque especial atingido",
        description: `Você pode gastar até R$ ${availableAmount.toLocaleString()} (incluindo cheque especial). Custo do galpão: R$ ${targetWarehouse.unlockRequirement.toLocaleString()}`,
        variant: "destructive"
      });
      return false;
    }

    // Aviso quando usar cheque especial
    if (newBalance < 0 && gameState.money >= 0) {
      toast({
        title: "⚠️ Usando cheque especial",
        description: `Esta compra usará R$ ${Math.abs(newBalance).toLocaleString()} do seu cheque especial`,
        variant: "default"
      });
    }

    // Verificar se já não é o galpão atual
    if (gameState.currentWarehouse === warehouseId) {
      toast({
        title: "Galpão já ativo",
        description: "Este já é o seu galpão atual",
        variant: "default"
      });
      return false;
    }

    // Atualizar estado do jogo
    setGameState(prev => ({
      ...prev,
      money: prev.money - targetWarehouse.unlockRequirement,
      currentWarehouse: warehouseId,
      warehouseCapacity: targetWarehouse.capacity
    }));

    // Atualizar no sistema de progresso
    setGameState(prev => ({
        ...prev,
        currentWarehouse: warehouseId,
        warehouseCapacity: targetWarehouse.capacity,
        money: prev.money - targetWarehouse.unlockRequirement
      }));

    toast({
      title: "🏢 Galpão adquirido!",
      description: `Você agora possui o ${targetWarehouse.name} com capacidade de ${targetWarehouse.capacity.toLocaleString()} unidades`,
      variant: "default",
      duration: 5000
    });

    console.log(`🏢 [WAREHOUSE] Galpão atualizado para: ${targetWarehouse.name} (${targetWarehouse.capacity} unidades)`);
    
    return true;
  }, [gameState.money, gameState.currentWarehouse, gameState.overdraftLimit, gameState.reputation]);

  const payLawyer = useCallback((vehicleId: string) => {
    // Verificar se a funcionalidade de apreensão está habilitada
    if (!isFeatureEnabled('POLICE_SEIZURE_ENABLED')) {
      toast({
        title: "Funcionalidade desabilitada",
        description: "A funcionalidade de apreensão policial está temporariamente desabilitada",
        variant: "default"
      });
      return false;
    }

    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      toast({
        title: "Erro",
        description: "Veículo não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Verificar se há dinheiro suficiente (considerando limite do cheque especial)
    if (gameState.money - 4000 < -30000) {
      toast({
        title: "Limite do cheque especial atingido",
        description: "Você não pode pagar o advogado com este valor",
        variant: "destructive"
      });
      return false;
    }

    // Atualizar estado do veículo e dinheiro
    const updatedVehicles = gameState.vehicles.map(v => 
      v.id === vehicleId ? {
        ...v,
        lawyerPaid: true
      } : v
    );

    setGameState(prev => ({
      ...prev,
      money: prev.money - 4000,
      vehicles: updatedVehicles
    }));
    
    setGameState(prev => ({
        ...prev,
        vehicles: updatedVehicles,
        money: prev.money - 4000
      }));

    toast({
       title: "Advogado pago!",
       description: `${vehicle.name} - Gustavão Advogado foi pago. Aguarde o guincho.`,
       duration: 3000
     });

     console.log(`[LAWYER] Advogado pago para veículo ${vehicleId}`);
     return true;
  }, [gameState.vehicles, gameState.money]);

  const payTowTruck = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      toast({
        title: "Erro",
        description: "Veículo não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Verificar se há dinheiro suficiente (considerando limite do cheque especial)
    if (gameState.money - 800 < -30000) {
      toast({
        title: "Limite do cheque especial atingido",
        description: "Você não pode pagar o guincho com este valor",
        variant: "destructive"
      });
      return false;
    }

    // Atualizar estado do veículo e dinheiro
    const updatedVehicles = gameState.vehicles.map(v => 
      v.id === vehicleId ? {
        ...v,
        towTruckPaid: true,
        towTruckStartTime: Date.now()
      } : v
    );

    setGameState(prev => ({
      ...prev,
      money: prev.money - 800,
      vehicles: updatedVehicles
    }));
    
    setGameState(prev => ({
        ...prev,
        vehicles: updatedVehicles,
        money: prev.money - 800
      }));

    // Configurar timeout para liberar o veículo após 15 segundos
    setTimeout(() => {
      const finalUpdatedVehicles = gameState.vehicles.map(v => 
        v.id === vehicleId ? {
          ...v,
          seized: false,
          active: false,
          lawyerPaid: false,
          towTruckPaid: false,
          towTruckStartTime: undefined
        } : v
      );
      
      setGameState(prev => ({ ...prev, vehicles: finalUpdatedVehicles }));
      setGameState(prev => ({
        ...prev,
        vehicles: finalUpdatedVehicles
      }));
      
      toast({
        title: "Veículo liberado!",
        description: `${vehicle.name} foi liberado e está disponível novamente`,
        duration: 3000
      });
      
      console.log(`[TOWTRUCK] Veículo ${vehicleId} liberado após guincho`);
    }, 15000);

    toast({
       title: "Guincho pago!",
       description: `${vehicle.name} - Clodoaldo do Guincho foi pago. Aguarde 15 segundos.`,
       duration: 3000
     });

     console.log(`[TOWTRUCK] Guincho pago para veículo ${vehicleId}`);
     return true;
  }, [gameState.vehicles, gameState.money]);

  const payTowTruckForBreakdown = useCallback((vehicleId: string) => {
    // Verificar se a funcionalidade de quebra está habilitada
    if (!isFeatureEnabled('VEHICLE_BREAKDOWN_ENABLED')) {
      toast({
        title: "Funcionalidade desabilitada",
        description: "A funcionalidade de quebra de veículos está temporariamente desabilitada",
        variant: "default"
      });
      return false;
    }

    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      toast({
        title: "Erro",
        description: "Veículo não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Verificar se há dinheiro suficiente (considerando limite do cheque especial)
    if (gameState.money - 800 < -30000) {
      toast({
        title: "Limite do cheque especial atingido",
        description: "Você não pode pagar o guincho com este valor",
        variant: "destructive"
      });
      return false;
    }

    // Atualizar estado do veículo e dinheiro
    const updatedVehicles = gameState.vehicles.map(v => 
      v.id === vehicleId ? {
        ...v,
        towTruckPaidForBreakdown: true,
        repairStartTime: Date.now()
      } : v
    );

    setGameState(prev => ({
      ...prev,
      money: prev.money - 800,
      vehicles: updatedVehicles
    }));
    
    setGameState(prev => ({
        ...prev,
        vehicles: updatedVehicles,
        money: prev.money - 800
      }));

    // Configurar timeout para consertar o veículo após 30 segundos
    setTimeout(() => {
      const finalUpdatedVehicles = gameState.vehicles.map(v => 
        v.id === vehicleId ? {
          ...v,
          broken: false,
          active: false,
          towTruckPaidForBreakdown: false,
          repairStartTime: undefined,
          breakdownsCount: (v.breakdownsCount || 0) + 1
        } : v
      );
      
      setGameState(prev => ({ ...prev, vehicles: finalUpdatedVehicles }));
      setGameState(prev => ({
        ...prev,
        vehicles: finalUpdatedVehicles
      }));
      
      toast({
        title: "Veículo consertado!",
        description: `${vehicle.name} foi consertado e está disponível novamente`,
        duration: 3000
      });
      
      console.log(`[REPAIR] Veículo ${vehicleId} consertado após guincho`);
    }, 30000);

    toast({
       title: "Guincho pago!",
       description: `${vehicle.name} - Clodoaldo do Guincho foi pago. Conserto em 30 segundos.`,
       duration: 3000
     });

     console.log(`[REPAIR] Guincho pago para conserto do veículo ${vehicleId}`);
     return true;
  }, [gameState.vehicles, gameState.money]);

  const saveGameManually = useCallback(async () => {
    try {
      // Estado salvo localmente
      console.log('✅ Jogo salvo manualmente com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar jogo manualmente:', error);
      return false;
    }
  }, [gameState]);

  const resetGameProgress = useCallback(async () => {
    try {
      // Resetar estado local do jogo para o estado inicial
      setGameState({
        ...INITIAL_GAME_STATE,
        buyers: [] // Inicializar com lista vazia
      });
      
      // Resetar compradores
      setBuyers([]);
      
      // Resetar produtos para estado inicial
      setProducts(PRODUCTS);
      
      // Se o usuário estiver logado, deletar dados do Supabase
      if (user) {
        setGameState(INITIAL_GAME_STATE);
    setBuyers([]);
      }
      
      console.log('🔄 Jogo resetado para estado inicial');
      return true;
    } catch (error) {
      console.error('❌ Erro ao resetar jogo:', error);
      throw error;
    }
  }, []);

  // Hidratar estado a partir de progresso salvo (Supabase)
  const hydrateGameState = useCallback((state: GameState) => {
    try {
      // Backfill de campos novos que podem não existir em saves antigos
      // + AUTO-CONSERTO de invariantes que já quebraram em saves legados:
      //   - Lojas que ficaram isLocked=true com 0 produtos (bug antigo) → destravam sozinhas
      //   - Veículos marcados active=true mas sem tripStartTime → ficam idle
      const healedStores = (state.stores ?? []).map((store) => {
        const total = (store.products ?? []).reduce(
          (sum, sp) => sum + (sp.quantity || 0),
          0
        );
        // Limpar entradas fantasma de quantidade 0
        const cleanProducts = (store.products ?? []).filter(
          (sp) => sp.quantity > 0
        );
        if (store.isLocked && total === 0) {
          console.log(
            `🔧 [HYDRATE] Auto-destravando loja "${store.name}" (estoque zerado em save legado)`
          );
          return { ...store, isLocked: false, products: cleanProducts };
        }
        return { ...store, products: cleanProducts };
      });

      // Sanear veículos: se estão marcados ativos sem viagem real, volta a idle
      const healedVehicles = (state.vehicles ?? []).map((v) => {
        if (v.active && !v.tripStartTime && !v.seized && !v.broken) {
          console.log(
            `🔧 [HYDRATE] Auto-resetando veículo "${v.name}" (active=true sem viagem real)`
          );
          return { ...v, active: false, status: 'idle' };
        }
        return v;
      });

      setGameState({
        ...state,
        stores: healedStores,
        vehicles: healedVehicles,
        pendingPickups: state.pendingPickups ?? [],
        pendingDeliveries: state.pendingDeliveries ?? [],
        productStats: state.productStats ?? {},
      });
      setBuyers([]);
      console.log('✅ [HYDRATE] Estado do jogo atualizado a partir do backend');
    } catch (error) {
      console.error('❌ [HYDRATE] Falha ao hidratar estado:', error);
    }
  }, []);



  // =============== FUNÇÕES DE TESTE (TEMPORÁRIAS) ===============
  
  const forceBreakdown = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId ? { 
          ...v, 
          broken: true,
          active: false,
          seizuresCount: v.seizuresCount || 0,
          breakdownsCount: (v.breakdownsCount || 0) + 1
        } : v
      )
    }));

    toast({
      title: "🔧 Teste: Quebra Forçada",
      description: `${vehicle.name} foi forçado a quebrar para teste`,
      variant: "destructive"
    });
  }, [gameState.vehicles]);

  const forceSeizure = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    setGameState(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId ? { 
          ...v, 
          seized: true,
          active: false,
          breakdownsCount: v.breakdownsCount || 0,
          seizuresCount: (v.seizuresCount || 0) + 1
        } : v
      )
    }));

    toast({
      title: "🚔 Teste: Apreensão Forçada",
      description: `${vehicle.name} teve mercadorias apreendidas para teste`,
      variant: "destructive"
    });
  }, [gameState.vehicles]);

  // ============================================================

  const startDelivery = useCallback((buyerId: string, orderIndex: number) => {
    try {
      const buyer = buyers.find(b => b.id === buyerId);
      if (!buyer || !buyer.orders[orderIndex]) {
        console.warn('Comprador ou pedido não encontrado');
        return false;
      }

      const order = buyer.orders[orderIndex];
      const delivery = {
        id: `delivery_${Date.now()}`,
        buyerId,
        orderIndex,
        products: order.products,
        destination: buyer.location,
        startTime: Date.now(),
        estimatedDuration: 30 * 60 * 1000, // 30 minutos
        status: 'in_progress'
      };

      updateState(prev => ({
        ...prev,
        pending_deliveries: [...prev.pending_deliveries, delivery]
      }));
      return true;
    } catch (error) {
      console.error('Erro ao iniciar entrega:', error);
      return false;
    }
  }, [buyers, updateState]);

  const completeDelivery = useCallback((deliveryId: string) => {
    try {
      updateState(prev => {
        const delivery = prev.pending_deliveries.find(d => d.id === deliveryId);
        if (!delivery) {
          console.warn('Entrega não encontrada:', deliveryId);
          return prev;
        }

        const updatedDeliveries = prev.pending_deliveries.filter(d => d.id !== deliveryId);
        
        return {
          ...prev,
          pending_deliveries: updatedDeliveries,
          completed_orders: prev.completed_orders + 1
        };
      });
      return true;
    } catch (error) {
      console.error('Erro ao completar entrega:', error);
      return false;
    }
  }, [updateState]);

  const addPendingDelivery = useCallback((delivery: any) => {
    try {
      updateState(prev => ({
        ...prev,
        pending_deliveries: [...prev.pending_deliveries, delivery]
      }));
      return true;
    } catch (error) {
      console.error('Erro ao adicionar entrega pendente:', error);
      return false;
    }
  }, [updateState]);

  // Função para calcular ocupação do galpão
  const getWarehouseOccupation = useCallback(() => {
    const totalStock = Object.values(gameState.stock).reduce((sum, qty) => sum + qty, 0);
    return Math.round((totalStock / gameState.warehouseCapacity) * 100);
  }, [gameState.stock, gameState.warehouseCapacity]);

  // Função para formatar tempo do jogo
  const formatGameTime = useCallback(() => {
    const { day, hour, minute } = gameState.gameTime;
    return `Dia ${day}, ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }, [gameState.gameTime]);

  // Função para calcular custos operacionais
  const getOperationalCosts = useCallback(() => {
    const currentWarehouse = WAREHOUSES.find(w => w.id === gameState.currentWarehouse);
    const warehouseCost = currentWarehouse ? currentWarehouse.weeklyCost : 0;
    return warehouseCost;
  }, [gameState.currentWarehouse]);

  // Função para verificar se pode usar veículo
  const canUseVehicle = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    return vehicle && !vehicle.active;
  }, [gameState.vehicles]);

  // Função para forçar reset de veículo travado
  const forceResetVehicle = useCallback((vehicleId: string) => {
    const vehicle = gameState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      toast({
        title: "Erro",
        description: "Veículo não encontrado",
        variant: "destructive"
      });
      return false;
    }

    // Limpar timeout de viagem se existir
    clearTripTimeout(vehicleId);

    // Preservar produtos da viagem antes de resetar
    let updatedStock = { ...gameState.stock };
    let productsRecovered = [];
    
    // Verificar se há produtos para recuperar (viagem única)
    if (vehicle.productId && vehicle.quantity) {
      const product = products.find(p => p.id === vehicle.productId);
      if (product) {
        // Caixas desmembram em unidades do produto base
        decomposeStockDelta(vehicle.productId, vehicle.quantity).forEach(d => {
          updatedStock[d.productId] = (updatedStock[d.productId] || 0) + d.quantity;
        });
        productsRecovered.push(`${vehicle.quantity} ${product.name}`);
        console.log(`📦 [FORCE RESET] Recuperando ${vehicle.quantity} ${product.name}`);
      }
    }

    // Verificar se há produtos para recuperar (viagem múltipla)
    if (vehicle.selectedProducts && vehicle.selectedProducts.length > 0) {
      vehicle.selectedProducts.forEach(sp => {
        const product = products.find(p => p.id === sp.productId);
        if (product) {
          // Caixas desmembram em unidades do produto base
          decomposeStockDelta(sp.productId, sp.quantity).forEach(d => {
            updatedStock[d.productId] = (updatedStock[d.productId] || 0) + d.quantity;
          });
          productsRecovered.push(`${sp.quantity} ${product.name}`);
          console.log(`📦 [FORCE RESET] Recuperando ${sp.quantity} ${product.name}`);
        }
      });
    }

    // Resetar estado do veículo
    const updatedVehicles = gameState.vehicles.map(v => 
      v.id === vehicleId ? {
        ...v,
        active: false,
        tripStartTime: undefined,
        productId: undefined,
        quantity: undefined,
        selectedProducts: undefined,
        seized: false,
        broken: false
      } : v
    );
    
    // Atualizar tanto o estado local quanto o sistema de progresso
    setGameState(prev => ({ 
      ...prev, 
      vehicles: updatedVehicles,
      stock: updatedStock
    }));
    setGameState(prev => ({
      ...prev,
      vehicles: updatedVehicles
    }));

    const recoveryMessage = productsRecovered.length > 0 
      ? ` Produtos recuperados: ${productsRecovered.join(', ')}`
      : '';

    toast({
      title: "Veículo resetado!",
      description: `${vehicle.name} foi forçadamente resetado e está disponível novamente.${recoveryMessage}`,
      duration: 5000
    });

    console.log(`🔄 [FORCE RESET] Veículo ${vehicleId} foi forçadamente resetado${recoveryMessage ? ' com recuperação de produtos' : ''}`);
    return true;
  }, [gameState.vehicles, gameState.stock, products, clearTripTimeout]);

  // Estado de sincronização
  const isSyncing = false;

  // Função para contratar motorista
  const hireDriver = useCallback((driver: any) => {
    try {
      // Validar entrada
      if (!driver || typeof driver.price !== 'number' || driver.price <= 0) {
        toast({
          title: "Erro na contratação",
          description: "Dados do motorista inválidos",
          variant: "destructive"
        });
        return false;
      }

      // Gate por nível de reputação
      const currentLevel = ensureReputation(gameState.reputation).level;
      const requiredLevel = driver.levelRequirement ?? 1;
      if (!meetsLevelRequirement(currentLevel, requiredLevel)) {
        toast({
          title: "🔒 Nível insuficiente",
          description: `Este motorista requer Nível ${requiredLevel}. Seu nível atual: ${currentLevel}.`,
          variant: "destructive"
        });
        return false;
      }

      // Verificar se já existe um motorista com o mesmo ID
      if (gameState.drivers.some(d => d.id === driver.id)) {
        toast({
          title: "Motorista já contratado",
          description: "Este motorista já faz parte da sua equipe",
          variant: "destructive"
        });
        return false;
      }

      // Verificar se pode usar cheque especial
      const newBalance = gameState.money - driver.price;
      if (newBalance < gameState.overdraftLimit) {
        const availableAmount = gameState.money - gameState.overdraftLimit;
        toast({
          title: "Limite de cheque especial atingido",
          description: `Você pode gastar até R$ ${availableAmount.toLocaleString()} (incluindo cheque especial). Custo do motorista: R$ ${driver.price.toLocaleString()}`,
          variant: "destructive"
        });
        return false;
      }

      // Aviso quando usar cheque especial
      if (newBalance < 0 && gameState.money >= 0) {
        toast({
          title: "⚠️ Usando cheque especial",
          description: `Esta compra usará R$ ${Math.abs(newBalance).toLocaleString()} do seu cheque especial`,
          variant: "default"
        });
      }
      
      // Extrair propriedades de specs e mesclar com dados do motorista
      const driverData = {
        id: driver.id,
        name: driver.name,
        photo: driver.photo,
        description: driver.description,
        vehicles: driver.vehicles,
        trait: driver.trait,
        assigned: false,
        ...driver.specs // Extrair dailyWage, repairDiscount, etc. de specs
      };
      
      setGameState(prev => ({
        ...prev,
        money: prev.money - driver.price,
        drivers: [...prev.drivers, driverData]
      }));

      toast({
        title: "Motorista contratado!",
        description: `${driver.name} foi adicionado à sua equipe`,
        variant: "default"
      });

      return true;
    } catch (error) {
      console.error('❌ Erro ao contratar motorista:', error);
      toast({
        title: "Erro na contratação",
        description: "Ocorreu um erro inesperado ao contratar o motorista",
        variant: "destructive"
      });
      return false;
    }
  }, [gameState.money, gameState.drivers, gameState.overdraftLimit, gameState.reputation]);

  // Função para vender tudo para um comprador - VERSÃO MELHORADA
  const sellAll = useCallback((buyerId: string) => {
    // Validações iniciais
    const buyer = buyers.find(b => b.id === buyerId);
    if (!buyer) {
      toast({
        title: "Erro na venda",
        description: "Comprador não encontrado",
        variant: "destructive"
      });
      return false;
    }

    if (!buyer.orders || buyer.orders.length === 0) {
      toast({
        title: "Nenhum pedido",
        description: `${buyer.name} não possui pedidos ativos`,
        variant: "destructive"
      });
      return false;
    }
    
    let totalEarnings = 0;
    let totalProfit = 0;
    let totalCost = 0;
    const updatedStock = { ...gameState.stock };
    const salesDetails: string[] = [];
    const partialSales: string[] = [];
    const unavailableItems: string[] = [];
    const saleRecords: any[] = [];
    
    // Processar cada pedido
    buyer.orders.forEach(order => {
      const product = products.find(p => p.id === order.productId);
      if (!product) return;

      const availableQuantity = gameState.stock[order.productId] || 0;
      const requestedQuantity = order.quantity;
      const sellQuantity = Math.min(availableQuantity, requestedQuantity);
      
      if (sellQuantity > 0) {
        const saleValue = sellQuantity * order.pricePerUnit;
        const itemCost = sellQuantity * product.baseCost;
        const itemProfit = saleValue - itemCost;
        
        totalEarnings += saleValue;
        totalProfit += itemProfit;
        totalCost += itemCost;
        updatedStock[order.productId] = Math.max(0, availableQuantity - sellQuantity);
        
        // Criar registro da venda
        saleRecords.push({
          id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: order.productId,
          productName: product.displayName,
          quantity: sellQuantity,
          totalValue: saleValue,
          profit: itemProfit,
          gameDay: gameState.gameTime.day,
          soldAt: Date.now()
        });
        
        if (sellQuantity === requestedQuantity) {
          salesDetails.push(`✅ ${sellQuantity}x ${product.displayName}`);
        } else {
          salesDetails.push(`⚠️ ${sellQuantity}x ${product.displayName} (de ${requestedQuantity}x)`);
          partialSales.push(`${product.displayName}: ${sellQuantity}/${requestedQuantity}`);
        }
      } else {
        unavailableItems.push(`❌ ${product.displayName} (${requestedQuantity}x)`);
      }
    });
    
    // Verificar se houve vendas
    if (totalEarnings === 0) {
      toast({
        title: "Venda não realizada",
        description: `Nenhum produto em estoque para atender ${buyer.name}`,
        variant: "destructive"
      });
      return false;
    }

    // Calcular métricas
    const profitMargin = ((totalProfit / totalEarnings) * 100).toFixed(1);
    const itemsSold = salesDetails.length;
    const totalItems = buyer.orders.length;
    
    // Tocar som de dinheiro quando ganhar dinheiro
    if (totalEarnings > 0) {
      playMoneySound();
    }

    // Atualizar estado do jogo
    setGameState(prev => ({
      ...prev,
      money: prev.money + totalEarnings,
      stock: updatedStock,
      completedOrders: prev.completedOrders + 1,
      completedSalesInCycle: prev.completedSalesInCycle + 1,
      productSales: [...prev.productSales, ...saleRecords]
    }));

    // Remover pedidos atendidos e comprador se não há mais pedidos
    setBuyers(prev => {
      const updatedBuyers = prev.map(b => {
        if (b.id === buyerId) {
          const remainingOrders = b.orders.filter(order => {
            const availableQuantity = gameState.stock[order.productId] || 0;
            const sellQuantity = Math.min(availableQuantity, order.quantity);
            return sellQuantity < order.quantity; // Manter pedidos não completamente atendidos
          });
          return { ...b, orders: remainingOrders };
        }
        return b;
      });
      
      return updatedBuyers.filter(b => b.orders.length > 0);
    });

    // Feedback detalhado para o usuário
    const isGoodDeal = totalProfit > 0;
    const dealQuality = totalProfit > (totalCost * 0.5) ? "excelente" : 
                       totalProfit > (totalCost * 0.2) ? "boa" : "regular";

    let description = `🏪 Vendas para ${buyer.name}:\n${salesDetails.join('\n')}\n\n💰 Total: R$ ${totalEarnings.toLocaleString()}\n📈 Lucro: R$ ${totalProfit.toLocaleString()} (${profitMargin}%)\n🎯 Negócio ${dealQuality}`;
    
    if (partialSales.length > 0) {
      description += `\n\n⚠️ Vendas parciais:\n${partialSales.join('\n')}`;
    }
    
    if (unavailableItems.length > 0) {
      description += `\n\n❌ Sem estoque:\n${unavailableItems.join('\n')}`;
    }

    toast({
      title: `✅ Vendas realizadas (${itemsSold}/${totalItems} itens)`,
      description,
      variant: isGoodDeal ? "default" : "destructive"
    });

    return true;
  }, [buyers, gameState.stock, products]);

  // Inicializar compradores quando o jogo carrega (removido - foi movido)

  // Atualizar tempo do jogo (otimizado)
  useEffect(() => {
    if (gameLoaded) {
      const interval = setInterval(() => {
        updateGameTime();
      }, 200); // Aumentado de 100ms para 200ms para reduzir ainda mais a carga

      return () => clearInterval(interval);
    }
  }, [gameLoaded]); // Removido updateGameTime das dependências

  // Timer duplicado removido - já existe timer acima para checkBuyerGeneration

  // Store functions
  const buyStore = useCallback((storeId: string) => {
    const store = INITIAL_STORES.find(s => s.id === storeId);
    if (!store) {
      return false;
    }

    // Verificar se pode usar cheque especial
    const newBalance = gameState.money - store.purchasePrice;
    if (newBalance < gameState.overdraftLimit) {
      const availableAmount = gameState.money - gameState.overdraftLimit;
      toast({
        title: "Limite de cheque especial atingido",
        description: `Você pode gastar até R$ ${availableAmount.toLocaleString()} (incluindo cheque especial). Custo da loja: R$ ${store.purchasePrice.toLocaleString()}`,
        variant: "destructive"
      });
      return false;
    }

    // Aviso quando usar cheque especial
    if (newBalance < 0 && gameState.money >= 0) {
      toast({
        title: "⚠️ Usando cheque especial",
        description: `Esta compra usará R$ ${Math.abs(newBalance).toLocaleString()} do seu cheque especial`,
        variant: "default"
      });
    }

    setGameState(prev => {
      const storeIndex = prev.stores.findIndex(s => s.id === storeId);
      if (storeIndex === -1) return prev;

      const newStores = [...prev.stores];
      newStores[storeIndex] = {
        ...newStores[storeIndex],
        owned: true
      };

      return {
        ...prev,
        stores: newStores,
        money: prev.money - store.purchasePrice
      };
    });

    return true;
  }, [gameState.money]);

  const sellStore = useCallback((storeId: string) => {
    const store = INITIAL_STORES.find(s => s.id === storeId);
    if (!store) {
      return false;
    }

    const ownedStore = gameState.stores.find(s => s.id === storeId && s.owned);
    if (!ownedStore) {
      toast({
        title: "Erro",
        description: "Você não possui esta loja",
        variant: "destructive"
      });
      return false;
    }

    // Verificar se a loja tem produtos em estoque
    const hasProducts = ownedStore.products && ownedStore.products.some(product => product.quantity > 0);
    if (hasProducts) {
      toast({
        title: "Não é possível vender",
        description: "Você deve remover todos os produtos da loja antes de vendê-la",
        variant: "destructive"
      });
      return false;
    }

    // Calcular valor de venda (1/4 do valor pago)
    const sellValue = Math.floor(store.purchasePrice / 4);

    setGameState(prev => {
      const storeIndex = prev.stores.findIndex(s => s.id === storeId);
      if (storeIndex === -1) return prev;

      const newStores = [...prev.stores];
      newStores[storeIndex] = {
        ...INITIAL_STORES.find(s => s.id === storeId)!, // Reset para estado inicial
        owned: false
      };

      return {
        ...prev,
        stores: newStores,
        money: prev.money + sellValue
      };
    });

    toast({
      title: "Loja vendida",
      description: `Você recebeu R$ ${sellValue.toLocaleString()} pela venda da loja`,
      variant: "default"
    });

    return true;
  }, [gameState.stores, gameState.money]);

  const depositProductInStore = useCallback((storeId: string, productId: string, quantity: number) => {
    setGameState(prev => {
      // Verificar se há estoque suficiente
      if ((prev.stock[productId] || 0) < quantity) {
        return prev; // Não há estoque suficiente
      }

      // Encontrar a loja
      const storeIndex = prev.stores.findIndex(store => store.id === storeId);
      if (storeIndex === -1 || !prev.stores[storeIndex].owned) {
        return prev; // Loja não encontrada ou não é do jogador
      }

      const store = prev.stores[storeIndex];
      
      // NOVA REGRA: Verificar se a loja está bloqueada
      if (store.isLocked) {
        console.log(`🔒 [STORE] Loja ${store.name} está bloqueada. Deve zerar o estoque primeiro.`);
        return prev; // Loja bloqueada, não permite novos depósitos
      }
      
      // Verificar se o produto é da categoria da loja
      const product = PRODUCTS.find(p => p.id === productId);
      if (!product || product.category !== store.category) {
        return prev; // Produto não é da categoria da loja
      }
      
      // Verificar capacidade
      const currentCapacity = store.products.reduce((total, product) => total + product.quantity, 0);
      if (currentCapacity + quantity > store.maxCapacity) {
        return prev; // Não há capacidade suficiente
      }

      // Atualizar estado
      const newStores = [...prev.stores];
      const existingProductIndex = store.products.findIndex(p => p.productId === productId);
      
      if (existingProductIndex >= 0) {
        // Produto já existe na loja, adicionar quantidade
        newStores[storeIndex] = {
          ...store,
          products: store.products.map((product, index) => 
            index === existingProductIndex
              ? { ...product, quantity: product.quantity + quantity }
              : product
          ),
          isLocked: true // BLOQUEAR a loja após adicionar produtos
        };
      } else {
        // Novo produto na loja
        newStores[storeIndex] = {
          ...store,
          products: [
            ...store.products,
            {
              productId,
              quantity,
              depositedAt: Date.now()
            }
          ],
          isLocked: true // BLOQUEAR a loja após adicionar produtos
        };
      }

      console.log(`🔒 [STORE] Loja ${store.name} foi bloqueada após adicionar ${quantity}x ${product.displayName}`);

      return {
        ...prev,
        stores: newStores,
        stock: {
          ...prev.stock,
          [productId]: (prev.stock[productId] || 0) - quantity
        }
      };
    });

    return true;
  }, []);

  const depositProductsBatch = useCallback((storeId: string, items: { productId: string; quantity: number }[]) => {
    let addedCount = 0;
    setGameState(prev => {
      const storeIndex = prev.stores.findIndex(s => s.id === storeId);
      if (storeIndex === -1) return prev;
      const store = prev.stores[storeIndex];
      if (!store.owned || store.isLocked) return prev;

      let currentCapacity = store.products.reduce((sum, p) => sum + p.quantity, 0);
      const baseCapacity = currentCapacity;
      const newStock = { ...prev.stock } as Record<string, number>;
      const newProducts = [...store.products];

      items.forEach(({ productId, quantity }) => {
        if (quantity <= 0) return;
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product || product.category !== store.category) return;
        const available = newStock[productId] || 0;
        if (available < quantity) return;
        if (currentCapacity + quantity > store.maxCapacity) return;

        // Apply changes
        newStock[productId] = available - quantity;
        const idx = newProducts.findIndex(p => p.productId === productId);
        if (idx >= 0) newProducts[idx] = { ...newProducts[idx], quantity: newProducts[idx].quantity + quantity };
        else newProducts.push({ productId, quantity, depositedAt: Date.now() });
        currentCapacity += quantity;
        addedCount += 1;
      });

      if (addedCount === 0) return prev;

      const newStores = [...prev.stores];
      newStores[storeIndex] = { ...store, products: newProducts, isLocked: true };

      console.log(`🔒 [STORE] Loja ${store.name} bloqueada após depósito em lote. Itens adicionados: ${addedCount}`);

      return {
        ...prev,
        stores: newStores,
        stock: newStock
      };
    });

    return addedCount;
  }, []);

  const storeLastSaleTimeRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    console.log('🏪 [STORES DEBUG] Iniciando sistema de vendas automáticas globais');
    
    const storesSalesInterval = setInterval(() => {
      setGameState(prev => {
        const currentTime = Date.now();
        let hasChanges = false;
        const newState = { ...prev };
        
        console.log(`🔄 [STORES DEBUG] Verificando ${prev.stores.length} lojas para vendas automáticas`);
        
        // Processar vendas automáticas de todas as lojas com estoque
        prev.stores.forEach(store => {
          if (!store.owned || store.products.length === 0) {
            return;
          }
          
          // Verificar se há produtos em estoque
          const productsWithStock = store.products.filter(product => product.quantity > 0);
          if (productsWithStock.length === 0) {
            return;
          }
          
          console.log(`🏪 [STORES DEBUG] ${store.name}: ${productsWithStock.length} produtos em estoque`);
          
          // Garantir que o tempo inicial seja persistido para acumular intervalo corretamente
          if (!storeLastSaleTimeRef.current.has(store.id)) {
            storeLastSaleTimeRef.current.set(store.id, currentTime);
            console.log(`⏰ [STORES DEBUG] Iniciando timer para ${store.name}`);
          }
          const lastSaleTime = storeLastSaleTimeRef.current.get(store.id)!;
          const timeSinceLastSale = currentTime - lastSaleTime;
          
          console.log(`⏰ [STORES DEBUG] ${store.name}: ${timeSinceLastSale}ms desde última venda (intervalo: ${store.sellInterval}ms)`);
          
          // Verificar se é hora de fazer uma venda (baseado no sellInterval da loja)
          if (timeSinceLastSale >= store.sellInterval) {
            // Selecionar produto aleatório com estoque
            const randomIndex = Math.floor(Math.random() * productsWithStock.length);
            const selectedStoreProduct = productsWithStock[randomIndex];
            
            // Encontrar dados do produto
            const product = PRODUCTS.find(p => p.id === selectedStoreProduct.productId);
            if (!product) {
              console.log(`❌ [STORES DEBUG] Produto ${selectedStoreProduct.productId} não encontrado`);
              return;
            }
            
            // Calcular lucro da venda (reduzido 50% — lojas compradas na aba "Mais")
            const salePrice = product.currentPrice * store.profitMultiplier;
            const profit = (salePrice - product.baseCost) * 0.5;
            
            // Atualizar estado - remover 1 unidade do produto vendido
            const updatedStores = prev.stores.map(s => {
              if (s.id === store.id) {
                const updatedProducts = s.products.map(sp => {
                  if (sp.productId === selectedStoreProduct.productId) {
                    return {
                      ...sp,
                      quantity: Math.max(0, sp.quantity - 1)
                    };
                  }
                  return sp;
                }).filter(sp => sp.quantity > 0); // Remover produtos sem estoque
                
                // CORREÇÃO: Verificar se a loja deve ser desbloqueada
                const shouldUnlock = updatedProducts.length === 0 && s.isLocked;
                
                if (shouldUnlock) {
                  console.log(`🔓 [AUTO SALE] Loja ${s.name} foi desbloqueada automaticamente (estoque zerado)`);
                }
                
                return {
                  ...s,
                  products: updatedProducts,
                  isLocked: shouldUnlock ? false : s.isLocked
                };
              }
              return s;
            });
            
            newState.stores = updatedStores;
            newState.money = prev.money + profit;
            
            // Tocar som de dinheiro quando ganhar dinheiro
            if (profit > 0) {
              playMoneySound();
            }
            
            // Atualizar tempo da última venda
            storeLastSaleTimeRef.current.set(store.id, currentTime);
            hasChanges = true;
            
            console.log(`💰 [AUTO SALE] ${store.name}: Vendeu 1x ${product.displayName} por ${formatMoney(profit)} lucro`);
          }
        });
        
        return hasChanges ? newState : prev;
      });
    }, 1000); // Verificar vendas a cada segundo
    
    return () => {
      console.log('🏪 [STORES DEBUG] Parando sistema de vendas automáticas');
      clearInterval(storesSalesInterval);
    };
  }, []);

  // Função formatMoney local para use no hook
  const formatMoney = useCallback((amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const storeSaleComplete = useCallback((storeId: string, productId: string, quantity: number, profit: number) => {
    setGameState(prev => {
      const storeIndex = prev.stores.findIndex(store => store.id === storeId);
      if (storeIndex === -1) return prev;

      const store = prev.stores[storeIndex];
      const productIndex = store.products.findIndex(p => p.productId === productId);
      if (productIndex === -1) return prev;

      const newStores = [...prev.stores];
      const currentProduct = store.products[productIndex];

      if (currentProduct.quantity <= quantity) {
        // Remover produto se quantidade zerou
        newStores[storeIndex] = {
          ...store,
          products: store.products.filter((_, index) => index !== productIndex)
        };
      } else {
        // Reduzir quantidade
        newStores[storeIndex] = {
          ...store,
          products: store.products.map((product, index) =>
            index === productIndex
              ? { ...product, quantity: product.quantity - quantity }
              : product
          )
        };
      }

      // NOVA REGRA: Verificar se a loja deve ser desbloqueada
      const updatedStore = newStores[storeIndex];
      const totalProductsInStore = updatedStore.products.reduce((total, product) => total + product.quantity, 0);
      
      if (totalProductsInStore === 0 && updatedStore.isLocked) {
        // Desbloquear a loja quando não há mais produtos
        newStores[storeIndex] = {
          ...updatedStore,
          isLocked: false
        };
        console.log(`🔓 [STORE] Loja ${updatedStore.name} foi desbloqueada (estoque zerado)`);
      }

      // Criar registro de venda
      const product = PRODUCTS.find(p => p.id === productId);
      const saleRecord = {
        id: `store_sale_${Date.now()}_${Math.random()}`,
        productId,
        productName: product?.displayName || 'Produto',
        quantity,
        totalValue: profit,
        profit,
        gameDay: prev.gameTime?.day || 1,
        soldAt: Date.now()
      };

      // Tocar som de dinheiro quando ganhar dinheiro
      if (profit > 0) {
        playMoneySound();
      }

      return {
        ...prev,
        stores: newStores,
        money: prev.money + profit,
        productSales: [...(prev.productSales || []), saleRecord]
      };
    });

    // Estatísticas por produto (venda via loja própria).
    // Aqui `profit` é a receita total dessa venda (é o que entra em money),
    // então o preço unitário é profit/quantity.
    if (quantity > 0 && profit > 0) {
      updateProductStats('sell', productId, quantity, Math.round(profit / quantity));
    }
  }, [updateProductStats]);

  const renameStore = useCallback((storeId: string, newName: string) => {
    setGameState(prev => {
      const storeIndex = prev.stores.findIndex(store => store.id === storeId);
      if (storeIndex === -1 || !prev.stores[storeIndex].owned) {
        return prev; // Loja não encontrada ou não é do jogador
      }

      const newStores = [...prev.stores];
      newStores[storeIndex] = {
        ...newStores[storeIndex],
        customName: newName
      };

      return {
        ...prev,
        stores: newStores
      };
    });

    return true;
  }, []);

  // =======================================================
  // Helpers para o Mercado P2P entre jogadores
  // =======================================================
  const reservePlayerMarketStock = useCallback((productId: string, quantity: number): boolean => {
    const currentStock = gameStateRef.current.stock[productId] ?? 0;
    if (currentStock < quantity || quantity <= 0) return false;
    setGameState(prev => ({
      ...prev,
      stock: {
        ...prev.stock,
        [productId]: Math.max(0, (prev.stock[productId] ?? 0) - quantity),
      },
    }));
    return true;
  }, []);

  const returnPlayerMarketStock = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setGameState(prev => ({
      ...prev,
      stock: {
        ...prev.stock,
        [productId]: (prev.stock[productId] ?? 0) + quantity,
      },
    }));
  }, []);

  const receivePlayerMarketStock = useCallback((productId: string, quantity: number): boolean => {
    if (quantity <= 0) return false;
    const current = gameStateRef.current;
    const spaceUsed = Object.values(current.stock).reduce((a, b) => a + (b as number), 0);
    if (spaceUsed + quantity > current.warehouseCapacity) return false;
    setGameState(prev => ({
      ...prev,
      stock: {
        ...prev.stock,
        [productId]: (prev.stock[productId] ?? 0) + quantity,
      },
    }));
    return true;
  }, []);

  const spendPlayerMarketMoney = useCallback((amount: number): boolean => {
    if (amount <= 0) return false;
    const current = gameStateRef.current;
    if (current.money - amount < current.overdraftLimit) return false;
    setGameState(prev => ({ ...prev, money: prev.money - amount }));
    return true;
  }, []);

  const addPlayerMarketMoney = useCallback((amount: number) => {
    if (amount <= 0) return;
    setGameState(prev => ({ ...prev, money: prev.money + amount }));
  }, []);

  const gameLogicInstance = {
    gameState,
    buyers,
    products,
    gameLoaded,
    isSyncing,

    sellToBuyer,
    rejectBuyer,
    tryBargain,
    assignVehicle,
    unassignVehicle,
    assignDriver,
    unassignDriver,
    startTrip,
    buyVehicle,
    buyDriver,
    sellVehicle,
    hireDriver,
    makeTrip,
    makeTripWithMultipleProducts,
    sellAll,
    calculateTripCost,
    calculateTripCostForMultipleProducts,
    upgradeWarehouse,
    payLawyer,
    payTowTruck,
    payTowTruckForBreakdown,
    saveGameManually,
    resetGameProgress,
    hydrateGameState,
    warehouses: WAREHOUSES,
    marketplaceVehicles: MARKETPLACE_VEHICLES,
    marketplaceDrivers: MARKETPLACE_DRIVERS,
    startDelivery,
    completeDelivery,
    addPendingDelivery,
    getWarehouseOccupation,
    formatGameTime,
    getOperationalCosts,
    canAcceptTrip,
    canUseVehicle,
    forceResetVehicle,
    clearAllTripTimeouts,
    // Store functions
    buyStore,
    sellStore,
    depositProductInStore,
    depositProductsBatch,
    storeSaleComplete,
    renameStore,
    // Funções de teste temporárias
    forceBreakdown,
    forceSeizure,

    // Mercado P2P helpers
    reservePlayerMarketStock,
    returnPlayerMarketStock,
    receivePlayerMarketStock,
    spendPlayerMarketMoney,
    addPlayerMarketMoney,

    // Fornecedores / Pickups
    suppliers: SUPPLIERS,
    buyFromSupplier,
    dispatchPickupVehicle,
    calculatePickupCost,
    computePickupLoadForVehicle,
    getTotalPendingPickupUnits,
    getSupplierUnitPrice,
    updateProductStats,
    cancelPendingPickup,
    pickupExpirationMs: PICKUP_EXPIRATION_MS,
    /** Slots máximos de compradores no tick atual (varia com o nível). */
    maxBuyers: MAX_BUYERS,
  };

  // Expor instância globalmente para acesso durante logout (otimizado)
  useEffect(() => {
    if (gameLoaded) {
      // Usar uma referência para evitar re-criações constantes
      window.gameLogicInstance = {
        get gameState() { return gameStateRef.current; }, // Usar getter para acesso dinâmico sem dependência
        clearAllTripTimeouts,
        forceResetVehicle
      };
      console.log('🌐 GameLogic instance exposta globalmente');
    }
    
    return () => {
      if (window.gameLogicInstance) {
        delete window.gameLogicInstance;
        console.log('🧹 GameLogic instance removida do escopo global');
      }
    };
  }, [gameLoaded]); // Removido gameState, clearAllTripTimeouts e forceResetVehicle das dependências

  return gameLogicInstance;
};