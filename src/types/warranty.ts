// =====================================================================
// Tipos do sistema de Garantias
//
// Quando um carro vendido tinha condição < 60% e o jogador é Lv 8+,
// existe 50% de chance do cliente abrir um claim de garantia pedindo
// o pagamento de um reparo aleatório. O jogador pode:
//   • PAGAR: deduz o valor do reparo, claim resolvida, jogador mantém
//     o dinheiro da venda original.
//   • RECUSAR: subtrai o valor TOTAL da venda do saldo e o carro volta
//     pra garagem (status original do carro vendido).
// =====================================================================
import type { OwnedCar } from './game';

export type WarrantyClaimStatus = 'pending' | 'paid' | 'refused';

export interface WarrantyClaim {
  /** UUID único do claim */
  id: string;
  /** Quando o cliente abriu o claim */
  createdAt: number;
  /** Estado atual */
  status: WarrantyClaimStatus;
  /** Nome do cliente que comprou o carro */
  buyerName: string;
  /** Snapshot do carro vendido — usado pra reverter caso o jogador recuse */
  car: OwnedCar;
  /** Preço pelo qual o carro foi vendido (devolvido se recusar) */
  salePrice: number;
  /** ID do reparo solicitado (corresponde a REPAIR_TYPES) */
  repairTypeId: string;
  /** Nome legível do reparo (cacheado pra não depender do catálogo) */
  repairName: string;
  /** Ícone do reparo */
  repairIcon: string;
  /** Quanto o cliente quer que o jogador pague pelo reparo */
  repairCost: number;
  /** Atributo afetado, pra UX */
  attribute: string;
  /** Prazo (timestamp ms) — após isso o claim é auto-recusado se ignorado */
  expiresAt: number;
}

/** Nível mínimo do jogador para o sistema funcionar (não atrapalha iniciantes) */
export const WARRANTY_MIN_LEVEL = 8;

/** Threshold da condição que ativa a chance de claim (acima disso = 0%) */
export const WARRANTY_CONDITION_THRESHOLD = 60;

/** Limite inferior — abaixo disso (inclusive) o claim é GARANTIDO (100%) */
export const WARRANTY_GUARANTEED_THRESHOLD = 20;

/**
 * Calcula a probabilidade (0..1) de claim com base na condição do carro.
 *   • condição ≥ 60%  → 0% (sem risco)
 *   • condição ≤ 20%  → 100% (garantido)
 *   • entre 20 e 60%  → escala linear: 100% em 20, 0% em 60
 */
export function warrantyClaimChance(condition: number): number {
  if (condition >= WARRANTY_CONDITION_THRESHOLD)  return 0;
  if (condition <= WARRANTY_GUARANTEED_THRESHOLD) return 1;
  // Linear: cond=20 → 1.0, cond=60 → 0.0
  const range = WARRANTY_CONDITION_THRESHOLD - WARRANTY_GUARANTEED_THRESHOLD; // 40
  return Math.max(0, Math.min(1, (WARRANTY_CONDITION_THRESHOLD - condition) / range));
}
