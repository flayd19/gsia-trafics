// =====================================================================
// construction.ts — Dados estáticos do Simulador de Construtora
// Catálogo de funcionários, máquinas, materiais e gerador de licitações
// =====================================================================
import type {
  EmployeeType,
  MachineCategory,
  WorkType,
  WorkRequirements,
  Licitacao,
} from '@/types/game';

// ── Formatador ────────────────────────────────────────────────────────
export const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v);

// ══════════════════════════════════════════════════════════════════════
// FUNCIONÁRIOS
// ══════════════════════════════════════════════════════════════════════

export interface EmployeeTypeDef {
  type: EmployeeType;
  label: string;
  icon: string;
  description: string;
  /** m² produzidos por minuto (base, skill=100) */
  producaoBase: number;
  /** R$/min (base, skill=100) */
  custoBase: number;
  /** Custo de contratação (one-time) */
  hiringCost: number;
  /** Obrigatório para certos tipos de obra */
  isRequired: boolean;
  /** Nível mínimo para contratar */
  minLevel: number;
}

export const EMPLOYEE_TYPES: EmployeeTypeDef[] = [
  {
    type:        'ajudante',
    label:       'Ajudante',
    icon:        '👷',
    description: 'Mão de obra básica. Baixa produção, custo acessível.',
    producaoBase: 5.0,
    custoBase:    100,
    hiringCost:   500,
    isRequired:   false,
    minLevel:     1,
  },
  {
    type:        'pedreiro',
    label:       'Pedreiro',
    icon:        '🧱',
    description: 'Especialista em alvenaria. Produção 2×.',
    producaoBase: 10.0,
    custoBase:    300,
    hiringCost:   2_000,
    isRequired:   false,
    minLevel:     1,
  },
  {
    type:        'mestre',
    label:       'Mestre de Obra',
    icon:        '📐',
    description: 'Coordena a equipe. Concede +15% de bônus de produção geral.',
    producaoBase: 0,
    custoBase:    500,
    hiringCost:   3_000,
    isRequired:   false,
    minLevel:     2,
  },
  {
    type:        'engenheiro',
    label:       'Engenheiro',
    icon:        '🔧',
    description: 'Obrigatório em obras médias e grandes. 2 engenheiros = +10% de bônus.',
    producaoBase: 0,
    custoBase:    800,
    hiringCost:   10_000,
    isRequired:   true,
    minLevel:     3,
  },
  {
    type:        'seguranca',
    label:       'Segurança do Trabalho',
    icon:        '🦺',
    description: 'Requisito em obras grandes e mega. Reduz risco de falha.',
    producaoBase: 0,
    custoBase:    400,
    hiringCost:   2_500,
    isRequired:   true,
    minLevel:     4,
  },
];

export function getEmployeeTypeDef(type: EmployeeType): EmployeeTypeDef {
  return EMPLOYEE_TYPES.find(e => e.type === type) ?? EMPLOYEE_TYPES[0]!;
}

// Nomes aleatórios para funcionários
const EMPLOYEE_NAMES = [
  'Carlos Silva', 'João Pereira', 'Marcos Oliveira', 'Pedro Santos',
  'Ricardo Lima', 'Fernando Costa', 'José Souza', 'Paulo Ferreira',
  'André Rodrigues', 'Bruno Almeida', 'Diego Martins', 'Eduardo Nascimento',
  'Gabriel Castro', 'Henrique Moreira', 'Ivan Carvalho', 'Lucas Nunes',
  'Mateus Barbosa', 'Nathan Rocha', 'Otávio Dias', 'Rafael Gomes',
  'Samuel Ribeiro', 'Thiago Mendes', 'Vitor Cruz', 'William Araújo',
  'Alexandre Pinto', 'Bernardo Lopes', 'Caio Freitas', 'Davi Azevedo',
];

export function randomEmployeeName(): string {
  return EMPLOYEE_NAMES[Math.floor(Math.random() * EMPLOYEE_NAMES.length)]!;
}

// ══════════════════════════════════════════════════════════════════════
// MÁQUINAS
// ══════════════════════════════════════════════════════════════════════

export interface MachineTypeDef {
  typeId: string;
  name: string;
  icon: string;
  category: MachineCategory;
  /** R$/min custo operacional */
  costPerMin: number;
  /** Preço de compra (R$) */
  purchasePrice: number;
  /** Nível mínimo para comprar */
  minLevel: number;
  description: string;
}

