// =====================================================================
// COMPRADORES DE CARROS (NPCs) — Aba Vendas
// =====================================================================
import type { CarBuyerNPC, BuyerPersonality, OwnedCar } from '@/types/game';
import { CAR_MODELS, conditionValueFactor, carFullName } from '@/data/cars';

// Templates de compradores (são instanciados dinamicamente)
interface BuyerTemplate {
  name: string;
  avatar: string;
  personality: BuyerPersonality;
  targetCategories: string[];
  payRange: { min: number; max: number };
  hasTradeIn: boolean;
  patience: number; // segundos
  description: string;
}

export const BUYER_TEMPLATES: BuyerTemplate[] = [
  // ── RACIONAIS (pagam perto da FIPE, negociam pouco) ─────────────
  {
    name: 'Marcos Rodrigues',
    avatar: '👨‍💼',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.85, max: 1.10 },
    hasTradeIn: false,
    patience: 70,
    description: 'Sabe o valor do carro. Paga justo.',
  },
  {
    name: 'Ana Paula Ferreira',
    avatar: '👩‍💼',
    personality: 'racional',
    targetCategories: ['popular'],
    payRange: { min: 0.80, max: 1.05 },
    hasTradeIn: false,
    patience: 65,
    description: 'Pesquisou bastante. Não paga mais que a tabela.',
  },
  {
    name: 'Roberto Cunha',
    avatar: '🧑‍💻',
    personality: 'racional',
    targetCategories: ['medio', 'suv'],
    payRange: { min: 0.88, max: 1.15 },
    hasTradeIn: false,
    patience: 75,
    description: 'Quer qualidade pelo preço certo.',
  },
  {
    name: 'Juliana Motta',
    avatar: '👩‍🔬',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.82, max: 1.08 },
    hasTradeIn: true,
    patience: 80,
    description: 'Veio com o carro dela pra trocar.',
  },

  // ── EMOCIONAIS (podem pagar acima da FIPE se gostar) ────────────
  {
    name: 'Gabriel Sousa',
    avatar: '😄',
    personality: 'emocional',
    targetCategories: ['esportivo', 'suv'],
    payRange: { min: 0.90, max: 1.25 },
    hasTradeIn: false,
    patience: 55,
    description: 'Se apaixona rápido. Pode pagar bem acima.',
  },
  {
    name: 'Fernanda Lima',
    avatar: '😍',
    personality: 'emocional',
    targetCategories: ['popular', 'suv'],
    payRange: { min: 0.88, max: 1.22 },
    hasTradeIn: false,
    patience: 50,
    description: 'Quer o carro dos sonhos, preço não é prioridade.',
  },
  {
    name: 'Diego Alves',
    avatar: '🤩',
    personality: 'emocional',
    targetCategories: ['esportivo'],
    payRange: { min: 0.92, max: 1.25 },
    hasTradeIn: true,
    patience: 60,
    description: 'Louquinho por esportivos. Paga bem se for o certo.',
  },
  {
    name: 'Camila Torres',
    avatar: '💃',
    personality: 'emocional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.85, max: 1.18 },
    hasTradeIn: false,
    patience: 55,
    description: 'Gosta de carro bonito. Valoriza aparência.',
  },

  // ── PECHINCHEIROS (tentam pagar abaixo da FIPE sempre) ───────────
  {
    name: 'Dona Maria',
    avatar: '👵',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.60, max: 0.88 },
    hasTradeIn: false,
    patience: 90,
    description: 'Negocia até o último centavo. Nunca aceita de primeira.',
  },
  {
    name: 'Seu Zé das Aranhas',
    avatar: '🕷️',
    personality: 'pechincha',
    targetCategories: ['popular', 'pickup'],
    payRange: { min: 0.58, max: 0.85 },
    hasTradeIn: true,
    patience: 85,
    description: 'Mestre da pechincha. Vai oferecer o menos possível.',
  },
  {
    name: 'Claudinho Comprador',
    avatar: '🤑',
    personality: 'pechincha',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.62, max: 0.90 },
    hasTradeIn: false,
    patience: 80,
    description: 'Só compra se sentir que fez um bom negócio.',
  },
  {
    name: 'Vera Nogueira',
    avatar: '🧓',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.65, max: 0.88 },
    hasTradeIn: false,
    patience: 100,
    description: 'Tem todo o tempo do mundo e quer descontar ao máximo.',
  },

  // ── APRESSADOS (pagam rápido, às vezes bem) ──────────────────────
  {
    name: 'Dr. Fábio Braga',
    avatar: '👨‍⚕️',
    personality: 'apressado',
    targetCategories: ['suv', 'medio'],
    payRange: { min: 0.88, max: 1.22 },
    hasTradeIn: false,
    patience: 35,
    description: 'Não tem tempo a perder. Paga bem e rápido.',
  },
  {
    name: 'Renata Corrêa',
    avatar: '👩‍⚕️',
    personality: 'apressado',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.85, max: 1.15 },
    hasTradeIn: false,
    patience: 30,
    description: 'Com pressa pra fechar. Aceita rápido.',
  },
  {
    name: 'Thiago Veloz',
    avatar: '🏃',
    personality: 'apressado',
    targetCategories: ['popular'],
    payRange: { min: 0.80, max: 1.10 },
    hasTradeIn: true,
    patience: 40,
    description: 'Quer resolver agora. Se não fechar logo, some.',
  },

  // ── CURIOSOS (indecisos, podem ou não comprar) ───────────────────
  {
    name: 'Paulo Wanderley',
    avatar: '🤔',
    personality: 'curioso',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.75, max: 1.10 },
    hasTradeIn: false,
    patience: 60,
    description: 'Ainda não sabe o que quer. Pode se convencer.',
  },
  {
    name: 'Lúcia Mendes',
    avatar: '🧐',
    personality: 'curioso',
    targetCategories: ['popular', 'eletrico'],
    payRange: { min: 0.80, max: 1.12 },
    hasTradeIn: false,
    patience: 65,
    description: 'Curiosa sobre carros elétricos e populares.',
  },
  {
    name: 'Heitor Peixoto',
    avatar: '😐',
    personality: 'curioso',
    targetCategories: ['pickup', 'suv'],
    payRange: { min: 0.78, max: 1.08 },
    hasTradeIn: true,
    patience: 55,
    description: 'Quer trocar o dele. Avalia opções.',
  },
];

