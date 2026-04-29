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

/** Probabilidade do cliente abrir um claim quando condição < 60% */
export const WARRANTY_CLAIM_CHANCE = 0.50;

/** Nível mínimo do jogador para o sistema funcionar (não atrapalha iniciantes) */
export const WARRANTY_MIN_LEVEL = 8;

/** Threshold da condição que ativa a chance de claim */
export const WARRANTY_CONDITION_THRESHOLD = 60;

/** Prazo do jogador para responder a um claim (ms) — 5 minutos reais */
export const WARRANTY_CLAIM_TTL_MS = 5 * 60_000;
