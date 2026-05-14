// =====================================================================
// cadeia.ts — Tipos do jogo Cadeia (Gerenciamento Econômico Multiplayer)
// =====================================================================

// ── Regiões ──────────────────────────────────────────────────────────
export type RegionId =
  | 'sul'
  | 'sudeste'
  | 'centro_oeste'
  | 'nordeste'
  | 'norte';

export interface Region {
  id: RegionId;
  name: string;
  icon: string;
  description: string;
}

// ── Produtos ─────────────────────────────────────────────────────────
export type ProductCategory =
  | 'materia_prima'
  | 'intermediario'
  | 'manufaturado'
  | 'combustivel'
  | 'alimento';

export interface Product {
  id: string;
  name: string;
  icon: string;
  category: ProductCategory;
  unit: string;
  basePrice: number;
  description: string;
}

// ── Tipos de Empresa ──────────────────────────────────────────────────
export type CompanyCategory =
  | 'extracao'
  | 'industria'
  | 'logistica'
  | 'varejo';

export type CompanyTypeId =
  | 'mina_ferro'
  | 'poco_petroleo'
  | 'fazenda_graos'
  | 'siderurgica'
  | 'refinaria'
  | 'moinho'
  | 'fabrica_parafusos'
  | 'industria_alimenticia'
  | 'frota_pesada'
  | 'frota_tanque'
  | 'frota_granel'
  | 'frota_bau'
  | 'loja_construcao'
  | 'mercado_varejo'
  | 'posto_combustivel';

export type CompanySize = 'pequena' | 'media' | 'grande';

export interface SizeVariant {
  size: CompanySize;
  /** Custo de criação (do caixa do jogador) */
  baseCost: number;
  /** Capacidade máxima de estoque (unidades do produto principal) */
  storageCapacity: number;
  /** Custo fixo por dia real (24h) deducted from company.capital */
  operationalCostPerDay: number;
}

export interface CompanyTypeDef {
  id: CompanyTypeId;
  name: string;
  icon: string;
  category: CompanyCategory;
  description: string;
  /** Número mínimo de empresas ativas para desbloquear este tipo */
  minLevel: number;
  /** Produtos que esta empresa pode comprar/vender/produzir */
  acceptedProducts: string[];
  /** Variantes de tamanho disponíveis */
  sizes: SizeVariant[];
}

// ── Receitas de Produção ──────────────────────────────────────────────
export interface RecipeIngredient {
  productId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  companyTypeId: CompanyTypeId;
  /** Tamanho de empresa ao qual esta receita se aplica */
  companySize: CompanySize;
  name: string;
  inputs: RecipeIngredient[];
  outputs: RecipeIngredient[];
  /** Duração real do ciclo em minutos */
  durationMin: number;
  /** Custo de produção por lote deducted from company.capital */
  productionCostPerBatch: number;
}

// ── Instância de Empresa ──────────────────────────────────────────────
export interface InventoryItem {
  productId: string;
  quantity: number;
  /** Custo médio ponderado de aquisição */
  avgCost: number;
}

export interface ActiveProduction {
  id: string;
  recipeId: string;
  startedAt: number;
  completesAt: number;
  status: 'running' | 'completed';
}

export type SalesPolicy = 'aggressive' | 'balanced' | 'conservative';

export interface CompanyConfig {
  autoProduction: boolean;
  autoSell: boolean;
  autoBuy: boolean;
  /** Receita selecionada para auto-produção (null = primeira disponível) */
  selectedRecipeId: string | null;
  /** Preço de venda por produto */
  sellPrices: Record<string, number>;
  /** Preço máximo de compra */
  buyMaxPrices: Record<string, number>;
  /** Estoque mínimo antes de acionar compra automática */
  minInventory: Record<string, number>;
  salesPolicy: SalesPolicy;
}

// ── Contrato de Fornecimento ──────────────────────────────────────────
export type ContractSide = 'buy' | 'sell';

export interface SupplyContract {
  id: string;
  /** Quem assinou: o jogador compra ('buy') ou vende ('sell') */
  side: ContractSide;
  productId: string;
  /** Quantidade por ciclo contratual (qtyPerDay unidades/dia) */
  qtyPerDay: number;
  /** Preço fixo acordado por unidade */
  pricePerUnit: number;
  /** Nome do parceiro NPC */
  partnerName: string;
  /** Duração em dias reais (null = permanente até cancelamento) */
  durationDays: number | null;
  createdAt: number;
  /** Quando o contrato expira (ms); null se permanente */
  expiresAt: number | null;
  /** Último tick em que foi processado */
  lastProcessedAt: number;
}

export interface Company {
  id: string;
  cnpj: string;
  name: string;
  typeId: CompanyTypeId;
  size: CompanySize;
  regionId: RegionId;
  capital: number;
  reputation: number;
  status: 'active' | 'paused' | 'closed';
  inventory: InventoryItem[];
  activeProductions: ActiveProduction[];
  config: CompanyConfig;
  totalRevenue: number;
  totalCost: number;
  createdAt: number;
  /** Timestamp do último débito de custo operacional */
  lastOperationalCostAt: number;
  /** Funcionários contratados: { role: count } */
  employees: Record<string, number>;
  /** IDs de upgrades adquiridos */
  upgrades: string[];
  /** Contratos de fornecimento ativos */
  contracts: SupplyContract[];
}

// ── Transações ────────────────────────────────────────────────────────
export type TransactionType =
  | 'production_complete'
  | 'production_cost'
  | 'sale'
  | 'purchase'
  | 'tax'
  | 'dividend'
  | 'logistics_income'
  | 'company_purchase'
  | 'operational_cost'
  | 'salary_cost'
  | 'contract_purchase'
  | 'contract_sale';

export interface Transaction {
  id: string;
  companyId: string;
  companyName: string;
  type: TransactionType;
  productId?: string;
  productName?: string;
  quantity?: number;
  amount: number;
  description: string;
  occurredAt: number;
}

// ── Mercado Spot ──────────────────────────────────────────────────────
export interface MarketListing {
  id: string;
  sellerCompanyId: string;
  sellerName: string;
  productId: string;
  totalQty: number;
  availableQty: number;
  pricePerUnit: number;
  regionId: RegionId;
  isNPC: boolean;
  refreshesAt: number;
}

// ── PMR — Preço Médio de Referência ──────────────────────────────────
export interface PMREntry {
  productId: string;
  regionId: RegionId;
  price: number;
  lastUpdated: number;
}

// ── Notificações ──────────────────────────────────────────────────────
export interface GameNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  companyId?: string;
}

// ── Navegação Hub ─────────────────────────────────────────────────────
export type HubModule =
  | 'hub'
  | 'empresas'
  | 'mercado'
  | 'mapa'
  | 'negociacoes'
  | 'financas'
  | 'perfil';

// ── Estado Principal do Jogo ──────────────────────────────────────────
export interface CadeiaState {
  playerCapital: number;
  playerName: string;
  cnpjCounter: number;
  companies: Company[];
  transactions: Transaction[];
  pmr: PMREntry[];
  marketListings: MarketListing[];
  marketLastRefresh: number;
  notifications: GameNotification[];
  totalEarned: number;
  totalSpent: number;
  lastSaved: number;
}
