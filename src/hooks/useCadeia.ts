// =====================================================================
// useCadeia.ts — Hook principal do jogo Cadeia
// Estado global, tick loop (5s), todas as ações do jogador
// =====================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CadeiaState,
  Company,
  MarketListing,
  RegionId,
  CompanyTypeId,
  CompanySize,
  Transaction,
  GameNotification,
  PMREntry,
} from '@/types/cadeia';
import { getCompanyType, getSizeVariant, calcTaxRate, PRODUCTS, REGIONS, getRecipesForCompany } from '@/data/cadeia';
import {
  tickCompany,
  buildCompany,
  withdrawDividends,
  createMarketListing,
  buyFromMarket,
  generateNPCListings,
  updatePMRCache,
  getPMR,
  calcPMR,
  getInventoryQty,
} from '@/lib/cadeiaEngine';

// ── Estado inicial ────────────────────────────────────────────────────
const STORAGE_KEY = 'cadeia_state_v1';
const TICK_INTERVAL_MS = 5_000;
const MAX_TRANSACTIONS = 100;
const MAX_NOTIFICATIONS = 30;
const NPC_REFRESH_MS = 15 * 60 * 1_000;

function makeInitialState(): CadeiaState {
  const nowMs = Date.now();
  // PMR começa no basePrice de cada produto para cada região
  const pmr: PMREntry[] = PRODUCTS.flatMap((p) =>
    REGIONS.map((r) => ({
      productId: p.id,
      regionId: r.id as RegionId,
      price: p.basePrice,
      lastUpdated: nowMs,
    })),
  );

  return {
    playerCapital: 50_000,
    playerName: 'Jogador',
    cnpjCounter: 0,
    companies: [],
    transactions: [],
    pmr,
    marketListings: generateNPCListings(pmr, nowMs),
    marketLastRefresh: nowMs,
    notifications: [],
    totalEarned: 0,
    totalSpent: 0,
    lastSaved: nowMs,
  };
}

function loadState(): CadeiaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CadeiaState;
      // Garantir que PMR existe para todos os produtos/regiões
      const nowMs = Date.now();
      const fullPmr: PMREntry[] = PRODUCTS.flatMap((p) =>
        REGIONS.map((r) => {
          const existing = parsed.pmr.find(
            (e) => e.productId === p.id && e.regionId === r.id,
          );
          return existing ?? { productId: p.id, regionId: r.id as RegionId, price: p.basePrice, lastUpdated: nowMs };
        }),
      );
      return { ...parsed, pmr: fullPmr };
    }
  } catch {
    // ignore
  }
  return makeInitialState();
}

