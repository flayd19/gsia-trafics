// =====================================================================
// Game Types — GSIA Trafics · Compra e Venda de Carros
// =====================================================================

import type { MarketplaceCar } from '@/data/cars';

// ── Re-exportar para conveniência ──────────────────────────────────
export type { MarketplaceCar } from '@/data/cars';

// ── Carro em posse do jogador ─────────────────────────────────────
export interface OwnedCar {
  /** UUID único da instância (mesmo modelo pode ter várias instâncias) */
  instanceId: string;
  modelId: string;
  variantId: string;
  /** Nome completo cacheado ex: "Volkswagen Gol 1.0 Trend" */
  fullName: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  icon: string;
  /** Preço FIPE de referência no momento da compra */
  fipePrice: number;
  /** Condição 0-100 */
  condition: number;
  /** Preço pago na aquisição */
  purchasePrice: number;
  purchasedAt: number; // timestamp
  /** Se está em reparo na oficina */
  inRepair?: boolean;
  repairCompletesAt?: number; // timestamp
  repairTypeId?: string;
  repairGain?: number; // quanto de condição vai ganhar
  /** IDs dos tipos de reparo já realizados neste carro — cada reparo só pode ser feito uma vez por carro */
  completedRepairs: string[];
}

// ── Slots da garagem ─────────────────────────────────────────────
export interface GarageSlot {
  id: number;
  unlocked: boolean;
  unlockCost: number;
  car?: OwnedCar;
}

// ── Oficina / tipos de reparo ─────────────────────────────────────
export interface RepairType {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;       // custo base em R$
  conditionGain: number;  // pontos de condição ganhos (ex: 20 = +20%)
  /** Duração em segundos REAIS (não in-game). Ex: 30 = 30s */
  durationSec: number;
  /** Condição mínima do carro para aplicar esse reparo */
  minCondition?: number;
  /** Condição máxima do carro (acima disso o reparo não faz sentido) */
  maxCondition?: number;
}

// ── Compradores de carros (NPCs na aba Vendas) ────────────────────
export type BuyerPersonality = 'racional' | 'emocional' | 'pechincha' | 'apressado' | 'curioso';

export interface CarBuyerNPC {
  id: string;
  name: string;
  avatar: string; // emoji
  personality: BuyerPersonality;
  /** IDs dos modelos que esse NPC está procurando. Vazio = qualquer. */
  targetModelIds: string[];
  /** Categorias aceitas. Vazio = qualquer. */
  targetCategories: string[];
  /**
   * Disposição de pagar em relação à FIPE do carro na condição atual.
   * Ex: { min: 0.7, max: 1.15 } → paga entre 70% e 115% da FIPE × condition_factor
   * A sorte do jogador decide onde dentro desse range vai cair.
   */
  payRange: { min: number; max: number };
  /** Pode oferecer um carro como parte do pagamento? */
  hasTradeIn: boolean;
  /** Carro de troca (gerado na hora se hasTradeIn=true) */
  tradeInCar?: OwnedCar;
  /** Valor do carro de troca */
  tradeInValue?: number;
  /** Quanto tempo o NPC fica disponível (segundos reais) */
  patience: number;
  arrivedAt: number; // timestamp
  /** Estado: esperando oferta, pensando, decidido */
  state: 'waiting' | 'thinking' | 'accepted' | 'rejected' | 'expired';
  /** Timestamp que entrou no estado thinking */
  thinkingStartedAt?: number;
  /** Oferta enviada pelo jogador */
  playerOffer?: number;
  /** Inclui trade-in? */
  playerIncludedTradeIn?: boolean;
  /** Resultado final */
  finalPrice?: number;
  targetCarInstanceId?: string; // qual carro da garagem quer comprar
}

// ── Reputação ────────────────────────────────────────────────────
export interface Reputation {
  level: number;
  xp: number;
  totalXp: number;
}

// ── Histórico de vendas ───────────────────────────────────────────
export interface CarSaleRecord {
  id: string;
  carInstanceId: string;
  fullName: string;
  purchasePrice: number;
  salePrice: number;
  fipePrice: number;
  condition: number;
  profit: number;
  soldAt: number;
  gameDay: number;
}

// ── Mercado P2P (mantido) ─────────────────────────────────────────
export type PlayerMarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';

