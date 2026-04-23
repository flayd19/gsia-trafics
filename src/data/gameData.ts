import { Product, Vehicle, Driver, MarketplaceItem, Warehouse, GameState, ProductCategory } from '@/types/game';
import { INITIAL_STORES } from './stores';
import { INITIAL_REPUTATION } from '@/lib/reputation';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'tabaco_vape',
    name: 'Tabaco & Vape',
    icon: '🚬',
    description: 'Cigarros e produtos de vape'
  },
  {
    id: 'eletronicos',
    name: 'Eletrônicos',
    icon: '📱',
    description: 'Celulares e dispositivos eletrônicos'
  },
  {
    id: 'drogas',
    name: 'Substâncias',
    icon: '🟫',
    description: 'Produtos de alto risco'
  },
  {
    id: 'roupas_acessorios',
    name: 'Roupas & Acessórios',
    icon: '👕',
    description: 'Vestuário e acessórios'
  },
  {
    id: 'ferramentas_pecas',
    name: 'Ferramentas & Peças',
    icon: '🔧',
    description: 'Ferramentas e peças automotivas'
  },
  {
    id: 'bebidas',
    name: 'Bebidas',
    icon: '🍺',
    description: 'Bebidas alcoólicas'
  },
  {
    id: 'perfumes',
    name: 'Perfumes',
    icon: '🌸',
    description: 'Perfumes e cosméticos'
  },
  {
    id: 'armas',
    name: 'Armamentos',
    icon: '🔫',
    description: 'Armas e munições'
  },
  {
    id: 'brinquedos',
    name: 'Brinquedos',
    icon: '🧸',
    description: 'Brinquedos e jogos'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'marlboro',
    name: 'marlboro',
    displayName: 'Marlboro (melancia)',
    icon: '🚬',
    space: 1,
    baseCost: 12,
    baseStreetPrice: 17, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 17,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'pods',
    name: 'pods',
    displayName: 'Pods Ignite',
    icon: '💨',
    space: 1,
    baseCost: 8,
    baseStreetPrice: 11, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 11,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'perfumes',
    name: 'perfumes',
    displayName: 'Perfumes árabes',
    icon: '🌸',
    space: 1,
    baseCost: 25,
    baseStreetPrice: 34, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 34,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'perfumes'
  },
  {
    id: 'celulares',
    name: 'celulares',
    displayName: 'Celulares',
    icon: '📱',
    space: 1,
    baseCost: 900,
    baseStreetPrice: 1215, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 1215,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'eletronicos'
  },
  {
    id: 'prensadao',
    name: 'prensadao',
    displayName: 'Prensadão',
    icon: '🟫',
    space: 1,
    baseCost: 180,
    baseStreetPrice: 244, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 244,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'escama',
    name: 'escama',
    displayName: 'Escama de peixe',
    icon: '🐟',
    space: 1,
    baseCost: 80,
    baseStreetPrice: 108, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 108,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'armas',
    name: 'glock G19',
    displayName: 'Glock G19',
    icon: '🔫',
    space: 1,
    baseCost: 2500,
    baseStreetPrice: 3375, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 3375,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: '357_magnum',
    name: '357 magnum',
    displayName: '357 Magnum',
    icon: '🔫',
    space: 1,
    baseCost: 1800,
    baseStreetPrice: 2430, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 2430,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: '762_parafal',
    name: '762 parafal',
    displayName: '762 Parafal',
    icon: '🔫',
    space: 4,
    baseCost: 11000,
    baseStreetPrice: 17270, // 57% acima do custo (11000 * 1.57)
    currentPrice: 17270,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: '38_bulldog',
    name: '38 bulldog',
    displayName: '.38 Bulldog',
    icon: '🔫',
    space: 1,
    baseCost: 1250,
    baseStreetPrice: 1688, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 1688,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: 'smirnoffa',
    name: 'smirnoffa',
    displayName: 'Smirnoffa',
    icon: '🍺',
    space: 1,
    baseCost: 18,
    baseStreetPrice: 25, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 25,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'bebidas'
  },
  {
    id: 'camiseta_peruana',
    name: 'camiseta_peruana',
    displayName: 'Camiseta Peruana',
    icon: '👕',
    space: 1,
    baseCost: 15,
    baseStreetPrice: 21, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 21,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'roupas_acessorios'
  },
  {
    id: 'tenis_mike',
    name: 'tenis_mike',
    displayName: 'Tênis da Mike',
    icon: '👟',
    space: 1,
    baseCost: 60,
    baseStreetPrice: 81, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 81,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'roupas_acessorios'
  },
  {
    id: 'ferramentas',
    name: 'ferramentas',
    displayName: 'Ferramentas',
    icon: '🔨',
    space: 1,
    baseCost: 45,
    baseStreetPrice: 61, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 61,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'ferramentas_pecas'
  },
  {
    id: 'pneus',
    name: 'pneus',
    displayName: 'Pneus',
    icon: '🛞',
    space: 2,
    baseCost: 70,
    baseStreetPrice: 95, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 95,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'ferramentas_pecas'
  },
  {
    id: 'pecas_carros',
    name: 'pecas_carros',
    displayName: 'Peças de Carros',
    icon: '🔧',
    space: 1,
    baseCost: 90,
    baseStreetPrice: 122, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 122,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'ferramentas_pecas'
  },
  {
    id: 'bobigude',
    name: 'bobigude',
    displayName: 'Bobigude',
    icon: '🧸',
    space: 1,
    baseCost: 15,
    baseStreetPrice: 21, // Preço mínimo calculado (1.4x do custo)
    currentPrice: 21,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'brinquedos'
  },
  {
    id: 'starlinks',
    name: 'starlinks',
    displayName: 'Starlinks',
    icon: '📡',
    space: 1,
    baseCost: 450,
    baseStreetPrice: 630, // Preço mínimo calculado (1.4x do custo)
    currentPrice: 630,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos'
  },
  {
    id: 'patinete_eletrico',
    name: 'patinete_eletrico',
    displayName: 'Patinete Elétrico',
    icon: '🛴',
    space: 6,
    baseCost: 2800,
    baseStreetPrice: 3780, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 3780,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos'
  },
  {
    id: 'nobesio_extra_forte',
    name: 'nobesio_extra_forte',
    displayName: 'Nobésio Extra Forte',
    icon: '💊',
    space: 1,
    baseCost: 350,
    baseStreetPrice: 473, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 473,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'tadalafila',
    name: 'tadalafila',
    displayName: 'Tadalafila',
    icon: '💙',
    space: 1,
    baseCost: 280,
    baseStreetPrice: 378, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 378,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'md_rosa',
    name: 'md_rosa',
    displayName: 'MD Rosa',
    icon: '🌸',
    space: 1,
    baseCost: 420,
    baseStreetPrice: 567, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 567,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'bala',
    name: 'bala',
    displayName: 'Bala',
    icon: '🍭',
    space: 1,
    baseCost: 320,
    baseStreetPrice: 432, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 432,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'ice_weed',
    name: 'ice_weed',
    displayName: 'Ice Weed',
    icon: '❄️',
    space: 1,
    baseCost: 500,
    baseStreetPrice: 675, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 675,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'drogas',
    isIllicit: true
  },
  {
    id: 'caixa_municao',
    name: 'caixa_municao',
    displayName: 'Caixa de Munição',
    icon: '📦',
    space: 2,
    baseCost: 800,
    baseStreetPrice: 1080, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 1080,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: 'smart_watch',
    name: 'smart_watch',
    displayName: 'Smart Watch',
    icon: '⌚',
    space: 1,
    baseCost: 350,
    baseStreetPrice: 473, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 473,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos'
  },
  {
    id: 'notebook',
    name: 'notebook',
    displayName: 'Notebook',
    icon: '💻',
    space: 3,
    baseCost: 2200,
    baseStreetPrice: 2970, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 2970,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos'
  },
  {
    id: 'tv_80_pl',
    name: 'tv_80_pl',
    displayName: 'Televisão 80 PL',
    icon: '📺',
    space: 10,
    baseCost: 4500,
    baseStreetPrice: 6075, // Preço mínimo calculado (1.35x do custo)
    currentPrice: 6075,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos'
  },
  // =====================================================
  // CAIXAS (produtos em caixa — desconto por volume)
  // =====================================================
  {
    id: 'caixa_pods',
    name: 'caixa_pods',
    displayName: 'Caixa de Pods (12un)',
    icon: '📦',
    space: 12,
    baseCost: 88, // 8 × 12 = 96 -> desconto ~8% por volume
    baseStreetPrice: 132, // 1.5x do custo (margem maior pro atacado)
    currentPrice: 132,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape',
    boxContents: { productId: 'pods', units: 12 }
  },
  {
    id: 'caixa_smirnoffa',
    name: 'caixa_smirnoffa',
    displayName: 'Caixa de Smirnoffa (10un)',
    icon: '📦',
    space: 10,
    baseCost: 162, // 18 × 10 = 180 -> desconto 10%
    baseStreetPrice: 243, // 1.5x do custo
    currentPrice: 243,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'bebidas',
    boxContents: { productId: 'smirnoffa', units: 10 }
  },
  {
    id: 'caixa_marlboro',
    name: 'caixa_marlboro',
    displayName: 'Caixa de Marlboro (10un)',
    icon: '📦',
    space: 10,
    baseCost: 108, // 12 × 10 = 120 -> desconto 10%
    baseStreetPrice: 162, // 1.5x do custo
    currentPrice: 162,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape',
    boxContents: { productId: 'marlboro', units: 10 }
  },
  {
    id: 'caixa_perfumes',
    name: 'caixa_perfumes',
    displayName: 'Caixa de Perfumes (8un)',
    icon: '📦',
    space: 8,
    baseCost: 180, // 25 × 8 = 200 -> desconto 10%
    baseStreetPrice: 270,
    currentPrice: 270,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'perfumes',
    boxContents: { productId: 'perfumes', units: 8 }
  },
  {
    id: 'caixa_municao_762',
    name: 'caixa_municao_762',
    displayName: 'Caixa Munição 7.62 (50un)',
    icon: '📦',
    space: 3,
    baseCost: 1200,
    baseStreetPrice: 1800,
    currentPrice: 1800,
    priceDirection: 'stable',
    riskLevel: 'alto',
    category: 'armas',
    isIllicit: true
  },
  {
    id: 'caixa_starlinks',
    name: 'caixa_starlinks',
    displayName: 'Caixa de Starlinks (5un)',
    icon: '📦',
    space: 5,
    baseCost: 20250, // 4500 × 5 = 22500 -> desconto 10%
    baseStreetPrice: 30375, // 1.5x do custo
    currentPrice: 30375,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'eletronicos',
    boxContents: { productId: 'starlinks', units: 5 }
  },
  {
    id: 'caixa_camiseta_peruana',
    name: 'caixa_camiseta_peruana',
    displayName: 'Caixa de Camisetas Peruanas (40un)',
    icon: '📦',
    space: 40,
    baseCost: 1080, // 30 × 40 = 1200 -> desconto 10%
    baseStreetPrice: 1620,
    currentPrice: 1620,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'roupas',
    boxContents: { productId: 'camiseta_peruana', units: 40 }
  },
  {
    id: 'caixa_perfumes_grande',
    name: 'caixa_perfumes_grande',
    displayName: 'Caixa Grande de Perfumes (50un)',
    icon: '📦',
    space: 50,
    baseCost: 1125, // 25 × 50 = 1250 -> desconto 10%
    baseStreetPrice: 1688,
    currentPrice: 1688,
    priceDirection: 'stable',
    riskLevel: 'médio',
    category: 'perfumes',
    boxContents: { productId: 'perfumes', units: 50 }
  },
  // =====================================================
  // VARIAÇÕES DE SABORES — Pods
  // =====================================================
  {
    id: 'pods_manga',
    name: 'pods_manga',
    displayName: 'Pods Manga Gelada',
    icon: '🥭',
    space: 1,
    baseCost: 9,
    baseStreetPrice: 13,
    currentPrice: 13,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'pods_menta',
    name: 'pods_menta',
    displayName: 'Pods Menta Ice',
    icon: '🌿',
    space: 1,
    baseCost: 9,
    baseStreetPrice: 13,
    currentPrice: 13,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'pods_uva',
    name: 'pods_uva',
    displayName: 'Pods Uva Black',
    icon: '🍇',
    space: 1,
    baseCost: 10,
    baseStreetPrice: 14,
    currentPrice: 14,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'pods_morango',
    name: 'pods_morango',
    displayName: 'Pods Morango Kiwi',
    icon: '🍓',
    space: 1,
    baseCost: 10,
    baseStreetPrice: 14,
    currentPrice: 14,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  // =====================================================
  // VARIAÇÕES DE SABORES — Marlboro
  // =====================================================
  {
    id: 'marlboro_red',
    name: 'marlboro_red',
    displayName: 'Marlboro Vermelho',
    icon: '🚬',
    space: 1,
    baseCost: 13,
    baseStreetPrice: 18,
    currentPrice: 18,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'marlboro_menthol',
    name: 'marlboro_menthol',
    displayName: 'Marlboro Menthol',
    icon: '🚬',
    space: 1,
    baseCost: 14,
    baseStreetPrice: 19,
    currentPrice: 19,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  {
    id: 'marlboro_gold',
    name: 'marlboro_gold',
    displayName: 'Marlboro Gold',
    icon: '🚬',
    space: 1,
    baseCost: 14,
    baseStreetPrice: 19,
    currentPrice: 19,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'tabaco_vape'
  },
  // =====================================================
  // VARIAÇÕES DE SABORES — Smirnoffa
  // =====================================================
  {
    id: 'smirnoffa_frutas',
    name: 'smirnoffa_frutas',
    displayName: 'Smirnoffa Frutas Vermelhas',
    icon: '🍒',
    space: 1,
    baseCost: 20,
    baseStreetPrice: 27,
    currentPrice: 27,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'bebidas'
  },
  {
    id: 'smirnoffa_limao',
    name: 'smirnoffa_limao',
    displayName: 'Smirnoffa Limão',
    icon: '🍋',
    space: 1,
    baseCost: 19,
    baseStreetPrice: 26,
    currentPrice: 26,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'bebidas'
  },
  {
    id: 'smirnoffa_tropical',
    name: 'smirnoffa_tropical',
    displayName: 'Smirnoffa Tropical',
    icon: '🍍',
    space: 1,
    baseCost: 20,
    baseStreetPrice: 27,
    currentPrice: 27,
    priceDirection: 'stable',
    riskLevel: 'baixo',
    category: 'bebidas'
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'monza1',
    name: 'Monza 1997',
    capacity: 200,
    fuelCost: 300,
    price: 15000,
    assigned: true,
    driverId: 'felipe', // Felipe já atribuído
    active: false,
    tripDuration: 33.75, // +50% (22.5 -> 33.75)
    breakdownChance: 0.10 // +5% (0.05 -> 0.10)
  }
];



export const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'felipe',
    name: 'Felipe Mendes',
    dailyWage: 257,
    repairDiscount: 0,
    breakdownChanceModifier: 0.1, // 10% mais chance de quebrar (inexperiente)
    seizureChanceModifier: 0.1, // 10% mais chance de apreensão (inexperiente)
    speedModifier: 0.05, // 5% mais lento (inexperiente)
    experience: 'iniciante',
    assigned: true,
    photo: '/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png',
    description: 'Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.',
    vehicles: ['Monza', 'Uno'],
    trait: 'Confiável mas inexperiente'
  }
];

