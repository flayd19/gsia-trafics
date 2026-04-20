export interface Buyer {
  id: string;
  name: string;
  description: string;
  emoji: string;
  orders: BuyerOrder[];
  priceMultiplier: number; // Multiplicador do preço base (1.40 a 2.55)
  reliability: 'baixa' | 'média' | 'alta'; // Confiabilidade do pagamento
  tier?: number; // Tier do comprador (1-4) baseado em pedidos completados
  minCompletedOrders?: number; // Mínimo de pedidos completados para aparecer
  location?: string; // Localização do comprador

  // ─── Sistema novo (paciência + negociação) ───
  /** Frase em itálico exibida no card. Padrão para Tier 2-4. */
  catchPhrase?: string;
  /** Faixa de paciência em segundos [min, max]. Default: [75, 90]. Impacientes: [55, 60]. */
  patienceRange?: [number, number];
  /** 0 a 1. Quão disposto está a pechinchar. 0 = botão não aparece. */
  negotiationFlexibility?: number;
  /** Faixa de bônus percentual aplicado em caso de sucesso na pechincha. Default [0.07, 0.15]. */
  bargainBonusRange?: [number, number];

  // ─── Campos runtime (preenchidos quando o buyer é "instanciado" no jogo) ───
  /** Lista de produtos que o buyer aceita pedir (IDs) — usado para gerar pedidos aleatórios. */
  productPool?: string[];
  /** Timestamp absoluto em que o buyer vai embora se não for atendido. */
  patienceDeadline?: number;
  /** Duração total da paciência em ms (para cálculo de barra). */
  patienceTotalMs?: number;
  /** Se já tentou pechinchar. */
  bargainAttempted?: boolean;
  /** Resultado da pechincha (null = não tentou, true = aceita, false = recusa). */
  bargainAccepted?: boolean | null;
  /** Bônus aplicado em caso de sucesso (ex: 0.12 = +12% nos preços). */
  bargainBonusApplied?: number | null;
  /** Timestamp em que o card vai desaparecer (quando bargainAccepted=false, dá um delay pra feedback). */
  leavingAt?: number;
}

export interface BuyerOrder {
  productId: string;
  quantity: number;
  pricePerUnit: number;
  /** Preço base antes de bônus de pechincha (preservado para recomputar). */
  basePricePerUnit?: number;
  products?: any[]; // Compatibilidade com código legado
}

// ─── Defaults do sistema de paciência/negociação ───
/** Paciência normal (segundos). */
export const DEFAULT_PATIENCE_RANGE: [number, number] = [75, 90];
/** Paciência para impacientes (segundos). */
export const IMPATIENT_PATIENCE_RANGE: [number, number] = [55, 60];
/** Faixa default de bônus aplicado em caso de sucesso na pechincha. */
export const DEFAULT_BARGAIN_BONUS_RANGE: [number, number] = [0.07, 0.15];
/** Frase genérica para Tier 2-4 que não têm catchPhrase própria. */
export const DEFAULT_CATCH_PHRASE = 'Negócio é negócio. Tô esperando.';
/** Chance de aceitar pechincha por reliability. */
export const BARGAIN_ACCEPT_CHANCE: Record<'baixa' | 'média' | 'alta', number> = {
  baixa: 0.72,
  média: 0.60,
  alta: 0.45,
};