export interface PlayerMarketListing {
  id: string;
  seller_id: string;
  seller_name: string;
  product_id: string;
  product_name: string;
  product_icon?: string | null;
  category?: string | null;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  /** Dados completos do carro (OwnedCar serializado) para entrega ao comprador */
  car_data?: OwnedCar | null;
  status: PlayerMarketListingStatus;
  buyer_id?: string | null;
  buyer_name?: string | null;
  sold_at?: string | null;
  paid_out_at?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export interface CreateListingInput {
  product_id: string;
  product_name: string;
  product_icon?: string | null;
  category?: string | null;
  quantity: number;
  price_per_unit: number;
  /** Dados completos do carro para entrega ao comprador */
  car_data?: OwnedCar | null;
}

export interface PurchaseResult {
  success: boolean;
  message?: string;
  listing?: PlayerMarketListing;
}

export interface PayoutResult {
  success: boolean;
  message?: string;
  total: number;
  count: number;
  listings: PlayerMarketListing[];
}

// ── GameState Principal ───────────────────────────────────────────
export interface GameState {
  money: number;

  /** Slots da garagem (1 grátis, demais compráveis) */
  garage: GarageSlot[];

  /** Reparos ativos */
  activeRepairs: {
    carInstanceId: string;
    repairTypeId: string;
    startedAt: number;
    durationSec: number;
    conditionGain: number;
    cost: number;
  }[];

  /** Carros disponíveis no marketplace de fornecedores */
  marketplaceCars: MarketplaceCar[];
  /** Última vez que o marketplace foi recarregado */
  marketplaceLastRefresh: number;

  /** NPCs compradores ativos na aba Vendas */
  carBuyers: CarBuyerNPC[];
  lastBuyerGeneration: number;
  isWaitingForNewBuyers: boolean;
  newBuyersTimerStart: number;
  newBuyersTimerDuration: number;

  /** Histórico de vendas */
  carSales: CarSaleRecord[];

  /** Dinheiro total ganho com carros */
  totalRevenue: number;
  /** Total gasto em compras de carros */
  totalSpent: number;
  /** Carros vendidos */
  totalCarsSold: number;
  /** Carros comprados */
  totalCarsBought: number;

  /** Reputação / Nível */
  reputation: Reputation;

  /** Tempo do jogo */
  gameTime: {
    day: number;
    hour: number;
    minute: number;
    lastUpdate: number;
  };

  /** Limite do cheque especial */
  overdraftLimit: number;
  lastInterestCalculation: number;

  completedOrders: number;

  // P2P market compatibility
  buyers?: unknown[];
  pending_deliveries?: unknown[];
  completed_orders?: number;
}

// ── Helpers de tipo ───────────────────────────────────────────────

/** Garante backwards-compat para saves antigos */
export function ensureGameState(raw: Partial<GameState>): GameState {
  return {
    money: raw.money ?? 15_000,
    garage: raw.garage ?? [{ id: 1, unlocked: true, unlockCost: 0, car: undefined }],
    activeRepairs: raw.activeRepairs ?? [],
    marketplaceCars: raw.marketplaceCars ?? [],
    marketplaceLastRefresh: raw.marketplaceLastRefresh ?? 0,
    carBuyers: raw.carBuyers ?? [],
    lastBuyerGeneration: raw.lastBuyerGeneration ?? 0,
    isWaitingForNewBuyers: raw.isWaitingForNewBuyers ?? false,
    newBuyersTimerStart: raw.newBuyersTimerStart ?? 0,
    newBuyersTimerDuration: raw.newBuyersTimerDuration ?? 30,
    carSales: raw.carSales ?? [],
    totalRevenue: raw.totalRevenue ?? 0,
    totalSpent: raw.totalSpent ?? 0,
    totalCarsSold: raw.totalCarsSold ?? 0,
    totalCarsBought: raw.totalCarsBought ?? 0,
    reputation: raw.reputation ?? { level: 1, xp: 0, totalXp: 0 },
    gameTime: raw.gameTime ?? { day: 1, hour: 8, minute: 0, lastUpdate: Date.now() },
    overdraftLimit: raw.overdraftLimit ?? -30_000,
    lastInterestCalculation: raw.lastInterestCalculation ?? 0,
    completedOrders: raw.completedOrders ?? 0,
  };
}