export const MACHINE_CATALOG: MachineTypeDef[] = [
  // ── Terraplanagem ─────────────────────────────────────────────────
  {
    typeId: 'retroescavadeira', name: 'Retroescavadeira', icon: '🚜',
    category: 'terraplanagem', costPerMin: 200, purchasePrice: 120_000,
    minLevel: 1, description: 'Versátil. Escavação e carga.',
  },
  {
    typeId: 'escavadeira', name: 'Escavadeira Hidráulica', icon: '⛏️',
    category: 'terraplanagem', costPerMin: 300, purchasePrice: 180_000,
    minLevel: 2, description: 'Alta capacidade de escavação.',
  },
  {
    typeId: 'pa_carregadeira', name: 'Pá Carregadeira', icon: '🚧',
    category: 'terraplanagem', costPerMin: 250, purchasePrice: 150_000,
    minLevel: 2, description: 'Carregamento e transporte de material.',
  },
  {
    typeId: 'motoniveladora', name: 'Motoniveladora', icon: '🛤️',
    category: 'terraplanagem', costPerMin: 400, purchasePrice: 300_000,
    minLevel: 3, description: 'Nivelar terrenos com precisão.',
  },
  {
    typeId: 'rolo_compactador', name: 'Rolo Compactador', icon: '🛞',
    category: 'terraplanagem', costPerMin: 220, purchasePrice: 140_000,
    minLevel: 2, description: 'Compactação de solo e asfalto.',
  },
  // ── Estrutura ─────────────────────────────────────────────────────
  {
    typeId: 'guindaste_movel', name: 'Guindaste Móvel', icon: '🏗️',
    category: 'estrutura', costPerMin: 600, purchasePrice: 500_000,
    minLevel: 4, description: 'Içamento de cargas pesadas em obras.',
  },
  {
    typeId: 'guindaste_torre', name: 'Guindaste Torre', icon: '🗼',
    category: 'estrutura', costPerMin: 900, purchasePrice: 1_200_000,
    minLevel: 6, description: 'Para obras de grande altura.',
  },
  {
    typeId: 'munck', name: 'Caminhão Munck', icon: '🚛',
    category: 'estrutura', costPerMin: 350, purchasePrice: 250_000,
    minLevel: 3, description: 'Carga e descarga com braço articulado.',
  },
  {
    typeId: 'bomba_concreto', name: 'Bomba de Concreto', icon: '🪣',
    category: 'estrutura', costPerMin: 400, purchasePrice: 300_000,
    minLevel: 3, description: 'Lança concreto a grande distância.',
  },
  // ── Logística ─────────────────────────────────────────────────────
  {
    typeId: 'caminhao_basculante', name: 'Caminhão Basculante', icon: '🚚',
    category: 'logistica', costPerMin: 300, purchasePrice: 220_000,
    minLevel: 2, description: 'Transporte de terra, areia e entulho.',
  },
  {
    typeId: 'caminhao_prancha', name: 'Caminhão Prancha', icon: '🚛',
    category: 'logistica', costPerMin: 350, purchasePrice: 260_000,
    minLevel: 2, description: 'Transporte de máquinas e equipamentos.',
  },
  {
    typeId: 'empilhadeira', name: 'Empilhadeira', icon: '📦',
    category: 'logistica', costPerMin: 150, purchasePrice: 90_000,
    minLevel: 1, description: 'Movimentação de materiais no canteiro.',
  },
  // ── Concretagem ───────────────────────────────────────────────────
  {
    typeId: 'betoneira', name: 'Betoneira', icon: '🔄',
    category: 'concretagem', costPerMin: 100, purchasePrice: 60_000,
    minLevel: 1, description: 'Mistura de concreto no local.',
  },
  {
    typeId: 'caminhao_betoneira', name: 'Caminhão Betoneira', icon: '🚛',
    category: 'concretagem', costPerMin: 500, purchasePrice: 400_000,
    minLevel: 4, description: 'Concreto pronto entregue no canteiro.',
  },
  {
    typeId: 'vibrador', name: 'Vibrador de Concreto', icon: '⚡',
    category: 'concretagem', costPerMin: 80, purchasePrice: 40_000,
    minLevel: 1, description: 'Adensa o concreto para maior resistência.',
  },
];

