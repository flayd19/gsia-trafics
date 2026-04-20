import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, Minus, Plus, Package2, ShoppingCart, TrendingDown, TrendingUp, Clock, X } from 'lucide-react';
import {
  SUPPLIERS,
  Supplier,
  SupplierItem,
  computeSupplierPrice,
  getSupplierById,
  SUPPLIER_TAG_LABEL,
  SUPPLIER_TAG_STYLE,
} from '@/data/suppliers';
import { GameState, PendingPickup, Product } from '@/types/game';
import { cn } from '@/lib/utils';

interface SuppliersScreenProps {
  gameState: GameState;
  products: Product[];
  onBuyFromSupplier: (supplierId: string, productId: string, quantity: number) => boolean;
  /**
   * Preço unitário *com jitter de mercado* (±10%). Se ausente, a tela cai
   * no cálculo base estático. Sempre que possível, passe esse getter.
   */
  getSupplierUnitPrice?: (supplierId: string, productId: string) => number;
  /**
   * Cancela uma compra pendente (reembolsa dinheiro e remove do pool).
   */
  onCancelPendingPickup?: (pickupId: string) => boolean;
  /**
   * Prazo máximo (ms) antes de um PendingPickup expirar automaticamente.
   * Default: 3 min.
   */
  pickupExpirationMs?: number;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

/* ================================================================
 * PICKUP CARD (sub-aba Retirada) — countdown de 3 min
 * ================================================================ */

const PickupCard: React.FC<{
  pickup: PendingPickup;
  product: Product | undefined;
  supplier: Supplier | undefined;
  expirationMs: number;
  onCancel: () => void;
}> = ({ pickup, product, supplier, expirationMs, onCancel }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - pickup.purchasedAt;
  const remainingMs = Math.max(0, expirationMs - elapsed);
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;

  const pct = Math.max(0, Math.min(100, (remainingMs / expirationMs) * 100));
  const urgent = remainingMs <= 30_000; // último 30s: vermelho
  const warning = remainingMs <= 60_000; // último 1min: amarelo

  const barColor = urgent
    ? 'bg-danger'
    : warning
    ? 'bg-warning'
    : 'bg-primary';
  const timeColor = urgent
    ? 'text-danger'
    : warning
    ? 'text-warning'
    : 'text-foreground';

  const refund = pickup.unitCost * pickup.quantity;

  return (
    <Card className="ios-surface p-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-muted flex items-center justify-center text-xl shrink-0">
          {product?.icon || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-[14px] text-foreground truncate">
              {pickup.quantity}× {product?.displayName || pickup.productId}
            </h4>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {supplier?.emoji} {supplier?.name || pickup.supplierId} ·{' '}
            <span className="tabular-nums">{formatMoney(refund)}</span>
          </div>
        </div>
        <div className={cn('flex items-center gap-1 font-bold tabular-nums text-[14px]', timeColor)}>
          <Clock size={14} />
          {timeStr}
        </div>
      </div>

      {/* Barra de progresso do countdown */}
      <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-1000 ease-linear', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {urgent
            ? '⏰ quase expirando'
            : warning
            ? 'retire logo'
            : 'aguardando veículo'}
        </div>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[12px] text-danger hover:bg-danger/10 hover:text-danger"
        >
          <X size={12} className="mr-1" />
          Cancelar
        </Button>
      </div>
    </Card>
  );
};

/* ================================================================
 * SUPPLIER LIST (root view)
 * ================================================================ */

const SupplierCard: React.FC<{
  supplier: Supplier;
  pendingUnits: number;
  onClick: () => void;
}> = ({ supplier, pendingUnits, onClick }) => {
  const tagStyle = SUPPLIER_TAG_STYLE[supplier.tag];
  return (
    <button
      onClick={onClick}
      className="w-full text-left active:scale-[0.99] transition"
    >
      <Card className="ios-surface p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl shadow-sm"
          style={{ background: 'hsl(var(--muted))' }}
        >
          {supplier.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-game-title text-[15px] font-bold text-foreground truncate">
              {supplier.name}
            </h3>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider"
              style={{ background: tagStyle.bg, color: tagStyle.fg }}
            >
              {SUPPLIER_TAG_LABEL[supplier.tag]}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {supplier.shortDescription}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>📍 {supplier.distanceKm} km</span>
            <span>🛒 {supplier.catalog.length} itens</span>
            {pendingUnits > 0 && (
              <span className="text-primary font-semibold">
                📦 {pendingUnits} pendentes
              </span>
            )}
          </div>
        </div>

        <div className="text-muted-foreground">›</div>
      </Card>
    </button>
  );
};

/* ================================================================
 * SUPPLIER DETAIL (catalog)
 * ================================================================ */

const SupplierCatalogItem: React.FC<{
  item: SupplierItem;
  product: Product;
  supplierId: string;
  money: number;
  overdraftLimit: number;
  onBuy: (productId: string, quantity: number) => void;
  getSupplierUnitPrice?: (supplierId: string, productId: string) => number;
}> = ({ item, product, supplierId, money, overdraftLimit, onBuy, getSupplierUnitPrice }) => {
  const [qty, setQty] = useState(1);

  // Preço "de tabela" do fornecedor (sem jitter) — usado como referência
  // pra mostrar se o mercado tá subindo ou descendo agora.
  const tablePrice = computeSupplierPrice(item, product.baseCost);
  const jitteredUnitPrice = getSupplierUnitPrice
    ? getSupplierUnitPrice(supplierId, product.id)
    : 0;
  const unitPrice = jitteredUnitPrice > 0 ? jitteredUnitPrice : tablePrice;
  const total = unitPrice * qty;

  const basePrice = product.baseCost;
  const discountPct = Math.round(((basePrice - unitPrice) / basePrice) * 100);

  // Variação vs. preço de tabela do fornecedor (mostra se o mercado subiu/desceu)
  const marketDeltaPct =
    tablePrice > 0
      ? Math.round(((unitPrice - tablePrice) / tablePrice) * 100)
      : 0;

  // overdraftLimit é negativo (ex.: -30000). Saldo pós-compra precisa ficar >= overdraft.
  const canAfford = money - total >= overdraftLimit;

  return (
    <Card className="ios-surface p-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-muted flex items-center justify-center text-xl shrink-0">
          {product.icon || '📦'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[14px] text-foreground truncate">
              {product.displayName}
            </h4>
            {product.isIllicit && (
              <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded font-bold">
                ⚠️ ilícito
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mt-0.5 tabular-nums flex-wrap">
            <span className="font-semibold text-foreground">{formatMoney(unitPrice)}</span>
            <span>/un</span>
            {discountPct !== 0 && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  discountPct > 0
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                )}
              >
                {discountPct > 0 ? `−${discountPct}%` : `+${Math.abs(discountPct)}%`} vs. base
              </span>
            )}
            {Math.abs(marketDeltaPct) >= 1 && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded',
                  marketDeltaPct < 0
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
                )}
                title="Oscilação de mercado do momento"
              >
                {marketDeltaPct < 0 ? (
                  <TrendingDown size={10} />
                ) : (
                  <TrendingUp size={10} />
                )}
                {marketDeltaPct > 0 ? `+${marketDeltaPct}%` : `${marketDeltaPct}%`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stepper + Buy */}
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center bg-muted rounded-[10px] overflow-hidden">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-8 h-8 flex items-center justify-center active:bg-muted-foreground/10"
            aria-label="Diminuir"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setQty(Number.isFinite(n) && n > 0 ? n : 1);
            }}
            className="w-12 text-center bg-transparent text-[14px] font-bold tabular-nums outline-none"
          />
          <button
            onClick={() => setQty((q) => q + 1)}
            className="w-8 h-8 flex items-center justify-center active:bg-muted-foreground/10"
            aria-label="Aumentar"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Total
          </div>
          <div className="text-[14px] font-bold tabular-nums text-foreground">
            {formatMoney(total)}
          </div>
        </div>

