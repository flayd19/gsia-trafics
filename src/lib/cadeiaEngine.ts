// =====================================================================
// cadeiaEngine.ts — Motor de jogo do Cadeia
// Funções puras: PMR, elasticidade, tick de empresa, NPCs, mercado
// =====================================================================

import type {
  Company,
  Transaction,
  MarketListing,
  InventoryItem,
  ActiveProduction,
  PMREntry,
  GameNotification,
  RegionId,
  CompanyTypeId,
  CompanySize,
} from '@/types/cadeia';
import {
  PRODUCTS,
  REGIONS,
  getProduct,
  getCompanyType,
  getSizeVariant,
  getRecipesForCompany,
  getRecipe,
  calcTaxRate,
  RETAIL_BASE_VELOCITY_PER_HOUR,
  LOGISTICS_INCOME_PER_MIN,
} from '@/data/cadeia';

// ── Utilitários ───────────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── PMR — Preço Médio de Referência ──────────────────────────────────
const PMR_WINDOW_MS = 24 * 60 * 60 * 1_000; // janela de 24h
const PMR_MAX_TRANSACTIONS = 100;
const PMR_OUTLIER_THRESHOLD = 0.70; // exclui transações >±70% do PMR atual
const PMR_SMOOTHING_PREV = 0.70;    // peso do PMR anterior (smoothing 70/30)
const PMR_SMOOTHING_NEW  = 0.30;    // peso do valor calculado

/**
 * Calcula o PMR bruto (volume-weighted) de um produto/região.
 * Exclui transações que desviam >±70% do prevPMR antes de calcular.
 * Retorna prevPMR se não houver transações válidas.
 */
export function calcPMR(
  transactions: Transaction[],
  productId: string,
  regionId: RegionId,
  nowMs: number,
  prevPMR?: number,
): number {
  const basePrice = getProduct(productId).basePrice;
  const reference = prevPMR ?? basePrice;
  const cutoff = nowMs - PMR_WINDOW_MS;

  const relevant = transactions
    .filter(
      (t) =>
        t.productId === productId &&
        t.quantity != null &&
        t.quantity > 0 &&
        t.amount !== 0 &&
        t.occurredAt >= cutoff &&
        (t.type === 'sale' || t.type === 'purchase'),
    )
    .slice(-PMR_MAX_TRANSACTIONS);

  if (relevant.length === 0) return reference;

  // Excluir outliers (>±70% do preço de referência)
  const lowerBound = reference * (1 - PMR_OUTLIER_THRESHOLD);
  const upperBound = reference * (1 + PMR_OUTLIER_THRESHOLD);

  const filtered = relevant.filter((t) => {
    const price = Math.abs(t.amount) / t.quantity!;
    return price >= lowerBound && price <= upperBound;
  });

  if (filtered.length === 0) return reference;

  // Média ponderada por volume
  let totalQty = 0;
  let weightedSum = 0;
  for (const t of filtered) {
    const pricePerUnit = Math.abs(t.amount) / t.quantity!;
    weightedSum += pricePerUnit * t.quantity!;
    totalQty += t.quantity!;
  }

  return totalQty > 0 ? weightedSum / totalQty : reference;
}

/** Lê PMR do cache (já calculado). Retorna basePrice se não encontrado. */
export function getPMR(
  pmrCache: PMREntry[],
  productId: string,
  regionId: RegionId,
): number {
  const entry = pmrCache.find(
    (e) => e.productId === productId && e.regionId === regionId,
  );
  return entry?.price ?? getProduct(productId).basePrice;
}

/**
 * Upsert no cache do PMR com smoothing 70/30.
 * PMR_new = PMR_prev × 0.7 + rawCalcPrice × 0.3
 */
export function updatePMRCache(
  pmrCache: PMREntry[],
  productId: string,
  regionId: RegionId,
  rawCalcPrice: number,
  nowMs: number,
): PMREntry[] {
  const prevEntry = pmrCache.find(
    (e) => e.productId === productId && e.regionId === regionId,
  );
  const prevPrice = prevEntry?.price ?? getProduct(productId).basePrice;
  const smoothedPrice = prevPrice * PMR_SMOOTHING_PREV + rawCalcPrice * PMR_SMOOTHING_NEW;

  if (prevEntry) {
    return pmrCache.map((e) =>
      e.productId === productId && e.regionId === regionId
        ? { ...e, price: smoothedPrice, lastUpdated: nowMs }
        : e,
    );
  }
  return [...pmrCache, { productId, regionId, price: smoothedPrice, lastUpdated: nowMs }];
}