export function getMachineTypeDef(typeId: string): MachineTypeDef | undefined {
  return MACHINE_CATALOG.find(m => m.typeId === typeId);
}

// ══════════════════════════════════════════════════════════════════════
// MATERIAIS
// ══════════════════════════════════════════════════════════════════════

export interface MaterialDef {
  materialId: string;
  name: string;
  icon: string;
  category: 'estrutura' | 'alvenaria' | 'cobertura' | 'acabamento';
  /** Unidade: 'kg', 'saco', 'unid', 'm²' etc. */
  unit: string;
  /** Preço base NPC (R$/unidade) */
  basePrice: number;
  /** Variação de preço ±% */
  priceVariation: number;
}

export const MATERIALS: MaterialDef[] = [
  // ── Estrutura ─────────────────────────────────────────────────────
  { materialId: 'cimento',    name: 'Cimento',        icon: '🧱', category: 'estrutura', unit: 'saco 50kg', basePrice: 40,    priceVariation: 0.10 },
  { materialId: 'areia',      name: 'Areia',          icon: '🏖️', category: 'estrutura', unit: 'm³',       basePrice: 120,   priceVariation: 0.08 },
  { materialId: 'brita',      name: 'Brita',          icon: '🪨', category: 'estrutura', unit: 'm³',       basePrice: 150,   priceVariation: 0.08 },
  { materialId: 'ferro',      name: 'Ferro (vergalhão)', icon: '🔩', category: 'estrutura', unit: 'barra 12m', basePrice: 80, priceVariation: 0.15 },
  // ── Alvenaria ─────────────────────────────────────────────────────
  { materialId: 'tijolo',     name: 'Tijolo Cerâmico', icon: '🟥', category: 'alvenaria', unit: 'milheiro', basePrice: 1_200, priceVariation: 0.10 },
  { materialId: 'bloco',      name: 'Bloco de Concreto', icon: '⬛', category: 'alvenaria', unit: 'unid',  basePrice: 3,     priceVariation: 0.08 },
  { materialId: 'argamassa',  name: 'Argamassa',      icon: '🪣', category: 'alvenaria', unit: 'saco 20kg', basePrice: 25,  priceVariation: 0.10 },
  // ── Cobertura ─────────────────────────────────────────────────────
  { materialId: 'telha_ceramica',     name: 'Telha Cerâmica',     icon: '🏠', category: 'cobertura', unit: 'unid',  basePrice: 5,    priceVariation: 0.12 },
  { materialId: 'telha_trapezoidal',  name: 'Telha Trapezoidal',  icon: '🏭', category: 'cobertura', unit: 'm²',    basePrice: 25,   priceVariation: 0.10 },
  { materialId: 'telha_sanduiche',    name: 'Telha Sanduíche',    icon: '🏗️', category: 'cobertura', unit: 'm²',    basePrice: 60,   priceVariation: 0.10 },
  // ── Acabamento ────────────────────────────────────────────────────
  { materialId: 'tinta',      name: 'Tinta Acrílica', icon: '🎨', category: 'acabamento', unit: 'lata 18L', basePrice: 280, priceVariation: 0.12 },
  { materialId: 'piso',       name: 'Piso Cerâmico',  icon: '⬜', category: 'acabamento', unit: 'm²',      basePrice: 45,  priceVariation: 0.15 },
];

export function getMaterialDef(materialId: string): MaterialDef | undefined {
  return MATERIALS.find(m => m.materialId === materialId);
}

/** Preço atual com variação ±priceVariation */
export function currentMaterialPrice(mat: MaterialDef): number {
  const v = mat.priceVariation;
  const factor = 1 + (Math.random() * 2 - 1) * v;
  return Math.round(mat.basePrice * factor);
}

// ══════════════════════════════════════════════════════════════════════
// GERADOR DE LICITAÇÕES
// ══════════════════════════════════════════════════════════════════════

interface WorkTypeDef {
  tipo: WorkType;
  label: string;
  icon: string;
  tamanhoRange: [number, number];   // m²
  tempoRange: [number, number];     // min base
  margemRange: [number, number];    // fator sobre custo (1.30–1.40 etc.)
  minLevel: number;
}

