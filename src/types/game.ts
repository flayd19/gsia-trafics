// =====================================================================
// Game Types — GSIA Trafics · Compra e Venda de Carros
// =====================================================================

import type { MarketplaceCar } from '@/data/cars';

// ── Re-exportar para conveniência ──────────────────────────────────
export type { MarketplaceCar } from '@/data/cars';

// ── 4 atributos independentes do carro ───────────────────────────
export interface CarAttributes {
  body:       number; // Lataria   0–100
  mechanical: number; // Mecânica  0–100
  electrical: number; // Elétrica  0–100
  interior:   number; // Interior  0–100
}

export type AttributeKey = keyof CarAttributes;

// ── Resultado do diagnóstico na oficina ──────────────────────────
export interface DiagnosisResult {
  attribute:      AttributeKey;
  attributeLabel: string;
  repairTypeId:   string;
  repairName:     string;
  repairIcon:     string;
}

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
  /** Quilometragem do veículo */
  mileage?: number;
  /** Preço pago na aquisição */
  purchasePrice: number;
  /** Soma acumulada dos gastos com oficina neste veículo */
  totalRepairCost?: number;
  purchasedAt: number; // timestamp
  /** Se está em reparo na oficina */
  inRepair?: boolean;
  repairCompletesAt?: number; // timestamp
  repairTypeId?: string;
  repairGain?: number; // ganho RNG aplicado ao atributo
  /** IDs dos tipos de reparo realizados (histórico) */
  completedRepairs: string[];
  /** 4 atributos independentes (novo sistema de oficina) */
  attributes?: CarAttributes;
  /** Todos os reparos identificados no último diagnóstico */
  diagnosisResult?: DiagnosisResult[] | null;

  // ── Sistema de Desempenho + Tunagem ──────────────────────────────
  /** Stats de performance (calculado lazily via performanceEngine) */
  performance?: import('./performance').PerformanceStats;
  /** Upgrades de tunagem aplicados */
  tuneUpgrades?: import('./performance').TuneUpgrade[];
  /** Histórico de rachas deste carro */
  raceHistory?: import('./performance').RaceRecord[];

  /**
   * Origem do carro — identifica como chegou na garagem do jogador.
   * Útil para selos visuais (ex: badge "🔨 Leilão" no P2P) e auditoria.
   */
  acquiredFrom?: 'marketplace' | 'p2p' | 'auction' | 'gift' | 'trade_in';
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
  baseCost: number;
  /** Mantido para compatibilidade; ganho real é RNG 5–28 */
  conditionGain: number;
  durationSec: number;
  minCondition?: number;
  maxCondition?: number;
  /** Atributo afetado por este reparo */
  attribute: AttributeKey;
  /** Se true: sempre visível/disponível sem diagnóstico (ex: lavagem) */
  isAlwaysAvailable?: boolean;
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
  /** Estado: esperando oferta, pensando, aguardando resposta da contraoferta, decidido */
  state: 'waiting' | 'thinking' | 'countering' | 'accepted' | 'rejected' | 'expired';
  /** Timestamp que entrou no estado thinking */
  thinkingStartedAt?: number;
  /** Duração do tempo de pensamento sorteado (3–10 s) */
  thinkDuration?: number;
  /** Oferta enviada pelo jogador */
  playerOffer?: number;
  /** Inclui trade-in? */
  playerIncludedTradeIn?: boolean;
  /**
   * Valor que o jogador atribuiu ao veículo de troca.
   * Se undefined + playerIncludedTradeIn=true, usa buyer.tradeInValue.
   * Limitado a 0 … tradeInCar.fipePrice × conditionFactor (sem exploit).
   */
  playerTradeInValuation?: number;
  /** Resultado final */
  finalPrice?: number;
  /** Valor máximo que o comprador aceita pagar — preenchido quando state='countering' */
  counterOffer?: number;
  targetCarInstanceId?: string; // qual carro da garagem quer comprar
  /**
   * True quando a oferta foi enviada pelo Vendedor (funcionário) automaticamente.
   * Quando a venda fecha, o sistema cobra comissão (SELLER_COMMISSION_RATE)
   * sobre o valor total da venda.
   */
  offerSentByEmployee?: boolean;

  // ── Sistema de ciclos (30 min) ──────────────────────────────────
  /** Índice do slot que este comprador ocupa (0-based) */
  slotIndex?: number;
  /**
   * Tipo de requisito: 'category' (aceita toda uma categoria) ou
   * 'model' (quer um modelo específico)
   */
  requirementType?: 'category' | 'model';
  /** ID do modelo específico (quando requirementType === 'model') */
  targetModelId?: string;
  /** Nome legível do modelo alvo (ex: "Volkswagen Gol") */
  targetModelName?: string;
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
  /** Descrição opcional do vendedor (máx. 150 caracteres) */
  description?: string | null;
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
  /** Descrição opcional do vendedor (máx. 150 caracteres) */
  description?: string | null;
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
    /** Atributo alvo do reparo (novo sistema) */
    targetAttribute?: AttributeKey;
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

  // ── Sistema de ciclos de compradores (30 min) ────────────────────
  /**
   * Índice do ciclo atual de compradores.
   * Calculado como Math.floor(Date.now() / 1_800_000).
   * Quando este valor muda, todos os slots são renovados.
   */
  buyerCycleEpoch: number;
  /**
   * Por slot (índice 0-based): o epoch em que o slot foi bloqueado
   * neste ciclo (-1 = desbloqueado / disponível).
   * Um slot é bloqueado após o jogador vender ou ter sua oferta recusada.
   */
  buyerSlotLocks: number[];

  /**
   * Timestamp (ms) de quando o próximo ciclo de compradores deve ocorrer.
   * Substitui buyerCycleEpoch para comparações de persistência entre sessões.
   */
  nextBuyerCycleAt: number;

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
  /** Último dia em que o aluguel diário das vagas foi cobrado */
  lastRentCharge: number;

  completedOrders: number;

  // P2P market compatibility
  buyers?: unknown[];
  pending_deliveries?: unknown[];
  completed_orders?: number;

  /** Vitórias em rachas assíncronos (não contadas em car.raceHistory) */
  asyncRacesWon: number;

  /**
   * Versão da última migração automática de reputação aplicada a este save.
   * Usado para evitar reexecutar reconstrução em saves já normalizados.
   */
  _reputationMigrationVersion?: number;

  /** Funcionários contratados (lavador, vendedor, etc.). */
  employees?: import('./employees').HiredEmployee[];
  /** Último dia in-game em que o salário dos funcionários foi cobrado. */
  lastEmployeePayDay?: number;
}

