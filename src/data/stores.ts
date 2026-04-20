import { Store } from '@/types/game';

export const INITIAL_STORES: Store[] = [
  // Lojas de Tabaco & Vape
  {
    id: 'smoke_shop_downtown',
    name: 'Tabacaria do Centro',
    location: 'Centro da Cidade',
    purchasePrice: 25000,
    level: 1,
    maxCapacity: 80,
    sellInterval: 2000,
    profitMultiplier: 1.3,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'tabaco_vape',
    customName: '',
    isLocked: false
  },
  {
    id: 'vape_store_mall',
    name: 'Vape Store Shopping',
    location: 'Shopping Center',
    purchasePrice: 80000,
    level: 2,
    maxCapacity: 150,
    sellInterval: 1500,
    profitMultiplier: 1.6,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'tabaco_vape',
    customName: '',
    isLocked: false
  },

  // Lojas de Eletrônicos
  {
    id: 'electronics_downtown',
    name: 'Eletrônicos Express',
    location: 'Galeria do Centro',
    purchasePrice: 120000,
    level: 2,
    maxCapacity: 100,
    sellInterval: 3000,
    profitMultiplier: 1.8,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'eletronicos',
    customName: '',
    isLocked: false
  },
  {
    id: 'tech_megastore',
    name: 'TechMega Store',
    location: 'Shopping Technology',
    purchasePrice: 400000,
    level: 4,
    maxCapacity: 300,
    sellInterval: 2500,
    profitMultiplier: 2.2,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'eletronicos',
    customName: '',
    isLocked: false
  },

  // Lojas de Roupas & Acessórios
  {
    id: 'fashion_store',
    name: 'Moda & Estilo',
    location: 'Rua das Flores',
    purchasePrice: 60000,
    level: 1,
    maxCapacity: 200,
    sellInterval: 2200,
    profitMultiplier: 1.4,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'roupas_acessorios',
    customName: '',
    isLocked: false
  },
  {
    id: 'boutique_premium',
    name: 'Boutique Premium',
    location: 'Bairro Nobre',
    purchasePrice: 200000,
    level: 3,
    maxCapacity: 120,
    sellInterval: 1800,
    profitMultiplier: 2.0,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'roupas_acessorios',
    customName: '',
    isLocked: false
  },

  // Lojas de Ferramentas & Peças
  {
    id: 'auto_parts_shop',
    name: 'Auto Peças Silva',
    location: 'Distrito Industrial',
    purchasePrice: 150000,
    level: 2,
    maxCapacity: 250,
    sellInterval: 2800,
    profitMultiplier: 1.7,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'ferramentas_pecas',
    customName: '',
    isLocked: false
  },

  // Lojas de Bebidas
  {
    id: 'beverage_store',
    name: 'Adega & Conveniência',
    location: 'Avenida Principal',
    purchasePrice: 45000,
    level: 1,
    maxCapacity: 180,
    sellInterval: 1800,
    profitMultiplier: 1.3,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'bebidas',
    customName: '',
    isLocked: false
  },

  // Lojas de Perfumes
  {
    id: 'perfume_boutique',
    name: 'Essence Boutique',
    location: 'Shopping Luxo',
    purchasePrice: 90000,
    level: 2,
    maxCapacity: 100,
    sellInterval: 2000,
    profitMultiplier: 1.9,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'perfumes',
    customName: '',
    isLocked: false
  },

  // Lojas de Brinquedos
  {
    id: 'toy_store',
    name: 'Mundo dos Brinquedos',
    location: 'Shopping Family',
    purchasePrice: 70000,
    level: 1,
    maxCapacity: 300,
    sellInterval: 2500,
    profitMultiplier: 1.5,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'brinquedos',
    customName: '',
    isLocked: false
  },

  // Lojas Especializadas (produtos de alto risco)
  {
    id: 'underground_store',
    name: 'Loja Discreta',
    location: 'Zona Industrial',
    purchasePrice: 300000,
    level: 3,
    maxCapacity: 80,
    sellInterval: 4000,
    profitMultiplier: 3.0,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'drogas',
    customName: '',
    isLocked: false
  },
  {
    id: 'tactical_store',
    name: 'Equipamentos Táticos',
    location: 'Periferia',
    purchasePrice: 750000,
    level: 4,
    maxCapacity: 50,
    sellInterval: 6000,
    profitMultiplier: 1.9,
    products: [],
    owned: false,
    lastSaleTime: 0,
    category: 'armas',
    customName: '',
    isLocked: false
  }
];