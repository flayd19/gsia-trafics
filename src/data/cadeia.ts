// =====================================================================
// cadeia.ts — Catálogo estático do jogo Cadeia
// Produtos, tipos de empresa, receitas, regiões, NPCs
// =====================================================================
import type {
  Product, CompanyTypeDef, Recipe, Region,
  CompanyTypeId, RegionId, CompanySize,
} from '@/types/cadeia';

// ── Regiões ───────────────────────────────────────────────────────────
export const REGIONS: Region[] = [
  { id: 'sul',          name: 'Sul',           icon: '🌲', description: 'Rica em grãos e indústria metalúrgica.' },
  { id: 'sudeste',      name: 'Sudeste',        icon: '🏙️', description: 'Centro financeiro. Alta demanda de combustível.' },
  { id: 'centro_oeste', name: 'Centro-Oeste',   icon: '🌾', description: 'Maior produção agropecuária do país.' },
  { id: 'nordeste',     name: 'Nordeste',        icon: '🌊', description: 'Polo de crescimento, alta demanda de construção.' },
  { id: 'norte',        name: 'Norte',           icon: '🌿', description: 'Rica em minério. Logística desafiadora.' },
];

// ── Produtos ──────────────────────────────────────────────────────────
export const PRODUCTS: Product[] = [
  // Matérias-primas
  {
    id: 'minerio_ferro', name: 'Minério de Ferro', icon: '⛏️',
    category: 'materia_prima', unit: 'tonelada', basePrice: 200,
    description: 'Matéria-prima para siderúrgicas.',
  },
  {
    id: 'petroleo_bruto', name: 'Petróleo Bruto', icon: '🛢️',
    category: 'materia_prima', unit: 'barril', basePrice: 400,
    description: 'Insumo para refinarias.',
  },
  {
    id: 'graos', name: 'Grãos', icon: '🌾',
    category: 'materia_prima', unit: 'tonelada', basePrice: 1_500,
    description: 'Matéria-prima para moinhos.',
  },
  // Intermediários
  {
    id: 'aco', name: 'Aço', icon: '🔩',
    category: 'intermediario', unit: 'tonelada', basePrice: 450,
    description: 'Produto da siderúrgica. Base para parafusos e vergalhão.',
  },
  {
    id: 'vergalhao', name: 'Vergalhão', icon: '🏗️',
    category: 'intermediario', unit: 'tonelada', basePrice: 600,
    description: 'Aço em vergalhão. Vendido em lojas de construção.',
  },
  {
    id: 'farinha', name: 'Farinha', icon: '🌫️',
    category: 'intermediario', unit: 'tonelada', basePrice: 2_500,
    description: 'Produto do moinho. Insumo para indústria alimentícia.',
  },
  // Manufaturados
  {
    id: 'parafusos', name: 'Parafusos', icon: '🔧',
    category: 'manufaturado', unit: 'caixa', basePrice: 80,
    description: 'Alta margem. Vendido em lojas de construção.',
  },
  // Combustíveis
  {
    id: 'gasolina', name: 'Gasolina', icon: '⛽',
    category: 'combustivel', unit: 'litro', basePrice: 5.80,
    description: 'Produto da refinaria. Alta demanda em postos.',
  },
  {
    id: 'diesel', name: 'Diesel', icon: '🚛',
    category: 'combustivel', unit: 'litro', basePrice: 5.50,
    description: 'Insumo das frotas. Alta demanda permanente.',
  },
  // Alimentos
  {
    id: 'alimentos', name: 'Alimentos Prontos', icon: '🥫',
    category: 'alimento', unit: 'tonelada', basePrice: 4_000,
    description: 'Produto da indústria alimentícia. Vendido em mercados.',
  },
];

export function getProduct(id: string): Product {
  return PRODUCTS.find(p => p.id === id) ?? PRODUCTS[0]!;
}

