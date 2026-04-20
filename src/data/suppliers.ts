/**
 * GSIA TRAFICS — Fornecedores (lojas de mercadorias)
 *
 * Cada loja tem catálogo próprio e preços próprios pro mesmo produto.
 * A compra desconta o dinheiro na hora; a retirada é feita depois
 * por um veículo que vai ao pool de `pendingPickups` (no useGameLogic).
 *
 * Distância é em km (afeta duração da viagem + combustível).
 *
 * Pra definir o preço por produto, usamos `priceMultiplier`: o preço
 * final é `product.baseCost * priceMultiplier`. Assim fica fácil ajustar
 * balance: quanto menor, mais barato (ex: Paraguaio = 0.7 ≈ 30% off).
 */

export interface SupplierItem {
  /** id de um Product (src/data/gameData.ts PRODUCTS) */
  productId: string;
  /** Multiplicador sobre product.baseCost pra montar o preço da loja. */
  priceMultiplier: number;
  /** Preço absoluto (se quiser sobrescrever o multiplier). */
  priceOverride?: number;
  /** Quantidade disponível por “restock”. undefined = ilimitado. */
  stockLimit?: number;
}

export interface Supplier {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  /** Distância até Goianésia em km (usado pra viagem/combustível) */
  distanceKm: number;
  /** “Vibe” da loja, usado no card (ex: oficial / contrabando / boca) */
  tag: 'oficial' | 'contrabando' | 'camelo' | 'boca' | 'atacado';
  catalog: SupplierItem[];
}

/* =============================================================
 * SUPPLIERS
 * ============================================================= */

export const SUPPLIERS: Supplier[] = [
  /* --------------------------------------------------------- */
  {
    id: 'paraguaio_utilidades',
    name: 'Paraguaio Utilidades',
    emoji: '🇵🇾',
    shortDescription: 'Contrabando baratinho de Ciudad del Este.',
    distanceKm: 480,
    tag: 'contrabando',
    catalog: [
      // Eletrônicos — forte do Paraguai
      { productId: 'celulares',         priceMultiplier: 0.75 },
      { productId: 'smart_watch',       priceMultiplier: 0.72 },
      { productId: 'notebook',          priceMultiplier: 0.70 },
      { productId: 'tv_80_pl',          priceMultiplier: 0.68 },
      { productId: 'starlinks',         priceMultiplier: 0.78 },
      { productId: 'patinete_eletrico', priceMultiplier: 0.80 },
      // Cigarros/vape de contrabando
      { productId: 'marlboro',          priceMultiplier: 0.70 },
      { productId: 'pods',              priceMultiplier: 0.72 },
      // Perfume árabe
      { productId: 'perfumes',          priceMultiplier: 0.80 },
      { productId: 'md_rosa',           priceMultiplier: 0.82 },
      // Vodka russa contrabandeada
      { productId: 'smirnoffa',         priceMultiplier: 0.72 },
    ],
  },

  /* --------------------------------------------------------- */
  {
    id: 'distribuidora_goias',
    name: 'Distribuidora Goiás',
    emoji: '🏭',
    shortDescription: 'Atacado oficial: nota fiscal, prazo curto.',
    distanceKm: 60,
    tag: 'oficial',
    catalog: [
      // Bebidas
      { productId: 'smirnoffa',           priceMultiplier: 1.10 },
      // Ferramentas e peças
      { productId: 'ferramentas',         priceMultiplier: 1.05 },
      { productId: 'pneus',               priceMultiplier: 1.08 },
      { productId: 'pecas_carros',        priceMultiplier: 1.10 },
      // Perfumes e cosméticos
      { productId: 'perfumes',            priceMultiplier: 1.15 },
      { productId: 'nobesio_extra_forte', priceMultiplier: 1.08 },
      { productId: 'md_rosa',             priceMultiplier: 1.12 },
      // Brinquedos
      { productId: 'bobigude',            priceMultiplier: 1.10 },
      // Tadalafila (farmácia)
      { productId: 'tadalafila',          priceMultiplier: 1.15 },
    ],
  },

  /* --------------------------------------------------------- */
  {
    id: 'atacadao_mercado',
    name: 'Atacadão do Mercado',
    emoji: '🛒',
    shortDescription: 'Mistureba de tudo: barato, na mão.',
    distanceKm: 120,
    tag: 'atacado',
    catalog: [
      // Cigarros
      { productId: 'marlboro',      priceMultiplier: 0.95 },
      { productId: 'pods',          priceMultiplier: 0.98 },
      // Bebidas
      { productId: 'smirnoffa',     priceMultiplier: 0.92 },
      // Roupas
      { productId: 'camiseta_peruana', priceMultiplier: 0.88 },
      { productId: 'tenis_mike',       priceMultiplier: 0.90 },
      // Brinquedos
      { productId: 'bobigude',      priceMultiplier: 0.95 },
      // Perfumes
      { productId: 'md_rosa',       priceMultiplier: 0.98 },
    ],
  },

  /* --------------------------------------------------------- */
  {
    id: 'boca_do_ze',
    name: 'Boca do Zé',
    emoji: '🕵️',
    shortDescription: 'Beco escuro do morro. Pagou, levou.',
    distanceKm: 25,
    tag: 'boca',
    catalog: [
      // Ilícitos pesados
      { productId: 'prensadao',   priceMultiplier: 1.10 },
      { productId: 'escama',      priceMultiplier: 1.20 },
      { productId: 'ice_weed',    priceMultiplier: 1.15 },
      { productId: 'bala',        priceMultiplier: 1.25 },
      // Armas
      { productId: 'armas',       priceMultiplier: 1.15 }, // Glock G19
      { productId: '357_magnum',  priceMultiplier: 1.20 },
      { productId: '38_bulldog',  priceMultiplier: 1.18 },
      { productId: '762_parafal', priceMultiplier: 1.30 },
      { productId: 'caixa_municao', priceMultiplier: 1.10 },
      // Tadalafila underground
      { productId: 'tadalafila',  priceMultiplier: 0.90 },
    ],
  },

  /* --------------------------------------------------------- */
  {
    id: 'feira_camelo',
    name: 'Feira do Camelô',
    emoji: '🏬',
    shortDescription: 'Camelô grande, de tudo um pouco.',
    distanceKm: 200,
    tag: 'camelo',
    catalog: [
      // Eletrônicos (qualidade camelô)
      { productId: 'celulares',         priceMultiplier: 0.88 },
      { productId: 'smart_watch',       priceMultiplier: 0.90 },
      { productId: 'patinete_eletrico', priceMultiplier: 0.92 },
      // Roupas
      { productId: 'camiseta_peruana',  priceMultiplier: 0.82 },
      { productId: 'tenis_mike',        priceMultiplier: 0.85 },
      // Perfumes
      { productId: 'md_rosa',           priceMultiplier: 0.92 },
      { productId: 'nobesio_extra_forte', priceMultiplier: 0.95 },
      // Cigarros & vape
      { productId: 'marlboro',          priceMultiplier: 0.90 },
      { productId: 'pods',              priceMultiplier: 0.88 },
      // Brinquedos
      { productId: 'bobigude',          priceMultiplier: 0.90 },
    ],
  },
];

