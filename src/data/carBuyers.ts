// =====================================================================
// COMPRADORES DE CARROS (NPCs) — Aba Vendas
// =====================================================================
import type { CarBuyerNPC, BuyerPersonality, OwnedCar } from '@/types/game';
import { CAR_MODELS, conditionValueFactor } from '@/data/cars';

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
// Sistema de ciclos (30 min)
// ─────────────────────────────────────────────────────────────────

/** Duração de um ciclo de compradores em milissegundos (10 min) */
export const BUYER_CYCLE_MS = 10 * 60 * 1_000;

/** Índice do ciclo atual; incrementa a cada 30 minutos de tempo real */
export function currentCycleEpoch(): number {
  return Math.floor(Date.now() / BUYER_CYCLE_MS);
}

/** Segundos restantes até o início do próximo ciclo */
export function secondsUntilNextCycle(): number {
  const elapsed = Date.now() % BUYER_CYCLE_MS;
  return Math.ceil((BUYER_CYCLE_MS - elapsed) / 1_000);
}

/** Timestamp (ms) do início do próximo ciclo de compradores */
export function nextCycleTimestamp(): number {
  return Math.ceil(Date.now() / BUYER_CYCLE_MS) * BUYER_CYCLE_MS;
}

/**
 * Número máximo de slots de comprador disponíveis para o nível do jogador.
 *
 * Progressão:
 *   Nível  1–9  → 2 slots (base)
 *   Nível 10    → 3 slots  (+1 a cada 10 níveis a partir daqui)
 *   Nível 20    → 4 slots
 *   Nível 30    → 5 slots
 *   Nível 40    → 6 slots
 *   Nível 50    → 7 slots  … e assim por diante
 *
 * Fórmula: 2 + floor(level / 10)
 */
export function maxBuyerSlots(level: number): number {
  return 2 + Math.floor(level / 10);
}

// ─────────────────────────────────────────────────────────────────
// Progressão por nível — categorias e preços desbloqueados
// ─────────────────────────────────────────────────────────────────

interface BuyerTier {
  minLevel: number;
  /** Categorias que compradores podem solicitar neste tier */
  allowedCategories: string[];
  /** Preço FIPE máximo (variante mais barata do modelo) para pedidos de modelo específico */
  maxFipePrice: number;
}

/**
 * Tabela de progressão de compradores por nível do jogador.
 * Cada tier define quais categorias são desbloqueadas e o teto de
 * preço FIPE que um comprador pode solicitar (pedido de modelo exato).
 *
 * Níveis 1–5   → populares baratos (até R$ 100 k)
 * Níveis 6–15  → populares + médios (até R$ 160 k)
 * Níveis 16–29 → + SUVs e pickups básicas (até R$ 250 k)
 * Níveis 30–49 → + elétricos e veículos premium (até R$ 400 k)
 * Nível 50+    → + esportivos e supercarros (sem teto)
 */
const LEVEL_TIERS: BuyerTier[] = [
  {
    minLevel: 1,
    allowedCategories: ['popular'],
    maxFipePrice: 100_000,
  },
  {
    minLevel: 6,
    allowedCategories: ['popular', 'medio'],
    maxFipePrice: 160_000,
  },
  {
    minLevel: 16,
    allowedCategories: ['popular', 'medio', 'suv', 'pickup'],
    maxFipePrice: 250_000,
  },
  {
    minLevel: 30,
    allowedCategories: ['popular', 'medio', 'suv', 'pickup', 'eletrico'],
    maxFipePrice: 400_000,
  },
  {
    minLevel: 50,
    allowedCategories: ['popular', 'medio', 'suv', 'pickup', 'eletrico', 'esportivo'],
    maxFipePrice: Infinity,
  },
];

/** Retorna o tier de compradores correspondente ao nível do jogador */
function getBuyerTier(level: number): BuyerTier {
  let tier = LEVEL_TIERS[0];
  for (const t of LEVEL_TIERS) {
    if (level >= t.minLevel) tier = t;
  }
  return tier;
}

// Labels legíveis para categorias
export const CATEGORY_LABELS: Record<string, string> = {
  popular:   'Popular',
  medio:     'Médio',
  suv:       'SUV',
  pickup:    'Pickup',
  esportivo: 'Esportivo',
  eletrico:  'Elétrico',
};

function genCycleId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Instancia um comprador para um slot de ciclo específico.
 * requirementType determina se busca categoria inteira ou modelo exato.
 * playerLevel filtra categorias e preços de acordo com a progressão do jogador.
 *
 * Regras de troca (trade-in):
 * - O target (modelo ou categoria) é determinado ANTES da geração do trade-in,
 *   para que o teto de FIPE do trade-in seja calculado com base no que o comprador quer comprar.
 * - Trade-in FIPE ≤ 90 % do menor FIPE do modelo desejado (pedido de modelo)
 *   ou ≤ 80 % do teto do tier (pedido de categoria).
 * - Isso garante que a troca nunca gere vantagem econômica injusta para o comprador.
 */
