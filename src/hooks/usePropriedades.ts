// =====================================================================
// usePropriedades — Sistema de imóveis (construção, aluguel, venda)
// =====================================================================
import { useState, useCallback, useEffect } from 'react';
import type {
  Property,
  PropertyType,
  BuildOption,
  AvailableLot,
} from '@/types/game';

// ── Catálogo de tipos de construção ──────────────────────────────────

export const BUILD_OPTIONS: Record<PropertyType, BuildOption> = {
  casa: {
    typeId: 'casa',
    name: 'Casa',
    icon: '🏠',
    areaM2: 120,
    buildCost: 85_000,
    buildDays: 5,
    marketValue: 240_000,
    rentMonthly: 1_800,
    maintenancePerDay: 40,
    description: 'Residência padrão para família. Boa procura por aluguel.',
  },
  sobrado: {
    typeId: 'sobrado',
    name: 'Sobrado',
    icon: '🏘️',
    areaM2: 200,
    buildCost: 140_000,
    buildDays: 8,
    marketValue: 390_000,
    rentMonthly: 2_800,
    maintenancePerDay: 65,
    description: 'Dois pavimentos, ideal para famílias maiores. Alto valor de revenda.',
  },
  apartamento: {
    typeId: 'apartamento',
    name: 'Apartamento',
    icon: '🏢',
    areaM2: 75,
    buildCost: 95_000,
    buildDays: 6,
    marketValue: 270_000,
    rentMonthly: 2_200,
    maintenancePerDay: 35,
    description: 'Compacto e eficiente. Alta liquidez no mercado.',
  },
  comercial: {
    typeId: 'comercial',
    name: 'Ponto Comercial',
    icon: '🏪',
    areaM2: 150,
    buildCost: 160_000,
    buildDays: 10,
    marketValue: 450_000,
    rentMonthly: 4_500,
    maintenancePerDay: 80,
    description: 'Para comércio ou serviços. Maior retorno mensal.',
  },
  galpao: {
    typeId: 'galpao',
    name: 'Galpão Industrial',
    icon: '🏭',
    areaM2: 500,
    buildCost: 280_000,
    buildDays: 15,
    marketValue: 720_000,
    rentMonthly: 7_500,
    maintenancePerDay: 120,
    description: 'Para logística e indústria. Contratos de longo prazo.',
  },
};

// ── Lotes disponíveis ──────────────────────────────────────────────

export const AVAILABLE_LOTS: AvailableLot[] = [
  {
    id: 'lot_centro_1',
    name: 'Terreno Centro A',
    neighborhood: 'Centro',
    areaM2: 200,
    price: 60_000,
    buildOptions: ['apartamento', 'comercial'],
  },
  {
    id: 'lot_jardins_1',
    name: 'Terreno Jardins',
    neighborhood: 'Jardins',
    areaM2: 300,
    price: 45_000,
    buildOptions: ['casa', 'sobrado'],
  },
  {
    id: 'lot_industrial_1',
    name: 'Área Industrial Norte',
    neighborhood: 'Distrito Industrial',
    areaM2: 600,
    price: 80_000,
    buildOptions: ['galpao', 'comercial'],
  },
  {
    id: 'lot_vila_1',
    name: 'Terreno Vila Nova',
    neighborhood: 'Vila Nova',
    areaM2: 180,
    price: 35_000,
    buildOptions: ['casa', 'sobrado', 'apartamento'],
  },
  {
    id: 'lot_centro_2',
    name: 'Terreno Centro B',
    neighborhood: 'Centro',
    areaM2: 250,
    price: 75_000,
    buildOptions: ['apartamento', 'comercial', 'sobrado'],
  },
  {
    id: 'lot_bairro_1',
    name: 'Terreno Bairro Novo',
    neighborhood: 'Bairro Novo',
    areaM2: 220,
    price: 30_000,
    buildOptions: ['casa', 'sobrado'],
  },
];

// NPC tenant names
const TENANT_NAMES = [
  'João Silva', 'Maria Santos', 'Carlos Oliveira', 'Ana Lima',
  'Pedro Costa', 'Fernanda Rocha', 'Lucas Mendes', 'Juliana Souza',
  'Roberto Alves', 'Camila Ferreira', 'Diego Martins', 'Priscila Nunes',
  'Empresa GoLog Ltda', 'Mercado Boa Compra', 'Oficina FastFix',
  'Distribuidora Prata', 'Tech Soluções ME',
];

