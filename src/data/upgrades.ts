// =====================================================================
// upgrades.ts — Upgrade catalog (client-side copy for offline use)
// Doc 04v2 — Modular Progression System
// =====================================================================

export type UpgradeCategory = 'equipment' | 'structure' | 'employee_slot' | 'permanent_unlock';

export interface UpgradeDef {
  id:          string;
  companyTypeId: string;
  category:    UpgradeCategory;
  tier:        number;
  name:        string;
  description: string;
  cost:        number;
  requiresId?: string;
  effects:     Record<string, number | string | boolean>;
}

export const UPGRADES: UpgradeDef[] = [
  // ── Mina de Ferro ────────────────────────────────────────────────
  {
    id: 'mina_ferro_equip_1', companyTypeId: 'mina_ferro', category: 'equipment', tier: 1,
    name: 'Britador Pequeno', description: 'Aumenta produção em 20% por ciclo.',
    cost: 8000, effects: { production_multiplier: 1.2 },
  },
  {
    id: 'mina_ferro_equip_2', companyTypeId: 'mina_ferro', category: 'equipment', tier: 2,
    name: 'Britador Industrial', description: 'Aumenta produção em 50% por ciclo.',
    cost: 25000, requiresId: 'mina_ferro_equip_1', effects: { production_multiplier: 1.5 },
  },
  {
    id: 'mina_ferro_equip_3', companyTypeId: 'mina_ferro', category: 'equipment', tier: 3,
    name: 'Linha de Beneficiamento', description: 'Dobra a produção por ciclo.',
    cost: 80000, requiresId: 'mina_ferro_equip_2', effects: { production_multiplier: 2.0 },
  },
  {
    id: 'mina_ferro_struct_1', companyTypeId: 'mina_ferro', category: 'structure', tier: 1,
    name: 'Galpão de Armazenagem', description: 'Aumenta capacidade de estoque em 500 t.',
    cost: 12000, effects: { storage_bonus: 500 },
  },
  {
    id: 'mina_ferro_struct_2', companyTypeId: 'mina_ferro', category: 'structure', tier: 2,
    name: 'Silo Metálico', description: 'Aumenta capacidade de estoque em 2000 t.',
    cost: 45000, requiresId: 'mina_ferro_struct_1', effects: { storage_bonus: 2000 },
  },
  {
    id: 'mina_ferro_emp_1', companyTypeId: 'mina_ferro', category: 'employee_slot', tier: 1,
    name: 'Vaga de Operário', description: 'Permite contratar 1 operário (reduz ciclo em 5%).',
    cost: 5000, effects: { employee_slots: 1, cycle_reduction: 0.05 },
  },
  {
    id: 'mina_ferro_emp_2', companyTypeId: 'mina_ferro', category: 'employee_slot', tier: 2,
    name: 'Vaga de Técnico', description: 'Permite contratar 1 técnico (reduz ciclo em 10%).',
    cost: 15000, requiresId: 'mina_ferro_emp_1', effects: { employee_slots: 1, cycle_reduction: 0.10 },
  },
  {
    id: 'mina_ferro_unlock_qualidade', companyTypeId: 'mina_ferro', category: 'permanent_unlock', tier: 1,
    name: 'Certificação de Qualidade', description: 'Venda direta para siderúrgicas (+15% preço).',
    cost: 30000, effects: { sell_price_bonus: 0.15, unlocks: 'direct_to_siderurgica' },
  },

  // ── Poco de Petróleo ────────────────────────────────────────────
  {
    id: 'poco_petroleo_equip_1', companyTypeId: 'poco_petroleo', category: 'equipment', tier: 1,
    name: 'Bomba Submersível', description: 'Aumenta extração em 25% por ciclo.',
    cost: 12000, effects: { production_multiplier: 1.25 },
  },
  {
    id: 'poco_petroleo_equip_2', companyTypeId: 'poco_petroleo', category: 'equipment', tier: 2,
    name: 'Torre de Perfuração', description: 'Aumenta extração em 60% por ciclo.',
    cost: 40000, requiresId: 'poco_petroleo_equip_1', effects: { production_multiplier: 1.6 },
  },
  {
    id: 'poco_petroleo_struct_1', companyTypeId: 'poco_petroleo', category: 'structure', tier: 1,
    name: 'Tanque de Armazenagem', description: 'Aumenta capacidade em 1000 barris.',
    cost: 18000, effects: { storage_bonus: 1000 },
  },
  {
    id: 'poco_petroleo_emp_1', companyTypeId: 'poco_petroleo', category: 'employee_slot', tier: 1,
    name: 'Técnico de Poço', description: 'Reduz ciclo em 8%.',
    cost: 8000, effects: { employee_slots: 1, cycle_reduction: 0.08 },
  },

  // ── Fazenda de Grãos ────────────────────────────────────────────
  {
    id: 'fazenda_graos_equip_1', companyTypeId: 'fazenda_graos', category: 'equipment', tier: 1,
    name: 'Semeadeira Mecânica', description: 'Aumenta plantio em 20%.',
    cost: 7000, effects: { production_multiplier: 1.2 },
  },
  {
    id: 'fazenda_graos_equip_2', companyTypeId: 'fazenda_graos', category: 'equipment', tier: 2,
    name: 'Colheitadeira Automatizada', description: 'Aumenta colheita em 60%.',
    cost: 35000, requiresId: 'fazenda_graos_equip_1', effects: { production_multiplier: 1.6 },
  },
  {
    id: 'fazenda_graos_struct_1', companyTypeId: 'fazenda_graos', category: 'structure', tier: 1,
    name: 'Silo Graneleiro', description: 'Aumenta estoque em 5000 sacos.',
    cost: 15000, effects: { storage_bonus: 5000 },
  },
  {
    id: 'fazenda_graos_emp_1', companyTypeId: 'fazenda_graos', category: 'employee_slot', tier: 1,
    name: 'Trabalhador Rural', description: 'Reduz ciclo em 5%.',
    cost: 4000, effects: { employee_slots: 1, cycle_reduction: 0.05 },
  },

  // ── Siderúrgica ──────────────────────────────────────────────────
  {
    id: 'siderurgica_equip_1', companyTypeId: 'siderurgica', category: 'equipment', tier: 1,
    name: 'Alto-Forno Auxiliar', description: 'Aumenta produção de aço em 30%.',
    cost: 50000, effects: { production_multiplier: 1.3 },
  },
  {
    id: 'siderurgica_equip_2', companyTypeId: 'siderurgica', category: 'equipment', tier: 2,
    name: 'Forno de Arco Elétrico', description: 'Aumenta produção em 80%.',
    cost: 150000, requiresId: 'siderurgica_equip_1', effects: { production_multiplier: 1.8 },
  },
  {
    id: 'siderurgica_struct_1', companyTypeId: 'siderurgica', category: 'structure', tier: 1,
    name: 'Pátio de Bobinas', description: 'Aumenta estoque em 800 t.',
    cost: 30000, effects: { storage_bonus: 800 },
  },
  {
    id: 'siderurgica_emp_1', companyTypeId: 'siderurgica', category: 'employee_slot', tier: 1,
    name: 'Fundidor', description: 'Reduz ciclo em 10%.',
    cost: 12000, effects: { employee_slots: 1, cycle_reduction: 0.10 },
  },
  {
    id: 'siderurgica_unlock_exportacao', companyTypeId: 'siderurgica', category: 'permanent_unlock', tier: 1,
    name: 'Certificação de Exportação', description: 'Habilita exportação de aço (+20% preço).',
    cost: 80000, effects: { sell_price_bonus: 0.20, unlocks: 'export_steel' },
  },

  // ── Frota Pesada ─────────────────────────────────────────────────
  {
    id: 'frota_pesada_equip_1', companyTypeId: 'frota_pesada', category: 'equipment', tier: 1,
    name: 'Caminhão Adicional', description: 'Aceita 1 frete extra simultâneo.',
    cost: 60000, effects: { freight_slots: 1 },
  },
  {
    id: 'frota_pesada_equip_2', companyTypeId: 'frota_pesada', category: 'equipment', tier: 2,
    name: 'Frota Semirreboque', description: 'Aceita 2 fretes extras simultâneos.',
    cost: 180000, requiresId: 'frota_pesada_equip_1', effects: { freight_slots: 2 },
  },
  {
    id: 'frota_pesada_struct_1', companyTypeId: 'frota_pesada', category: 'structure', tier: 1,
    name: 'Garagem e Oficina', description: 'Reduz custo operacional em 15%.',
    cost: 25000, effects: { cost_reduction: 0.15 },
  },
  {
    id: 'frota_pesada_unlock_rastreamento', companyTypeId: 'frota_pesada', category: 'permanent_unlock', tier: 1,
    name: 'Rastreamento GPS', description: 'Aumenta confiança dos compradores (+10% frete).',
    cost: 15000, effects: { freight_bonus: 0.10, unlocks: 'gps_tracking' },
  },

  // ── Loja de Construção ────────────────────────────────────────────
  {
    id: 'loja_construcao_equip_1', companyTypeId: 'loja_construcao', category: 'equipment', tier: 1,
    name: 'Expositor Adicional', description: 'Aumenta vendas em 20%.',
    cost: 8000, effects: { production_multiplier: 1.2 },
  },
  {
    id: 'loja_construcao_struct_1', companyTypeId: 'loja_construcao', category: 'structure', tier: 1,
    name: 'Depósito Ampliado', description: 'Aumenta estoque em 500 itens.',
    cost: 12000, effects: { storage_bonus: 500 },
  },
  {
    id: 'loja_construcao_emp_1', companyTypeId: 'loja_construcao', category: 'employee_slot', tier: 1,
    name: 'Vendedor', description: 'Aumenta vendas em 10%.',
    cost: 5000, effects: { employee_slots: 1, sell_bonus: 0.10 },
  },
];

export function getUpgradesForType(companyTypeId: string): UpgradeDef[] {
  return UPGRADES.filter((u) => u.companyTypeId === companyTypeId);
}

export function getUpgradeDef(upgradeId: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === upgradeId);
}
