// Game Types - Tycoon Minimalista

export interface Product {
  id: string;
  name: string;
  displayName: string;
  icon?: string;
  space: number; // Espaço ocupado
  baseCost: number; // Custo de operação
  baseStreetPrice: number; // Preço de rua base
  currentPrice: number; // Preço atual com oscilação
  priceDirection: 'up' | 'down' | 'stable';
  riskLevel?: string;
  category?: string; // Categoria do produto
  isIllicit?: boolean; // Indica se o produto é ilícito (sujeito a apreensão)
}

export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface SelectedProduct {
  productId: string;
  quantity: number;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number; // Unidades que pode carregar
  fuelCost: number; // Custo de combustível por viagem
  price: number; // Preço original do veículo
  assigned: boolean;
  driverId?: string;
  productId?: string;
  quantity?: number;
  active: boolean; // Se está em operação
  tripStartTime?: number; // Timestamp do início da viagem
  tripDuration: number; // Duração da viagem em segundos
  seized?: boolean; // Se foi apreendido pela polícia
  seizedTime?: number; // Timestamp da apreensão
  lawyerPaid?: boolean; // Se o advogado foi pago
  towTruckPaid?: boolean; // Se o guincho foi pago
  towTruckStartTime?: number; // Timestamp do início do guincho
  broken?: boolean; // Se o veículo estragou
  brokenTime?: number; // Timestamp quando estragou
  towTruckPaidForBreakdown?: boolean; // Se o guincho foi pago para conserto
  repairPaid?: boolean; // Se o conserto na REVISA AUTOCENTER foi pago
  repairStartTime?: number; // Timestamp do início do conserto
  // Estatísticas do veículo
  tripsCompleted?: number; // Número de viagens completadas
  seizuresCount?: number; // Número de apreensões
  breakdownsCount?: number; // Número de estragos
  breakdownChance?: number; // Chance base de quebra do veículo (0-0.1)
  // Campos adicionais usados na lógica
  status?: string; // 'idle' | 'assigned' | 'traveling' etc.
  assignedProduct?: string;
  assignedQuantity?: number;
  operationalCost?: number;
  selectedProducts?: { productId: string; quantity: number }[];
}



export interface Driver {
  id: string;
  name: string;
  dailyWage: number; // Salário diário
  repairDiscount: number; // Desconto em conserto (0-1)
  breakdownChanceModifier?: number; // Modificador da chance de quebra (-1 a 1, onde -0.5 = 50% menos chance)
  seizureChanceModifier?: number; // Modificador da chance de apreensão (-1 a 1)
  experience: 'iniciante' | 'experiente';
  assigned: boolean;
  photo?: string;
  description?: string;
  vehicles?: string[];
  trait?: string;
  speedModifier?: number;
  // Campos adicionais usados na lógica
  vehicleId?: string;
  hired?: boolean;
}

export interface Stock {
  [productId: string]: number; // quantidade em estoque
}

export interface Warehouse {
  id: string;
  name: string;
  capacity: number;
  weeklyCost: number;
  unlockRequirement: number;
  description: string;
}

export interface PoliceInterception {
  vehicleId: string;
  productId: string;
  quantity: number;
  moneyLost: number;
  timestamp: number;
}



export interface PendingDelivery {
  id: string;
  buyerName: string;
  product: string;
  quantity: number;
  totalValue: number;
  reservedAt: number;
}

/**
 * Mercadoria comprada num fornecedor e que está aguardando retirada
 * por um veículo. Vai pro pool global `gameState.pendingPickups`.
 *
 * - O dinheiro já foi debitado no momento da compra (`unitCost * quantity`).
 * - Quando um veículo busca, ele pega itens FIFO até encher a capacidade.
 */
export interface PendingPickup {
  id: string;
  productId: string;
  quantity: number;
  /** Preço unitário pago ao fornecedor (pra referência/ranking). */
  unitCost: number;
  /** Id da loja onde foi comprado (define distância da viagem). */
  supplierId: string;
  /** Timestamp da compra (pra ordenar FIFO). */
  purchasedAt: number;
}

export interface VehicleSale {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleType: 'vehicle';
  salePrice: number;
  originalPrice: number;
  soldAt: number; // timestamp
  gameDay: number;
}

export interface ProductSale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalValue: number;
  profit: number;
  gameDay: number;
  soldAt: number; // timestamp
}

/**
 * Estatísticas acumuladas por produto. Usado no Galpão pra mostrar
 * preço médio de compra, preço médio de venda e último preço pago
 * — dados estratégicos pro jogador decidir quando e onde comprar/vender.
 */