export function spawnCycleBuyer(
  slotIndex: number,
  requirementType: 'category' | 'model',
  playerLevel: number,
): CarBuyerNPC {
  const tier = getBuyerTier(playerLevel);

  // Filtra templates cujas categorias-alvo têm interseção com o tier atual
  const eligibleTemplates = BUYER_TEMPLATES.filter(t =>
    t.targetCategories.some(c => tier.allowedCategories.includes(c)),
  );
  const templatePool = eligibleTemplates.length > 0 ? eligibleTemplates : BUYER_TEMPLATES;
  const template = templatePool[Math.floor(Math.random() * templatePool.length)];

  // ── 1. Determina o target ANTES do trade-in ──────────────────────
  let targetModelIds:   string[] = [];
  let targetCategories: string[] = [];
  let targetModelId:    string | undefined;
  let targetModelName:  string | undefined;
  let maxTradeInFipe:   number;

  if (requirementType === 'model') {
    const eligibleModels = CAR_MODELS.filter(m =>
      tier.allowedCategories.includes(m.category) &&
      Math.min(...m.variants.map(v => v.fipePrice)) <= tier.maxFipePrice,
    );
    const modelPool = eligibleModels.length > 0 ? eligibleModels : CAR_MODELS;
    const model = modelPool[Math.floor(Math.random() * modelPool.length)];
    targetModelIds  = [model.id];
    targetModelId   = model.id;
    targetModelName = `${model.brand} ${model.model}`;
    // Teto do trade-in: 90 % do menor FIPE do modelo solicitado
    // O comprador só pode trazer algo menos valioso do que o que quer comprar.
    maxTradeInFipe = Math.min(...model.variants.map(v => v.fipePrice)) * 0.9;
  } else {
    const cats = template.targetCategories.filter(c => tier.allowedCategories.includes(c));
    const catPool = cats.length > 0 ? cats : tier.allowedCategories;
    const cat = catPool[Math.floor(Math.random() * catPool.length)];
    targetCategories = [cat];
    // Teto do trade-in: 80 % do teto do tier (Infinity → cap absoluto de R$ 500 k)
    maxTradeInFipe = (tier.maxFipePrice === Infinity ? 500_000 : tier.maxFipePrice) * 0.8;
  }

  // ── 2. Gera trade-in com teto calculado a partir do target ───────
  const tradeInCar = template.hasTradeIn && Math.random() > 0.4
    ? generateTradeInCar(maxTradeInFipe)
    : undefined;
  const tradeInValue = tradeInCar
    ? Math.round(
        tradeInCar.fipePrice *
        conditionValueFactor(tradeInCar.condition) *
        (0.85 + Math.random() * 0.15)
      )
    : undefined;

  return {
    id:              genCycleId(),
    name:            template.name,
    avatar:          template.avatar,
    personality:     template.personality,
    targetModelIds,
    targetCategories,
    targetModelId,
    targetModelName,
    requirementType,
    slotIndex,
    payRange:        template.payRange,
    hasTradeIn:      !!tradeInCar,
    tradeInCar,
    tradeInValue,
    // patience = segundos restantes no ciclo atual no momento do spawn
    patience:  secondsUntilNextCycle(),
    arrivedAt: Date.now(),
    state:     'waiting',
  };
}

/**
 * Gera todos os compradores para um novo ciclo.
 * lockedSlotIndices: slots que permanecem bloqueados (não recebem comprador novo).
 * Distribui 50% categoria / 50% modelo específico, com pequeno embaralhamento.
 */
export function generateCycleBuyers(
  playerLevel: number,
  lockedSlotIndices: number[],
): CarBuyerNPC[] {
  const totalSlots = maxBuyerSlots(playerLevel);

  // Distribui tipos: alternando categoria/modelo → 50/50 para slots pares
  const reqTypes: Array<'category' | 'model'> = Array.from(
    { length: totalSlots },
    (_, i): 'category' | 'model' => (i % 2 === 0 ? 'category' : 'model'),
  );
  // Fisher-Yates shuffle para não ser sempre previsível
  for (let i = reqTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = reqTypes[i];
    reqTypes[i] = reqTypes[j];
    reqTypes[j] = tmp;
  }

  const buyers: CarBuyerNPC[] = [];
  for (let i = 0; i < totalSlots; i++) {
    if (lockedSlotIndices.includes(i)) continue;
    buyers.push(spawnCycleBuyer(i, reqTypes[i], playerLevel));
  }
  return buyers;
}

// ─────────────────────────────────────────────────────────────────
// Gerador de instância de comprador (legado — mantido para compat)
// ─────────────────────────────────────────────────────────────────

