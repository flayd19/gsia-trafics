// =====================================================================
// usePropriedades — Sistema imobiliário
// Compra de terreno + construção + aluguel NPC + venda
// =====================================================================
import { useState, useCallback, useEffect } from 'react';
import type {
  Property,
  PropertyType,
  PropertyCategory,
  BuildOption,
  GameState,
} from '@/types/game';

// ─────────────────────────────────────────────────────────────────────
// Catálogo de construções
// ─────────────────────────────────────────────────────────────────────

export const BUILD_CATALOG: BuildOption[] = [
  // ── Residencial ──────────────────────────────────────────────────
  {
    typeId: 'casa_popular',
    category: 'residencial',
    name: 'Casa Popular',
    icon: '🏠',
    areaM2: 60,
    lotCostBase: 18_000,
    buildCost: 65_000,
    buildDaysBase: 4,
    marketValue: 145_000,
    rentMonthly: 900,
    maintenancePerDay: 20,
    employeeReq: { minTotal: 2, minSkilled: 1, engineerBonus: false },
    description: 'Residência simples e acessível. Alta procura por aluguel.',
  },
  {
    typeId: 'casa_media',
    category: 'residencial',
    name: 'Casa Média',
    icon: '🏡',
    areaM2: 120,
    lotCostBase: 35_000,
    buildCost: 140_000,
    buildDaysBase: 7,
    marketValue: 320_000,
    rentMonthly: 1_900,
    maintenancePerDay: 38,
    employeeReq: { minTotal: 3, minSkilled: 2, engineerBonus: false },
    description: 'Padrão médio com bom acabamento. Muito valorizada.',
  },
  {
    typeId: 'casa_alto_padrao',
    category: 'residencial',
    name: 'Casa Alto Padrão',
    icon: '🏘️',
    areaM2: 220,
    lotCostBase: 80_000,
    buildCost: 310_000,
    buildDaysBase: 14,
    marketValue: 720_000,
    rentMonthly: 4_800,
    maintenancePerDay: 80,
    employeeReq: { minTotal: 5, minSkilled: 3, engineerBonus: true },
    description: 'Acabamento superior, área nobre. Alto retorno.',
  },
  {
    typeId: 'casa_luxo',
    category: 'residencial',
    name: 'Casa de Luxo',
    icon: '🏰',
    areaM2: 380,
    lotCostBase: 200_000,
    buildCost: 680_000,
    buildDaysBase: 25,
    marketValue: 1_600_000,
    rentMonthly: 10_500,
    maintenancePerDay: 160,
    employeeReq: { minTotal: 8, minSkilled: 5, engineerBonus: true },
    description: 'Condomínio de luxo. Enorme valorização e renda.',
  },
  // ── Comercial ────────────────────────────────────────────────────
  {
    typeId: 'comercial_pequeno',
    category: 'comercial',
    name: 'Ponto Comercial Pequeno',
    icon: '🏪',
    areaM2: 80,
    lotCostBase: 45_000,
    buildCost: 110_000,
    buildDaysBase: 6,
    marketValue: 260_000,
    rentMonthly: 2_600,
    maintenancePerDay: 45,
    employeeReq: { minTotal: 2, minSkilled: 1, engineerBonus: false },
    description: 'Loja ou serviço de bairro. Baixo custo inicial.',
  },
  {
    typeId: 'comercial_medio',
    category: 'comercial',
    name: 'Ponto Comercial Médio',
    icon: '🏬',
    areaM2: 200,
    lotCostBase: 90_000,
    buildCost: 260_000,
    buildDaysBase: 12,
    marketValue: 600_000,
    rentMonthly: 5_800,
    maintenancePerDay: 90,
    employeeReq: { minTotal: 4, minSkilled: 2, engineerBonus: true },
    description: 'Ideal para supermercado ou academia. Alta liquidez.',
  },
  {
    typeId: 'comercial_grande',
    category: 'comercial',
    name: 'Ponto Comercial Grande',
    icon: '🏢',
    areaM2: 450,
    lotCostBase: 200_000,
    buildCost: 520_000,
    buildDaysBase: 20,
    marketValue: 1_250_000,
    rentMonthly: 11_000,
    maintenancePerDay: 180,
    employeeReq: { minTotal: 7, minSkilled: 4, engineerBonus: true },
    description: 'Shopping, atacadão ou escritório corporativo.',
  },
  // ── Industrial ───────────────────────────────────────────────────
  {
    typeId: 'galpao_pequeno',
    category: 'industrial',
    name: 'Galpão Pequeno',
    icon: '🏭',
    areaM2: 300,
    lotCostBase: 60_000,
    buildCost: 190_000,
    buildDaysBase: 9,
    marketValue: 430_000,
    rentMonthly: 4_200,
    maintenancePerDay: 70,
    employeeReq: { minTotal: 3, minSkilled: 2, engineerBonus: false },
    description: 'Depósito ou oficina. Alta demanda industrial.',
  },
  {
    typeId: 'galpao_medio',
    category: 'industrial',
    name: 'Galpão Médio',
    icon: '🏗️',
    areaM2: 700,
    lotCostBase: 130_000,
    buildCost: 420_000,
    buildDaysBase: 18,
    marketValue: 980_000,
    rentMonthly: 9_500,
    maintenancePerDay: 140,
    employeeReq: { minTotal: 6, minSkilled: 3, engineerBonus: true },
    description: 'Armazém ou fábrica. Contratos longos e seguros.',
  },
  {
    typeId: 'galpao_grande',
    category: 'industrial',
    name: 'Galpão Grande',
    icon: '🏭',
    areaM2: 1_500,
    lotCostBase: 280_000,
    buildCost: 880_000,
    buildDaysBase: 32,
    marketValue: 2_200_000,
    rentMonthly: 20_000,
    maintenancePerDay: 300,
    employeeReq: { minTotal: 10, minSkilled: 6, engineerBonus: true },
    description: 'Complexo logístico. Maior retorno do portfólio.',
  },
];