// Tier 1: Compradores iniciantes (0-5 pedidos completados)
export const TIER_1_BUYERS: Buyer[] = [
  {
    id: 'acos_fm',
    name: 'AÇOS FM',
    description: 'Loja de armas e materiais de construção',
    emoji: '🔧',
    priceMultiplier: 1.25,
    reliability: 'alta',
    tier: 1,
    minCompletedOrders: 0,
    catchPhrase: 'Tô precisando dessa porra pro estoque, bora rapidão.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0,
    bargainBonusRange: [0.07, 0.10],
    productPool: ['ferramentas', 'pneus', 'pecas_carros', 'marlboro', 'pods'],
    orders: [
      { productId: 'ferramentas', quantity: 1, pricePerUnit: 94.71 },
      { productId: 'pneus', quantity: 1, pricePerUnit: 142.5 },
      { productId: 'marlboro', quantity: 2, pricePerUnit: 17.85 }
    ]
  },
  {
    id: 'naldao_agropecuaria',
    name: 'Naldao agropecuária',
    description: 'Agropecuária com armas e eletrônicos',
    emoji: '🚜',
    priceMultiplier: 1.25,
    reliability: 'média',
    tier: 1,
    minCompletedOrders: 0,
    catchPhrase: 'Vim da roça só pra isso, caminhão esperando lá fora.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.4,
    bargainBonusRange: [0.08, 0.12],
    productPool: ['ferramentas', 'pneus', 'pecas_carros', 'marlboro', 'smirnoffa', 'pods'],
    orders: [
      { productId: 'ferramentas', quantity: 2, pricePerUnit: 73.08 },
      { productId: 'marlboro', quantity: 3, pricePerUnit: 19.32 },
      { productId: 'smirnoffa', quantity: 2, pricePerUnit: 30.00 }
    ]
  },
  {
    id: 'corujinha_pesca',
    name: 'corujinha pesca',
    description: 'Loja de pesca com armas e eletrônicos',
    emoji: '🎣',
    priceMultiplier: 1.35,
    reliability: 'baixa',
    tier: 1,
    minCompletedOrders: 1,
    catchPhrase: 'Toma essa proposta aí, depois a gente acerta o resto.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.5,
    bargainBonusRange: [0.10, 0.15],
    productPool: ['ferramentas', 'perfumes', 'marlboro', 'pods', 'camiseta_peruana', 'tenis_mike'],
    orders: [
      { productId: 'ferramentas', quantity: 1, pricePerUnit: 82.35 },
      { productId: 'perfumes', quantity: 2, pricePerUnit: 45.90 },
      { productId: 'marlboro', quantity: 3, pricePerUnit: 22.95 }
    ]
  },
  {
    id: 'mercadinho_pessoa',
    name: 'mercadinho Pessoa',
    description: 'Mercadinho com brinquedos, cigarros e bebidas',
    emoji: '🏪',
    priceMultiplier: 1.30,
    reliability: 'média',
    tier: 1,
    minCompletedOrders: 1,
    catchPhrase: 'Cliente fiel merece um precinho, né meu chapa?',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.3,
    bargainBonusRange: [0.07, 0.11],
    productPool: ['marlboro', 'smirnoffa', 'bobigude', 'pods', 'perfumes'],
    orders: [
      { productId: 'marlboro', quantity: 2, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 3, pricePerUnit: 25.00 },
      { productId: 'bobigude', quantity: 4, pricePerUnit: 26.73 }
    ]
  },
  {
    id: 'najupsx_variedades',
    name: 'Najupsx variedades',
    description: 'Loja de variedades com brinquedos, perfumes, cremes e roupas',
    emoji: '🛍️',
    priceMultiplier: 1.33,
    reliability: 'média',
    tier: 1,
    minCompletedOrders: 2,
    catchPhrase: 'Quero variedade no estoque, nem reclamo do preço.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.3,
    bargainBonusRange: [0.08, 0.12],
    productPool: ['perfumes', 'camiseta_peruana', 'bobigude', 'marlboro', 'tenis_mike', 'pods'],
    orders: [
      { productId: 'perfumes', quantity: 2, pricePerUnit: 34.65 },
      { productId: 'camiseta_peruana', quantity: 2, pricePerUnit: 27.72 },
      { productId: 'bobigude', quantity: 3, pricePerUnit: 27.72 },
      { productId: 'marlboro', quantity: 4, pricePerUnit: 21.42 }
    ]
  },
  {
    id: 'colombiano_baixada',
    name: 'colombiano da baixada',
    description: 'Distribuidor geral - todas as categorias',
    emoji: '🌎',
    priceMultiplier: 1.80,
    reliability: 'alta',
    tier: 1,
    minCompletedOrders: 2,
    catchPhrase: 'Hermano, no tengo tiempo. Vamos a hacer negocio ya.',
    patienceRange: [55, 60],
    negotiationFlexibility: 0,
    bargainBonusRange: [0.07, 0.10],
    productPool: ['marlboro', 'celulares', 'patinete_eletrico', 'perfumes', 'prensadao', 'escama', 'armas', 'camiseta_peruana', 'tenis_mike'],
    orders: [
      { productId: 'marlboro', quantity: 3, pricePerUnit: 17.33 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1273.96 },
      { productId: 'patinete_eletrico', quantity: 1, pricePerUnit: 3800.00 },
      { productId: 'perfumes', quantity: 2, pricePerUnit: 38.12 }
    ]
  },
  {
    id: 'sparta_tech',
    name: 'sparta tech',
    description: 'Loja de eletrônicos e brinquedos',
    emoji: '💻',
    priceMultiplier: 1.25,
    reliability: 'alta',
    tier: 1,
    minCompletedOrders: 3,
    catchPhrase: 'Eletrônico bom é mercadoria fácil de virar.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0,
    bargainBonusRange: [0.07, 0.10],
    productPool: ['celulares', '38_bulldog', 'caixa_municao', 'notebook', 'starlinks', 'smart_watch', 'tv_80_pl'],
    orders: [
      { productId: 'celulares', quantity: 1, pricePerUnit: 1231.23 },
      { productId: '38_bulldog', quantity: 1, pricePerUnit: 4200.00 },
      { productId: 'caixa_municao', quantity: 2, pricePerUnit: 1458.00 }
    ]
  },
  {
    id: 'yp_outlet',
    name: 'yp outlet',
    description: 'Outlet de perfumes, roupas e calçados',
    emoji: '👕',
    priceMultiplier: 1.32,
    reliability: 'média',
    tier: 1,
    minCompletedOrders: 3,
    catchPhrase: 'Trouxe dinheiro vivo, não me deixa esperando.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.4,
    bargainBonusRange: [0.08, 0.12],
    productPool: ['perfumes', 'camiseta_peruana', 'tenis_mike', 'bobigude', 'pods', 'marlboro'],
    orders: [
      { productId: 'perfumes', quantity: 2, pricePerUnit: 34.00 },
      { productId: 'camiseta_peruana', quantity: 3, pricePerUnit: 25.41 },
      { productId: 'tenis_mike', quantity: 1, pricePerUnit: 106.26 }
    ]
  },
  {
    id: 'goianesia_importados',
    name: 'Goianésia importados',
    description: 'Importadora geral - todas as categorias',
    emoji: '📦',
    priceMultiplier: 1.40,
    reliability: 'alta',
    tier: 1,
    minCompletedOrders: 4,
    catchPhrase: 'Importado bom é importado certo. Tô na expectativa.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0,
    bargainBonusRange: [0.07, 0.10],
    productPool: ['celulares', 'perfumes', 'marlboro', 'notebook', 'starlinks', 'smart_watch', 'pods', 'camiseta_peruana', 'tenis_mike'],
    orders: [
      { productId: 'celulares', quantity: 1, pricePerUnit: 1358.28 },
      { productId: 'perfumes', quantity: 3, pricePerUnit: 40.43 },
      { productId: 'marlboro', quantity: 5, pricePerUnit: 18.48 },
      { productId: 'notebook', quantity: 1, pricePerUnit: 4158.00 }
    ]
  },
  {
    id: 'ze_baxinho',
    name: 'zé baxinho',
    description: 'Distribuidor de bebidas, cigarros e eletrônicos',
    emoji: '🍺',
    priceMultiplier: 1.30,
    reliability: 'baixa',
    tier: 1,
    minCompletedOrders: 4,
    catchPhrase: 'Confia em mim, sempre paguei. Quase sempre.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.5,
    bargainBonusRange: [0.10, 0.15],
    productPool: ['marlboro', 'smirnoffa', 'celulares', 'notebook', 'pods', 'bobigude'],
    orders: [
      { productId: 'marlboro', quantity: 4, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 5, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 },
      { productId: 'notebook', quantity: 1, pricePerUnit: 3861.00 }
    ]
  },
  {
    id: 'cerveja_cia',
    name: 'cerveja e cia',
    description: 'Distribuidora de bebidas, cigarros e eletrônicos',
    emoji: '🍻',
    priceMultiplier: 1.28,
    reliability: 'média',
    tier: 1,
    minCompletedOrders: 5,
    catchPhrase: 'Final de semana tá vindo aí, preciso encher o estoque.',
    patienceRange: [75, 90],
    negotiationFlexibility: 0.3,
    bargainBonusRange: [0.08, 0.12],
    productPool: ['marlboro', 'smirnoffa', 'celulares', 'pods', 'bobigude'],
    orders: [
      { productId: 'marlboro', quantity: 6, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 8, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 }
    ]
  },
  {
    id: 'so_festas',
    name: 'só festas',
    description: 'Casa de festas com bebidas, cigarros e eletrônicos',
    emoji: '🎉',
    priceMultiplier: 1.35,
    reliability: 'alta',
    tier: 1,
    minCompletedOrders: 5,
    catchPhrase: 'Tem evento hoje à noite, mano. Tá com pressa ou não?',
    patienceRange: [55, 60],
    negotiationFlexibility: 0,
    bargainBonusRange: [0.07, 0.10],
    productPool: ['marlboro', 'smirnoffa', 'celulares', 'pods', 'perfumes', 'md_rosa', 'bala'],
    orders: [
      { productId: 'marlboro', quantity: 8, pricePerUnit: 17.33 },
      { productId: 'smirnoffa', quantity: 10, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 }
    ]
  }
];