const BUYER_NAMES = [
  'Construtora Alpha', 'Investidor JR', 'Família Andrade',
  'Holding Goiás', 'Dr. Marcos Vidal', 'Sra. Helena Braga',
  'Fundo Imobiliário GY', 'Paulo Investimentos',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Persistent storage ────────────────────────────────────────────

const LS_KEY = 'gsia_properties_v1';

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ── Hook ──────────────────────────────────────────────────────────

export interface UsePropriedadesReturn {
  properties: Property[];
  availableLots: AvailableLot[];
  buildOptions: Record<PropertyType, BuildOption>;

  // Ações
  buyLotAndBuild: (lotId: string, typeId: PropertyType, currentDay: number, money: number) => { ok: boolean; message: string; cost?: number };
  listForRent: (instanceId: string, currentDay: number) => { ok: boolean; message: string };
  collectRent: (instanceId: string, currentDay: number) => { ok: boolean; message: string; amount?: number };
  evictTenant: (instanceId: string) => { ok: boolean; message: string };
  listForSale: (instanceId: string, price: number, currentDay: number) => { ok: boolean; message: string };
  cancelSale: (instanceId: string) => { ok: boolean; message: string };
  acceptBuyer: (instanceId: string) => { ok: boolean; message: string; amount?: number };
  tickDay: (currentDay: number) => { rentEarned: number; maintenancePaid: number; newBuyers: string[] };
}

export function usePropriedades(): UsePropriedadesReturn {
  const [properties, setProperties] = useState<Property[]>(() => {
    return lsGet<Property[]>(LS_KEY) ?? [];
  });

  // persist whenever state changes
  useEffect(() => {
    lsSet(LS_KEY, properties);
  }, [properties]);

  // ── Buy lot + build ─────────────────────────────────────────────
  const buyLotAndBuild = useCallback((
    lotId: string,
    typeId: PropertyType,
    currentDay: number,
    money: number,
  ): { ok: boolean; message: string; cost?: number } => {
    const lot = AVAILABLE_LOTS.find(l => l.id === lotId);
    if (!lot) return { ok: false, message: 'Terreno não encontrado.' };
    if (!lot.buildOptions.includes(typeId)) return { ok: false, message: 'Tipo de construção não disponível neste terreno.' };

    const build = BUILD_OPTIONS[typeId];
    const totalCost = lot.price + build.buildCost;
    if (money < totalCost) {
      return { ok: false, message: `Saldo insuficiente. Necessário ${fmtBRL(totalCost)}.`, cost: totalCost };
    }

    const already = properties.some(p => p.lotId === lotId && p.status !== 'vendido');
    if (already) return { ok: false, message: 'Você já possui um imóvel neste terreno.' };

    const prop: Property = {
      instanceId: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      lotId,
      name: `${build.name} — ${lot.neighborhood}`,
      type: typeId,
      icon: build.icon,
      areaM2: build.areaM2,
      neighborhood: lot.neighborhood,
      lotCost: lot.price,
      buildCost: build.buildCost,
      marketValue: build.marketValue,
      rentMonthly: build.rentMonthly,
      maintenancePerDay: build.maintenancePerDay,
      status: 'construindo',
      buildStartDay: currentDay,
      buildEndDay: currentDay + build.buildDays,
      rentCollected: 0,
      purchasedAt: Date.now(),
    };

    setProperties(prev => [...prev, prop]);
    return { ok: true, message: `Construção iniciada! Pronto no Dia ${prop.buildEndDay}.`, cost: totalCost };
  }, [properties]);

  // ── List for rent ────────────────────────────────────────────────
  const listForRent = useCallback((instanceId: string, currentDay: number): { ok: boolean; message: string } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status === 'construindo') return { ok: false, message: 'Imóvel ainda em construção.' };
    if (prop.status === 'alugado') return { ok: false, message: 'Imóvel já está alugado.' };
    if (prop.status === 'vendido') return { ok: false, message: 'Imóvel foi vendido.' };

    // Find a tenant immediately (game simplification)
    const tenantName = randomFrom(TENANT_NAMES);
    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      status: 'alugado',
      tenantName,
      tenantSince: currentDay,
      lastRentDay: currentDay,
      salePrice: undefined,
      listedForSaleDay: undefined,
    } : p));
    return { ok: true, message: `Inquilino encontrado: ${tenantName}!` };
  }, [properties]);

  // ── Collect rent ─────────────────────────────────────────────────
  const collectRent = useCallback((instanceId: string, currentDay: number): { ok: boolean; message: string; amount?: number } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'alugado') return { ok: false, message: 'Imóvel não está alugado.' };

    const lastDay = prop.lastRentDay ?? prop.tenantSince ?? currentDay;
    const daysPassed = currentDay - lastDay;
    if (daysPassed < 1) return { ok: false, message: 'Nenhum aluguel pendente ainda.' };

    // Rent is per 30 game days; prorated
    const dailyRent = prop.rentMonthly / 30;
    const amount = Math.floor(dailyRent * daysPassed);

    if (amount <= 0) return { ok: false, message: 'Nenhum valor a receber ainda.' };

    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      lastRentDay: currentDay,
      rentCollected: p.rentCollected + amount,
    } : p));
    return { ok: true, message: `Aluguel recebido: ${fmtBRL(amount)}!`, amount };
  }, [properties]);

  // ── Evict tenant ─────────────────────────────────────────────────
  const evictTenant = useCallback((instanceId: string): { ok: boolean; message: string } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'alugado') return { ok: false, message: 'Não há inquilino.' };

    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      status: 'pronto',
      tenantName: undefined,
      tenantSince: undefined,
      lastRentDay: undefined,
    } : p));
    return { ok: true, message: 'Inquilino desocupou o imóvel.' };
  }, [properties]);

  // ── List for sale ─────────────────────────────────────────────────
  const listForSale = useCallback((instanceId: string, price: number, currentDay: number): { ok: boolean; message: string } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status === 'construindo') return { ok: false, message: 'Imóvel ainda em construção.' };
    if (prop.status === 'vendido') return { ok: false, message: 'Imóvel já foi vendido.' };
    if (price <= 0) return { ok: false, message: 'Preço inválido.' };

    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      status: 'a_venda',
      salePrice: price,
      listedForSaleDay: currentDay,
      tenantName: undefined,
      tenantSince: undefined,
      lastRentDay: undefined,
    } : p));
    return { ok: true, message: `Imóvel anunciado por ${fmtBRL(price)}.` };
  }, [properties]);

  // ── Cancel sale ──────────────────────────────────────────────────
  const cancelSale = useCallback((instanceId: string): { ok: boolean; message: string } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (prop.status !== 'a_venda') return { ok: false, message: 'Imóvel não está à venda.' };

    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      status: 'pronto',
      salePrice: undefined,
      listedForSaleDay: undefined,
      pendingBuyerName: undefined,
      pendingBuyerDay: undefined,
    } : p));
    return { ok: true, message: 'Anúncio cancelado.' };
  }, [properties]);

  // ── Accept buyer ─────────────────────────────────────────────────
  const acceptBuyer = useCallback((instanceId: string): { ok: boolean; message: string; amount?: number } => {
    const prop = properties.find(p => p.instanceId === instanceId);
    if (!prop) return { ok: false, message: 'Imóvel não encontrado.' };
    if (!prop.pendingBuyerName || !prop.salePrice) return { ok: false, message: 'Sem comprador pendente.' };

    const amount = prop.salePrice;
    setProperties(prev => prev.map(p => p.instanceId === instanceId ? {
      ...p,
      status: 'vendido',
      pendingBuyerName: undefined,
      pendingBuyerDay: undefined,
    } : p));
    return { ok: true, message: `Venda concluída por ${fmtBRL(amount)}!`, amount };
  }, [properties]);

  // ── Tick (chamado quando game day avança) ────────────────────────
  const tickDay = useCallback((currentDay: number): { rentEarned: number; maintenancePaid: number; newBuyers: string[] } => {
    let rentEarned = 0;
    let maintenancePaid = 0;
    const newBuyers: string[] = [];

    setProperties(prev => prev.map(p => {
      let next = { ...p };

      // Construção finalizada
      if (next.status === 'construindo' && currentDay >= next.buildEndDay) {
        next.status = 'pronto';
      }

      // Imóvel alugado — desconta manutenção diária automaticamente (simplificado: apenas registra)
      if (next.status === 'alugado') {
        maintenancePaid += next.maintenancePerDay;
      }

      // Imóvel à venda — NPC comprador aparece após 3-7 dias
      if (next.status === 'a_venda' && next.listedForSaleDay !== undefined && !next.pendingBuyerName) {
        const daysOnMarket = currentDay - next.listedForSaleDay;
        // Probabilidade cresce com o tempo no mercado
        const chance = Math.min(0.15 + daysOnMarket * 0.05, 0.6);
        if (Math.random() < chance) {
          next.pendingBuyerName = randomFrom(BUYER_NAMES);
          next.pendingBuyerDay = currentDay;
          newBuyers.push(`${next.name}: ${next.pendingBuyerName} quer comprar!`);
        }
      }

      return next;
    }));

    return { rentEarned, maintenancePaid, newBuyers };
  }, []);

  return {
    properties,
    availableLots: AVAILABLE_LOTS,
    buildOptions: BUILD_OPTIONS,
    buyLotAndBuild,
    listForRent,
    collectRent,
    evictTenant,
    listForSale,
    cancelSale,
    acceptBuyer,
    tickDay,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

export function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