// ── Tipos de Empresa ──────────────────────────────────────────────────
export const COMPANY_TYPES: CompanyTypeDef[] = [
  // ── Extração ──────────────────────────────────────────────────
  {
    id: 'mina_ferro', name: 'Mina de Ferro', icon: '⛏️',
    category: 'extracao',
    description: 'Extrai minério de ferro continuamente. Ciclo de 10 min.',
    acceptedProducts: ['minerio_ferro'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  80_000, storageCapacity:   500, operationalCostPerDay:   800 },
      { size: 'media',   baseCost: 200_000, storageCapacity: 1_200, operationalCostPerDay: 2_000 },
      { size: 'grande',  baseCost: 400_000, storageCapacity: 2_500, operationalCostPerDay: 4_500 },
    ],
  },
  {
    id: 'poco_petroleo', name: 'Poço de Petróleo', icon: '🛢️',
    category: 'extracao',
    description: 'Extrai petróleo bruto. Ciclo de 15 min.',
    acceptedProducts: ['petroleo_bruto'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost: 120_000, storageCapacity:  2_000, operationalCostPerDay: 1_200 },
      { size: 'media',   baseCost: 300_000, storageCapacity:  5_000, operationalCostPerDay: 3_000 },
      { size: 'grande',  baseCost: 600_000, storageCapacity: 10_000, operationalCostPerDay: 6_500 },
    ],
  },
  {
    id: 'fazenda_graos', name: 'Fazenda de Grãos', icon: '🌾',
    category: 'extracao',
    description: 'Produz grãos. Ciclo longo de 20 min.',
    acceptedProducts: ['graos'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  60_000, storageCapacity:   800, operationalCostPerDay:   600 },
      { size: 'media',   baseCost: 150_000, storageCapacity: 2_000, operationalCostPerDay: 1_500 },
      { size: 'grande',  baseCost: 300_000, storageCapacity: 4_000, operationalCostPerDay: 3_200 },
    ],
  },
  // ── Indústria ─────────────────────────────────────────────────
  {
    id: 'siderurgica', name: 'Siderúrgica', icon: '🏭',
    category: 'industria',
    description: 'Transforma minério em aço. Pode converter aço em vergalhão.',
    acceptedProducts: ['minerio_ferro', 'aco', 'vergalhao'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost: 100_000, storageCapacity:   300, operationalCostPerDay: 1_000 },
      { size: 'media',   baseCost: 250_000, storageCapacity:   750, operationalCostPerDay: 2_500 },
      { size: 'grande',  baseCost: 500_000, storageCapacity: 1_500, operationalCostPerDay: 5_500 },
    ],
  },
  {
    id: 'refinaria', name: 'Refinaria', icon: '🔥',
    category: 'industria',
    description: 'Refina petróleo em gasolina e diesel. Ciclo de 8 min.',
    acceptedProducts: ['petroleo_bruto', 'gasolina', 'diesel'],
    minLevel: 3,
    sizes: [
      { size: 'pequena', baseCost: 150_000, storageCapacity: 10_000, operationalCostPerDay: 1_500 },
      { size: 'media',   baseCost: 375_000, storageCapacity: 25_000, operationalCostPerDay: 3_800 },
      { size: 'grande',  baseCost: 750_000, storageCapacity: 50_000, operationalCostPerDay: 8_000 },
    ],
  },
  {
    id: 'moinho', name: 'Moinho', icon: '🌀',
    category: 'industria',
    description: 'Transforma grãos em farinha. Ciclo de 5 min.',
    acceptedProducts: ['graos', 'farinha'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  50_000, storageCapacity:   400, operationalCostPerDay:   500 },
      { size: 'media',   baseCost: 125_000, storageCapacity: 1_000, operationalCostPerDay: 1_250 },
      { size: 'grande',  baseCost: 250_000, storageCapacity: 2_000, operationalCostPerDay: 2_800 },
    ],
  },
  {
    id: 'fabrica_parafusos', name: 'Fábrica de Parafusos', icon: '🔩',
    category: 'industria',
    description: 'Transforma aço em parafusos de alta margem. Ciclo de 5 min.',
    acceptedProducts: ['aco', 'parafusos'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost:  70_000, storageCapacity: 5_000, operationalCostPerDay:   700 },
      { size: 'media',   baseCost: 175_000, storageCapacity:10_000, operationalCostPerDay: 1_750 },
      { size: 'grande',  baseCost: 350_000, storageCapacity:20_000, operationalCostPerDay: 3_800 },
    ],
  },
  {
    id: 'industria_alimenticia', name: 'Indústria Alimentícia', icon: '🏗️',
    category: 'industria',
    description: 'Transforma farinha em alimentos prontos. Ciclo de 8 min.',
    acceptedProducts: ['farinha', 'alimentos'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost:  90_000, storageCapacity:   400, operationalCostPerDay:   900 },
      { size: 'media',   baseCost: 225_000, storageCapacity: 1_000, operationalCostPerDay: 2_250 },
      { size: 'grande',  baseCost: 450_000, storageCapacity: 2_000, operationalCostPerDay: 5_000 },
    ],
  },
  // ── Logística ─────────────────────────────────────────────────
  {
    id: 'frota_pesada', name: 'Frota Carga Pesada', icon: '🚚',
    category: 'logistica',
    description: 'Transporta ferro, aço e parafusos. Renda passiva por demanda regional.',
    acceptedProducts: ['minerio_ferro', 'aco', 'vergalhao', 'parafusos'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost:  80_000, storageCapacity: 0, operationalCostPerDay:   800 },
      { size: 'media',   baseCost: 200_000, storageCapacity: 0, operationalCostPerDay: 2_000 },
      { size: 'grande',  baseCost: 400_000, storageCapacity: 0, operationalCostPerDay: 4_500 },
    ],
  },
  {
    id: 'frota_tanque', name: 'Frota Tanque', icon: '🚛',
    category: 'logistica',
    description: 'Transporta petróleo, gasolina e diesel.',
    acceptedProducts: ['petroleo_bruto', 'gasolina', 'diesel'],
    minLevel: 2,
    sizes: [
      { size: 'pequena', baseCost:  60_000, storageCapacity: 0, operationalCostPerDay:   600 },
      { size: 'media',   baseCost: 150_000, storageCapacity: 0, operationalCostPerDay: 1_500 },
      { size: 'grande',  baseCost: 300_000, storageCapacity: 0, operationalCostPerDay: 3_300 },
    ],
  },
  {
    id: 'frota_granel', name: 'Frota Granel', icon: '🚜',
    category: 'logistica',
    description: 'Transporta grãos e farinha.',
    acceptedProducts: ['graos', 'farinha'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  50_000, storageCapacity: 0, operationalCostPerDay:   500 },
      { size: 'media',   baseCost: 125_000, storageCapacity: 0, operationalCostPerDay: 1_250 },
      { size: 'grande',  baseCost: 250_000, storageCapacity: 0, operationalCostPerDay: 2_800 },
    ],
  },
  {
    id: 'frota_bau', name: 'Frota Baú', icon: '📦',
    category: 'logistica',
    description: 'Transporta alimentos prontos e produtos embalados.',
    acceptedProducts: ['alimentos'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  45_000, storageCapacity: 0, operationalCostPerDay:   450 },
      { size: 'media',   baseCost: 112_000, storageCapacity: 0, operationalCostPerDay: 1_125 },
      { size: 'grande',  baseCost: 225_000, storageCapacity: 0, operationalCostPerDay: 2_500 },
    ],
  },
  // ── Varejo ────────────────────────────────────────────────────
  {
    id: 'loja_construcao', name: 'Loja de Construção', icon: '🏪',
    category: 'varejo',
    description: 'Vende vergalhão e parafusos ao consumidor final.',
    acceptedProducts: ['vergalhao', 'parafusos'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  40_000, storageCapacity:   500, operationalCostPerDay:   400 },
      { size: 'media',   baseCost: 100_000, storageCapacity: 1_200, operationalCostPerDay: 1_000 },
      { size: 'grande',  baseCost: 200_000, storageCapacity: 2_500, operationalCostPerDay: 2_200 },
    ],
  },
  {
    id: 'mercado_varejo', name: 'Mercado', icon: '🛒',
    category: 'varejo',
    description: 'Vende alimentos prontos ao consumidor. Alta rotatividade.',
    acceptedProducts: ['alimentos'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  35_000, storageCapacity:   300, operationalCostPerDay:   350 },
      { size: 'media',   baseCost:  87_000, storageCapacity:   750, operationalCostPerDay:   875 },
      { size: 'grande',  baseCost: 175_000, storageCapacity: 1_500, operationalCostPerDay: 1_950 },
    ],
  },
  {
    id: 'posto_combustivel', name: 'Posto de Combustível', icon: '⛽',
    category: 'varejo',
    description: 'Vende gasolina e diesel. Única fonte de combustível para NPCs.',
    acceptedProducts: ['gasolina', 'diesel'],
    minLevel: 1,
    sizes: [
      { size: 'pequena', baseCost:  25_000, storageCapacity: 20_000, operationalCostPerDay:   250 },
      { size: 'media',   baseCost:  62_000, storageCapacity: 50_000, operationalCostPerDay:   625 },
      { size: 'grande',  baseCost: 125_000, storageCapacity:100_000, operationalCostPerDay: 1_400 },
    ],
  },
];