// ── Elasticidade de Vendas ────────────────────────────────────────────

/**
 * Tabela de 8 faixas: ratio = preço_venda / PMR → multiplicador de velocidade.
 * maxRatio é EXCLUSIVO (ratio < maxRatio pertence a esta faixa).
 */
const ELASTICITY_TABLE: ReadonlyArray<{ maxRatio: number; factor: number }> = [
  { maxRatio: 0.50, factor: 5.0  },  // ≤ -50%  → 5×
  { maxRatio: 0.70, factor: 3.0  },  // -50→-30% → 3×
  { maxRatio: 0.90, factor: 1.8  },  // -30→-10% → 1.8×
  { maxRatio: 1.10, factor: 1.0  },  // ±10%    → 1×
  { maxRatio: 1.30, factor: 0.5  },  // +10→+30% → 0.5×
  { maxRatio: 1.50, factor: 0.2  },  // +30→+50% → 0.2×
  { maxRatio: 2.00, factor: 0.05 },  // +50→+100%→ 0.05×
  { maxRatio: Infinity, factor: 0.0 }, // > +100% → 0×
];

function reputationFactor(reputation: number): number {
  if (reputation >= 80) return 1.15;
  if (reputation >= 50) return 1.00;
  if (reputation >= 30) return 0.95;
  return 0.90;
}

/**
 * Velocidade real de venda (unidades/hora) levando em conta
 * elasticidade de preço e reputação da empresa.
 */
export function calcSalesVelocity(
  pricePerUnit: number,
  pmr: number,
  baseVelocityPerHour: number,
  reputation: number,
): number {
  if (pmr <= 0) return 0;
  const ratio = pricePerUnit / pmr;
  const row =
    ELASTICITY_TABLE.find((r) => ratio < r.maxRatio) ??
    ELASTICITY_TABLE[ELASTICITY_TABLE.length - 1]!;
  return baseVelocityPerHour * row.factor * reputationFactor(reputation);
}

// ── Inventário (helpers imutáveis) ────────────────────────────────────

export function getInventoryQty(company: Company, productId: string): number {
  return company.inventory.find((i) => i.productId === productId)?.quantity ?? 0;
}

function addToInventory(
  inventory: InventoryItem[],
  productId: string,
  quantity: number,
  costPerUnit: number,
): InventoryItem[] {
  const existing = inventory.find((i) => i.productId === productId);
  if (existing) {
    const totalQty = existing.quantity + quantity;
    const newAvgCost =
      (existing.quantity * existing.avgCost + quantity * costPerUnit) / totalQty;
    return inventory.map((i) =>
      i.productId === productId
        ? { ...i, quantity: totalQty, avgCost: newAvgCost }
        : i,
    );
  }
  return [...inventory, { productId, quantity, avgCost: costPerUnit }];
}

function removeFromInventory(
  inventory: InventoryItem[],
  productId: string,
  quantity: number,
): InventoryItem[] {
  return inventory
    .map((i) =>
      i.productId === productId
        ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
        : i,
    )
    .filter((i) => i.quantity > 0);
}

// ── buildCompany ──────────────────────────────────────────────────────

export interface BuildCompanyParams {
  name: string;
  typeId: CompanyTypeId;
  size: CompanySize;
  regionId: RegionId;
  cnpj: string;
  initialCapital?: number;
}

/** Fábrica: cria uma nova instância de Company com defaults sensatos. */
export function buildCompany(params: BuildCompanyParams): Company {
  return {
    id: uid(),
    cnpj: params.cnpj,
    name: params.name,
    typeId: params.typeId,
    size: params.size,
    regionId: params.regionId,
    capital: params.initialCapital ?? 0,
    reputation: 50,
    status: 'active',
    inventory: [],
    activeProductions: [],
    config: {
      autoProduction: true,
      autoSell: true,
      autoBuy: false,
      selectedRecipeId: null,
      sellPrices: {},
      buyMaxPrices: {},
      minInventory: {},
      salesPolicy: 'balanced',
    },
    totalRevenue: 0,
    totalCost: 0,
    createdAt: Date.now(),
    lastOperationalCostAt: Date.now(),
  };
}