export interface ProductStats {
  /** Total de unidades compradas ao longo do jogo (fornecedores). */
  totalBought: number;
  /** Total gasto em compras (dinheiro), pra calcular avg buy price. */
  totalSpent: number;
  /** Total de unidades vendidas (clientes + lojas). */
  totalSold: number;
  /** Receita bruta total (dinheiro), pra calcular avg sell price. */
  totalRevenue: number;
  /** Último preço pago por unidade em compra. 0 se nunca comprou. */
  lastPurchasePrice: number;
  /** Última venda por unidade. 0 se nunca vendeu. */
  lastSalePrice: number;
  /** Timestamp da última compra. */
  lastPurchaseAt?: number;
  /** Timestamp da última venda. */
  lastSaleAt?: number;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  purchasePrice: number; // Preço para comprar a loja
  level: number; // Nível da loja (1-5)
  maxCapacity: number; // Capacidade máxima de produtos
  sellInterval: number; // Intervalo entre vendas em segundos
  profitMultiplier: number; // Multiplicador de lucro
  products: StoreProduct[]; // Produtos depositados na loja
  owned: boolean; // Se o jogador possui a loja
  lastSaleTime: number; // Timestamp da última venda
  category: string; // Categoria de produtos que a loja vende
  customName: string; // Nome personalizado da loja
  isLocked: boolean; // Se a loja está bloqueada para novos depósitos
}

export interface StoreProduct {
  productId: string;
  quantity: number;
  depositedAt: number; // Timestamp quando foi depositado
}



export interface GameState {
  money: number;
  vehicles: Vehicle[];
  drivers: Driver[];
  motorcycles?: any[]; // Motocicletas para entregas
  stock: Stock;
  inventory?: any; // Inventário geral
  warehouseCapacity: number;
  warehouseLevel?: number; // Nível do armazém
  currentWarehouse: string;
  currentTrips?: any[]; // Viagens atuais
  lawyerHired?: boolean; // Se o advogado foi contratado
  towTruckHired?: boolean; // Se o guincho foi contratado
  lastPriceUpdate: number;
  lastWeeklyCostPaid: number;
  policeInterceptions: PoliceInterception[];
  // Cheque especial
  overdraftLimit: number; // Limite do cheque especial (30.000)
  lastInterestCalculation: number; // Último dia que os juros foram calculados
  completedOrders: number; // Número de pedidos completados
  completedSalesInCycle: number; // Vendas completadas no ciclo atual
  // Timer para geração de novos compradores
  isWaitingForNewBuyers: boolean; // Se está aguardando para gerar novos compradores
  newBuyersTimerStart: number; // Timestamp do início do timer
  newBuyersTimerDuration: number; // Duração do timer em segundos (30s)
  lastBuyerGeneration?: number; // Último dia que compradores foram gerados
  gameTime: {
    day: number;
    hour: number;
    minute: number;
    lastUpdate: number;
  };
  // Entregas
  pendingDeliveries: PendingDelivery[]; // Entregas pendentes
  /** Pool de compras nos fornecedores aguardando retirada por veículo. */
  pendingPickups: PendingPickup[];
  // Histórico de vendas de veículos
  vehicleSales: VehicleSale[]; // Histórico de vendas de veículos
  // Histórico de vendas de produtos
  productSales: ProductSale[]; // Histórico de vendas de produtos com lucro
  /** Estatísticas agregadas por productId (preço médio, último preço, etc). */
  productStats: Record<string, ProductStats>;
  // Lojas
  stores: Store[]; // Lojas disponíveis
  // Campos adicionais usados em partes legadas
  buyers?: any[];
  pending_deliveries?: any[];
  completed_orders?: number;
}

export interface MarketplaceItem {
  id: string;
  type: 'vehicle' | 'driver';
  name: string;
  price: number;
  description: string;
  specs?: any; // Especificações específicas
  unlockRequirement?: number; // Dinheiro necessário para desbloquear
  // Vehicle specific
  seller?: string;
  condition?: string;
  // Driver specific
  photo?: string;
  vehicles?: string[];
  trait?: string;
}

// =============================================================
// Mercado P2P entre jogadores
// =============================================================
export type PlayerMarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';

export interface PlayerMarketListing {
  id: string;
  seller_id: string;
  seller_name: string;
  product_id: string;
  product_name: string;
  product_icon?: string | null;
  category?: string | null;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  status: PlayerMarketListingStatus;
  buyer_id?: string | null;
  buyer_name?: string | null;
  sold_at?: string | null;
  paid_out_at?: string | null;
  created_at: string;
  expires_at: string;
}

export interface CreateListingInput {
  product_id: string;
  product_name: string;
  product_icon?: string | null;
  category?: string | null;
  quantity: number;
  price_per_unit: number;
}

export interface PurchaseResult {
  success: boolean;
  message?: string;
  listing?: PlayerMarketListing;
}

export interface PayoutResult {
  success: boolean;
  message?: string;
  total: number;
  count: number;
  listings: PlayerMarketListing[];
}