export function getCompanyType(id: CompanyTypeId): CompanyTypeDef {
  return COMPANY_TYPES.find(c => c.id === id) ?? COMPANY_TYPES[0]!;
}

export function getSizeVariant(typeId: CompanyTypeId, size: CompanySize) {
  const def = getCompanyType(typeId);
  return def.sizes.find(s => s.size === size) ?? def.sizes[0]!;
}

// ── Receitas de Produção ──────────────────────────────────────────────
// Tempos em minutos reais. ProductionCostPerBatch debitado do capital da empresa.
export const RECIPES: Recipe[] = [
  // ── Mina de Ferro ──────────────────────────────────────────────
  {
    id: 'extracao_minerio_pequena', companyTypeId: 'mina_ferro', companySize: 'pequena',
    name: 'Extração de Minério (P)',
    inputs: [], outputs: [{ productId: 'minerio_ferro', quantity: 50 }],
    durationMin: 10, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_minerio_media', companyTypeId: 'mina_ferro', companySize: 'media',
    name: 'Extração de Minério (M)',
    inputs: [], outputs: [{ productId: 'minerio_ferro', quantity: 125 }],
    durationMin: 10, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_minerio_grande', companyTypeId: 'mina_ferro', companySize: 'grande',
    name: 'Extração de Minério (G)',
    inputs: [], outputs: [{ productId: 'minerio_ferro', quantity: 250 }],
    durationMin: 10, productionCostPerBatch: 0,
  },

  // ── Poço de Petróleo ──────────────────────────────────────────
  {
    id: 'extracao_petroleo_pequena', companyTypeId: 'poco_petroleo', companySize: 'pequena',
    name: 'Extração de Petróleo (P)',
    inputs: [], outputs: [{ productId: 'petroleo_bruto', quantity: 200 }],
    durationMin: 15, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_petroleo_media', companyTypeId: 'poco_petroleo', companySize: 'media',
    name: 'Extração de Petróleo (M)',
    inputs: [], outputs: [{ productId: 'petroleo_bruto', quantity: 500 }],
    durationMin: 15, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_petroleo_grande', companyTypeId: 'poco_petroleo', companySize: 'grande',
    name: 'Extração de Petróleo (G)',
    inputs: [], outputs: [{ productId: 'petroleo_bruto', quantity: 1_000 }],
    durationMin: 15, productionCostPerBatch: 0,
  },

  // ── Fazenda de Grãos ──────────────────────────────────────────
  {
    id: 'extracao_graos_pequena', companyTypeId: 'fazenda_graos', companySize: 'pequena',
    name: 'Colheita de Grãos (P)',
    inputs: [], outputs: [{ productId: 'graos', quantity: 10 }],
    durationMin: 20, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_graos_media', companyTypeId: 'fazenda_graos', companySize: 'media',
    name: 'Colheita de Grãos (M)',
    inputs: [], outputs: [{ productId: 'graos', quantity: 25 }],
    durationMin: 20, productionCostPerBatch: 0,
  },
  {
    id: 'extracao_graos_grande', companyTypeId: 'fazenda_graos', companySize: 'grande',
    name: 'Colheita de Grãos (G)',
    inputs: [], outputs: [{ productId: 'graos', quantity: 50 }],
    durationMin: 20, productionCostPerBatch: 0,
  },

  // ── Siderúrgica — Aço ─────────────────────────────────────────
  {
    id: 'siderurgia_aco_pequena', companyTypeId: 'siderurgica', companySize: 'pequena',
    name: 'Fundição de Aço (P)',
    inputs: [{ productId: 'minerio_ferro', quantity: 10 }],
    outputs: [{ productId: 'aco', quantity: 7 }],
    durationMin: 5, productionCostPerBatch: 300,
  },
  {
    id: 'siderurgia_aco_media', companyTypeId: 'siderurgica', companySize: 'media',
    name: 'Fundição de Aço (M)',
    inputs: [{ productId: 'minerio_ferro', quantity: 25 }],
    outputs: [{ productId: 'aco', quantity: 18 }],
    durationMin: 5, productionCostPerBatch: 750,
  },
  {
    id: 'siderurgia_aco_grande', companyTypeId: 'siderurgica', companySize: 'grande',
    name: 'Fundição de Aço (G)',
    inputs: [{ productId: 'minerio_ferro', quantity: 50 }],
    outputs: [{ productId: 'aco', quantity: 35 }],
    durationMin: 5, productionCostPerBatch: 1_500,
  },

  // ── Siderúrgica — Vergalhão ───────────────────────────────────
  {
    id: 'siderurgia_vergalhao_pequena', companyTypeId: 'siderurgica', companySize: 'pequena',
    name: 'Laminação Vergalhão (P)',
    inputs: [{ productId: 'aco', quantity: 5 }],
    outputs: [{ productId: 'vergalhao', quantity: 4 }],
    durationMin: 5, productionCostPerBatch: 200,
  },
  {
    id: 'siderurgia_vergalhao_media', companyTypeId: 'siderurgica', companySize: 'media',
    name: 'Laminação Vergalhão (M)',
    inputs: [{ productId: 'aco', quantity: 12 }],
    outputs: [{ productId: 'vergalhao', quantity: 10 }],
    durationMin: 5, productionCostPerBatch: 500,
  },
  {
    id: 'siderurgia_vergalhao_grande', companyTypeId: 'siderurgica', companySize: 'grande',
    name: 'Laminação Vergalhão (G)',
    inputs: [{ productId: 'aco', quantity: 25 }],
    outputs: [{ productId: 'vergalhao', quantity: 20 }],
    durationMin: 5, productionCostPerBatch: 1_000,
  },

  // ── Refinaria ─────────────────────────────────────────────────
  {
    id: 'refino_combustivel_pequena', companyTypeId: 'refinaria', companySize: 'pequena',
    name: 'Refino de Petróleo (P)',
    inputs: [{ productId: 'petroleo_bruto', quantity: 50 }],
    outputs: [
      { productId: 'gasolina', quantity: 2_800 },
      { productId: 'diesel',   quantity: 1_000 },
    ],
    durationMin: 8, productionCostPerBatch: 500,
  },
  {
    id: 'refino_combustivel_media', companyTypeId: 'refinaria', companySize: 'media',
    name: 'Refino de Petróleo (M)',
    inputs: [{ productId: 'petroleo_bruto', quantity: 125 }],
    outputs: [
      { productId: 'gasolina', quantity: 7_000 },
      { productId: 'diesel',   quantity: 2_500 },
    ],
    durationMin: 8, productionCostPerBatch: 1_250,
  },
  {
    id: 'refino_combustivel_grande', companyTypeId: 'refinaria', companySize: 'grande',
    name: 'Refino de Petróleo (G)',
    inputs: [{ productId: 'petroleo_bruto', quantity: 250 }],
    outputs: [
      { productId: 'gasolina', quantity: 14_000 },
      { productId: 'diesel',   quantity: 5_000 },
    ],
    durationMin: 8, productionCostPerBatch: 2_500,
  },

  // ── Moinho ────────────────────────────────────────────────────
  {
    id: 'moagem_graos_pequena', companyTypeId: 'moinho', companySize: 'pequena',
    name: 'Moagem de Grãos (P)',
    inputs: [{ productId: 'graos', quantity: 5 }],
    outputs: [{ productId: 'farinha', quantity: 4 }],
    durationMin: 5, productionCostPerBatch: 500,
  },
  {
    id: 'moagem_graos_media', companyTypeId: 'moinho', companySize: 'media',
    name: 'Moagem de Grãos (M)',
    inputs: [{ productId: 'graos', quantity: 12 }],
    outputs: [{ productId: 'farinha', quantity: 10 }],
    durationMin: 5, productionCostPerBatch: 1_250,
  },
  {
    id: 'moagem_graos_grande', companyTypeId: 'moinho', companySize: 'grande',
    name: 'Moagem de Grãos (G)',
    inputs: [{ productId: 'graos', quantity: 25 }],
    outputs: [{ productId: 'farinha', quantity: 20 }],
    durationMin: 5, productionCostPerBatch: 2_500,
  },

  // ── Fábrica de Parafusos ──────────────────────────────────────
  {
    id: 'fabricacao_parafusos_pequena', companyTypeId: 'fabrica_parafusos', companySize: 'pequena',
    name: 'Fabricação de Parafusos (P)',
    inputs: [{ productId: 'aco', quantity: 5 }],
    outputs: [{ productId: 'parafusos', quantity: 200 }],
    durationMin: 5, productionCostPerBatch: 300,
  },
  {
    id: 'fabricacao_parafusos_media', companyTypeId: 'fabrica_parafusos', companySize: 'media',
    name: 'Fabricação de Parafusos (M)',
    inputs: [{ productId: 'aco', quantity: 12 }],
    outputs: [{ productId: 'parafusos', quantity: 500 }],
    durationMin: 5, productionCostPerBatch: 750,
  },
  {
    id: 'fabricacao_parafusos_grande', companyTypeId: 'fabrica_parafusos', companySize: 'grande',
    name: 'Fabricação de Parafusos (G)',
    inputs: [{ productId: 'aco', quantity: 25 }],
    outputs: [{ productId: 'parafusos', quantity: 1_000 }],
    durationMin: 5, productionCostPerBatch: 1_500,
  },

  // ── Indústria Alimentícia ─────────────────────────────────────
  {
    id: 'producao_alimentos_pequena', companyTypeId: 'industria_alimenticia', companySize: 'pequena',
    name: 'Processamento Alimentício (P)',
    inputs: [{ productId: 'farinha', quantity: 5 }],
    outputs: [{ productId: 'alimentos', quantity: 4 }],
    durationMin: 8, productionCostPerBatch: 1_000,
  },
  {
    id: 'producao_alimentos_media', companyTypeId: 'industria_alimenticia', companySize: 'media',
    name: 'Processamento Alimentício (M)',
    inputs: [{ productId: 'farinha', quantity: 12 }],
    outputs: [{ productId: 'alimentos', quantity: 10 }],
    durationMin: 8, productionCostPerBatch: 2_500,
  },
  {
    id: 'producao_alimentos_grande', companyTypeId: 'industria_alimenticia', companySize: 'grande',
    name: 'Processamento Alimentício (G)',
    inputs: [{ productId: 'farinha', quantity: 25 }],
    outputs: [{ productId: 'alimentos', quantity: 20 }],
    durationMin: 8, productionCostPerBatch: 5_000,
  },
];