// ── Resultado do tick por empresa ─────────────────────────────────────

export interface TickResult {
  company: Company;
  newTransactions: Transaction[];
  newNotifications: GameNotification[];
  /** Alteração no capital PESSOAL do jogador (dividendos automáticos, etc.) */
  playerCapitalDelta: number;
  pmrUpdates: Array<{ productId: string; regionId: RegionId; price: number }>;
  /** Listings que foram consumidos (reduzir availableQty no estado global) */
  consumedListings: Array<{ listingId: string; quantityConsumed: number }>;
}

// ── tickCompany ───────────────────────────────────────────────────────

/**
 * Avança o estado de uma empresa pelo intervalo [lastTickMs, nowMs].
 * Delta é capado em 5 min para evitar saltos em abas fechadas.
 *
 * Ordem de processamento:
 * 0. Custo operacional proporcional ao delta
 * 1. Completar produções terminadas
 * 2. Iniciar nova produção automática (com custo por lote)
 * 3. Renda passiva de logística
 * 4. Venda automática (varejo)
 * 5. Compra automática de insumos
 */
export function tickCompany(
  company: Company,
  nowMs: number,
  lastTickMs: number,
  pmrCache: PMREntry[],
  marketListings: MarketListing[],
  totalCompanies: number,
): TickResult {
  const emptyResult: TickResult = {
    company,
    newTransactions: [],
    newNotifications: [],
    playerCapitalDelta: 0,
    pmrUpdates: [],
    consumedListings: [],
  };

  if (company.status !== 'active') return emptyResult;

  const deltaMs = Math.min(nowMs - lastTickMs, 5 * 60 * 1_000);
  const deltaMin = deltaMs / 60_000;
  if (deltaMs <= 0) return emptyResult;

  let c = { ...company, inventory: [...company.inventory] };
  const newTransactions: Transaction[] = [];
  const newNotifications: GameNotification[] = [];
  const pmrUpdates: Array<{ productId: string; regionId: RegionId; price: number }> = [];
  const consumedListings: Array<{ listingId: string; quantityConsumed: number }> = [];

  const def = getCompanyType(company.typeId);
  const sizeVariant = getSizeVariant(company.typeId, company.size);

  // ── 0. Custo operacional (proporcional ao delta) ──────────────────
  if (sizeVariant.operationalCostPerDay > 0) {
    const costPerMs = sizeVariant.operationalCostPerDay / (24 * 60 * 60 * 1_000);
    const opCost = costPerMs * deltaMs;
    if (opCost > 0.01) {
      c = {
        ...c,
        capital: c.capital - opCost,
        totalCost: c.totalCost + opCost,
        lastOperationalCostAt: nowMs,
      };
      // Só cria transação a cada 30 min para não poluir o histórico
      const lastCostMs = company.lastOperationalCostAt ?? company.createdAt;
      if (nowMs - lastCostMs >= 30 * 60 * 1_000) {
        newTransactions.push({
          id: uid(),
          companyId: c.id,
          companyName: c.name,
          type: 'operational_cost',
          amount: -opCost,
          description: `🏭 Custo operacional (${sizeVariant.operationalCostPerDay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/dia)`,
          occurredAt: nowMs,
        });
      }
    }
  }

  // ── 1. Completar produções ────────────────────────────────────────
  const stillRunning: ActiveProduction[] = [];
  for (const prod of c.activeProductions) {
    if (prod.status === 'running' && nowMs >= prod.completesAt) {
      const recipe = getRecipe(prod.recipeId);
      if (recipe) {
        for (const out of recipe.outputs) {
          c.inventory = addToInventory(c.inventory, out.productId, out.quantity, 0);
        }
        newTransactions.push({
          id: uid(),
          companyId: c.id,
          companyName: c.name,
          type: 'production_complete',
          description: `✅ Produção concluída: ${recipe.name}`,
          amount: 0,
          occurredAt: nowMs,
        });
        c = { ...c, reputation: Math.min(100, c.reputation + 0.1) };
      }
    } else {
      stillRunning.push(prod);
    }
  }
  c = { ...c, activeProductions: stillRunning };

  // ── 2. Auto-produção ─────────────────────────────────────────────
  if (c.config.autoProduction && c.activeProductions.length === 0) {
    const allRecipes = getRecipesForCompany(c.typeId, c.size);
    // selectedRecipeId tem prioridade; fallback para primeira disponível
    const recipe = c.config.selectedRecipeId != null
      ? (allRecipes.find(r => r.id === c.config.selectedRecipeId) ?? allRecipes[0])
      : allRecipes[0];

    if (recipe) {
      const firstOut = recipe.outputs[0];
      const storageCapacity = sizeVariant.storageCapacity;
      const stockFull =
        storageCapacity > 0 &&
        firstOut != null &&
        getInventoryQty(c, firstOut.productId) >= storageCapacity;

      const hasCapital = recipe.productionCostPerBatch <= c.capital;

      const canProduce =
        !stockFull &&
        hasCapital &&
        recipe.inputs.every(
          (inp) => getInventoryQty(c, inp.productId) >= inp.quantity,
        );

      if (canProduce) {
        // Deductar insumos do estoque
        for (const inp of recipe.inputs) {
          c.inventory = removeFromInventory(c.inventory, inp.productId, inp.quantity);
        }
        // Deductar custo de produção por lote do capital da empresa
        if (recipe.productionCostPerBatch > 0) {
          c = {
            ...c,
            capital: c.capital - recipe.productionCostPerBatch,
            totalCost: c.totalCost + recipe.productionCostPerBatch,
          };
          newTransactions.push({
            id: uid(),
            companyId: c.id,
            companyName: c.name,
            type: 'production_cost',
            amount: -recipe.productionCostPerBatch,
            description: `⚙️ Custo de lote: ${recipe.name}`,
            occurredAt: nowMs,
          });
        }
        const newProd: ActiveProduction = {
          id: uid(),
          recipeId: recipe.id,
          startedAt: nowMs,
          completesAt: nowMs + recipe.durationMin * 60_000,
          status: 'running',
        };
        c = { ...c, activeProductions: [...c.activeProductions, newProd] };
      }
    }
  }

  // ── 3. Logística: renda passiva ───────────────────────────────────
  if (def.category === 'logistica') {
    const incomeBySize = LOGISTICS_INCOME_PER_MIN[company.typeId];
    const incomePerMin = incomeBySize?.[company.size] ?? 0;
    const grossIncome = incomePerMin * deltaMin;
    if (grossIncome > 0.01) {
      const taxRate = calcTaxRate(totalCompanies);
      const taxAmount = grossIncome * taxRate;
      const netIncome = grossIncome - taxAmount;
      c = {
        ...c,
        capital: c.capital + netIncome,
        totalRevenue: c.totalRevenue + grossIncome,
        totalCost: c.totalCost + taxAmount,
      };
      newTransactions.push({
        id: uid(),
        companyId: c.id,
        companyName: c.name,
        type: 'logistics_income',
        amount: netIncome,
        description: `🚚 Renda logística (taxa ${Math.round(taxRate * 100)}%)`,
        occurredAt: nowMs,
      });
    }
  }

  // ── 4. Varejo: auto-venda ─────────────────────────────────────────
  if (def.category === 'varejo' && c.config.autoSell) {
    const baseVelocities = RETAIL_BASE_VELOCITY_PER_HOUR[company.typeId] ?? {};

    for (const [productId, velocityBySize] of Object.entries(baseVelocities)) {
      const baseVelPerHour = (velocityBySize as Record<CompanySize, number>)[company.size] ?? 0;
      if (baseVelPerHour <= 0) continue;

      const pmr = getPMR(pmrCache, productId, c.regionId);
      const sellPrice = c.config.sellPrices[productId] ?? pmr;
      const velocity = calcSalesVelocity(sellPrice, pmr, baseVelPerHour, c.reputation);

      const maxSellable = (velocity / 3_600_000) * deltaMs;
      const available = getInventoryQty(c, productId);
      if (available <= 0 || maxSellable < 0.001) continue;

      const sold = Math.min(maxSellable, available);
      const soldRounded = Math.floor(sold * 1000) / 1000;
      if (soldRounded <= 0) continue;

      const grossRevenue = soldRounded * sellPrice;
      const taxRate = calcTaxRate(totalCompanies);
      const taxAmount = grossRevenue * taxRate;
      const netRevenue = grossRevenue - taxAmount;

      c.inventory = removeFromInventory(c.inventory, productId, soldRounded);
      c = {
        ...c,
        capital: c.capital + netRevenue,
        totalRevenue: c.totalRevenue + grossRevenue,
        totalCost: c.totalCost + taxAmount,
        reputation: Math.min(100, c.reputation + 0.005),
      };

      const product = getProduct(productId);
      newTransactions.push({
        id: uid(),
        companyId: c.id,
        companyName: c.name,
        type: 'sale',
        productId,
        productName: product.name,
        quantity: soldRounded,
        amount: netRevenue,
        description: `💰 Venda: ${soldRounded.toFixed(2)} ${product.unit} × R$${sellPrice.toFixed(2)}`,
        occurredAt: nowMs,
      });

      pmrUpdates.push({ productId, regionId: c.regionId, price: sellPrice });
    }
  }

  // ── 5. Auto-compra de insumos ─────────────────────────────────────
  if (c.config.autoBuy) {
    const allRecipes = getRecipesForCompany(c.typeId, c.size);
    const recipe = c.config.selectedRecipeId != null
      ? (allRecipes.find(r => r.id === c.config.selectedRecipeId) ?? allRecipes[0])
      : allRecipes[0];

    if (recipe) {
      for (const inp of recipe.inputs) {
        const have = getInventoryQty(c, inp.productId);
        const minStock = c.config.minInventory[inp.productId] ?? inp.quantity * 3;
        if (have >= minStock) continue;

        const pmr = getPMR(pmrCache, inp.productId, c.regionId);
        const maxBuyPrice =
          c.config.buyMaxPrices[inp.productId] ?? pmr * 1.3;

        const listing = marketListings
          .filter(
            (l) =>
              l.productId === inp.productId &&
              l.availableQty > 0 &&
              l.pricePerUnit <= maxBuyPrice,
          )
          .sort((a, b) => a.pricePerUnit - b.pricePerUnit)[0];

        if (!listing) continue;

        const needed = minStock - have;
        const canBuy = Math.min(needed, listing.availableQty);
        const cost = canBuy * listing.pricePerUnit;

        if (cost > c.capital) continue;

        c.inventory = addToInventory(c.inventory, inp.productId, canBuy, listing.pricePerUnit);
        c = {
          ...c,
          capital: c.capital - cost,
          totalCost: c.totalCost + cost,
        };

        const product = getProduct(inp.productId);
        newTransactions.push({
          id: uid(),
          companyId: c.id,
          companyName: c.name,
          type: 'purchase',
          productId: inp.productId,
          productName: product.name,
          quantity: canBuy,
          amount: -cost,
          description: `🛒 Compra: ${canBuy.toFixed(1)} ${product.unit} × R$${listing.pricePerUnit.toFixed(2)} (de ${listing.sellerName})`,
          occurredAt: nowMs,
        });

        consumedListings.push({ listingId: listing.id, quantityConsumed: canBuy });
        pmrUpdates.push({ productId: inp.productId, regionId: c.regionId, price: listing.pricePerUnit });
      }
    }
  }

  return {
    company: c,
    newTransactions,
    newNotifications,
    playerCapitalDelta: 0,
    pmrUpdates,
    consumedListings,
  };
}