// Tier 2: Compradores intermediários (6-15 pedidos completados)
export const TIER_2_BUYERS: Buyer[] = [
  {
    id: 'disk_zoio',
    name: 'disk do zoio',
    description: 'Distribuidora de bebidas, cigarros e eletrônicos',
    emoji: '👁️',
    priceMultiplier: 1.30,
    reliability: 'alta',
    tier: 2,
    minCompletedOrders: 6,
    orders: [
      { productId: 'marlboro', quantity: 10, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 12, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1273.96 },
      { productId: 'pods', quantity: 8, pricePerUnit: 13.05 },
      { productId: 'perfumes', quantity: 5, pricePerUnit: 40.25 },
      { productId: 'glock_g19', quantity: 1, pricePerUnit: 4074.84 },
      { productId: 'ferramentas', quantity: 3, pricePerUnit: 73.08 },
      { productId: 'tenis_mike', quantity: 2, pricePerUnit: 97.20 },
      { productId: 'camiseta_peruana', quantity: 6, pricePerUnit: 25.20 },
      { productId: 'bobigude', quantity: 10, pricePerUnit: 23.52 },
      { productId: 'smart_watch', quantity: 2, pricePerUnit: 615.90 }
    ]
  },
  {
    id: 'pinguins_distribuidora',
    name: 'Pinguins Distribuidora',
    description: 'Distribuidora de bebidas, cigarros e eletrônicos',
    emoji: '🐧',
    priceMultiplier: 1.28,
    reliability: 'alta',
    tier: 2,
    minCompletedOrders: 7,
    orders: [
      { productId: 'marlboro', quantity: 15, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 18, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1231.23 },
      { productId: 'pods', quantity: 12, pricePerUnit: 12.87 },
      { productId: 'perfumes', quantity: 8, pricePerUnit: 38.61 },
      { productId: 'tenis_mike', quantity: 3, pricePerUnit: 93.23 },
      { productId: 'camiseta_peruana', quantity: 8, pricePerUnit: 24.18 },
      { productId: 'bobigude', quantity: 12, pricePerUnit: 22.58 },
      { productId: 'ferramentas', quantity: 4, pricePerUnit: 70.13 },
      { productId: 'starlinks', quantity: 1, pricePerUnit: 816.15 },
      { productId: 'smart_watch', quantity: 3, pricePerUnit: 605.55 }
    ]
  },
  {
    id: 'revisa_autocenter',
    name: 'revisa autocenter',
    description: 'Autocenter especializado em peças de carro e pneus',
    emoji: '🚗',
    priceMultiplier: 1.35,
    reliability: 'alta',
    tier: 2,
    minCompletedOrders: 8,
    orders: [
      { productId: 'pneus', quantity: 2, pricePerUnit: 142.5 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1273.96 },
      { productId: 'pecas_carros', quantity: 3, pricePerUnit: 142.5 },
      { productId: 'ferramentas', quantity: 5, pricePerUnit: 75.75 },
      { productId: 'marlboro', quantity: 12, pricePerUnit: 18.15 },
      { productId: 'perfumes', quantity: 4, pricePerUnit: 41.25 },
      { productId: 'pods', quantity: 10, pricePerUnit: 13.95 },
      { productId: 'notebook', quantity: 1, pricePerUnit: 4009.50 }
    ]
  },
  {
    id: 'fonseca_mecanica',
    name: 'Fonseca mecânica',
    description: 'Oficina mecânica especializada em peças de carro e pneus',
    emoji: '🔧',
    priceMultiplier: 1.40,
    reliability: 'média',
    tier: 2,
    minCompletedOrders: 9,
    orders: [
      { productId: 'pecas_carros', quantity: 2, pricePerUnit: 158.23 },
      { productId: 'ferramentas', quantity: 3, pricePerUnit: 98.18 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 },
      { productId: 'pneus', quantity: 2, pricePerUnit: 119.70 },
      { productId: 'marlboro', quantity: 8, pricePerUnit: 16.66 },
      { productId: 'pods', quantity: 6, pricePerUnit: 12.81 }
    ]
  },
  {
    id: 'catitu',
    name: 'catítu',
    description: 'Traficante especializado em ilícitos e armas',
    emoji: '🐱',
    priceMultiplier: 1.95,
    reliability: 'média',
    tier: 2,
    minCompletedOrders: 10,
    orders: [
      { productId: 'prensadao', quantity: 3, pricePerUnit: 322.25 },
      { productId: 'escama', quantity: 4, pricePerUnit: 144.38 },
      { productId: '357_magnum', quantity: 1, pricePerUnit: 4669.67 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1701.00 },
      { productId: 'marlboro', quantity: 15, pricePerUnit: 20.48 },
      { productId: 'pods', quantity: 12, pricePerUnit: 15.75 },
      { productId: 'caixa_municao', quantity: 3, pricePerUnit: 2106.00 }
    ]
  },
  {
    id: 'vaguinho',
    name: 'Vaguinho',
    description: 'Traficante especializado em ilícitos e armas',
    emoji: '🚂',
    priceMultiplier: 1.95,
    reliability: 'baixa',
    tier: 2,
    minCompletedOrders: 11,
    orders: [
      { productId: 'prensadao', quantity: 2, pricePerUnit: 307.23 },
      { productId: 'escama', quantity: 3, pricePerUnit: 137.45 },
      { productId: '762_parafal', quantity: 1, pricePerUnit: 4414.41 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1579.50 },
      { productId: 'marlboro', quantity: 12, pricePerUnit: 19.01 },
      { productId: 'caixa_municao', quantity: 2, pricePerUnit: 2106.00 }
    ]
  },
  {
    id: 'parrudo',
    name: 'parrudo',
    description: 'Traficante especializado em ilícitos e armas',
    emoji: '💪',
    priceMultiplier: 1.40,
    reliability: 'média',
    tier: 2,
    minCompletedOrders: 12,
    orders: [
      { productId: 'prensadao', quantity: 2, pricePerUnit: 296.83 },
      { productId: 'escama', quantity: 3, pricePerUnit: 131.67 },
      { productId: '38_bulldog', quantity: 1, pricePerUnit: 4244.63 }
    ]
  },
  {
    id: 'catitu_disfarçado',
    name: 'catitu disfarçado',
    description: 'Operação discreta de ilícitos e armas',
    emoji: '🥸',
    priceMultiplier: 1.95,
    reliability: 'alta',
    tier: 2,
    minCompletedOrders: 13,
    orders: [
      { productId: 'prensadao', quantity: 4, pricePerUnit: 382.31 },
      { productId: 'escama', quantity: 6, pricePerUnit: 169.79 },
      { productId: 'glock_g19', quantity: 1, pricePerUnit: 5093.55 },
      { productId: '357_magnum', quantity: 1, pricePerUnit: 5200.00 },
      { productId: 'tv_80_pl', quantity: 1, pricePerUnit: 8201.25 }
    ]
  },
  {
    id: 'bacarau',
    name: 'bacarau',
    description: 'Traficante especializado em ilícitos e armas',
    emoji: '🦅',
    priceMultiplier: 1.75,
    reliability: 'média',
    tier: 2,
    minCompletedOrders: 14,
    orders: [
      { productId: 'prensadao', quantity: 3, pricePerUnit: 328.02 },
      { productId: 'escama', quantity: 4, pricePerUnit: 149 },
      { productId: 'armas', quantity: 1, pricePerUnit: 4584.2 }
    ]
  },
  {
    id: 'divino_pedeboi',
    name: 'divino pédeboi',
    description: 'Grande distribuidor de ilícitos e armas da região',
    emoji: '🐂',
    priceMultiplier: 2.40,
    reliability: 'alta',
    tier: 2,
    minCompletedOrders: 15,
    orders: [
      { productId: 'prensadao', quantity: 6, pricePerUnit: 407.72 },
      { productId: 'escama', quantity: 8, pricePerUnit: 179.03 },
      { productId: 'armas', quantity: 2, pricePerUnit: 5263.34 }
    ]
  }
];

