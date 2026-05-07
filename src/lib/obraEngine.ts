// =====================================================================
// obraEngine.ts — Motor de cálculo de obras
// Produção, tempo, custo, verificação de requisitos, consumo de materiais
// =====================================================================
import type {
  Employee,
  Machine,
  WarehouseItem,
  ActiveWork,
  WorkRequirements,
  AllocatedEmployee,
  AllocatedMachine,
  ConsumedMaterial,
  WorkType,
  WorkMaterialReq,
} from '@/types/game';
import { EMPLOYEE_TYPES, MACHINE_CATALOG, MATERIALS } from '@/data/construction';

// ── Constantes ────────────────────────────────────────────────────────
/** Bônus de produção por Mestre de Obra (cada um) */
const MESTRE_BONUS = 0.15;
/** Bônus por 2 engenheiros na mesma obra */
const DUAL_ENG_BONUS = 0.10;
/** Segurança reduz probabilidade de falha (não afeta produção) */
export const SEGURANCA_FAIL_REDUCTION = 0.40;
/** Teto do bônus de máquinas (evita que máquinas dominem demais) */
const MACHINE_BONUS_CAP = 1.20; // max +120%

// ── Verificação de requisitos ─────────────────────────────────────────

export interface RequirementCheck {
  ok: boolean;
  missingEmployees: { type: string; label: string; needed: number; have: number }[];
  missingMachines:  { typeId: string; name: string; needed: number; have: number }[];
  missingMaterials: { materialId: string; name: string; needed: number; have: number }[];
}

/** Verifica se os recursos disponíveis cobrem os requisitos mínimos da obra */
export function checkRequirements(
  req: WorkRequirements,
  employees: Employee[],
  machines: Machine[],
  warehouse: WarehouseItem[],
): RequirementCheck {
  const result: RequirementCheck = {
    ok: true,
    missingEmployees: [],
    missingMachines: [],
    missingMaterials: [],
  };

  for (const er of req.employees) {
    const have = employees.filter(e => e.type === er.type && e.status === 'idle').length;
    if (have < er.quantity) {
      result.ok = false;
      const def = EMPLOYEE_TYPES.find(d => d.type === er.type);
      result.missingEmployees.push({ type: er.type, label: def?.label ?? er.type, needed: er.quantity, have });
    }
  }

  for (const mr of req.machines) {
    const have = machines.filter(m => m.typeId === mr.typeId && m.status === 'idle').length;
    if (have < mr.quantity) {
      result.ok = false;
      result.missingMachines.push({ typeId: mr.typeId, name: mr.name, needed: mr.quantity, have });
    }
  }

  for (const mat of req.materials) {
    const stock = warehouse.find(w => w.materialId === mat.materialId);
    const have  = stock?.quantity ?? 0;
    if (have < mat.quantity) {
      result.ok = false;
      result.missingMaterials.push({ materialId: mat.materialId, name: mat.name, needed: mat.quantity, have });
    }
  }

  return result;
}

// ── Materiais em falta no galpão vs requisitos ────────────────────────

export interface MaterialShortage {
  materialId: string;
  name: string;
  required: number;
  available: number;
  missing: number;
  unit: string;
}

/**
 * Retorna quais materiais estão em falta no galpão em relação ao total necessário.
 * Considera o que já foi consumido pela obra até agora.
 */
export function calcMaterialShortages(
  requisitos: WorkRequirements | undefined,
  consumedSoFar: ConsumedMaterial[],
  warehouse: WarehouseItem[],
): MaterialShortage[] {
  if (!requisitos || requisitos.materials.length === 0) return [];
  const shortages: MaterialShortage[] = [];

  for (const req of requisitos.materials) {
    const consumed  = consumedSoFar.find(c => c.materialId === req.materialId)?.quantity ?? 0;
    const remaining = Math.max(0, req.quantity - consumed);
    const available = warehouse.find(w => w.materialId === req.materialId)?.quantity ?? 0;
    const missing   = Math.max(0, remaining - available);
    const def       = MATERIALS.find(m => m.materialId === req.materialId);

    if (missing > 0.001) {
      shortages.push({
        materialId: req.materialId,
        name:       req.name,
        required:   req.quantity,
        available,
        missing:    Math.ceil(missing),
        unit:       def?.unit ?? 'unid',
      });
    }
  }

  return shortages;
}

