import { BuyerCard } from '@/components/BuyerCard';
import { Buyer } from '@/data/buyers';
import { UserPlus } from 'lucide-react';

interface SalesScreenProps {
  gameState: any;
  products: any[];
  buyers: Buyer[];
  onSellToBuyer: (buyerId: string, productId: string, quantity: number, price: number) => void;
  onRejectBuyer: (buyerId: string) => void;
  onBargain?: (buyerId: string) => void;
}

export const SalesScreen = ({
  gameState,
  products,
  buyers,
  onSellToBuyer,
  onRejectBuyer,
  onBargain,
}: SalesScreenProps) => {
  const stockedProducts = products.filter(
    (product) => (gameState.stock[product.id] || 0) > 0
  );

  const totalPotentialRevenue = stockedProducts.reduce((sum, product) => {
    const quantity = gameState.stock[product.id] || 0;
    return sum + quantity * product.currentPrice;
  }, 0);

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="space-y-4">
      {/* Section header iOS-style */}
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">
            Compradores
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {Math.min(4, buyers.length)} de 4 · chegadas em gotejamento
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Estoque potencial
          </div>
          <div className="font-game-title tabular-nums text-[15px] font-bold text-foreground">
            {formatMoney(totalPotentialRevenue)}
          </div>
        </div>
      </div>

      {/* Lista vertical (mobile-first); em telas >= md vira 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => {
          const buyer = buyers[index];
          if (buyer) {
            return (
              <BuyerCard
                key={buyer.id}
                buyer={buyer}
                products={products}
                stock={gameState.stock}
                onSellToBuyer={onSellToBuyer}
                onRejectBuyer={onRejectBuyer}
                onBargain={onBargain}
              />
            );
          }
          return (
            <div
              key={`empty-slot-${index}`}
              className="rounded-[16px] border border-dashed border-border bg-muted/30 p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]"
            >
              <div className="w-10 h-10 rounded-[12px] bg-muted flex items-center justify-center text-muted-foreground">
                <UserPlus size={20} />
              </div>
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-muted-foreground">
                  Slot {index + 1}
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" />
                  Novo comprador chegando…
                  <span
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse"
                    style={{ animationDelay: '0.5s' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo do estoque */}
      {stockedProducts.length > 0 && (
        <div className="ios-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
              Resumo do Estoque
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {stockedProducts.length} produtos
            </span>
          </div>
          <div className="divide-y divide-border -mx-1">
            {stockedProducts.map((product) => {
              const quantity = gameState.stock[product.id] || 0;
              const value = quantity * (product.currentPrice || 0);
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 py-2 px-1"
                >
                  <div className="w-8 h-8 rounded-[10px] bg-muted flex items-center justify-center text-base">
                    {product.icon || '📦'}
                  </div>
                  <span className="flex-1 text-[14px] font-medium text-foreground truncate">
                    {product.displayName}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatMoney(value)}
                  </span>
                  <span className="font-game-title tabular-nums text-[14px] font-bold text-foreground min-w-[28px] text-right">
                    {quantity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