function saveState(state: CadeiaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastSaved: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

// ── Hook ──────────────────────────────────────────────────────────────

export interface UseCadeiaReturn {
  state: CadeiaState;

  // Configuração
  setPlayerName: (name: string) => void;

  // Empresas
  buyCompany: (typeId: CompanyTypeId, size: CompanySize, regionId: RegionId, name: string) => { ok: boolean; error?: string };
  setSelectedRecipe: (companyId: string, recipeId: string | null) => void;
  closeCompany: (companyId: string) => { ok: boolean; error?: string };
  pauseCompany: (companyId: string) => void;
  resumeCompany: (companyId: string) => void;
  updateCompanyConfig: (companyId: string, partial: Partial<Company['config']>) => void;

  // Produção
  startProduction: (companyId: string, recipeId: string) => { ok: boolean; error?: string };

  // Finanças
  withdrawFromCompany: (companyId: string, amount: number) => { ok: boolean; error?: string };
  depositToCompany: (companyId: string, amount: number) => { ok: boolean; error?: string };

  // Mercado
  listOnMarket: (companyId: string, productId: string, qty: number, price: number) => { ok: boolean; error?: string };
  buyFromSpotMarket: (buyerCompanyId: string, listingId: string, qty: number) => { ok: boolean; error?: string };
  refreshMarket: () => void;

  // Utilitários
  resetGame: () => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Helpers derivados
  getCompany: (id: string) => Company | undefined;
  getActiveListing: (companyId: string, productId: string) => MarketListing | undefined;
}

export function useCadeia(): UseCadeiaReturn {
  const [state, setState] = useState<CadeiaState>(loadState);
  const lastTickRef = useRef<number>(Date.now());
  const stateRef = useRef<CadeiaState>(state);

  // Manter ref sincronizada para o tick não usar closure stale
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Auto-save ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      saveState(stateRef.current);
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Tick loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const nowMs = Date.now();
      const lastTickMs = lastTickRef.current;
      lastTickRef.current = nowMs;

      setState((prev) => {
        const totalCompanies = prev.companies.filter((c) => c.status === 'active').length;
        let allTransactions = [...prev.transactions];
        let allNotifications = [...prev.notifications];
        let pmrCache = [...prev.pmr];
        let marketListings = [...prev.marketListings];
        let playerCapitalDelta = 0;

        // Refresh NPC listings se expiradas
        const needsRefresh = nowMs > prev.marketLastRefresh + NPC_REFRESH_MS;
        if (needsRefresh) {
          // Manter listings de players, substituir NPCs
          const playerListings = marketListings.filter((l) => !l.isNPC);
          const npcListings = generateNPCListings(pmrCache, nowMs);
          marketListings = [...playerListings, ...npcListings];
        }

        const updatedCompanies = prev.companies.map((company) => {
          const result = tickCompany(
            company,
            nowMs,
            lastTickMs,
            pmrCache,
            marketListings,
            totalCompanies,
          );

          // Acumular transações
          allTransactions = [...allTransactions, ...result.newTransactions];
          allNotifications = [...allNotifications, ...result.newNotifications];
          playerCapitalDelta += result.playerCapitalDelta;

          // Atualizar PMR
          for (const upd of result.pmrUpdates) {
            pmrCache = updatePMRCache(pmrCache, upd.productId, upd.regionId, upd.price, nowMs);
          }

          // Reduzir qtd de listings consumidos (auto-buy)
          for (const consumed of result.consumedListings) {
            marketListings = marketListings.map((l) =>
              l.id === consumed.listingId
                ? { ...l, availableQty: Math.max(0, l.availableQty - consumed.quantityConsumed) }
                : l,
            );
          }

          return result.company;
        });

        // Recalcular PMR global com base nas transações acumuladas
        for (const product of PRODUCTS) {
          for (const region of REGIONS) {
            const prevPmr = getPMR(pmrCache, product.id, region.id as RegionId);
            const newPmr = calcPMR(allTransactions, product.id, region.id as RegionId, nowMs, prevPmr);
            pmrCache = updatePMRCache(pmrCache, product.id, region.id as RegionId, newPmr, nowMs);
          }
        }

        // Truncar histórico
        const trimmedTransactions = allTransactions.slice(-MAX_TRANSACTIONS);
        const trimmedNotifications = allNotifications.slice(-MAX_NOTIFICATIONS);

        return {
          ...prev,
          companies: updatedCompanies,
          transactions: trimmedTransactions,
          notifications: trimmedNotifications,
          pmr: pmrCache,
          marketListings,
          marketLastRefresh: needsRefresh ? nowMs : prev.marketLastRefresh,
          playerCapital: prev.playerCapital + playerCapitalDelta,
        };
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────
  const addNotification = useCallback(
    (
      type: GameNotification['type'],
      title: string,
      message: string,
      companyId?: string,
    ) => {
      setState((prev) => {
        const notif: GameNotification = {
          id: Math.random().toString(36).slice(2),
          type,
          title,
          message,
          createdAt: Date.now(),
          read: false,
          companyId,
        };
        return {
          ...prev,
          notifications: [...prev.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif],
        };
      });
    },
    [],
  );

  function nextCnpj(counter: number): string {
    return String(counter + 1).padStart(4, '0');
  }

  // ── Ações ─────────────────────────────────────────────────────────

  const setPlayerName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, playerName: name }));
  }, []);

  const buyCompany = useCallback(
    (
      typeId: CompanyTypeId,
      size: CompanySize,
      regionId: RegionId,
      name: string,
    ): { ok: boolean; error?: string } => {
      const def = getCompanyType(typeId);
      const variant = getSizeVariant(typeId, size);
      const s = stateRef.current;

      if (s.playerCapital < variant.baseCost) {
        return { ok: false, error: `Capital insuficiente. Custo: R$${variant.baseCost.toLocaleString('pt-BR')}` };
      }
      // Verificar nível mínimo (número de empresas ativas como proxy de nível)
      const activeCount = s.companies.filter((c) => c.status !== 'closed').length;
      if (activeCount < def.minLevel - 1) {
        return { ok: false, error: `Nível insuficiente. Precisa de ${def.minLevel - 1} empresas abertas.` };
      }

      const cnpj = nextCnpj(s.cnpjCounter);
      const newCompany = buildCompany({
        name: name.trim() || def.name,
        typeId,
        size,
        regionId,
        cnpj,
        initialCapital: 0,
      });

      setState((prev) => ({
        ...prev,
        playerCapital: prev.playerCapital - variant.baseCost,
        totalSpent: prev.totalSpent + variant.baseCost,
        cnpjCounter: prev.cnpjCounter + 1,
        companies: [...prev.companies, newCompany],
        transactions: [
          ...prev.transactions.slice(-(MAX_TRANSACTIONS - 1)),
          {
            id: Math.random().toString(36).slice(2),
            companyId: newCompany.id,
            companyName: newCompany.name,
            type: 'company_purchase' as const,
            amount: -variant.baseCost,
            description: `🏢 Compra de empresa: ${newCompany.name} (CNPJ ${cnpj})`,
            occurredAt: Date.now(),
          },
        ],
      }));

      addNotification('success', 'Empresa aberta!', `${newCompany.name} está operacional.`, newCompany.id);
      return { ok: true };
    },
    [addNotification],
  );

  const setSelectedRecipe = useCallback(
    (companyId: string, recipeId: string | null) => {
      setState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) =>
          c.id === companyId
            ? { ...c, config: { ...c.config, selectedRecipeId: recipeId } }
            : c,
        ),
      }));
    },
    [],
  );

  const closeCompany = useCallback(
    (companyId: string): { ok: boolean; error?: string } => {
      setState((prev) => {
        const company = prev.companies.find((c) => c.id === companyId);
        if (!company) return prev;
        // Devolver capital da empresa ao jogador ao fechar
        return {
          ...prev,
          playerCapital: prev.playerCapital + company.capital,
          companies: prev.companies.map((c) =>
            c.id === companyId ? { ...c, status: 'closed' } : c,
          ),
        };
      });
      addNotification('info', 'Empresa fechada', `Empresa encerrada. Capital devolvido.`);
      return { ok: true };
    },
    [addNotification],
  );

  const pauseCompany = useCallback((companyId: string) => {
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((c) =>
        c.id === companyId && c.status === 'active' ? { ...c, status: 'paused' } : c,
      ),
    }));
  }, []);

  const resumeCompany = useCallback((companyId: string) => {
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((c) =>
        c.id === companyId && c.status === 'paused' ? { ...c, status: 'active' } : c,
      ),
    }));
  }, []);

  const updateCompanyConfig = useCallback(
    (companyId: string, partial: Partial<Company['config']>) => {
      setState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) =>
          c.id === companyId ? { ...c, config: { ...c.config, ...partial } } : c,
        ),
      }));
    },
    [],
  );

  const startProduction = useCallback(
    (companyId: string, recipeId: string): { ok: boolean; error?: string } => {
      const s = stateRef.current;
      const company = s.companies.find((c) => c.id === companyId);
      if (!company) return { ok: false, error: 'Empresa não encontrada.' };
      if (company.status !== 'active') return { ok: false, error: 'Empresa não está ativa.' };
      if (company.activeProductions.length > 0) {
        return { ok: false, error: 'Já existe produção em andamento.' };
      }

      const recipes = getRecipesForCompany(company.typeId, company.size);
      const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0];
      if (!recipe) return { ok: false, error: 'Receita não encontrada.' };

      // Verificar insumos
      for (const inp of recipe.inputs) {
        const have = getInventoryQty(company, inp.productId);
        if (have < inp.quantity) {
          return { ok: false, error: `Insumo insuficiente: ${inp.productId}` };
        }
      }

      const nowMs = Date.now();
      setState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) => {
          if (c.id !== companyId) return c;
          let inventory = [...c.inventory];
          for (const inp of recipe.inputs) {
            inventory = inventory
              .map((i) =>
                i.productId === inp.productId
                  ? { ...i, quantity: Math.max(0, i.quantity - inp.quantity) }
                  : i,
              )
              .filter((i) => i.quantity > 0);
          }
          return {
            ...c,
            inventory,
            activeProductions: [
              ...c.activeProductions,
              {
                id: Math.random().toString(36).slice(2),
                recipeId: recipe.id,
                startedAt: nowMs,
                completesAt: nowMs + recipe.durationMin * 60_000,
                status: 'running' as const,
              },
            ],
          };
        }),
      }));

      return { ok: true };
    },
    [],
  );

  const withdrawFromCompany = useCallback(
    (companyId: string, amount: number): { ok: boolean; error?: string } => {
      const s = stateRef.current;
      const company = s.companies.find((c) => c.id === companyId);
      if (!company) return { ok: false, error: 'Empresa não encontrada.' };
      if (amount <= 0) return { ok: false, error: 'Valor inválido.' };
      if (company.capital < amount) {
        return { ok: false, error: `Capital insuficiente na empresa (disponível: R$${company.capital.toFixed(2)}).` };
      }

      const nowMs = Date.now();
      const { company: updatedCompany, transaction } = withdrawDividends(company, amount, nowMs);

      setState((prev) => ({
        ...prev,
        playerCapital: prev.playerCapital + amount,
        totalEarned: prev.totalEarned + amount,
        companies: prev.companies.map((c) => (c.id === companyId ? updatedCompany : c)),
        transactions: [...prev.transactions.slice(-(MAX_TRANSACTIONS - 1)), transaction],
      }));

      return { ok: true };
    },
    [],
  );

  const depositToCompany = useCallback(
    (companyId: string, amount: number): { ok: boolean; error?: string } => {
      const s = stateRef.current;
      if (s.playerCapital < amount) {
        return { ok: false, error: 'Capital pessoal insuficiente.' };
      }
      if (amount <= 0) return { ok: false, error: 'Valor inválido.' };

      setState((prev) => ({
        ...prev,
        playerCapital: prev.playerCapital - amount,
        totalSpent: prev.totalSpent + amount,
        companies: prev.companies.map((c) =>
          c.id === companyId ? { ...c, capital: c.capital + amount } : c,
        ),
      }));

      return { ok: true };
    },
    [],
  );

  const listOnMarket = useCallback(
    (
      companyId: string,
      productId: string,
      qty: number,
      price: number,
    ): { ok: boolean; error?: string } => {
      const s = stateRef.current;
      const company = s.companies.find((c) => c.id === companyId);
      if (!company) return { ok: false, error: 'Empresa não encontrada.' };

      const result = createMarketListing(company, productId, qty, price, Date.now());
      if (!result.ok) return { ok: false, error: result.error };

      setState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) => (c.id === companyId ? result.company : c)),
        marketListings: [...prev.marketListings, result.listing],
      }));

      return { ok: true };
    },
    [],
  );

  const buyFromSpotMarket = useCallback(
    (
      buyerCompanyId: string,
      listingId: string,
      qty: number,
    ): { ok: boolean; error?: string } => {
      const s = stateRef.current;
      const buyer = s.companies.find((c) => c.id === buyerCompanyId);
      const listing = s.marketListings.find((l) => l.id === listingId);

      if (!buyer) return { ok: false, error: 'Empresa compradora não encontrada.' };
      if (!listing) return { ok: false, error: 'Listing não encontrado.' };

      const result = buyFromMarket(buyer, listing, qty, Date.now());
      if (!result.ok) return { ok: false, error: result.error };

      const nowMs = Date.now();
      setState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) => (c.id === buyerCompanyId ? result.buyer : c)),
        marketListings: prev.marketListings.map((l) =>
          l.id === listingId ? result.listing : l,
        ),
        transactions: [...prev.transactions.slice(-(MAX_TRANSACTIONS - 1)), result.transaction],
        pmr: updatePMRCache(
          prev.pmr,
          listing.productId,
          buyer.regionId,
          listing.pricePerUnit,
          nowMs,
        ),
      }));

      return { ok: true };
    },
    [],
  );

  const refreshMarket = useCallback(() => {
    setState((prev) => {
      const nowMs = Date.now();
      const playerListings = prev.marketListings.filter((l) => !l.isNPC);
      const npcListings = generateNPCListings(prev.pmr, nowMs);
      return {
        ...prev,
        marketListings: [...playerListings, ...npcListings],
        marketLastRefresh: nowMs,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    const fresh = makeInitialState();
    setState(fresh);
    saveState(fresh);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState((prev) => ({ ...prev, notifications: [] }));
  }, []);

  const getCompany = useCallback(
    (id: string) => state.companies.find((c) => c.id === id),
    [state.companies],
  );

  const getActiveListing = useCallback(
    (companyId: string, productId: string) =>
      state.marketListings.find(
        (l) => l.sellerCompanyId === companyId && l.productId === productId && l.availableQty > 0,
      ),
    [state.marketListings],
  );

  return {
    state,
    setPlayerName,
    buyCompany,
    closeCompany,
    pauseCompany,
    resumeCompany,
    updateCompanyConfig,
    setSelectedRecipe,
    startProduction,
    withdrawFromCompany,
    depositToCompany,
    listOnMarket,
    buyFromSpotMarket,
    refreshMarket,
    resetGame,
    markNotificationRead,
    clearNotifications,
    getCompany,
    getActiveListing,
  };
}