export function getRecipesForCompany(typeId: CompanyTypeId, size?: CompanySize): Recipe[] {
  return RECIPES.filter(r =>
    r.companyTypeId === typeId && (size == null || r.companySize === size),
  );
}

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id);
}

// ── Nomes de Empresas NPC ────────────────────────────────────────────
const NPC_COMPANY_NAMES: Record<CompanyTypeId, string[]> = {
  mina_ferro:            ['Mineração Ouro Preto', 'Ferro Nacional LTDA', 'Minas do Vale SA'],
  poco_petroleo:         ['PetroBrasil NPC', 'Petro Sul SA', 'Óleo & Gás Nacional'],
  fazenda_graos:         ['Agro Center NPC', 'Grãos do Sul LTDA', 'Cooperativa Cerrado'],
  siderurgica:           ['Siderúrgica Nacional', 'AçoBR SA', 'MetalBase LTDA'],
  refinaria:             ['Refinaria Sul', 'PetroRefino SA', 'Combustível Nacional'],
  moinho:                ['Moinho Central NPC', 'Farinha & Cia', 'Grãos & Farinha SA'],
  fabrica_parafusos:     ['Parafusos Brasil NPC', 'MetalFix LTDA', 'Fixadores SA'],
  industria_alimenticia: ['AlimBR NPC', 'Comida & Cia', 'Alimentos do Brasil'],
  frota_pesada:          ['TransPeso NPC', 'Frete Nacional', 'Carga Pesada SA'],
  frota_tanque:          ['TransTanque NPC', 'Petro Frete LTDA', 'Combustível Frete'],
  frota_granel:          ['GraneliTransporte', 'Granel NPC', 'Agro Frete SA'],
  frota_bau:             ['TransBaú NPC', 'Entrega Rápida LTDA', 'Frete Alimentar'],
  loja_construcao:       ['Lojão NPC Construção', 'MatCon SA', 'Construir LTDA'],
  mercado_varejo:        ['MercadoNPC', 'Varejo Rápido SA', 'SuperMercado BR'],
  posto_combustivel:     ['Posto NPC Nacional', 'Combustível Express', 'Auto Posto SA'],
};