// ── Cálculo de produção ───────────────────────────────────────────────

/**
 * Multiplicador de produção baseado no nível do funcionário.
 * Nível 1 → ×1.0, nível 10 → ×2.08 (cap: ×2.5)
 */
export function calcLevelMultiplier(level: number): number {
  return Math.min(2.5, 1 + (level - 1) * 0.12);
}

/**
 * Bônus de produção aditivo das máquinas alocadas.
 * Cada máquina contribui com seu producaoBonus; somados e limitados.
 */
export function calcMachineProductionBonus(machines: AllocatedMachine[]): number {
  if (machines.length === 0) return 0;
  let total = 0;
  for (const m of machines) {
    const def = MACHINE_CATALOG.find(d => d.typeId === m.typeId);
    total += def?.producaoBonus ?? 0;
  }
  return Math.min(MACHINE_BONUS_CAP, total);
}

/**
 * Calcula a eficiência percentual da equipe vs. equipe ideal.
 *   idealProducao = tamanhoM2 / tempoBaseMin
 *   efficiencyPct = (currentProducao / idealProducao) × 100
 */
export function calcEfficiencyPct(
  producaoPerMin: number,
  tamanhoM2: number,
  tempoBaseMin: number,
): number {
  if (tempoBaseMin <= 0) return 0;
  const idealProducao = tamanhoM2 / tempoBaseMin;
  if (idealProducao <= 0) return 0;
  return Math.round((producaoPerMin / idealProducao) * 100);
}

/**
 * Calcula a produção total em m²/min de uma equipe alocada.
 *
 * Regras:
 *  - Só ajudantes e pedreiros produzem diretamente
 *  - producao_real = base × (skill / 100) × levelMultiplier
 *  - Mestre de Obra: +15% por mestre (aditivo)
 *  - 2+ engenheiros: +10% (uma única vez)
 *  - Máquinas: bônus aditivo via calcMachineProductionBonus
 */
export function calcProducaoPerMin(
  employees: AllocatedEmployee[],
  machines: AllocatedMachine[] = [],
): number {
  let base = 0;

  for (const emp of employees) {
    const def = EMPLOYEE_TYPES.find(d => d.type === emp.type);
    if (!def || def.producaoBase === 0) continue;
    const levelMult = calcLevelMultiplier(emp.level ?? 1);
    base += def.producaoBase * (emp.skill / 100) * levelMult;
  }

  if (base === 0) return 0;

  // Bônus de equipe
  const numMestres = employees.filter(e => e.type === 'mestre').length;
  const numEng     = employees.filter(e => e.type === 'engenheiro').length;
  let teamBonus = 1 + numMestres * MESTRE_BONUS;
  if (numEng >= 2) teamBonus += DUAL_ENG_BONUS;

  // Bônus de máquinas (multiplicativo separado para melhor legibilidade)
  const machineBonus = 1 + calcMachineProductionBonus(machines);

  return base * teamBonus * machineBonus;
}

/**
 * Tempo estimado para concluir a obra em minutos reais.
 * Baseado na produção atual da equipe.
 */
export function calcTempoEstimadoMin(tamanhoM2: number, producaoPerMin: number): number {
  if (producaoPerMin <= 0) return 99_999;
  return Math.max(1, tamanhoM2 / producaoPerMin);
}

// ── Custo real da obra ────────────────────────────────────────────────

export interface WorkCostBreakdown {
  /** Custo dos materiais consumidos durante execução */
  materialCost: number;
  /** Custo de mão-de-obra (custo/min × tempo × skill_factor) */
  laborCost: number;
  /** Custo operacional das máquinas (custo/min × tempo) */
  machineCost: number;
  total: number;
}