/**
 * Gera um OwnedCar para ser usado como trade-in de um NPC.
 * maxFipePrice: teto de FIPE — garante que o trade-in nunca valha mais
 * do que o carro que o comprador quer adquirir.
 */
function generateTradeInCar(maxFipePrice: number): OwnedCar {
  // Filtra modelos cujo menor preço de variante cabe no teto
  const eligibleModels = CAR_MODELS.filter(m =>
    Math.min(...m.variants.map(v => v.fipePrice)) <= maxFipePrice,
  );
  const modelPool = eligibleModels.length > 0 ? eligibleModels : CAR_MODELS;
  const model = modelPool[Math.floor(Math.random() * modelPool.length)];

  // Filtra variantes dentro do teto para garantia adicional
  const eligibleVariants = model.variants.filter(v => v.fipePrice <= maxFipePrice);
  const variantPool = eligibleVariants.length > 0 ? eligibleVariants : model.variants;
  const variant = variantPool[Math.floor(Math.random() * variantPool.length)];

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

/**
 * Instancia um comprador aleatório (legado — sem exigência específica).
 * Compradores genéricos não oferecem troca de veículos: apenas pagamento em dinheiro.
 */
export function spawnBuyer(id: string): CarBuyerNPC {
  const template = BUYER_TEMPLATES[Math.floor(Math.random() * BUYER_TEMPLATES.length)];
  // Sem trade-in: compradores sem pedido específico não têm base para propor troca equilibrada.
  return {
    id,
    name:             template.name,
    avatar:           template.avatar,
    personality:      template.personality,
    targetModelIds:   [],
    targetCategories: template.targetCategories,
    payRange:         template.payRange,
    hasTradeIn:       false,
    tradeInCar:       undefined,
    tradeInValue:     undefined,
    patience:         template.patience,
    arrivedAt:        Date.now(),
    state:            'waiting',
  };
}

/**
 * Multiplicador sobre o máximo do comprador a partir do qual ele faz uma contraoferta.
 * Se playerOffer ≤ buyerMax × COUNTER_OFFER_RATIO → contraoferta.
 * Se playerOffer > buyerMax × COUNTER_OFFER_RATIO → rejeição direta.
 */
export const COUNTER_OFFER_RATIO = 1.30;

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

/**
 * Avalia a probabilidade de aceitação da oferta do jogador.
 *
 * Fluxo:
 *  1. Calcula ratio = preço_jogador / valor_mercado  (FIPE × conditionValueFactor)
 *  2. Define chance base pelo ratio:
 *       ≤ 0.95 → 90–100 %
 *       ≤ 1.00 → 70–90 %
 *       ≤ 1.10 → 40–70 %
 *       > 1.10 → 10–40 %
 *  3. Ajuste por condição do veículo:
 *       condition ≥ 60 → bônus = (condition − 60) × 0.5
 *       condition < 60 → penalidade = (60 − condition) × 0.7
 *  4. chance_final = base + bônus − penalidade, limitada a [0, 100]
 *  5. Garantia mínima: se condition ≥ 60 → chance_final ≥ 60 %
 *  6. Decisão: random [0,100] ≤ chance_final → aceita
 *
 * Compradores emocionais recebem +5 % de tolerância adicional no ratio.
 */
export function evaluatePlayerOffer(
  buyer: CarBuyerNPC,
  playerOfferPrice: number,
  fipePrice: number,
  condition: number,
): boolean {
  const marketValue = fipePrice * conditionValueFactor(condition);
  if (marketValue <= 0) return false;

  // Tolerância extra para compradores emocionais
  const emotionalBonus = buyer.personality === 'emocional' ? 5 : 0;

  const ratio = playerOfferPrice / marketValue;

  // 1. Chance base por ratio
  let minChance: number;
  let maxChance: number;
  if (ratio <= 0.95) {
    minChance = 90; maxChance = 100;
  } else if (ratio <= 1.00) {
    minChance = 70; maxChance = 90;
  } else if (ratio <= 1.10) {
    minChance = 40; maxChance = 70;
  } else {
    minChance = 10; maxChance = 40;
  }
  const baseChance = minChance + Math.random() * (maxChance - minChance);

  // 2. Ajuste por condição
  const bonus   = condition >= 60 ? (condition - 60) * 0.5 : 0;
  const penalty = condition <  60 ? (60 - condition) * 0.7 : 0;

  // 3. Chance final
  let chance = baseChance + bonus - penalty + emotionalBonus;

  // 4. Garantia mínima para carros em bom estado
  if (condition >= 60) {
    chance = Math.max(chance, 60);
  }

  // 5. Clamp e decisão
  chance = Math.min(100, Math.max(0, chance));
  return Math.random() * 100 <= chance;
}