export const BUILD_MAP: Record<PropertyType, BuildOption> =
  Object.fromEntries(BUILD_CATALOG.map(b => [b.typeId, b])) as Record<PropertyType, BuildOption>;

// Bairros por categoria
const NEIGHBORHOODS: Record<PropertyCategory, string[]> = {
  residencial: ['Jardins', 'Vila Nova', 'Bairro Novo', 'Santa Luzia', 'Setor Sul', 'Res. Goiânia'],
  comercial:   ['Centro', 'Setor Comercial', 'Av. Goiás', 'Praça da Liberdade', 'Setor Norte'],
  industrial:  ['Distrito Industrial', 'Polo Industrial Sul', 'Zona Industrial Norte'],
};

const TENANT_NAMES = [
  'João Silva', 'Maria Santos', 'Carlos Oliveira', 'Ana Lima',
  'Pedro Costa', 'Fernanda Rocha', 'Lucas Mendes', 'Juliana Souza',
  'Roberto Alves', 'Camila Ferreira', 'Diego Martins', 'Priscila Nunes',
  'Empresa GoLog Ltda', 'Mercado Boa Compra', 'Oficina FastFix',
  'Distribuidora Prata', 'Tech Soluções ME', 'Atacadão GY',
  'Transportadora SulMais', 'Academia FitLife', 'Farmácia VidaVerde',
];