// Tier 3: Compradores avançados (16-30 pedidos completados)
export const TIER_3_BUYERS: Buyer[] = [
  {
    id: 'acos_fm_t3',
    name: 'AÇOS FM',
    description: 'Loja de armas e materiais de construção',
    emoji: '🔧',
    priceMultiplier: 1.40,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 16,
    orders: [
      { productId: 'armas', quantity: 2, pricePerUnit: 4414.41 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 },
      { productId: 'ferramentas', quantity: 20, pricePerUnit: 88.35 },
      { productId: 'pneus', quantity: 12, pricePerUnit: 129.90 },
      { productId: 'pecas_carros', quantity: 10, pricePerUnit: 155.52 },
      { productId: 'marlboro', quantity: 50, pricePerUnit: 21.09 },
      { productId: 'smirnoffa', quantity: 40, pricePerUnit: 30.45 },
      { productId: 'pods', quantity: 75, pricePerUnit: 16.28 },
      { productId: 'perfumes', quantity: 20, pricePerUnit: 48.83 },
      { productId: 'tenis_mike', quantity: 12, pricePerUnit: 117.45 },
      { productId: 'camiseta_peruana', quantity: 30, pricePerUnit: 30.45 },
      { productId: 'bobigude', quantity: 50, pricePerUnit: 28.29 },
      { productId: 'starlinks', quantity: 4, pricePerUnit: 1077.75 },
      { productId: 'prensadao', quantity: 8, pricePerUnit: 1458.00 },
      { productId: 'escama', quantity: 6, pricePerUnit: 2916.00 }
    ]
  },
  {
    id: 'naldao_agropecuaria_t3',
    name: 'Naldao agropecuária',
    description: 'Agropecuária com armas e eletrônicos',
    emoji: '🚜',
    priceMultiplier: 1.40,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 17,
    orders: [
      { productId: 'armas', quantity: 1, pricePerUnit: 4244.63 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1215.00 },
      { productId: 'ferramentas', quantity: 18, pricePerUnit: 73.08 },
      { productId: 'pneus', quantity: 10, pricePerUnit: 114.00 },
      { productId: 'pecas_carros', quantity: 8, pricePerUnit: 136.80 },
      { productId: 'marlboro', quantity: 45, pricePerUnit: 19.32 },
      { productId: 'smirnoffa', quantity: 35, pricePerUnit: 26.25 },
      { productId: 'pods', quantity: 65, pricePerUnit: 14.28 },
      { productId: 'perfumes', quantity: 16, pricePerUnit: 42.84 },
      { productId: 'tenis_mike', quantity: 10, pricePerUnit: 103.32 },
      { productId: 'camiseta_peruana', quantity: 25, pricePerUnit: 26.73 },
      { productId: 'bobigude', quantity: 40, pricePerUnit: 24.84 },
      { productId: 'starlinks', quantity: 3, pricePerUnit: 945.00 },
      { productId: 'prensadao', quantity: 6, pricePerUnit: 1278.60 },
      { productId: 'escama', quantity: 4, pricePerUnit: 2557.20 }
    ]
  },
  {
    id: 'corujinha_pesca_t3',
    name: 'corujinha pesca',
    description: 'Loja de pesca com armas e eletrônicos',
    emoji: '🎣',
    priceMultiplier: 1.35,
    reliability: 'baixa',
    tier: 3,
    minCompletedOrders: 18,
    orders: [
      { productId: 'armas', quantity: 1, pricePerUnit: 4074.84 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 },
      { productId: 'ferramentas', quantity: 15, pricePerUnit: 82.35 },
      { productId: 'pneus', quantity: 8, pricePerUnit: 121.50 },
      { productId: 'pecas_carros', quantity: 6, pricePerUnit: 145.80 },
      { productId: 'marlboro', quantity: 40, pricePerUnit: 20.58 },
      { productId: 'smirnoffa', quantity: 30, pricePerUnit: 28.13 },
      { productId: 'pods', quantity: 55, pricePerUnit: 15.23 },
      { productId: 'perfumes', quantity: 14, pricePerUnit: 45.68 },
      { productId: 'tenis_mike', quantity: 8, pricePerUnit: 110.25 },
      { productId: 'camiseta_peruana', quantity: 22, pricePerUnit: 28.58 },
      { productId: 'bobigude', quantity: 35, pricePerUnit: 26.55 },
      { productId: 'starlinks', quantity: 2, pricePerUnit: 1012.50 },
      { productId: 'prensadao', quantity: 5, pricePerUnit: 1366.88 },
      { productId: 'escama', quantity: 3, pricePerUnit: 2733.75 }
    ]
  },
  {
    id: 'mercadinho_pessoa_t3',
    name: 'mercadinho Pessoa',
    description: 'Mercadinho com brinquedos, cigarros e bebidas',
    emoji: '🏪',
    priceMultiplier: 1.30,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 19,
    orders: [
      { productId: 'marlboro', quantity: 8, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 10, pricePerUnit: 25.00 },
      { productId: 'bobigude', quantity: 45, pricePerUnit: 26.73 },
      { productId: 'pods', quantity: 60, pricePerUnit: 13.59 },
      { productId: 'perfumes', quantity: 18, pricePerUnit: 42.08 },
      { productId: 'camiseta_peruana', quantity: 28, pricePerUnit: 26.73 },
      { productId: 'tenis_mike', quantity: 12, pricePerUnit: 103.23 },
      { productId: 'celulares', quantity: 3, pricePerUnit: 1463.25 },
      { productId: 'ferramentas', quantity: 12, pricePerUnit: 75.53 },
      { productId: 'pecas_carros', quantity: 9, pricePerUnit: 151.06 },
      { productId: 'pneus', quantity: 7, pricePerUnit: 118.35 },
      { productId: 'starlinks', quantity: 2, pricePerUnit: 945.75 },
      { productId: 'armas', quantity: 1, pricePerUnit: 4159.13 }
    ]
  },
  {
    id: 'najupsx_variedades_t3',
    name: 'Najupsx variedades',
    description: 'Loja de variedades com brinquedos, perfumes, cremes e roupas',
    emoji: '🛍️',
    priceMultiplier: 1.33,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 20,
    orders: [
      { productId: 'perfumes', quantity: 5, pricePerUnit: 34.65 },
      { productId: 'camiseta_peruana', quantity: 6, pricePerUnit: 27.72 }
    ]
  },
  {
    id: 'colombiano_baixada_t3',
    name: 'colombiano da baixada',
    description: 'Distribuidor geral - todas as categorias',
    emoji: '🌎',
    priceMultiplier: 1.95,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 21,
    orders: [
      { productId: 'marlboro', quantity: 15, pricePerUnit: 17.33 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1273.96 },
      { productId: 'perfumes', quantity: 8, pricePerUnit: 38.12 },
      { productId: 'armas', quantity: 1, pricePerUnit: 4669.67 },
      { productId: 'camiseta_peruana', quantity: 10, pricePerUnit: 30.03 }
    ]
  },
  {
    id: 'sparta_tech_t3',
    name: 'sparta tech',
    description: 'Loja de eletrônicos e brinquedos',
    emoji: '💻',
    priceMultiplier: 1.40,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 22,
    orders: [
      { productId: 'celulares', quantity: 3, pricePerUnit: 1231.23 }
    ]
  },
  {
    id: 'yp_outlet_t3',
    name: 'yp outlet',
    description: 'Outlet de perfumes, roupas e calçados',
    emoji: '👕',
    priceMultiplier: 1.32,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 23,
    orders: [
      { productId: 'perfumes', quantity: 6, pricePerUnit: 34.00 },
      { productId: 'camiseta_peruana', quantity: 8, pricePerUnit: 25.41 },
      { productId: 'tenis_mike', quantity: 4, pricePerUnit: 106.26 }
    ]
  },
  {
    id: 'goianesia_importados_t3',
    name: 'Goianésia importados',
    description: 'Importadora geral - todas as categorias',
    emoji: '📦',
    priceMultiplier: 1.55,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 24,
    orders: [
      { productId: 'celulares', quantity: 4, pricePerUnit: 1358.28 },
      { productId: 'perfumes', quantity: 10, pricePerUnit: 40.43 },
      { productId: 'marlboro', quantity: 20, pricePerUnit: 18.48 },
      { productId: '762_parafal', quantity: 1, pricePerUnit: 4499.88 },
      { productId: 'patinete_eletrico', quantity: 1, pricePerUnit: 3900.00 },
      { productId: 'camiseta_peruana', quantity: 12, pricePerUnit: 30.03 }
    ]
  },
  {
    id: 'ze_baxinho_t3',
    name: 'zé baxinho',
    description: 'Distribuidor de bebidas, cigarros e eletrônicos',
    emoji: '🍺',
    priceMultiplier: 1.30,
    reliability: 'baixa',
    tier: 3,
    minCompletedOrders: 25,
    orders: [
      { productId: 'marlboro', quantity: 12, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 15, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 }
    ]
  },
  {
    id: 'cerveja_cia_t3',
    name: 'cerveja e cia',
    description: 'Distribuidora de bebidas, cigarros e eletrônicos',
    emoji: '🍻',
    priceMultiplier: 1.28,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 26,
    orders: [
      { productId: 'marlboro', quantity: 18, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 20, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1215.00 }
    ]
  },
  {
    id: 'so_festas_t3',
    name: 'só festas',
    description: 'Loja de festas com bebidas, cigarros e eletrônicos',
    emoji: '🎉',
    priceMultiplier: 1.32,
    reliability: 'baixa',
    tier: 3,
    minCompletedOrders: 27,
    orders: [
      { productId: 'marlboro', quantity: 15, pricePerUnit: 17.00 },
      { productId: 'smirnoffa', quantity: 12, pricePerUnit: 25.00 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1215.00 }
    ]
  },
  {
    id: 'disk_zoio_t3',
    name: 'disk do zoio',
    description: 'Delivery de bebidas, cigarros e eletrônicos',
    emoji: '👁️',
    priceMultiplier: 1.55,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 28,
    orders: [
      { productId: 'marlboro', quantity: 30, pricePerUnit: 18.48 },
      { productId: 'celulares', quantity: 4, pricePerUnit: 1337.49 },
      { productId: 'smirnoffa', quantity: 35, pricePerUnit: 27.72 },
      { productId: 'tv_80_pl', quantity: 1, pricePerUnit: 9416.25 }
    ]
  },
  {
    id: 'pinguins_distribuidora_t3',
    name: 'Pinguins Distribuidora',
    description: 'Grande distribuidora de bebidas, cigarros e eletrônicos',
    emoji: '🐧',
    priceMultiplier: 1.27,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 29,
    orders: [
      { productId: 'marlboro', quantity: 60, pricePerUnit: 17.00 },
      { productId: 'celulares', quantity: 10, pricePerUnit: 1215.00 },
      { productId: 'smirnoffa', quantity: 40, pricePerUnit: 25.00 }
    ]
  },
  {
    id: 'revisa_autocenter_t3',
    name: 'revisa autocenter',
    description: 'Oficina especializada em peças de carro e pneus',
    emoji: '🔧',
    priceMultiplier: 1.55,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 30,
    orders: [
      { productId: 'pneus', quantity: 2, pricePerUnit: 142.5 },
      { productId: 'pecas_carros', quantity: 1, pricePerUnit: 167.48 },
      { productId: 'ferramentas', quantity: 2, pricePerUnit: 100.49 },
      { productId: 'celulares', quantity: 2, pricePerUnit: 1375.61 }
    ]
  }
];