export function getNPCName(typeId: CompanyTypeId): string {
  const names = NPC_COMPANY_NAMES[typeId] ?? ['NPC Company'];
  return names[Math.floor(Math.random() * names.length)]!;
}

// ── Imposto Progressivo ───────────────────────────────────────────────
export function calcTaxRate(numCompanies: number): number {
  if (numCompanies <= 1) return 0.05;
  if (numCompanies === 2) return 0.08;
  if (numCompanies === 3) return 0.12;
  if (numCompanies === 4) return 0.17;
  if (numCompanies === 5) return 0.23;
  if (numCompanies === 6) return 0.30;
  return 0.38 + (numCompanies - 7) * 0.05;
}

export function calcTaxRateLabel(numCompanies: number): string {
  return `${Math.round(calcTaxRate(numCompanies) * 100)}%`;
}

// ── Renda base de logística por tipo e tamanho (R$/min enquanto ativa) ─
export const LOGISTICS_INCOME_PER_MIN: Record<string, Record<CompanySize, number>> = {
  frota_pesada:  { pequena: 180, media: 450, grande: 900 },
  frota_tanque:  { pequena: 150, media: 375, grande: 750 },
  frota_granel:  { pequena: 120, media: 300, grande: 600 },
  frota_bau:     { pequena: 100, media: 250, grande: 500 },
};

// ── Velocidade base de venda do varejo (unidades/hora no PMR) ─────────
export const RETAIL_BASE_VELOCITY_PER_HOUR: Record<string, Record<string, Record<CompanySize, number>>> = {
  loja_construcao: {
    vergalhao: { pequena: 2,   media: 5,   grande: 10  },   // t/h
    parafusos: { pequena: 300, media: 750, grande: 1500 },  // caixas/h
  },
  mercado_varejo: {
    alimentos: { pequena: 2,    media: 5,    grande: 10    }, // t/h
  },
  posto_combustivel: {
    gasolina:  { pequena: 2_000, media: 5_000, grande: 10_000 }, // L/h
    diesel:    { pequena: 800,   media: 2_000, grande:  4_000 }, // L/h
  },
};

export function getRegion(id: RegionId): Region {
  return REGIONS.find(r => r.id === id) ?? REGIONS[0]!;
}

// Returns the PMR price for a product/region pair; 0 if not found
export function getPMR(
  pmrList: import('@/types/cadeia').PMREntry[],
  productId: string,
  regionId: string,
): number {
  return pmrList.find(p => p.productId === productId && p.regionId === regionId)?.price ?? 0;
}