const WORK_TYPE_DEFS: WorkTypeDef[] = [
  // tempoRange = base de custo ≈ tempo real estimado (com equipe mínima a 50% de skill)
  // Tempo real = tamanhoM2 / producaoPerMin. A 50% skill:
  //   pequena (2aj+1ped → 10 m²/min): [50,300]/10 = 5–30min
  //   media   (4aj+3ped+1eng → 25 m²/min): [300,1500]/25 = 12–60min
  //   grande  (8aj+6ped+... → 50 m²/min): [1500,3750]/50 = 30–75min
  //   mega    (20aj+15ped+... → 125 m²/min): [7500,11250]/125 = 60–90min
  { tipo: 'pequena', label: 'Pequena',  icon: '🏠', tamanhoRange: [50,   300],  tempoRange: [5,   30], margemRange: [1.30, 1.45], minLevel: 1 },
  { tipo: 'media',   label: 'Média',    icon: '🏢', tamanhoRange: [300,  1500], tempoRange: [12,  60], margemRange: [1.20, 1.35], minLevel: 3 },
  { tipo: 'grande',  label: 'Grande',   icon: '🏗️', tamanhoRange: [1500, 3750], tempoRange: [30,  75], margemRange: [1.10, 1.20], minLevel: 5 },
  { tipo: 'mega',    label: 'Mega',     icon: '🌆', tamanhoRange: [7500, 11250],tempoRange: [60,  90], margemRange: [1.05, 1.15], minLevel: 8 },
];

export function getWorkTypeDef(tipo: WorkType) {
  return WORK_TYPE_DEFS.find(d => d.tipo === tipo) ?? WORK_TYPE_DEFS[0]!;
}

const OBRA_ADJECTIVES = ['Central', 'Norte', 'Sul', 'Leste', 'Oeste', 'Industrial', 'Residencial', 'Comercial', 'Municipal', 'Federal'];
const OBRA_NOUNS = [
  'Edifício', 'Complexo', 'Residencial', 'Centro', 'Parque', 'Torre',
  'Conjunto', 'Bloco', 'Galpão', 'Pavilhão', 'Terminal', 'Hospital',
  'Escola', 'Creche', 'UPA', 'Posto', 'Praça', 'Viaduto',
];
const OBRA_SUFFIXES = [
  'São Paulo', 'Rio Verde', 'Boa Vista', 'Nova Era', 'Alvorada', 'Primavera',
  'Horizonte', 'do Norte', 'da Paz', 'do Sul', 'Integrado', 'II', 'III',
];

function randomObraName(): string {
  const adj  = OBRA_ADJECTIVES[Math.floor(Math.random() * OBRA_ADJECTIVES.length)]!;
  const noun = OBRA_NOUNS[Math.floor(Math.random() * OBRA_NOUNS.length)]!;
  const suf  = OBRA_SUFFIXES[Math.floor(Math.random() * OBRA_SUFFIXES.length)]!;
  return `${noun} ${adj} ${suf}`;
}

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickMaterials(tamanhoM2: number, tipo: WorkType): WorkRequirements['materials'] {
  const s = tamanhoM2;
  const mats: WorkRequirements['materials'] = [];

  // Materiais base (todas as obras)
  mats.push({ materialId: 'cimento', name: 'Cimento',  quantity: Math.max(1, Math.round(s * 0.15)), unit: 'saco 50kg' });
  mats.push({ materialId: 'areia',   name: 'Areia',    quantity: Math.max(1, Math.round(s * 0.04)), unit: 'm³' });
  mats.push({ materialId: 'brita',   name: 'Brita',    quantity: Math.max(1, Math.round(s * 0.03)), unit: 'm³' });

  if (tipo !== 'pequena') {
    mats.push({ materialId: 'ferro',   name: 'Ferro (vergalhão)', quantity: Math.max(1, Math.round(s * 0.05)), unit: 'barra 12m' });
    // tijolo: 0.017/m² ≈ realístico (~17 mil tijolos por 1000m²)
    mats.push({ materialId: 'tijolo',  name: 'Tijolo Cerâmico',   quantity: Math.max(1, Math.round(s * 0.017)), unit: 'milheiro' });
  }
  if (tipo === 'grande' || tipo === 'mega') {
    // bloco: 0.2 unid/m² (era 2.0 — 10× mais razoável)
    mats.push({ materialId: 'bloco',    name: 'Bloco de Concreto', quantity: Math.max(1, Math.round(s * 0.2)), unit: 'unid' });
    mats.push({ materialId: 'argamassa',name: 'Argamassa',         quantity: Math.max(1, Math.round(s * 0.3)), unit: 'saco 20kg' });
  }
  if (tipo === 'mega') {
    mats.push({ materialId: 'tinta', name: 'Tinta Acrílica', quantity: Math.max(1, Math.round(s * 0.01)), unit: 'lata 18L' });
    // piso: 0.1 m²/m² de área bruta (era 0.5 — 5× mais razoável)
    mats.push({ materialId: 'piso',  name: 'Piso Cerâmico',  quantity: Math.max(1, Math.round(s * 0.1)),  unit: 'm²' });
  }

  return mats;
}