export function calcWorkCost(
  allocatedEmployees: AllocatedEmployee[],
  allocatedMachines: AllocatedMachine[],
  consumedMaterials: ConsumedMaterial[],
  tempoMin: number,
): WorkCostBreakdown {
  const materialCost = consumedMaterials.reduce(
    (s, m) => s + m.quantity * m.unitPrice, 0
  );

  const laborCost = allocatedEmployees.reduce((s, emp) => {
    const def = EMPLOYEE_TYPES.find(d => d.type === emp.type);
    if (!def) return s;
    return s + def.custoBase * (emp.skill / 100) * tempoMin;
  }, 0);

  const machineCost = allocatedMachines.reduce(
    (s, m) => s + m.costPerMin * tempoMin, 0
  );

  return { materialCost, laborCost, machineCost, total: materialCost + laborCost + machineCost };
}

// ── Margem de lucro esperada ──────────────────────────────────────────

export function expectedMarginPct(tipo: WorkType): string {
  switch (tipo) {
    case 'pequena': return '30–40%';
    case 'media':   return '20–30%';
    case 'grande':  return '8–15%';
    case 'mega':    return '5–10%';
  }
}

// ── Progresso da obra (tick) ──────────────────────────────────────────

/** Resultado de um tick de obra */
export interface TickResult {
  work: ActiveWork;
  /** Materiais consumidos neste tick (a serem debitados do galpão) */
  consumed: ConsumedMaterial[];
}

/**
 * Mescla consumos de materiais em uma lista existente.
 * Se o material já existe, soma a quantidade.
 */
function mergeConsumed(
  existing: ConsumedMaterial[],
  delta: ConsumedMaterial[],
): ConsumedMaterial[] {
  const map = new Map(existing.map(c => [c.materialId, { ...c }]));
  for (const d of delta) {
    const prev = map.get(d.materialId);
    if (prev) {
      map.set(d.materialId, { ...prev, quantity: prev.quantity + d.quantity });
    } else {
      map.set(d.materialId, { ...d });
    }
  }
  return Array.from(map.values());
}

/**
 * Atualiza o progresso de uma obra ativa (delta entre ticks).
 *
 * - Se faltarem materiais no galpão: congela progresso, seta materialStarved=true
 * - Se materiais ok: consome proporcionalmente e avança currentM2Done
 * - Se prazo estourado: status → 'failed'
 * - Se concluiu: status → 'completed'
 *
 * Retorna a obra atualizada + materiais a serem debitados do galpão.
 */
export function tickActiveWork(
  work: ActiveWork,
  nowMs: number,
  warehouse: WarehouseItem[],
): TickResult {
  if (work.status !== 'running') return { work, consumed: [] };

  // Prazo estourado → falha imediata
  if (nowMs > work.deadline) {
    return { work: { ...work, status: 'failed', lastTickAt: nowMs }, consumed: [] };
  }

  const lastTick = work.lastTickAt > 0 ? work.lastTickAt : work.startedAt;
  const deltaMs  = Math.max(0, nowMs - lastTick);
  const deltaMin = deltaMs / 60_000;

  // Sem produção (sem trabalhadores) → congela sem acusar falta de material
  if (work.producaoPerMin <= 0) {
    return {
      work: { ...work, materialStarved: false, lastTickAt: nowMs },
      consumed: [],
    };
  }

  // ── Verificação de materiais ────────────────────────────────────────
  const requiredMats: WorkMaterialReq[] = work.requisitos?.materials ?? [];
  // Cap ao m² restante: evita consumo excessivo quando o tick é longo
  // (aba inativa, browser throttle, etc.)
  const remainingM2Raw   = Math.max(0, work.tamanhoM2 - work.currentM2Done);
  const deltaM2Potential = Math.min(work.producaoPerMin * deltaMin, remainingM2Raw);
  const deltaConsumed: ConsumedMaterial[] = [];
  let canProgress = true;

  if (requiredMats.length > 0 && deltaM2Potential > 0) {
    for (const req of requiredMats) {
      const qtyPerM2     = req.quantity / work.tamanhoM2;
      const neededQty    = qtyPerM2 * deltaM2Potential;
      const warehouseQty = warehouse.find(w => w.materialId === req.materialId)?.quantity ?? 0;
      // Tolerância de float (0.1% ou 0.001 unid) evita starvation espúrio
      const epsilon      = Math.max(0.001, neededQty * 0.001);

      if (warehouseQty < neededQty - epsilon) {
        canProgress = false;
        break;
      }

      const unitPrice = warehouse.find(w => w.materialId === req.materialId)?.unitPrice ?? 0;
      deltaConsumed.push({
        materialId: req.materialId,
        name:       req.name,
        quantity:   neededQty,
        unitPrice,
      });
    }
  }

  if (!canProgress) {
    // Progresso congelado — prazo continua correndo
    return {
      work: { ...work, materialStarved: true, lastTickAt: nowMs },
      consumed: [],
    };
  }

  // ── Avança progresso ────────────────────────────────────────────────
  const newM2Done   = Math.min(work.tamanhoM2, work.currentM2Done + deltaM2Potential);
  const progressPct = Math.round((newM2Done / work.tamanhoM2) * 100);
  const completed   = newM2Done >= work.tamanhoM2;

  const newConsumed = mergeConsumed(work.consumedMaterials, deltaConsumed);

  // Recalcula estimativa de conclusão com base no ritmo atual
  const remainingM2    = work.tamanhoM2 - newM2Done;
  const estCompletesAt = completed
    ? nowMs
    : nowMs + (remainingM2 / work.producaoPerMin) * 60_000;

  const updatedWork: ActiveWork = {
    ...work,
    currentM2Done:        newM2Done,
    progressPct,
    status:               completed ? 'completed' : 'running',
    materialStarved:      false,
    lastTickAt:           nowMs,
    consumedMaterials:    newConsumed,
    estimatedCompletesAt: estCompletesAt,
  };

  return { work: updatedWork, consumed: deltaConsumed };
}