// ── generateNPCListings ───────────────────────────────────────────────

const NPC_REFRESH_MS = 15 * 60 * 1_000; // 15 min

/** Gera listings NPC para todos os produtos × regiões, a 15-25% acima do PMR. */
export function generateNPCListings(
  pmrCache: PMREntry[],
  nowMs: number,
): MarketListing[] {
  const listings: MarketListing[] = [];

  for (const region of REGIONS) {
    for (const product of PRODUCTS) {
      const pmr = getPMR(pmrCache, product.id, region.id);
      const markupFactor = 1.15 + Math.random() * 0.10;
      const price = Math.round(pmr * markupFactor * 100) / 100;

      let qty: number;
      switch (product.category) {
        case 'materia_prima': qty = 200 + Math.floor(Math.random() * 300); break;
        case 'intermediario': qty = 80 + Math.floor(Math.random() * 120); break;
        case 'manufaturado':  qty = 1_000 + Math.floor(Math.random() * 2_000); break;
        case 'combustivel':   qty = 5_000 + Math.floor(Math.random() * 10_000); break;
        case 'alimento':      qty = 30 + Math.floor(Math.random() * 70); break;
        default:              qty = 100;
      }

      listings.push({
        id: uid(),
        sellerCompanyId: `npc_${region.id}_${product.id}`,
        sellerName: `NPC ${region.name}`,
        productId: product.id,
        totalQty: qty,
        availableQty: qty,
        pricePerUnit: price,
        regionId: region.id,
        isNPC: true,
        refreshesAt: nowMs + NPC_REFRESH_MS,
      });
    }
  }

  return listings;
}