function pickEmployees(tipo: WorkType): WorkRequirements['employees'] {
  switch (tipo) {
    case 'pequena':
      return [
        { type: 'ajudante', quantity: 2 },
        { type: 'pedreiro', quantity: 1 },
      ];
    case 'media':
      return [
        { type: 'ajudante',    quantity: 4 },
        { type: 'pedreiro',    quantity: 3 },
        { type: 'engenheiro',  quantity: 1 },
      ];
    case 'grande':
      return [
        { type: 'ajudante',    quantity: 8 },
        { type: 'pedreiro',    quantity: 6 },
        { type: 'mestre',      quantity: 1 },
        { type: 'engenheiro',  quantity: 2 },
        { type: 'seguranca',   quantity: 1 },
      ];
    case 'mega':
      return [
        { type: 'ajudante',    quantity: 20 },
        { type: 'pedreiro',    quantity: 15 },
        { type: 'mestre',      quantity: 2 },
        { type: 'engenheiro',  quantity: 4 },
        { type: 'seguranca',   quantity: 2 },
      ];
  }
}

function pickMachines(tipo: WorkType): WorkRequirements['machines'] {
  switch (tipo) {
    case 'pequena':
      return [
        { typeId: 'betoneira', name: 'Betoneira', quantity: 1 },
        { typeId: 'empilhadeira', name: 'Empilhadeira', quantity: 1 },
      ];
    case 'media':
      return [
        { typeId: 'retroescavadeira', name: 'Retroescavadeira', quantity: 1 },
        { typeId: 'betoneira',        name: 'Betoneira',        quantity: 2 },
        { typeId: 'caminhao_basculante', name: 'Caminhão Basculante', quantity: 1 },
      ];
    case 'grande':
      return [
        { typeId: 'escavadeira',      name: 'Escavadeira Hidráulica', quantity: 1 },
        { typeId: 'guindaste_movel',  name: 'Guindaste Móvel',        quantity: 1 },
        { typeId: 'bomba_concreto',   name: 'Bomba de Concreto',      quantity: 1 },
        { typeId: 'caminhao_basculante', name: 'Caminhão Basculante', quantity: 2 },
      ];
    case 'mega':
      return [
        { typeId: 'escavadeira',        name: 'Escavadeira Hidráulica', quantity: 2 },
        { typeId: 'guindaste_torre',    name: 'Guindaste Torre',        quantity: 1 },
        { typeId: 'bomba_concreto',     name: 'Bomba de Concreto',      quantity: 2 },
        { typeId: 'caminhao_betoneira', name: 'Caminhão Betoneira',     quantity: 2 },
        { typeId: 'caminhao_basculante', name: 'Caminhão Basculante',   quantity: 3 },
      ];
  }
}

/**
 * Calcula o custo total estimado da obra:
 *   materiais (preço base) + mão-de-obra (custo/min × tempo) + máquinas (custo/min × tempo)
 */
function calcCustoEstimado(
  tempoBaseMin: number,
  mats: WorkRequirements['materials'],
  emps: WorkRequirements['employees'],
  machs: WorkRequirements['machines'],
): number {
  const matCost = mats.reduce((acc, m) => {
    const def = MATERIALS.find(d => d.materialId === m.materialId);
    return acc + (def ? def.basePrice * m.quantity : 0);
  }, 0);

  const empCost = emps.reduce((acc, e) => {
    const def = EMPLOYEE_TYPES.find(d => d.type === e.type);
    return acc + (def ? def.custoBase * e.quantity * tempoBaseMin : 0);
  }, 0);

  const machCost = machs.reduce((acc, m) => {
    const def = MACHINE_CATALOG.find(d => d.typeId === m.typeId);
    return acc + (def ? def.costPerMin * m.quantity * tempoBaseMin : 0);
  }, 0);

  return matCost + empCost + machCost;
}