export const MARKETPLACE_VEHICLES: MarketplaceItem[] = [
  {
    id: 'monza',
    type: 'vehicle',
    name: 'Monza 1994',
    price: 20250,
    description: 'Preto • Doc atrasado • Passagem por leilão',
    seller: 'Paulo Vitor',
    condition: 'Baixa quilometragem',
    specs: { capacity: 200, fuelCost: 300, tripDuration: 33.75, breakdownChance: 0.10 },
    levelRequirement: 1
  },
  {
    id: 'uno',
    type: 'vehicle',
    name: 'Uno 2002',
    price: 10800,
    description: 'Vermelho • Tenho recibo • Precisa só de uma tinta',
    seller: 'Paulo Vitor',
    condition: 'Bem conservado',
    specs: { capacity: 80, fuelCost: 150, tripDuration: 25.88, breakdownChance: 0.13 },
    unlockRequirement: 0,
    levelRequirement: 2
  },
  {
    id: 'kombi',
    type: 'vehicle',
    name: 'Kombi 1998',
    price: 29700,
    description: 'Branca • Baixa quilometragem • Revisão vencida',
    seller: 'Paulo Vitor',
    condition: 'Para reforma',
    specs: { capacity: 300, fuelCost: 400, tripDuration: 38.25, breakdownChance: 0.12 },
    unlockRequirement: 25000,
    levelRequirement: 8
  },
  {
    id: 'courier',
    type: 'vehicle',
    name: 'Ford Courier 2008',
    price: 37800,
    description: 'Branca • Era da Aços FM • Não transfere',
    seller: 'Paulo Vitor',
    condition: 'Motor revisado',
    specs: { capacity: 250, fuelCost: 350, tripDuration: 29.25, breakdownChance: 0.11 },
    unlockRequirement: 50000,
    levelRequirement: 12
  },
  {
    id: 'van',
    type: 'vehicle',
    name: 'Van Mercedes 2010',
    price: 60750,
    description: 'Branca • Diesel • Para transportadora',
    seller: 'Paulo Vitor',
    condition: 'Excelente estado',
    specs: { capacity: 500, fuelCost: 600, tripDuration: 42.75, breakdownChance: 0.09 },
    unlockRequirement: 100000,
    levelRequirement: 20
  },
  {
    id: 'escort',
    type: 'vehicle',
    name: 'Escort Conversível',
    price: 148500,
    description: 'Roxo • Hot Wheels • Sonho do 13BPM',
    seller: 'Paulo Vitor',
    condition: 'Restaurado',
    specs: { capacity: 400, fuelCost: 500, tripDuration: 18, breakdownChance: 0.08 },
    unlockRequirement: 80000,
    levelRequirement: 30
  },
  {
    id: 'fiat500',
    type: 'vehicle',
    name: 'Fiat 500',
    price: 60750,
    description: 'Rosa • Compacto • Carro de menina',
    seller: 'Paulo Vitor',
    condition: 'Bem conservado',
    specs: { capacity: 150, fuelCost: 200, tripDuration: 22.5, breakdownChance: 0.10 },
    unlockRequirement: 30000,
    levelRequirement: 5
  },
  {
    id: 'jetta',
    type: 'vehicle',
    name: 'Jetta Stage 2',
    price: 81000,
    description: 'Preto • Preparado para racha • Motor turbinado',
    seller: 'Paulo Vitor',
    condition: 'Modificado',
    specs: { capacity: 250, fuelCost: 500, tripDuration: 22.5, breakdownChance: 0.14 },
    unlockRequirement: 40000,
    levelRequirement: 15
  },
  {
    id: 'bmw320i',
    type: 'vehicle',
    name: 'BMW 320i Hot Wheels',
    price: 135000,
    description: 'Azul escuro • O terror do Jetta • Recuperada de financiamento',
    seller: 'Paulo Vitor',
    condition: 'Impecável',
    specs: { capacity: 350, fuelCost: 450, tripDuration: 21, breakdownChance: 0.07 },
    unlockRequirement: 70000,
    levelRequirement: 40
  },
  {
    id: 'amarok',
    type: 'vehicle',
    name: 'Amarok 2012',
    price: 94500,
    description: 'Branca • Motor recém feito • Sem garantia • Não tem garantia • Se estragar não me ligue',
    seller: 'Paulo Vitor',
    condition: 'Robusta',
    specs: { capacity: 400, fuelCost: 550, tripDuration: 28.5, breakdownChance: 0.15 },
    unlockRequirement: 50000,
    levelRequirement: 25
  },
  {
    id: 'bell206',
    type: 'vehicle',
    name: 'Helicóptero Bell 206',
    price: 2430000,
    description: 'Azul • Era de garimpo ilegal • Documentação regularizada',
    seller: 'Paulo Vitor',
    condition: 'Operacional',
    specs: { capacity: 800, fuelCost: 2000, tripDuration: 10.5, breakdownChance: 0.06 },
    unlockRequirement: 1500000,
    levelRequirement: 85
  },
  {
    id: 'fh540',
    type: 'vehicle',
    name: 'FH540 Rodotrem Azul',
    price: 1620000,
    description: 'Azul • Caminhão pesado • Capacidade máxima de carga',
    seller: 'Paulo Vitor',
    condition: 'Excelente estado',
    specs: { capacity: 2800, fuelCost: 1500, tripDuration: 57, breakdownChance: 0.07 },
    unlockRequirement: 800000,
    levelRequirement: 75
  },
  {
    id: 'scania440',
    type: 'vehicle',
    name: 'Scania 440 Gray',
    price: 945000,
    description: 'Cinza • Caminhão robusto • Ideal para cargas pesadas',
    seller: 'Paulo Vitor',
    condition: 'Bem conservado',
    specs: { capacity: 1500, fuelCost: 1200, tripDuration: 48, breakdownChance: 0.08 },
    unlockRequirement: 500000,
    levelRequirement: 55
  },


];

