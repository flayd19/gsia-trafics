// =====================================================================
// Tipos do sistema de funcionários (staff)
// =====================================================================

/** Identificador único de cada funcionário disponível para contratação. */
export type EmployeeId = 'washer' | 'seller';

/** Metadata estática (não muda em runtime) para cada funcionário. */
export interface EmployeeMeta {
  id:          EmployeeId;
  name:        string;
  icon:        string;
  description: string;
  /** Salário diário em reais (cobrado a cada dia in-game). */
  dailyCost:   number;
}

/**
 * Comissão do vendedor sobre cada venda total fechada por ele.
 * Aplicada SOBRE O VALOR DA VENDA (não sobre o lucro), descontada
 * automaticamente do valor recebido pelo jogador.
 */
export const SELLER_COMMISSION_RATE = 0.03; // 3%

/** Catálogo de funcionários disponíveis. */
export const EMPLOYEES_CATALOG: Record<EmployeeId, EmployeeMeta> = {
  washer: {
    id:          'washer',
    name:        'Lavador de carros',
    icon:        '🧽',
    description: 'Lava automaticamente todos os carros da garagem que ainda não foram lavados.',
    dailyCost:   500,
  },
  seller: {
    id:          'seller',
    name:        'Vendedor',
    icon:        '💼',
    description: 'Envia ofertas automaticamente para os compradores da aba Vendas. Você define a margem de preço. Cobra 3% de comissão sobre cada venda total fechada.',
    dailyCost:   2_000,
  },
};

/** Modo de precificação do Vendedor. */
export type PricingMode = 'below' | 'fipe' | 'above';

/** Configuração de cada funcionário (varia por tipo). */
export interface EmployeeConfig {
  /** [Vendedor] Modo de precificação. */
  pricingMode?:    PricingMode;
  /** [Vendedor] Porcentagem aplicada (0–50). 0 com modo 'fipe' = na FIPE exata. */
  pricingPercent?: number;
}

/** Estado de um funcionário contratado, persistido no save. */
export interface HiredEmployee {
  id:          EmployeeId;
  hiredAt:     number;
  config:      EmployeeConfig;
  /** Último dia in-game em que o salário foi cobrado. */
  lastPaidDay: number;
}

/** Helper: salário total dos funcionários contratados. */
export function totalDailyStaffCost(employees: HiredEmployee[]): number {
  return employees.reduce((sum, e) => sum + EMPLOYEES_CATALOG[e.id].dailyCost, 0);
}

/** Helper: calcula preço usando configuração do vendedor sobre uma FIPE. */
export function calcSellerPrice(fipePrice: number, config: EmployeeConfig): number {
  const mode = config.pricingMode ?? 'fipe';
  const pct  = Math.max(0, Math.min(50, config.pricingPercent ?? 0));
  const sign = mode === 'below' ? -1 : mode === 'above' ? 1 : 0;
  const factor = 1 + sign * (pct / 100);
  return Math.round(fipePrice * factor);
}