// ── Construir ActiveWork ──────────────────────────────────────────────

/**
 * Monta uma ActiveWork a partir dos recursos alocados pelo jogador.
 * Materiais NÃO são debitados aqui — são consumidos gradualmente pelo tick.
 */
export function buildActiveWork(params: {
  licitacaoId:        string;
  nome:               string;
  tipo:               WorkType;
  tamanhoM2:          number;
  tempoBaseMin:       number;
  contractValue:      number;
  allocatedEmployees: AllocatedEmployee[];
  allocatedMachines:  AllocatedMachine[];
  requisitos?:        WorkRequirements;
}): ActiveWork {
  const producaoPerMin = calcProducaoPerMin(params.allocatedEmployees, params.allocatedMachines);
  const tempoMin       = calcTempoEstimadoMin(params.tamanhoM2, producaoPerMin);
  const now            = Date.now();
  // Prazo = 2.5× o tempo base ideal (dá margem para pausas de material)
  const deadline       = now + params.tempoBaseMin * 60_000 * 2.5;
  const efficiencyPct  = calcEfficiencyPct(producaoPerMin, params.tamanhoM2, params.tempoBaseMin);

  return {
    id:                   `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    licitacaoId:          params.licitacaoId,
    nome:                 params.nome,
    tipo:                 params.tipo,
    tamanhoM2:            params.tamanhoM2,
    contractValue:        params.contractValue,
    estimatedCost:        0, // calculado no tick/conclusão
    producaoPerMin,
    progressPct:          0,
    status:               'running',
    startedAt:            now,
    deadline,
    estimatedCompletesAt: producaoPerMin > 0 ? now + tempoMin * 60_000 : now + 999_999_000,
    efficiencyPct,
    allocatedEmployees:   params.allocatedEmployees,
    allocatedMachines:    params.allocatedMachines,
    consumedMaterials:    [],   // começa vazio; cresce no tick
    currentM2Done:        0,
    requisitos:           params.requisitos,
    materialStarved:      false,
    lastTickAt:           now,
  };
}

// ── Custo de materiais no estoque ─────────────────────────────────────

/** Preço médio ponderado de um material no galpão */
export function warehouseUnitPrice(warehouse: WarehouseItem[], materialId: string): number {
  const item = warehouse.find(w => w.materialId === materialId);
  if (!item) {
    const def = MATERIALS.find(m => m.materialId === materialId);
    return def?.basePrice ?? 0;
  }
  return item.unitPrice;
}