const BUYER_NAMES = [
  'Construtora Alpha', 'Fundo Imobiliário GY', 'Investidor JR',
  'Família Andrade', 'Holding Goiás S.A.', 'Dr. Marcos Vidal',
  'Sra. Helena Braga', 'Paulo Investimentos', 'Grupo Capital BR',
  'Imobiliária CentroSul', 'Mr. João Capitão', 'Fundo URB',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Persistent storage ────────────────────────────────────────────

const LS_KEY = 'gsia_properties_v2';

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ── Construction speed boost from team ───────────────────────────

function calcBuildDays(base: BuildOption, gameState: GameState): number {
  const idle = gameState.employees.filter(e => e.status === 'idle');
  const skilled = idle.filter(e =>
    e.type === 'pedreiro' || e.type === 'mestre' || e.type === 'engenheiro'
  );
  const hasEngineer = idle.some(e => e.type === 'engenheiro');

  // Speed factor: more idle workers = faster build
  const teamBonus = Math.min(idle.length / 4, 1.5); // up to 1.5× speed
  const engineerMult = (base.employeeReq.engineerBonus && hasEngineer) ? 0.75 : 1;
  const skilledMult  = skilled.length >= base.employeeReq.minSkilled ? 0.9 : 1;

  const totalMult = engineerMult * skilledMult / Math.max(1, teamBonus);
  return Math.max(1, Math.round(base.buildDaysBase * totalMult));
}

function checkCanBuild(build: BuildOption, gameState: GameState): { ok: boolean; reason?: string } {
  const idle = gameState.employees.filter(e => e.status === 'idle');
  const skilled = idle.filter(e =>
    e.type === 'pedreiro' || e.type === 'mestre' || e.type === 'engenheiro'
  );
  if (idle.length < build.employeeReq.minTotal) {
    return {
      ok: false,
      reason: `Precisa de ${build.employeeReq.minTotal} funcionários disponíveis (você tem ${idle.length}).`,
    };
  }
  if (skilled.length < build.employeeReq.minSkilled) {
    return {
      ok: false,
      reason: `Precisa de ${build.employeeReq.minSkilled} pedreiro(s)/mestre(s)/engenheiro(s).`,
    };
  }
  return { ok: true };
}

// ── Hook ──────────────────────────────────────────────────────────

export interface PropriedadesAPI {
  properties: Property[];
  buildCatalog: BuildOption[];

  startBuild: (
    typeId: PropertyType,
    currentDay: number,
    gameState: GameState,
  ) => { ok: boolean; message: string; cost?: number };

  listForRent:   (instanceId: string, currentDay: number) => { ok: boolean; message: string };
  collectRent:   (instanceId: string, currentDay: number) => { ok: boolean; message: string; amount?: number };
  evictTenant:   (instanceId: string) => { ok: boolean; message: string };
  listForSale:   (instanceId: string, price: number, currentDay: number) => { ok: boolean; message: string };
  cancelSale:    (instanceId: string) => { ok: boolean; message: string };
  acceptBuyer:   (instanceId: string) => { ok: boolean; message: string; amount?: number };
  rejectBuyer:   (instanceId: string) => { ok: boolean; message: string };
  tickDay:       (currentDay: number) => { newBuyers: string[]; constructionDone: string[] };
  getBuildInfo:  (typeId: PropertyType, gameState: GameState) => {
    days: number;
    canBuild: boolean;
    reason?: string;
    totalCost: number;
  };
}

export function usePropriedades(): PropriedadesAPI {
  const [properties, setProperties] = useState<Property[]>(() => lsGet<Property[]>(LS_KEY) ?? []);

  useEffect(() => { lsSet(LS_KEY, properties); }, [properties]);

  // ── getBuildInfo ──────────────────────────────────────────────────
  const getBuildInfo = useCallback((typeId: PropertyType, gameState: GameState) => {
    const build = BUILD_MAP[typeId];
    const check = checkCanBuild(build, gameState);
    const days  = calcBuildDays(build, gameState);
    const totalCost = build.lotCostBase + build.buildCost;
    return { days, canBuild: check.ok, reason: check.reason, totalCost };
  }, []);

  // ── startBuild ────────────────────────────────────────────────────
  const startBuild = useCallback((
    typeId: PropertyType,
    currentDay: number,
    gameState: GameState,
  ): { ok: boolean; message: string; cost?: number } => {
    const build = BUILD_MAP[typeId];
    const check = checkCanBuild(build, gameState);
    if (!check.ok) return { ok: false, message: check.reason! };

    const totalCost = build.lotCostBase + build.buildCost;
    if (gameState.money < totalCost) {
      return {
        ok: false,
        message: `Saldo insuficiente. Precisa de ${fmtBRL(totalCost)} (faltam ${fmtBRL(totalCost - gameState.money)}).`,
        cost: totalCost,
      };
    }

    const days         = calcBuildDays(build, gameState);
    const neighborhood = randomFrom(NEIGHBORHOODS[build.category]);

    const prop: Property = {
      instanceId:       `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name:             `${build.name} — ${neighborhood}`,
      type:             typeId,
      category:         build.category,
      icon:             build.icon,
      areaM2:           build.areaM2,
      neighborhood,
      totalInvested:    totalCost,
      marketValue:      build.marketValue,
      rentMonthly:      build.rentMonthly,
      maintenancePerDay: build.maintenancePerDay,
      status:           'construindo',
      buildStartDay:    currentDay,
      buildEndDay:      currentDay + days,
      rentCollected:    0,
      purchasedAt:      Date.now(),
    };

    setProperties(prev => [...prev, prop]);
    return {
      ok: true,
      message: `Obra iniciada! ${build.name} em ${neighborhood} — pronta em ${days} dia${days !== 1 ? 's' : ''}.`,
      cost: totalCost,
    };
  }, []);

  // ── listForRent ───────────────────────────────────────────────────
  const listForRent = useCallback((instanceId: string, currentDay: number) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status === 'construindo') return { ok: false, message: 'Ainda em construção.' };
    if (prop.status === 'alugado')     return { ok: false, message: 'Já está alugado.' };
    if (prop.status === 'vendido')     return { ok: false, message: 'Imóvel vendido.' };

    const tenantName = randomFrom(TENANT_NAMES);
    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      status: 'alugado',
      tenantName,
      tenantSince:  currentDay,
      lastRentDay:  currentDay,
      salePrice:    undefined,
      listedForSaleDay:   undefined,
      pendingBuyerName:   undefined,
      pendingBuyerOffer:  undefined,
    }));
    return { ok: true, message: `Inquilino encontrado: ${tenantName}!` };
  }, [properties]);

  // ── collectRent ───────────────────────────────────────────────────
  const collectRent = useCallback((instanceId: string, currentDay: number) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop)                      return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'alugado')  return { ok: false, message: 'Imóvel não está alugado.' };

    const lastDay    = prop.lastRentDay ?? prop.tenantSince ?? currentDay;
    const daysPassed = currentDay - lastDay;
    if (daysPassed < 1) return { ok: false, message: 'Nenhum aluguel pendente ainda.' };

    const amount = Math.floor((prop.rentMonthly / 30) * daysPassed);
    if (amount <= 0)  return { ok: false, message: 'Valor ainda muito baixo.' };

    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      lastRentDay:    currentDay,
      rentCollected:  p.rentCollected + amount,
    }));
    return { ok: true, message: `Aluguel recebido: ${fmtBRL(amount)}!`, amount };
  }, [properties]);

  // ── evictTenant ───────────────────────────────────────────────────
  const evictTenant = useCallback((instanceId: string) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop)                      return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'alugado')  return { ok: false, message: 'Nenhum inquilino.' };

    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      status:       'pronto',
      tenantName:   undefined,
      tenantSince:  undefined,
      lastRentDay:  undefined,
    }));
    return { ok: true, message: 'Inquilino removido.' };
  }, [properties]);

  // ── listForSale ───────────────────────────────────────────────────
  const listForSale = useCallback((instanceId: string, price: number, currentDay: number) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop)                         return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status === 'construindo') return { ok: false, message: 'Ainda em construção.' };
    if (prop.status === 'vendido')     return { ok: false, message: 'Já foi vendido.' };
    if (price < 1_000)                 return { ok: false, message: 'Preço mínimo: R$ 1.000.' };

    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      status:           'a_venda',
      salePrice:        price,
      listedForSaleDay: currentDay,
      tenantName:       undefined,
      tenantSince:      undefined,
      lastRentDay:      undefined,
      pendingBuyerName:  undefined,
      pendingBuyerOffer: undefined,
    }));
    return { ok: true, message: `Imóvel anunciado por ${fmtBRL(price)}.` };
  }, [properties]);

  // ── cancelSale ────────────────────────────────────────────────────
  const cancelSale = useCallback((instanceId: string) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop)                        return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'a_venda')    return { ok: false, message: 'Não está à venda.' };

    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      status:           'pronto',
      salePrice:        undefined,
      listedForSaleDay: undefined,
      pendingBuyerName:  undefined,
      pendingBuyerOffer: undefined,
    }));
    return { ok: true, message: 'Anúncio cancelado.' };
  }, [properties]);

  // ── acceptBuyer ───────────────────────────────────────────────────
  const acceptBuyer = useCallback((instanceId: string) => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop || !prop.pendingBuyerName || !prop.pendingBuyerOffer)
      return { ok: false, message: 'Sem comprador pendente.' };

    const amount = prop.pendingBuyerOffer;
    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      status:            'vendido',
      pendingBuyerName:  undefined,
      pendingBuyerOffer: undefined,
    }));
    return { ok: true, message: `Venda concluída por ${fmtBRL(amount)}!`, amount };
  }, [properties]);

  // ── rejectBuyer ───────────────────────────────────────────────────
  const rejectBuyer = useCallback((instanceId: string) => {
    setProperties(prev => prev.map(p => p.instanceId !== instanceId ? p : {
      ...p,
      pendingBuyerName:  undefined,
      pendingBuyerOffer: undefined,
    }));
    return { ok: true, message: 'Proposta recusada. Aguardando novo comprador.' };
  }, []);

  // ── tickDay (chamado quando game day muda) ────────────────────────
  const tickDay = useCallback((currentDay: number) => {
    const newBuyers: string[] = [];
    const constructionDone: string[] = [];

    setProperties(prev => prev.map(p => {
      let next = { ...p };

      // Construção finalizada
      if (next.status === 'construindo' && currentDay >= next.buildEndDay) {
        next.status = 'pronto';
        constructionDone.push(`${next.icon} ${next.name} está pronta!`);
      }

      // Imóvel à venda — NPC comprador aparece
      if (next.status === 'a_venda' && next.listedForSaleDay !== undefined && !next.pendingBuyerName) {
        const daysOnMarket = currentDay - next.listedForSaleDay;
        const chance = Math.min(0.12 + daysOnMarket * 0.06, 0.55);
        if (Math.random() < chance) {
          const buyerName  = randomFrom(BUYER_NAMES);
          // Offer: 85–105% of asking price
          const factor     = 0.85 + Math.random() * 0.20;
          const offer      = Math.round((next.salePrice! * factor) / 1_000) * 1_000;
          next.pendingBuyerName  = buyerName;
          next.pendingBuyerOffer = offer;
          next.pendingBuyerDay   = currentDay;
          newBuyers.push(`${next.icon} ${next.name}: ${buyerName} ofereceu ${fmtBRL(offer)}!`);
        }
      }

      return next;
    }));

    return { newBuyers, constructionDone };
  }, []);

  return {
    properties,
    buildCatalog: BUILD_CATALOG,
    startBuild,
    listForRent,
    collectRent,
    evictTenant,
    listForSale,
    cancelSale,
    acceptBuyer,
    rejectBuyer,
    tickDay,
    getBuildInfo,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

export function fmtBRL(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (value >= 1_000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  }
  return `R$ ${value}`;
}