// Tier 4: Compradores elite (31+ pedidos completados)
export const TIER_4_BUYERS: Buyer[] = [
  {
    id: 'fonseca_mecanica_t4',
    name: 'Fonseca mecânica',
    description: 'Mecânica com peças de carro e pneus',
    emoji: '🚗',
    priceMultiplier: 1.40,
    reliability: 'média',
    tier: 4,
    minCompletedOrders: 31,
    orders: [
      { productId: 'pecas_carros', quantity: 2, pricePerUnit: 161.7 },
      { productId: 'ferramentas', quantity: 3, pricePerUnit: 101.64 },
      { productId: 'celulares', quantity: 1, pricePerUnit: 1221.99 }
    ]
  },
  {
    id: 'catitu_t4',
    name: 'catítu',
    description: 'Distribuidor especializado em ilícitos e armas',
    emoji: '🦎',
    priceMultiplier: 2.10,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 33,
    orders: [
      { productId: 'prensadao', quantity: 10, pricePerUnit: 356.9 },
      { productId: 'escama', quantity: 15, pricePerUnit: 161.7 },
      { productId: 'glock_g19', quantity: 2, pricePerUnit: 4881.03 },
      { productId: '38_bulldog', quantity: 1, pricePerUnit: 4950.00 }
    ]
  },
  {
    id: 'vaguinho_t4',
    name: 'Vaguinho',
    description: 'Comerciante de ilícitos e armas',
    emoji: '🔫',
    priceMultiplier: 1.95,
    reliability: 'média',
    tier: 4,
    minCompletedOrders: 35,
    orders: [
      { productId: 'prensadao', quantity: 8, pricePerUnit: 339.57 },
      { productId: 'escama', quantity: 12, pricePerUnit: 152.46 },
      { productId: '357_magnum', quantity: 1, pricePerUnit: 4584.2 },
      { productId: '762_parafal', quantity: 1, pricePerUnit: 4700.00 }
    ]
  },
  {
    id: 'parrudo_t4',
    name: 'parrudo',
    description: 'Comerciante de ilícitos e armas',
    emoji: '💪',
    priceMultiplier: 1.70,
    reliability: 'baixa',
    tier: 4,
    minCompletedOrders: 37,
    orders: [
      { productId: 'prensadao', quantity: 6, pricePerUnit: 314.16 },
      { productId: 'escama', quantity: 8, pricePerUnit: 139.76 },
      { productId: 'glock_g19', quantity: 1, pricePerUnit: 4330.1 },
      { productId: '38_bulldog', quantity: 1, pricePerUnit: 4400.00 }
    ]
  },
  {
    id: 'catitu_disfarçado_t4',
    name: 'catitu disfarçado',
    description: 'Operação discreta de ilícitos e armas',
    emoji: '🥸',
    priceMultiplier: 2.10,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 40,
    orders: [
      { productId: 'prensadao', quantity: 12, pricePerUnit: 382.31 },
      { productId: 'escama', quantity: 18, pricePerUnit: 169.79 },
      { productId: '762_parafal', quantity: 1, pricePerUnit: 5093.55 }
    ]
  },
  {
    id: 'bacarau_t4',
    name: 'bacarau',
    description: 'Traficante especializado em ilícitos e armas',
    emoji: '🦅',
    priceMultiplier: 1.75,
    reliability: 'média',
    tier: 4,
    minCompletedOrders: 43,
    orders: [
      { productId: 'prensadao', quantity: 7, pricePerUnit: 328.02 },
      { productId: 'escama', quantity: 10, pricePerUnit: 149 },
      { productId: 'glock_g19', quantity: 1, pricePerUnit: 4753.98 },
      { productId: 'patinete_eletrico', quantity: 1, pricePerUnit: 4100.00 }
    ]
  },
  {
    id: 'divino_pedeboi_t4',
    name: 'divino pédeboi',
    description: 'Grande distribuidor de ilícitos e armas da região',
    emoji: '🐂',
    priceMultiplier: 2.40,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 45,
    orders: [
      { productId: 'prensadao', quantity: 20, pricePerUnit: 407.72 },
      { productId: 'escama', quantity: 25, pricePerUnit: 179.03 },
      { productId: '357_magnum', quantity: 2, pricePerUnit: 5263.34 },
      { productId: '762_parafal', quantity: 1, pricePerUnit: 5400.00 },
      { productId: 'tv_80_pl', quantity: 1, pricePerUnit: 14580.00 }
    ]
  }
];