/* =============================================================
 * Helpers
 * ============================================================= */

export const getSupplierById = (id: string): Supplier | undefined =>
  SUPPLIERS.find((s) => s.id === id);

export const getSupplierItem = (
  supplier: Supplier,
  productId: string
): SupplierItem | undefined => supplier.catalog.find((c) => c.productId === productId);

/** Preço final de um item na loja, dado o baseCost do produto. */
export const computeSupplierPrice = (item: SupplierItem, productBaseCost: number): number => {
  if (typeof item.priceOverride === 'number') return item.priceOverride;
  return Math.round(productBaseCost * item.priceMultiplier);
};

/** Label de UI pra cada tag. */
export const SUPPLIER_TAG_LABEL: Record<Supplier['tag'], string> = {
  oficial: 'Oficial',
  contrabando: 'Contrabando',
  camelo: 'Camelô',
  boca: 'Boca',
  atacado: 'Atacado',
};

/** Cor/estilo por tag (Tailwind utility color), pra card iOS. */
export const SUPPLIER_TAG_STYLE: Record<
  Supplier['tag'],
  { bg: string; fg: string }
> = {
  oficial:      { bg: 'hsl(211 100% 50% / 0.10)', fg: 'hsl(211 100% 40%)' },
  contrabando:  { bg: 'hsl(32 100% 50% / 0.12)',  fg: 'hsl(32 100% 36%)'  },
  camelo:       { bg: 'hsl(135 59% 49% / 0.12)',  fg: 'hsl(135 59% 32%)'  },
  boca:         { bg: 'hsl(4 100% 61% / 0.10)',   fg: 'hsl(4 100% 45%)'   },
  atacado:      { bg: 'hsl(264 80% 60% / 0.10)',  fg: 'hsl(264 80% 45%)'  },
};
