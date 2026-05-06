// =====================================================================
// Game Types — Simulador de Construtora · Licitações & Obras
// =====================================================================

// ── Reputação ────────────────────────────────────────────────────────
export interface Reputation {
  level: number;
  xp: number;
  totalXp: number;
}

// ── Funcionários ──────────────────────────────────────────────────────
export type EmployeeType =
  | 'ajudante'
  | 'pedreiro'
  | 'mestre'
  | 'engenheiro'
  | 'seguranca';

export interface Employee {
  instanceId: string;
  type: EmployeeType;
  name: string;
  /** Habilidade 0-100, afeta produção e custo real */
  skill: number;
  status: 'idle' | 'working';
  assignedWorkId?: string;
  hiredAt: number; // timestamp
}

// ── Máquinas ──────────────────────────────────────────────────────────
export type MachineCategory =
  | 'terraplanagem'
  | 'estrutura'
  | 'logistica'
  | 'concretagem';

export interface Machine {
  instanceId: string;
  typeId: string;
  name: string;
  icon: string;
  category: MachineCategory;
  costPerMin: number;
  purchasePrice: number;
  status: 'idle' | 'working';
  assignedWorkId?: string;
  purchasedAt: number;
}

// ── Materiais (Galpão) ────────────────────────────────────────────────
export interface WarehouseItem {
  materialId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number; // preço médio pago
  icon: string;
}

// ── Requisitos de obra ────────────────────────────────────────────────
export interface WorkEmployeeReq {
  type: EmployeeType;
  quantity: number;
}

export interface WorkMachineReq {
  typeId: string;
  name: string;
  quantity: number;
}

export interface WorkMaterialReq {
  materialId: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface WorkRequirements {
  employees: WorkEmployeeReq[];
  machines: WorkMachineReq[];
  materials: WorkMaterialReq[];
}

// ── Licitação ─────────────────────────────────────────────────────────
export type WorkType = 'pequena' | 'media' | 'grande' | 'mega';

export interface Licitacao {
  id: string;
  nome: string;
  tipo: WorkType;
  tamanhoM2: number;
  tempoBaseMin: number;
  custoEstimado: number;
  valorBase: number;
  requisitos: WorkRequirements;
  /** Menor lance atual (null = sem lance) */
  melhorLance: number | null;
  liderNome: string | null;
  liderId: string | null;
  /** Quando o leilão fecha (timestamp ms) */
  expiresAt: number;
  status: 'open' | 'won' | 'preparing' | 'in_progress' | 'completed';
  winnerId?: string;
  winnerNome?: string;
  /** 30 min reais para o vencedor iniciar após vencer */
  prepDeadline?: number;
  batchId: number;
  createdAt: number;
}

// ── Obra ativa ────────────────────────────────────────────────────────
export interface AllocatedEmployee {
  instanceId: string;
  type: EmployeeType;
  name: string;
  skill: number;
}

export interface AllocatedMachine {
  instanceId: string;
  typeId: string;
  name: string;
  icon: string;
  costPerMin: number;
}

export interface ConsumedMaterial {
  materialId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ActiveWork {
  id: string;
  licitacaoId: string;
  nome: string;
  tipo: WorkType;
  tamanhoM2: number;
  /** Valor do lance vencedor (receita bruta) */
  contractValue: number;
  /** Custo total estimado (mão-de-obra + máquinas + materiais) */
  estimatedCost: number;
  /** Produção em m²/min efetiva */
  producaoPerMin: number;
  /** Progresso 0-100 */
  progressPct: number;
  status: 'preparing' | 'running' | 'completed' | 'failed';
  startedAt: number;
  estimatedCompletesAt: number;
  allocatedEmployees: AllocatedEmployee[];
  allocatedMachines: AllocatedMachine[];
  consumedMaterials: ConsumedMaterial[];
  currentM2Done: number;
}

// ── Histórico de obras ────────────────────────────────────────────────
export interface WorkRecord {
  id: string;
  nome: string;
  tipo: WorkType;
  contractValue: number;
  totalCost: number;
  profit: number;
  profitPct: number;
  tamanhoM2: number;
  completedAt: number;
  timeTakenMin: number;
  succeeded: boolean;
}

// ── Mercado P2P (materiais entre jogadores) ───────────────────────────
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
  description?: string | null;
  status: PlayerMarketListingStatus;
  buyer_id?: string | null;
  buyer_name?: string | null;
  sold_at?: string | null;
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
  description?: string | null;
}

export interface PurchaseResult {
  success: boolean;
  message?: string;
  listing?: PlayerMarketListing;
}

// ── Estado principal do jogo ───────────────────────────────────────────
export interface GameState {
  money: number;
  reputation: Reputation;