// ─────────────────────────────────────────────────────────────────
// Gerador de instância de comprador
// ─────────────────────────────────────────────────────────────────

/** Gera um OwnedCar simples para ser usado como trade-in de um NPC */
function generateTradeInCar(): OwnedCar {
  const model = CAR_MODELS[Math.floor(Math.random() * CAR_MODELS.length)];
  const variant = model.variants[Math.floor(Math.random() * model.variants.length)];
  const condition = Math.floor(20 + Math.random() * 60); // 20-80
  const factor = conditionValueFactor(condition);
  return {
    instanceId: `tradein_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    modelId: model.id,
    variantId: variant.id,
    fullName: `${model.brand} ${model.model} ${variant.trim}`,
    brand: model.brand,
    model: model.model,
    trim: variant.trim,
    year: variant.year,
    icon: model.icon,
    fipePrice: variant.fipePrice,
    condition,
    purchasePrice: Math.round(variant.fipePrice * factor),
    purchasedAt: Date.now(),
  };
}

/** Instancia um comprador aleatório */
export function spawnBuyer(id: string): CarBuyerNPC {
  const template = BUYER_TEMPLATES[Math.floor(Math.random() * BUYER_TEMPLATES.length)];
  const tradeInCar = template.hasTradeIn && Math.random() > 0.4 ? generateTradeInCar() : undefined;
  const tradeInValue = tradeInCar
    ? Math.round(tradeInCar.fipePrice * conditionValueFactor(tradeInCar.condition) * (0.85 + Math.random() * 0.15))
    : undefined;

  return {
    id,
    name: template.name,
    avatar: template.avatar,
    personality: template.personality,
    targetModelIds: [],
    targetCategories: template.targetCategories,
    payRange: template.payRange,
    hasTradeIn: !!tradeInCar,
    tradeInCar,
    tradeInValue,
    patience: template.patience,
    arrivedAt: Date.now(),
    state: 'waiting',
  };
}

/** Calcula o valor que o comprador está disposto a pagar (com sorte) */
export function calculateBuyerOffer(
  buyer: CarBuyerNPC,
  fipePrice: number,
  condition: number,
): number {
  const baseFipe = fipePrice * conditionValueFactor(condition);
  // Range de pagamento baseado na personalidade
  const { min, max } = buyer.payRange;
  // Sorte: distribuição não-linear (mais provável pagar próximo do min)
  const luck = Math.pow(Math.random(), 1.4); // skewed toward lower values
  const factor = min + luck * (max - min);
  return Math.round(baseFipe * factor);
}

/** Verifica se a oferta do jogador é aceitável para o comprador */
export function evaluatePlayerOffer(
  buyer: CarBuyerNPC,
  playerOfferPrice: number,
  fipePrice: number,
  condition: number,
): boolean {
  const buyerWillingToPay = calculateBuyerOffer(buyer, fipePrice, condition);
  // Aceita se o preço pedido for menor ou igual ao que está disposto a pagar
  // + pequena tolerância emocional
  const tolerance = buyer.personality === 'emocional' ? 0.05 : 0.01;
  return playerOfferPrice <= buyerWillingToPay * (1 + tolerance);
}