// ── Dividendos ────────────────────────────────────────────────────────

/** Retira dividendo da empresa para o caixa pessoal do jogador. */
export function withdrawDividends(
  company: Company,
  amount: number,
  nowMs: number,
): { company: Company; transaction: Transaction } {
  const withdrawn = Math.min(amount, company.capital);
  return {
    company: { ...company, capital: company.capital - withdrawn },
    transaction: {
      id: uid(),
      companyId: company.id,
      companyName: company.name,
      type: 'dividend',
      amount: withdrawn,
      description: `💸 Dividendo retirado de ${company.name}`,
      occurredAt: nowMs,
    },
  };
}

// ── Venda manual: criar listing no mercado spot ───────────────────────

export type CreateListingResult =
  | { ok: true; company: Company; listing: MarketListing }
  | { ok: false; error: string };

export function createMarketListing(
  company: Company,
  productId: string,
  quantity: number,
  pricePerUnit: number,
  nowMs: number,
): CreateListingResult {
  const available = getInventoryQty(company, productId);
  if (available < quantity) {
    return { ok: false, error: 'Estoque insuficiente.' };
  }
  if (quantity <= 0) {
    return { ok: false, error: 'Quantidade inválida.' };
  }
  if (pricePerUnit <= 0) {
    return { ok: false, error: 'Preço inválido.' };
  }

  const newInventory = removeFromInventory(company.inventory, productId, quantity);
  const listing: MarketListing = {
    id: uid(),
    sellerCompanyId: company.id,
    sellerName: company.name,
    productId,
    totalQty: quantity,
    availableQty: quantity,
    pricePerUnit,
    regionId: company.regionId,
    isNPC: false,
    refreshesAt: nowMs + 60 * 60 * 1_000,
  };

  return {
    ok: true,
    company: { ...company, inventory: newInventory },
    listing,
  };
}