/** Gera uma única licitação aleatória do tipo especificado */
export function generateLicitacao(tipo: WorkType, batchId = 1): Licitacao {
  const def       = getWorkTypeDef(tipo);
  const tamanhoM2 = randInt(def.tamanhoRange[0], def.tamanhoRange[1]);
  const tempoBaseMin = randInt(def.tempoRange[0], def.tempoRange[1]);

  const requisitos: WorkRequirements = {
    employees: pickEmployees(tipo),
    machines:  pickMachines(tipo),
    materials: pickMaterials(tamanhoM2, tipo),
  };

  const custoEstimado = calcCustoEstimado(tempoBaseMin, requisitos.materials, requisitos.employees, requisitos.machines);
  const margem = def.margemRange[0] + Math.random() * (def.margemRange[1] - def.margemRange[0]);
  const valorBase = Math.round(custoEstimado * margem);

  // Licitações ficam abertas por 15-45 minutos reais
  const durationMin = randInt(15, 45);
  const expiresAt = Date.now() + durationMin * 60_000;

  return {
    id:           `lic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome:         randomObraName(),
    tipo,
    tamanhoM2,
    tempoBaseMin,
    custoEstimado,
    valorBase,
    requisitos,
    melhorLance:  null,
    liderNome:    null,
    liderId:      null,
    expiresAt,
    status:       'open',
    batchId,
    createdAt:    Date.now(),
  };
}

// Número de licitações por pool
const POOL_SIZES: Record<WorkType, number> = {
  pequena: 6,
  media:   4,
  grande:  2,
  mega:    1,
};

/** Gera o pool completo de licitações (13 obras, mix de tamanhos) */
export function generateLicitacaoPool(batchId = 1): Licitacao[] {
  const pool: Licitacao[] = [];
  for (const [tipo, count] of Object.entries(POOL_SIZES) as [WorkType, number][]) {
    for (let i = 0; i < count; i++) {
      pool.push(generateLicitacao(tipo, batchId));
    }
  }
  // Embaralha
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool;
}

// ── Serviços Rápidos — contratos diretos, sem leilão ─────────────────
export interface ServicoRapido {
  id:            string;
  nome:          string;
  tipo:          WorkType;
  tamanhoM2:     number;
  tempoBaseMin:  number;
  custoEstimado: number;
  valorContrato: number;
  requisitos:    WorkRequirements;
}

type RapidoTemplate = {
  nome:     string;
  m2:       [number, number];
  valor:    [number, number];
  matId:    string;
  matNome:  string;
  matUnit:  string;
  matQtyFn: (m2: number) => number;
  req:      WorkRequirements['employees'];
};

const RAPIDO_TEMPLATES: RapidoTemplate[] = [
  { nome: 'Pintura de Apartamento',     m2: [40,  90],  valor: [6_000,  18_000], matId: 'tinta',     matNome: 'Tinta Acrílica',   matUnit: 'lata 18L',  matQtyFn: m => Math.max(1, Math.round(m * 0.012)), req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Reforma de Banheiro',        m2: [8,   25],  valor: [10_000, 30_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Troca de Piso Cerâmico',     m2: [30,  80],  valor: [8_000,  24_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Instalação de Forro PVC',    m2: [40,  120], valor: [5_000,  14_000], matId: 'argamassa', matNome: 'Argamassa',        matUnit: 'saco 20kg', matQtyFn: m => Math.max(1, Math.round(m * 0.15)),  req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Manutenção de Telhado',      m2: [50,  130], valor: [7_000,  22_000], matId: 'cimento',   matNome: 'Cimento',          matUnit: 'saco 50kg', matQtyFn: m => Math.max(1, Math.round(m * 0.08)),  req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Reboco de Fachada',          m2: [40,  110], valor: [12_000, 38_000], matId: 'argamassa', matNome: 'Argamassa',        matUnit: 'saco 20kg', matQtyFn: m => Math.max(2, Math.round(m * 0.3)),   req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Instalação de Drywall',      m2: [30,  80],  valor: [6_000,  16_000], matId: 'argamassa', matNome: 'Argamassa',        matUnit: 'saco 20kg', matQtyFn: m => Math.max(1, Math.round(m * 0.1)),   req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Calçamento de Quintal',      m2: [30,  100], valor: [9_000,  28_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Reparo de Infiltração',      m2: [15,  45],  valor: [4_500,  13_000], matId: 'cimento',   matNome: 'Cimento',          matUnit: 'saco 50kg', matQtyFn: m => Math.max(1, Math.round(m * 0.06)),  req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Pintura de Fachada',         m2: [60,  160], valor: [14_000, 48_000], matId: 'tinta',     matNome: 'Tinta Acrílica',   matUnit: 'lata 18L',  matQtyFn: m => Math.max(2, Math.round(m * 0.015)), req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Demolição de Parede',        m2: [15,  60],  valor: [5_000,  16_000], matId: 'areia',     matNome: 'Areia',            matUnit: 'm³',        matQtyFn: m => Math.max(1, Math.round(m * 0.03)),  req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Reforma Comercial',          m2: [40,  100], valor: [18_000, 65_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Troca de Revestimento',      m2: [25,  80],  valor: [8_000,  26_000], matId: 'argamassa', matNome: 'Argamassa',        matUnit: 'saco 20kg', matQtyFn: m => Math.max(2, Math.round(m * 0.25)),  req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Construção de Muro',         m2: [20,  80],  valor: [7_000,  24_000], matId: 'cimento',   matNome: 'Cimento',          matUnit: 'saco 50kg', matQtyFn: m => Math.max(2, Math.round(m * 0.1)),   req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Reforma de Cozinha',         m2: [12,  30],  valor: [14_000, 42_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
  { nome: 'Nivelamento de Piso',        m2: [50,  150], valor: [6_000,  20_000], matId: 'argamassa', matNome: 'Argamassa',        matUnit: 'saco 20kg', matQtyFn: m => Math.max(2, Math.round(m * 0.2)),   req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Pintura Industrial',         m2: [100, 200], valor: [22_000, 70_000], matId: 'tinta',     matNome: 'Tinta Acrílica',   matUnit: 'lata 18L',  matQtyFn: m => Math.max(3, Math.round(m * 0.018)), req: [{ type: 'ajudante', quantity: 1 }] },
  { nome: 'Assentamento de Cerâmica',   m2: [25,  75],  valor: [7_000,  22_000], matId: 'piso',      matNome: 'Piso Cerâmico',    matUnit: 'm²',        matQtyFn: m => Math.max(1, Math.round(m)),         req: [{ type: 'pedreiro', quantity: 1 }] },
];

export function generateServicosRapidos(seed = 0): ServicoRapido[] {
  const count = 8;
  const result: ServicoRapido[] = [];
  const n = RAPIDO_TEMPLATES.length;
  for (let i = 0; i < count; i++) {
    const tpl           = RAPIDO_TEMPLATES[(seed * 3 + i * 5) % n]!;
    const tamanhoM2     = randInt(tpl.m2[0], tpl.m2[1]);
    const valorContrato = randInt(tpl.valor[0], tpl.valor[1]);
    const custoEstimado = Math.round(valorContrato / (1.25 + Math.random() * 0.15));
    const tempoBaseMin  = Math.max(5, Math.round(tamanhoM2 / 5 + Math.random() * (tamanhoM2 / 10)));
    const matQty        = tpl.matQtyFn(tamanhoM2);
    const requisitos: WorkRequirements = {
      employees: tpl.req,
      machines:  [],
      materials: [{ materialId: tpl.matId, name: tpl.matNome, quantity: matQty, unit: tpl.matUnit }],
    };
    result.push({ id: `rapido_${seed}_${i}_${Date.now()}`, nome: tpl.nome, tipo: 'pequena', tamanhoM2, tempoBaseMin, custoEstimado, valorContrato, requisitos });
  }
  return result;
}

export const NPC_COMPANY_NAMES = [
  'Construtora Albuquerque', 'Obras do Norte Ltda.', 'Grupo Edificar',
  'Construtora Vega', 'TerraFirme Engenharia', 'MegaCon Obras',
  'Construções Horizonte', 'Edificações Paulista', 'Grupo Alpha Construções',
  'Construtora Zanetti', 'Obras e Projetos Centro-Oeste', 'Infraestrutura BR',
  'Construtora Pinheiro & Filhos', 'Engenharia Progresso', 'Construtora Sol Nascente',
];