export const MARKETPLACE_DRIVERS: MarketplaceItem[] = [
  {
    id: 'felipe',
    type: 'driver',
    name: 'Felipe Mendes',
    price: 0,
    photo: '/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png',
    description: 'Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.',
    vehicles: ['Monza', 'Uno'],
    trait: 'Confiável mas inexperiente',
    specs: { dailyWage: 257, repairDiscount: 0, breakdownChanceModifier: 0.1, seizureChanceModifier: 0.1, speedModifier: 0.05, experience: 'iniciante' },
    levelRequirement: 1
  },
  {
    id: 'will',
    type: 'driver',
    name: 'Will Carlos',
    price: 3000,
    photo: '/lovable-uploads/bb789fd2-397a-40d3-a564-27be1ef12137.png',
    description: 'Meio desligado, mas de alta confiança. Cuidado: pode fumar toda a mercadoria.',
    vehicles: ['Kombi', 'Ford Courier'],
    trait: 'Confiável mas distraído',
    specs: { dailyWage: 314, repairDiscount: 0.1, breakdownChanceModifier: 0.05, seizureChanceModifier: 0, speedModifier: 0, experience: 'experiente' },
    unlockRequirement: 15000,
    levelRequirement: 5
  },
  {
    id: 'pedro',
    type: 'driver',
    name: 'Pedro Félix',
    price: 4500,
    photo: '/lovable-uploads/727b93a8-ba2f-4f5e-9f09-f9c8c27a3f5c.png',
    description: 'Ex-caminhoneiro, conhece todos os atalhos… mas não gosta de pedágio.',
    vehicles: ['Ford Courier', 'Caminhões'],
    trait: 'Conhece atalhos',
    specs: { dailyWage: 400, repairDiscount: 0.15, breakdownChanceModifier: -0.1, seizureChanceModifier: -0.15, speedModifier: -0.1, experience: 'experiente' },
    unlockRequirement: 25000,
    levelRequirement: 12
  },
  {
    id: 'guizin',
    type: 'driver',
    name: 'Guizin Henrique 062',
    price: 6000,
    photo: '/lovable-uploads/36042e71-4a00-44f7-a5ca-c6e2e819a278.png',
    description: 'Fala pouco, dirige muito. Discreto e eficiente.',
    vehicles: ['Sedans'],
    trait: 'Discreto e rápido',
    specs: { dailyWage: 343, repairDiscount: 0.2, breakdownChanceModifier: -0.15, seizureChanceModifier: -0.2, speedModifier: -0.15, experience: 'experiente' },
    unlockRequirement: 35000,
    levelRequirement: 22
  },
  {
    id: 'alife',
    type: 'driver',
    name: 'Alife Hotwheels',
    price: 5500,
    photo: '/lovable-uploads/5b317cf1-8fae-4ee8-837f-286375ff8866.png',
    description: 'Rápido e veloz, mas pode bater o carro.',
    vehicles: ['Sedans'],
    trait: 'Velocidade + Risco',
    specs: { dailyWage: 371, repairDiscount: -0.1, breakdownChanceModifier: 0.25, seizureChanceModifier: 0.05, speedModifier: -0.15, experience: 'experiente' },
    unlockRequirement: 30000,
    levelRequirement: 18
  },
  {
    id: 'bruno',
    type: 'driver',
    name: 'Bruno Catatau',
    price: 8000,
    photo: '/lovable-uploads/d286050a-f66d-4610-9c83-5c75f42f0b0e.png',
    description: 'Pilota sedans e caminhões. Adora trazer eletrônicos, mas a polícia suspeita muito dele.',
    vehicles: ['Sedans', 'Caminhões'],
    trait: 'Especialista em eletrônicos',
    specs: { dailyWage: 457, repairDiscount: 0.25, breakdownChanceModifier: -0.2, seizureChanceModifier: -0.25, speedModifier: -0.2, experience: 'experiente' },
    unlockRequirement: 60000,
    levelRequirement: 35
  },
  {
    id: 'bemba',
    type: 'driver',
    name: 'Bemba',
    price: 4000,
    photo: '/lovable-uploads/bd411b15-6b33-4e85-a306-695f245b70b3.png',
    description: 'Ranzinza, já está velho pra isso. Qualquer carro estraga na mão dele.',
    vehicles: ['Pickups', 'Caminhões'],
    trait: 'Veterano problemático',
    specs: { dailyWage: 357, repairDiscount: 0.05, breakdownChanceModifier: 0.15, seizureChanceModifier: 0.1, speedModifier: -0.05, experience: 'experiente' },
    unlockRequirement: 40000,
    levelRequirement: 28
  },
  {
    id: 'neguin',
    type: 'driver',
    name: 'Neguin Morcego',
    price: 3500,
    photo: '/lovable-uploads/cc40e030-1f88-4af5-bbf8-4377dfd2712d.png',
    description: 'Não entende de mecânica, mas trabalha bastante pra sustentar 5 filhos.',
    vehicles: ['Todos'],
    trait: 'Trabalhador dedicado',
    specs: { dailyWage: 286, repairDiscount: 0, breakdownChanceModifier: 0.2, seizureChanceModifier: 0.15, speedModifier: 0.1, experience: 'iniciante' },
    unlockRequirement: 20000,
    levelRequirement: 8
  },
  {
      id: 'catitu',
      type: 'driver',
      name: 'José Catitu',
      price: 10000,
      photo: '/lovable-uploads/54c76870-b0fc-4412-8fe6-a21ec8f572ce.png',
      description: 'Muito experiente no ramo, mas a polícia acha o rosto dele familiar.',
      vehicles: ['Todos'],
      trait: 'Veterano conhecido',
      specs: { dailyWage: 543, repairDiscount: 0.4, breakdownChanceModifier: -0.2, seizureChanceModifier: 0.5, speedModifier: -0.05, experience: 'experiente' },
      unlockRequirement: 80000,
      levelRequirement: 60
    },
    {
      id: 'diego',
      type: 'driver',
      name: 'Diego Gonçalves',
      price: 7500,
      photo: '/lovable-uploads/7b19f1b8-e9d8-49b1-b438-9071b97deb03.png',
      description: 'Velocidade não é seu forte, mas o carro nunca estraga. A polícia acha ele um rapaz bacana.',
      vehicles: ['Todos'],
      trait: 'Cara limpa',
      specs: { dailyWage: 429, repairDiscount: 0.5, breakdownChanceModifier: -0.5, seizureChanceModifier: -0.8, speedModifier: 0.05, experience: 'experiente' },
      unlockRequirement: 50000,
      levelRequirement: 45
    }
];