// ── Compra manual do mercado spot ─────────────────────────────────────

export type BuyFromMarketResult =
  | { ok: true; buyer: Company; listing: MarketListing; transaction: Transaction }
  | { ok: false; error: string };

export function buyFromMarket(
  buyer: Company,
  listing: MarketListing,
  quantity: number,
  nowMs: number,
): BuyFromMarketResult {
  if (quantity <= 0) return { ok: false, error: 'Quantidade inválida.' };
  if (listing.availableQty < quantity) return { ok: false, error: 'Quantidade indisponível.' };

  const cost = quantity * listing.pricePerUnit;
  if (buyer.capital < cost) {
    return { ok: false, error: `Capital insuficiente. Necessário R$${cost.toFixed(2)}.` };
  }

  const product = getProduct(listing.productId);
  const updatedBuyer: Company = {
    ...buyer,
    inventory: addToInventory(buyer.inventory, listing.productId, quantity, listing.pricePerUnit),
    capital: buyer.capital - cost,
    totalCost: buyer.totalCost + cost,
  };
  const updatedListing: MarketListing = {
    ...listing,
    availableQty: listing.availableQty - quantity,
  };
  const transaction: Transaction = {
    id: uid(),
    companyId: buyer.id,
    companyName: buyer.name,
    type: 'purchase',
    productId: listing.productId,
    productName: product.name,
    quantity,
    amount: -cost,
    description: `🛒 Compra: ${quantity} ${product.unit} × R$${listing.pricePerUnit.toFixed(2)} (de ${listing.sellerName})`,
    occurredAt: nowMs,
  };

  return { ok: true, buyer: updatedBuyer, listing: updatedListing, transaction };
}

// ── Vender para listing de compra (player → player / player → NPC) ────
// (reservado para Fase 2 — não implementado)
