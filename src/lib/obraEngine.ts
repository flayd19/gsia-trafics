// =====================================================================
// obraEngine.ts — Motor de cálculo de obras
// Produção, tempo, custo, verificação de requisitos
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
} from '@/types/game';
import { EMPLOYEE_TYPES, MATERIALS } from '@/data/construction';

// ── Constantes ────────────────────────────────────────────────────────
/** Bônus de produção por Mestre de Obra (cada um) */
const MESTRE_BONUS = 0.15;
/** Bônus por 2 engenheiros na mesma obra */
const DUAL_ENG_BONUS = 0.10;
/** Segurança reduz probabilidade de falha (não afeta produção) */
export const SEGURANCA_FAIL_REDUCTION = 0.40; // -40% de chance de falha

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

  // Funcionários disponíveis (idle)
  for (const er of req.employees) {
    const have = employees.filter(e => e.type === er.type && e.status === 'idle').length;
    if (have < er.quantity) {
      result.ok = false;
      const def = EMPLOYEE_TYPES.find(d => d.type === er.type);
      result.missingEmployees.push({
        type: er.type,
        label: def?.label ?? er.type,
        needed: er.quantity,
        have,
      });
    }
  }

  // Máquinas disponíveis (idle)
  for (const mr of req.machines) {
    const have = machines.filter(m => m.typeId === mr.typeId && m.status === 'idle').length;
    if (have < mr.quantity) {
      result.ok = false;
      result.missingMachines.push({
        typeId: mr.typeId,
        name: mr.name,
        needed: mr.quantity,
        have,
      });
    }
  }

  // Materiais no galpão
  for (const mat of req.materials) {
    const stock = warehouse.find(w => w.materialId === mat.materialId);
    const have  = stock?.quantity ?? 0;
    if (have < mat.quantity) {
      result.ok = false;
      result.missingMaterials.push({
        materialId: mat.materialId,
        name: mat.name,
        needed: mat.quantity,
        have,
      });
    }
  }

  return result;
}

// ── Cálculo de produção ───────────────────────────────────────────────

/**
 * Multiplicador de produção baseado no nível do funcionário.
 * Nível 1 → ×1.0, nível 10 → ×2.08 (cap interno: ×2.5)
 */
export function calcLevelMultiplier(level: number): number {
  return Math.min(2.5, 1 + (level - 1) * 0.12);
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
 */
export function calcProducaoPerMin(employees: AllocatedEmployee[]): number {
  let base = 0;

  for (const emp of employees) {
    const def = EMPLOYEE_TYPES.find(d => d.type === emp.type);
    if (!def || def.producaoBase === 0) continue;
    const levelMult = calcLevelMultiplier(emp.level ?? 1);
    base += def.producaoBase * (emp.skill / 100) * levelMult;
  }

  // Bônus de Mestre
  const numMestres = employees.filter(e => e.type === 'mestre').length;
  let bonus = 1 + numMestres * MESTRE_BONUS;

  // Bônus de 2 engenheiros
  const numEng = employees.filter(e => e.type === 'engenheiro').length;
  if (numEng >= 2) bonus += DUAL_ENG_BONUS;

  return base * bonus;
}

/**
 * Tempo estimado para concluir a obra em minutos reais.
 *   tempo = tamanho_m2 / producao_por_min
 * Mínimo de 1 minuto.
 */
export function calcTempoEstimadoMin(tamanhoM2: number, producaoPerMin: number): number {
  if (producaoPerMin <= 0) return 99_999;
  return Math.max(1, tamanhoM2 / producaoPerMin);
}

// ── Custo real da obra ────────────────────────────────────────────────

export interface WorkCostBreakdown {
  /** Custo dos materiais consumidos (preço pago no galpão) */
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

  return {
    materialCost,
    laborCost,
    machineCost,
    total: materialCost + laborCost + machineCost,
  };
}

// ── Margem de lucro esperada ──────────────────────────────────────────

/** Retorna margem percentual esperada por tipo de obra */
export function expectedMarginPct(tipo: WorkType): string {
  switch (tipo) {
    case 'pequena': return '30–40%';
    case 'media':   return '20–30%';
    case 'grande':  return '8–15%';
    case 'mega':    return '5–10%';
  }
}

// ── Progresso da obra (tick) ──────────────────────────────────────────

/**
 * Atualiza o progresso de uma obra ativa.
 * Deve ser chamado a cada tick (ex: a cada segundo).
 * - Se concluiu: status → 'completed'
 * - Se passou do prazo sem concluir: status → 'failed'
 */
export function tickActiveWork(work: ActiveWork, nowMs: number): ActiveWork {
  if (work.status !== 'running') return work;

  // Prazo estourado → falha
  if (nowMs > work.deadline) {
    return { ...work, status: 'failed' };
  }

  const elapsedMin = (nowMs - work.startedAt) / 60_000;
  const m2Done = Math.min(
    work.tamanhoM2,
    work.producaoPerMin * elapsedMin,
  );
  const progressPct = Math.round((m2Done / work.tamanhoM2) * 100);
  const completed   = m2Done >= work.tamanhoM2;

  return {
    ...work,
    currentM2Done: m2Done,
    progressPct,
    status: completed ? 'completed' : 'running',
  };
}

// ── Construir ActiveWork ──────────────────────────────────────────────

/**
 * Monta uma ActiveWork a partir dos recursos alocados pelo jogador.
 * Não modifica o estado — apenas calcula e retorna.
 *
 * @param tempoBaseMin — tempo ideal da licitação (usado para deadline e eficiência)
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
  consumedMaterials:  ConsumedMaterial[];
  requisitos?:        import('@/types/game').WorkRequirements;
}): ActiveWork {
  const producaoPerMin = calcProducaoPerMin(params.allocatedEmployees);
  const tempoMin       = calcTempoEstimadoMin(params.tamanhoM2, producaoPerMin);
  const cost           = calcWorkCost(
    params.allocatedEmployees,
    params.allocatedMachines,
    params.consumedMaterials,
    tempoMin,
  );
  const now          = Date.now();
  // Prazo = 2× o tempo base ideal (em ms reais)
  const deadline     = now + params.tempoBaseMin * 60_000 * 2;
  const efficiencyPct = calcEfficiencyPct(producaoPerMin, params.tamanhoM2, params.tempoBaseMin);

  return {
    id:                   `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    licitacaoId:          params.licitacaoId,
    nome:                 params.nome,
    tipo:                 params.tipo,
    tamanhoM2:            params.tamanhoM2,
    contractValue:        params.contractValue,
    estimatedCost:        cost.total,
    producaoPerMin,
    progressPct:          0,
    status:               'running',
    startedAt:            now,
    deadline,
    estimatedCompletesAt: now + tempoMin * 60_000,
    efficiencyPct,
    allocatedEmployees:   params.allocatedEmployees,
    allocatedMachines:    params.allocatedMachines,
    consumedMaterials:    params.consumedMaterials,
    currentM2Done:        0,
    requisitos:           params.requisitos,
  };
}

// ── Custo de materiais no estoque ─────────────────────────────────────

/** Preço médio ponderado de um material no galpão */
export function warehouseUnitPrice(warehouse: WarehouseItem[], materialId: string): number {
  const item = warehouse.find(w => w.materialId === materialId);
  if (!item) {
    // Fallback ao preço base
    const def = MATERIALS.find(m => m.materialId === materialId);
    return def?.basePrice ?? 0;
  }
  return item.unitPrice;
}