export const WAREHOUSES: Warehouse[] = [
  {
    id: 'rua36',
    name: 'Galpão da Rua 36',
    capacity: 1080, // Reduzido 25% (1440 -> 1080)
    weeklyCost: 2240,
    unlockRequirement: 0,
    levelRequirement: 1,
    description: 'Seu primeiro galpão. Localização discreta e boa para começar.'
  },
  {
    id: 'sublime',
    name: 'Galpão Sublime',
    capacity: 2700, // Reduzido 25% (3600 -> 2700)
    weeklyCost: 4480,
    unlockRequirement: 200000,
    levelRequirement: 10,
    description: 'Galpão de médio porte com melhor estrutura e segurança.'
  },
  {
    id: 'manelino',
    name: 'Complexo de Galpões do Manelino',
    capacity: 6480, // Reduzido 25% (8640 -> 6480)
    weeklyCost: 11200,
    unlockRequirement: 500000,
    levelRequirement: 25,
    description: 'Complexo avançado com múltiplos galpões e infraestrutura completa.'
  },
  {
    id: 'pedeboi',
    name: 'Galpão do Pé de Boi',
    capacity: 15000, // Reduzido 25% (20000 -> 15000)
    weeklyCost: 22400,
    unlockRequirement: 1000000,
    levelRequirement: 45,
    description: 'O maior galpão da região. Capacidade massiva para operações de grande escala.'
  },
  {
    id: 'vale_industrial',
    name: 'Galpão Industrial do Vale',
    capacity: 28000,
    weeklyCost: 42000,
    unlockRequirement: 2500000,
    levelRequirement: 70,
    description: 'Galpão industrial blindado, contratado por empresários discretos. Segurança máxima.'
  },
  {
    id: 'mega_logistico',
    name: 'Mega Complexo Logístico',
    capacity: 48000,
    weeklyCost: 75000,
    unlockRequirement: 5000000,
    levelRequirement: 90,
    description: 'O topo do topo. Estrutura de transportadora premium com múltiplas docas e câmeras.'
  }
];