        <Button
          size="sm"
          disabled={!canAfford}
          onClick={() => {
            onBuy(product.id, qty);
            setQty(1);
          }}
          className="h-9"
        >
          <ShoppingCart size={14} className="mr-1" />
          Comprar
        </Button>
      </div>
    </Card>
  );
};

const SupplierDetail: React.FC<{
  supplier: Supplier;
  products: Product[];
  money: number;
  overdraftLimit: number;
  pendingFromThis: PendingPickup[];
  onBack: () => void;
  onBuy: (productId: string, quantity: number) => void;
  getSupplierUnitPrice?: (supplierId: string, productId: string) => number;
}> = ({ supplier, products, money, overdraftLimit, pendingFromThis, onBack, onBuy, getSupplierUnitPrice }) => {
  const tagStyle = SUPPLIER_TAG_STYLE[supplier.tag];

  // Agrupa por categoria pra organização
  const groupedItems = useMemo(() => {
    const map = new Map<string, { item: SupplierItem; product: Product }[]>();
    supplier.catalog.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return;
      const cat = product.category || 'outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ item, product });
    });
    return Array.from(map.entries());
  }, [supplier, products]);

  const pendingUnitsHere = pendingFromThis.reduce((s, p) => s + p.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-[10px] bg-muted flex items-center justify-center active:scale-95"
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{supplier.emoji}</span>
            <h2 className="font-game-title text-lg font-bold truncate">{supplier.name}</h2>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider"
              style={{ background: tagStyle.bg, color: tagStyle.fg }}
            >
              {SUPPLIER_TAG_LABEL[supplier.tag]}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            📍 {supplier.distanceKm} km · {supplier.shortDescription}
          </p>
        </div>
      </div>

      {/* Pending banner */}
      {pendingUnitsHere > 0 && (
        <Card className="ios-surface p-3 border-primary/30">
          <div className="flex items-center gap-2 text-[13px]">
            <Package2 size={16} className="text-primary" />
            <span className="font-semibold text-foreground">
              {pendingUnitsHere} un. compradas aqui
            </span>
            <span className="text-muted-foreground">aguardando retirada.</span>
          </div>
        </Card>
      )}

      {/* Catalog by category */}
      {groupedItems.map(([cat, entries]) => (
        <div key={cat} className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            {cat.replace(/_/g, ' ')}
          </div>
          <div className="space-y-2">
            {entries.map(({ item, product }) => (
              <SupplierCatalogItem
                key={product.id}
                item={item}
                product={product}
                supplierId={supplier.id}
                money={money}
                overdraftLimit={overdraftLimit}
                onBuy={onBuy}
                getSupplierUnitPrice={getSupplierUnitPrice}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ================================================================
 * MAIN EXPORT
 * ================================================================ */

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({
  gameState,
  products,
  onBuyFromSupplier,
  getSupplierUnitPrice,
  onCancelPendingPickup,
  pickupExpirationMs = 3 * 60 * 1000,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'pickup'>('list');

  const totalPending = (gameState.pendingPickups || []).reduce(
    (s, p) => s + p.quantity,
    0
  );

  // Pickups agrupados por supplier pra mostrar contadores
  const pendingBySupplier = useMemo(() => {
    const map = new Map<string, PendingPickup[]>();
    (gameState.pendingPickups || []).forEach((p) => {
      if (!map.has(p.supplierId)) map.set(p.supplierId, []);
      map.get(p.supplierId)!.push(p);
    });
    return map;
  }, [gameState.pendingPickups]);

  // Pickups ordenados por tempo restante (FIFO = mais antigo primeiro)
  const sortedPickups = useMemo(() => {
    return [...(gameState.pendingPickups || [])].sort(
      (a, b) => a.purchasedAt - b.purchasedAt
    );
  }, [gameState.pendingPickups]);

  const selectedSupplier = selectedSupplierId
    ? getSupplierById(selectedSupplierId)
    : null;

  // Dentro do detalhe de um fornecedor, retorne a view pura (sem tabs)
  if (selectedSupplier) {
    return (
      <SupplierDetail
        supplier={selectedSupplier}
        products={products}
        money={gameState.money}
        overdraftLimit={gameState.overdraftLimit ?? -30000}
        pendingFromThis={pendingBySupplier.get(selectedSupplier.id) || []}
        onBack={() => setSelectedSupplierId(null)}
        onBuy={(productId, quantity) =>
          onBuyFromSupplier(selectedSupplier.id, productId, quantity)
        }
        getSupplierUnitPrice={getSupplierUnitPrice}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <Building2 className="h-7 w-7 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-game-title font-bold text-foreground">
            Fornecedores
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Compre mercadoria e envie um veículo pra buscar.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'list' | 'pickup')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" className="flex items-center gap-1.5">
            <Building2 size={14} />
            Fornecedores
          </TabsTrigger>
          <TabsTrigger value="pickup" className="flex items-center gap-1.5">
            <Package2 size={14} />
            Retirada
            {totalPending > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                {totalPending}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Aba: Lista de fornecedores ─────────────────────── */}
        <TabsContent value="list" className="space-y-4 mt-4">
          {totalPending > 0 && (
            <Card className="ios-surface p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-primary">
                  <Package2 size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-foreground">
                    {totalPending} un. aguardando retirada
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Tem até 3 min pra despachar um veículo, senão a compra é cancelada.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTab('pickup')}
                  className="h-8"
                >
                  Ver
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {SUPPLIERS.map((supplier) => {
              const pending = pendingBySupplier.get(supplier.id) || [];
              const pendingUnits = pending.reduce((s, p) => s + p.quantity, 0);
              return (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  pendingUnits={pendingUnits}
                  onClick={() => setSelectedSupplierId(supplier.id)}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* ── Aba: Retirada (pickups com countdown) ──────────── */}
        <TabsContent value="pickup" className="space-y-3 mt-4">
          <Card className="ios-surface p-3 bg-warning/5 border-warning/30">
            <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
              <Clock size={14} className="text-warning shrink-0 mt-0.5" />
              <span>
                Cada compra tem <strong className="text-foreground">3 minutos</strong> pra ser retirada.
                Se o prazo expirar, o fornecedor cancela a venda e você recebe o dinheiro de volta.
                Despache um veículo na aba <strong className="text-foreground">Viagens</strong> pra buscar.
              </span>
            </div>
          </Card>

          {sortedPickups.length === 0 ? (
            <Card className="ios-surface p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <div className="text-[14px] font-semibold text-foreground mb-1">
                Nada aguardando retirada
              </div>
              <div className="text-[12px] text-muted-foreground">
                Compre em algum fornecedor pra ver os pedidos aqui.
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedPickups.map((pickup) => {
                const product = products.find((p) => p.id === pickup.productId);
                const supplier = getSupplierById(pickup.supplierId);
                return (
                  <PickupCard
                    key={pickup.id}
                    pickup={pickup}
                    product={product}
                    supplier={supplier}
                    expirationMs={pickupExpirationMs}
                    onCancel={() => onCancelPendingPickup?.(pickup.id)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