// ── Helpers de tipo ───────────────────────────────────────────────

/** Garante backwards-compat para saves antigos.
 * Usa isFinite() em vez de ?? para também capturar NaN
 * (NaN ?? default não funciona — NaN não é null/undefined). */
export function ensureGameState(raw: Partial<GameState>): GameState {
  const sanitizeMoney = (v: unknown, fallback: number) =>
    typeof v === 'number' && isFinite(v) ? v : fallback;
  return {
    money: sanitizeMoney(raw.money, 15_000),
    garage: raw.garage ?? [{ id: 1, unlocked: true, unlockCost: 0, car: undefined }],
    activeRepairs: raw.activeRepairs ?? [],
    marketplaceCars: raw.marketplaceCars ?? [],
    marketplaceLastRefresh: raw.marketplaceLastRefresh ?? 0,
    carBuyers: raw.carBuyers ?? [],
    lastBuyerGeneration: raw.lastBuyerGeneration ?? 0,
    isWaitingForNewBuyers: raw.isWaitingForNewBuyers ?? false,
    newBuyersTimerStart: raw.newBuyersTimerStart ?? 0,
    newBuyersTimerDuration: raw.newBuyersTimerDuration ?? 30,
    buyerCycleEpoch: raw.buyerCycleEpoch ?? -1,
    buyerSlotLocks: raw.buyerSlotLocks ?? [],
    nextBuyerCycleAt: raw.nextBuyerCycleAt ?? 0,
    carSales: raw.carSales ?? [],
    totalRevenue: raw.totalRevenue ?? 0,
    totalSpent: raw.totalSpent ?? 0,
    totalCarsSold: raw.totalCarsSold ?? 0,
    totalCarsBought: raw.totalCarsBought ?? 0,
    reputation: raw.reputation ?? { level: 1, xp: 0, totalXp: 0 },
    gameTime: raw.gameTime ?? { day: 1, hour: 8, minute: 0, lastUpdate: Date.now() },
    overdraftLimit: raw.overdraftLimit ?? -30_000,
    lastInterestCalculation: raw.lastInterestCalculation ?? 0,
    lastRentCharge: raw.lastRentCharge ?? 1,
    completedOrders: raw.completedOrders ?? 0,
    asyncRacesWon:   raw.asyncRacesWon   ?? 0,
    _reputationMigrationVersion: raw._reputationMigrationVersion,
    employees:        raw.employees        ?? [],
    lastEmployeePayDay: raw.lastEmployeePayDay ?? 0,
  };
}