// Compradores especializados em produtos ilícitos avançados
export const ILLICIT_SPECIALISTS: Buyer[] = [
  {
    id: 'pedro_felix',
    name: 'Pedro Felix',
    description: 'Especialista em produtos farmacêuticos ilícitos',
    emoji: '👨‍⚕️',
    priceMultiplier: 1.85,
    reliability: 'alta',
    tier: 3,
    minCompletedOrders: 20,
    orders: [
      { productId: 'nobesio_extra_forte', quantity: 3, pricePerUnit: 875.05 },
      { productId: 'tadalafila', quantity: 5, pricePerUnit: 699.3 },
      { productId: 'md_rosa', quantity: 2, pricePerUnit: 1048.95 }
    ]
  },
  {
    id: 'gui_henrique',
    name: 'Gui Henrique',
    description: 'Distribuidor de substâncias sintéticas',
    emoji: '🧪',
    priceMultiplier: 1.75,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 18,
    orders: [
      { productId: 'md_rosa', quantity: 4, pricePerUnit: 992.25 },
      { productId: 'bala', quantity: 6, pricePerUnit: 756 },
      { productId: 'ice_weed', quantity: 2, pricePerUnit: 1181.25 }
    ]
  },
  {
    id: 'will_carlos',
    name: 'Will Carlos',
    description: 'Comerciante de produtos premium',
    emoji: '💎',
    priceMultiplier: 2.20,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 30,
    orders: [
      { productId: 'ice_weed', quantity: 5, pricePerUnit: 1485 },
      { productId: 'nobesio_extra_forte', quantity: 4, pricePerUnit: 1040.6 },
      { productId: 'tadalafila', quantity: 3, pricePerUnit: 831.6 }
    ]
  },
  {
    id: 'bruno_soares',
    name: 'Bruno Soares',
    description: 'Fornecedor de festas e eventos',
    emoji: '🎉',
    priceMultiplier: 1.90,
    reliability: 'média',
    tier: 3,
    minCompletedOrders: 22,
    orders: [
      { productId: 'bala', quantity: 8, pricePerUnit: 820.8 },
      { productId: 'md_rosa', quantity: 3, pricePerUnit: 1077.3 },
      { productId: 'ice_weed', quantity: 1, pricePerUnit: 1282.5 }
    ]
  },
  {
    id: 'nathan_max',
    name: 'Nathan Max',
    description: 'Operador de mercado negro',
    emoji: '🕴️',
    priceMultiplier: 2.05,
    reliability: 'baixa',
    tier: 4,
    minCompletedOrders: 35,
    orders: [
      { productId: 'nobesio_extra_forte', quantity: 6, pricePerUnit: 969.65 },
      { productId: 'tadalafila', quantity: 8, pricePerUnit: 774.9 },
      { productId: 'bala', quantity: 4, pricePerUnit: 885.6 }
    ]
  },
  {
    id: 'felipe_castro',
    name: 'Felipe Castro',
    description: 'Distribuidor de alta qualidade',
    emoji: '⭐',
    priceMultiplier: 2.35,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 40,
    orders: [
      { productId: 'ice_weed', quantity: 7, pricePerUnit: 1586.25 },
      { productId: 'md_rosa', quantity: 5, pricePerUnit: 1332.45 },
      { productId: 'nobesio_extra_forte', quantity: 2, pricePerUnit: 1111.55 }
    ]
  },
  {
    id: 'michael_calheiro',
    name: 'Michael Calheiro',
    description: 'Chefe de operações ilícitas',
    emoji: '👑',
    priceMultiplier: 2.50,
    reliability: 'alta',
    tier: 4,
    minCompletedOrders: 45,
    orders: [
      { productId: 'ice_weed', quantity: 10, pricePerUnit: 1687.5 },
      { productId: 'nobesio_extra_forte', quantity: 8, pricePerUnit: 1182.5 },
      { productId: 'tadalafila', quantity: 12, pricePerUnit: 945 },
      { productId: 'md_rosa', quantity: 6, pricePerUnit: 1417.45 },
      { productId: 'bala', quantity: 10, pricePerUnit: 1080 }
    ]
  }
];

// Compradores VIP que aparecem após 8 pedidos completados (agora renomeados)
export const VIP_BUYERS: Buyer[] = [];

// Exportações dos arrays de tiers
// Manter compatibilidade com o array BUYERS original
export const BUYERS = TIER_3_BUYERS;