export const INITIAL_GAME_STATE: GameState = {
  money: 40000, // Saldo inicial de R$ 40.000
  vehicles: INITIAL_VEHICLES,
  drivers: INITIAL_DRIVERS,
  stock: {},
  warehouseCapacity: 1080, // Reduzido 25% (1440 -> 1080)
  currentWarehouse: 'rua36',
  lastPriceUpdate: 0,
  lastWeeklyCostPaid: 1, // Start with day 1
  policeInterceptions: [],
  // Overdraft system
  overdraftLimit: -30000, // Limite negativo de R$ 30.000
  lastInterestCalculation: 1, // Último dia que os juros foram calculados
  completedOrders: 0,
  completedSalesInCycle: 0, // Vendas completadas no ciclo atual
  // Timer para geração de novos compradores
  isWaitingForNewBuyers: false,
  newBuyersTimerStart: 0,
  newBuyersTimerDuration: 30, // 30 segundos
  gameTime: {
    day: 1,
    hour: 6,
    minute: 0,
    lastUpdate: Date.now()
  },
  // deliveryBikes removido - usando motorcycles para entregas
  pendingDeliveries: [],
  /** Pool de mercadorias compradas em fornecedores aguardando retirada. */
  pendingPickups: [],
  vehicleSales: [],
  productSales: [],
  /** Estatísticas acumuladas por produto (preço médio, último preço, etc). */
  productStats: {},
  // Lojas
  stores: INITIAL_STORES,
  // Reputação / Nível
  reputation: { ...INITIAL_REPUTATION }

};