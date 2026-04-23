import { BuyerCard } from '@/components/BuyerCard';
import { Buyer } from '@/data/buyers';
import { UserPlus } from 'lucide-react';

interface SalesScreenProps {
  gameState: any;
  products: any[];
  buyers: Buyer[];
  /**
   * Máximo de slots de comprador. Escala com reputação:
   * Lv 1→2, Lv 5→3, Lv 10→4, …, Lv 30+→8.
   * Padrão 2 se não for passado (evita quebrar callers antigos).
   */
  maxBuyers?: number;
  onSellToBuyer: (buyerId: string, productId: string, quantity: number, price: number) => void;
  onRejectBuyer: (buyerId: string) => void;
  onBargain?: (buyerId: string) => void;
}

export const SalesScreen = ({
  gameState,
  products,
  buyers,
  maxBuyers = 2,
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

  const slotCount = Math.max(1, Math.min(8, maxBuyers));

  return (
    <div className="space-y-4">
      {/* Section header iOS-style */}
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">
            Compradores
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {Math.min(slotCount, buyers.length)} de {slotCount} · chegadas em gotejamento
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
        {Array.from({ length: slotCount }, (_, index) => {
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
    </div>
  );
};