  // Recursos da empresa
  employees: Employee[];
  machines: Machine[];
  warehouse: WarehouseItem[];

  // Obras
  activeWorks: ActiveWork[];
  workHistory: WorkRecord[];

  // Estatísticas
  totalRevenue: number;
  totalSpent: number;
  completedContracts: number;
  failedContracts: number;

  // Tempo do jogo
  gameTime: {
    day: number;
    hour: number;
    minute: number;
    lastUpdate: number;
  };

  // Imóveis
  properties: Property[];

  // Idempotência de pagamentos via chat
  _processedChatMoneyIds?: Record<string, true>;
}

// ── Imóveis ───────────────────────────────────────────────────────────

export type PropertyType =
  | 'casa_popular'
  | 'casa_media'
  | 'casa_alto_padrao'
  | 'casa_luxo'
  | 'comercial_pequeno'
  | 'comercial_medio'
  | 'comercial_grande'
  | 'galpao_pequeno'
  | 'galpao_medio'
  | 'galpao_grande';

export type PropertyCategory = 'residencial' | 'comercial' | 'industrial';
export type PropertyStatus = 'construindo' | 'pronto' | 'alugado' | 'a_venda' | 'vendido';

export interface PropertyEmployeeReq {
  minTotal: number;          // mínimo de funcionários ativos na empresa
  minSkilled: number;        // mínimo de pedreiros/mestres/engenheiros
  engineerBonus: boolean;    // engenheiro reduz tempo de construção
}

export interface BuildOption {
  typeId: PropertyType;
  category: PropertyCategory;
  name: string;
  icon: string;
  areaM2: number;
  lotCostBase: number;       // custo do terreno incluso
  buildCost: number;         // custo de materiais + obra
  buildDaysBase: number;     // dias de jogo sem bônus de equipe
  marketValue: number;
  rentMonthly: number;
  maintenancePerDay: number;
  employeeReq: PropertyEmployeeReq;
  description: string;
}

export interface Property {
  instanceId: string;
  name: string;
  type: PropertyType;
  category: PropertyCategory;
  icon: string;
  areaM2: number;
  neighborhood: string;

  // Investimento
  totalInvested: number;
  marketValue: number;
  rentMonthly: number;
  maintenancePerDay: number;

  status: PropertyStatus;

  // Construção (game days)
  buildStartDay: number;
  buildEndDay: number;

  // Aluguel
  tenantName?: string;
  tenantSince?: number;
  lastRentDay?: number;
  rentCollected: number;

  // Venda
  salePrice?: number;
  listedForSaleDay?: number;
  pendingBuyerName?: string;
  pendingBuyerOffer?: number;
  pendingBuyerDay?: number;

  purchasedAt: number;
}

// ── Helper: garante compatibilidade com saves antigos ─────────────────
export function ensureGameState(raw: Partial<GameState>): GameState {
  const sanitizeMoney = (v: unknown, fallback: number) =>
    typeof v === 'number' && isFinite(v) ? v : fallback;

  return {
    money:               sanitizeMoney(raw.money, 100_000),
    reputation:          raw.reputation          ?? { level: 1, xp: 0, totalXp: 0 },
    employees:           raw.employees           ?? [],
    machines:            raw.machines            ?? [],
    warehouse:           raw.warehouse           ?? [],
    activeWorks:         raw.activeWorks         ?? [],
    workHistory:         raw.workHistory         ?? [],
    totalRevenue:        sanitizeMoney(raw.totalRevenue,  0),
    totalSpent:          sanitizeMoney(raw.totalSpent,    0),
    completedContracts:  raw.completedContracts  ?? 0,
    failedContracts:     raw.failedContracts      ?? 0,
    gameTime: raw.gameTime ?? { day: 1, hour: 8, minute: 0, lastUpdate: Date.now() },
    properties: raw.properties ?? [],
    _processedChatMoneyIds: raw._processedChatMoneyIds ?? {},
  };
}
