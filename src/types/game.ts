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
  /** Habilidade 0-100, atributo base de talento */
  skill: number;
  /** Nível 1-10, evolui com obras concluídas */
  level: number;
  /** Total de obras concluídas por este funcionário */
  worksCompleted: number;
  status: 'idle' | 'working';
  assignedWorkId?: string;
  hiredAt: number;
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
  unitPrice: number;
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
  melhorLance: number | null;
  liderNome: string | null;
  liderId: string | null;
  expiresAt: number;
  status: 'open' | 'won' | 'preparing' | 'in_progress' | 'completed';
  winnerId?: string;
  winnerNome?: string;
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
  level: number;
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
  contractValue: number;
  estimatedCost: number;
  producaoPerMin: number;
  progressPct: number;
  status: 'preparing' | 'running' | 'completed' | 'failed';
  startedAt: number;
  /** Prazo contratual: data-limite para conclusão (ms real) */
  deadline: number;
  estimatedCompletesAt: number;
  /** Eficiência em % vs equipe ideal (0-100+) */
  efficiencyPct: number;
  allocatedEmployees: AllocatedEmployee[];
  allocatedMachines: AllocatedMachine[];
  consumedMaterials: ConsumedMaterial[];
  currentM2Done: number;
  /** Requisitos originais da licitação (para exibir slots nos cards) */
  requisitos?: WorkRequirements;
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
  /** XP ganho (negativo se falhou) */
  xpDelta: number;
}

// ── Mercado P2P ───────────────────────────────────────────────────────
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

  employees: Employee[];
  machines: Machine[];
  warehouse: WarehouseItem[];

  activeWorks: ActiveWork[];
  workHistory: WorkRecord[];

  totalRevenue: number;
  totalSpent: number;
  completedContracts: number;
  failedContracts: number;

  gameTime: {
    day: number;
    hour: number;
    minute: number;
    lastUpdate: number;
  };

  _processedChatMoneyIds?: Record<string, true>;
}

// ── Helper: garante compatibilidade com saves antigos ─────────────────
export function ensureGameState(raw: Partial<GameState>): GameState {
  const sanitizeMoney = (v: unknown, fallback: number) =>
    typeof v === 'number' && isFinite(v) ? v : fallback;

  // Migra funcionários antigos que não possuem level/worksCompleted
  const rawEmps = (raw.employees ?? []) as Partial<Employee>[];
  const employees: Employee[] = rawEmps.map(e => ({
    instanceId:     e.instanceId    ?? '',
    type:           e.type          ?? 'ajudante',
    name:           e.name          ?? 'Funcionário',
    skill:          e.skill         ?? 70,
    level:          e.level         ?? 1,
    worksCompleted: e.worksCompleted ?? 0,
    status:         e.status        ?? 'idle',
    assignedWorkId: e.assignedWorkId,
    hiredAt:        e.hiredAt       ?? Date.now(),
  }));

  // Migra obras ativas antigas
  const rawWorks = (raw.activeWorks ?? []) as Partial<ActiveWork>[];
  const activeWorks: ActiveWork[] = rawWorks.map(w => ({
    id:                   w.id                  ?? '',
    licitacaoId:          w.licitacaoId         ?? '',
    nome:                 w.nome                ?? '',
    tipo:                 w.tipo                ?? 'pequena',
    tamanhoM2:            w.tamanhoM2           ?? 0,
    contractValue:        w.contractValue       ?? 0,
    estimatedCost:        w.estimatedCost       ?? 0,
    producaoPerMin:       w.producaoPerMin      ?? 0,
    progressPct:          w.progressPct         ?? 0,
    status:               w.status              ?? 'running',
    startedAt:            w.startedAt           ?? Date.now(),
    deadline:             w.deadline            ?? (w.startedAt ?? Date.now()) + 999_999_000,
    estimatedCompletesAt: w.estimatedCompletesAt ?? Date.now() + 999_999_000,
    efficiencyPct:        w.efficiencyPct       ?? 100,
    allocatedEmployees:   (w.allocatedEmployees ?? []).map(e => ({
      ...e,
      level: (e as Partial<AllocatedEmployee>).level ?? 1,
    })) as AllocatedEmployee[],
    allocatedMachines:    w.allocatedMachines   ?? [],
    consumedMaterials:    w.consumedMaterials   ?? [],
    currentM2Done:        w.currentM2Done       ?? 0,
  }));

  return {
    money:               sanitizeMoney(raw.money, 100_000),
    reputation:          raw.reputation          ?? { level: 1, xp: 0, totalXp: 0 },
    employees,
    machines:            raw.machines            ?? [],
    warehouse:           raw.warehouse           ?? [],
    activeWorks,
    workHistory:         (raw.workHistory        ?? []).map(r => ({
      ...(r as WorkRecord),
      xpDelta: (r as Partial<WorkRecord>).xpDelta ?? 0,
    })),
    totalRevenue:        sanitizeMoney(raw.totalRevenue,  0),
    totalSpent:          sanitizeMoney(raw.totalSpent,    0),
    completedContracts:  raw.completedContracts  ?? 0,
    failedContracts:     raw.failedContracts      ?? 0,
    gameTime: raw.gameTime ?? { day: 1, hour: 8, minute: 0, lastUpdate: Date.now() },
    _processedChatMoneyIds: raw._processedChatMoneyIds ?? {},
  };
}
