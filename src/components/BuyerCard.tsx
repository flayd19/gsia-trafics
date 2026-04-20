import React, { useState, useEffect, useMemo } from 'react';
import { Buyer } from '@/data/buyers';
import { Product } from '@/types/game';
import { Package, Check, X, MessageSquare, Timer } from 'lucide-react';

interface BuyerCardProps {
  buyer: Buyer;
  products: Product[];
  stock: Record<string, number>;
  onSellToBuyer: (buyerId: string, productId: string, quantity: number, price: number) => void;
  onRejectBuyer: (buyerId: string) => void;
  onBargain?: (buyerId: string) => void;
}

/* ----------------------------------------------------------------
 * BuyerCard — estilo iOS Operations.
 * White surface, rounded 16, hairline border, soft shadow.
 * Barra de paciência fina no topo (verde → amarelo → laranja → vermelho).
 * Frase em itálico, pedidos em linhas, 3 botões grandes (iOS touch target).
 * ---------------------------------------------------------------- */
export const BuyerCard: React.FC<BuyerCardProps> = ({
  buyer,
  products,
  stock,
  onSellToBuyer,
  onRejectBuyer,
  onBargain,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!buyer.patienceDeadline) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [buyer.patienceDeadline]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Paciência
  const patienceInfo = useMemo(() => {
    if (!buyer.patienceDeadline || !buyer.patienceTotalMs) {
      return { pct: 1, secondsLeft: null as number | null, color: 'bg-[#34C759]' };
    }
    const now = Date.now();
    const remaining = Math.max(0, buyer.patienceDeadline - now);
    const pct = Math.max(0, Math.min(1, remaining / buyer.patienceTotalMs));
    const secondsLeft = Math.ceil(remaining / 1000);
    let color = 'bg-[#34C759]'; // iOS green
    if (pct < 0.25) color = 'bg-[#FF3B30]';      // red
    else if (pct < 0.5) color = 'bg-[#FF9500]';  // orange
    else if (pct < 0.75) color = 'bg-[#FFCC00]'; // yellow
    return { pct, secondsLeft, color };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer.patienceDeadline, buyer.patienceTotalMs, tick]);

  // Totais
  const orderTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let canFulfillAll = true;
    buyer.orders.forEach((order) => {
      const product = products.find((p) => p.id === order.productId);
      const available = stock[order.productId] || 0;
      if (product) {
        totalRevenue += order.pricePerUnit * order.quantity;
        totalCost += product.baseCost * order.quantity;
        if (available < order.quantity) canFulfillAll = false;
      }
    });
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    return { totalRevenue, totalCost, totalProfit, profitMargin, canFulfillAll };
  }, [buyer.orders, products, stock]);

  const handleSell = () => {
    if (isLoading || !orderTotals.canFulfillAll) return;
    setIsLoading(true);
    try {
      buyer.orders.forEach((order) => {
        onSellToBuyer(buyer.id, order.productId, order.quantity, order.pricePerUnit);
      });
      setTimeout(() => setIsLoading(false), 500);
    } catch (error) {
      console.error('Erro ao processar venda:', error);
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      onRejectBuyer(buyer.id);
      setTimeout(() => setIsLoading(false), 300);
    } catch (error) {
      console.error('Erro ao rejeitar comprador:', error);
      setIsLoading(false);
    }
  };

  const handleBargain = () => {
    if (!onBargain || buyer.bargainAttempted) return;
    onBargain(buyer.id);
  };

  const showBargainBtn =
    !!onBargain && (buyer.negotiationFlexibility ?? 0) > 0 && !buyer.bargainAttempted;

  const showBargainResult =
    buyer.bargainAttempted && buyer.bargainAccepted !== null && buyer.bargainAccepted !== undefined;

  const profitColor =
    orderTotals.profitMargin >= 50
      ? 'text-success'
      : orderTotals.profitMargin >= 20
      ? 'text-warning'
      : orderTotals.profitMargin >= 0
      ? 'text-foreground'
      : 'text-danger';

  return (
    <div className="ios-surface relative overflow-hidden">
      {/* Patience bar no topo */}
      {buyer.patienceDeadline && buyer.patienceTotalMs && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted overflow-hidden z-10">
          <div
            className={`h-full transition-[width,background-color] duration-200 ease-linear ${patienceInfo.color}`}
            style={{ width: `${(patienceInfo.pct * 100).toFixed(2)}%` }}
          />
        </div>
      )}

      <div className="p-3 pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-[12px] bg-muted flex items-center justify-center text-xl">
                {buyer.emoji}
              </div>
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                {buyer.orders.length}
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground leading-tight truncate">
                {buyer.name}
              </h3>
              {patienceInfo.secondsLeft !== null && patienceInfo.pct < 0.4 && (
                <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-danger font-semibold">
                  <Timer size={11} />
                  {patienceInfo.secondsLeft}s
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Total
            </div>
            <div className="font-game-title tabular-nums text-[15px] font-bold text-foreground leading-tight">
              {formatMoney(orderTotals.totalRevenue)}
            </div>
            <div className={`text-[11px] font-semibold tabular-nums ${profitColor}`}>
              {orderTotals.profitMargin >= 0 ? '+' : ''}
              {orderTotals.profitMargin.toFixed(1)}% ({formatMoney(orderTotals.totalProfit)})
            </div>
          </div>
        </div>

        {/* Catchphrase */}
        {buyer.catchPhrase && (
          <p className="text-[13px] italic text-muted-foreground leading-snug">
            &ldquo;{buyer.catchPhrase}&rdquo;
          </p>
        )}

        {/* Orders */}
        <div className="space-y-1.5">
          {buyer.orders.map((order) => {
            const product = products.find((p) => p.id === order.productId);
            const available = stock[order.productId] || 0;
            const hasStock = available >= order.quantity;
            if (!product) return null;
            const totalProductValue = order.quantity * order.pricePerUnit;

            return (
              <div
                key={order.productId}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2 border transition-colors ${
                  hasStock
                    ? 'border-success/25 bg-success/5'
                    : 'border-danger/30 bg-danger/5'
                }`}
              >
                <div className="w-9 h-9 rounded-[10px] bg-muted flex items-center justify-center text-lg shrink-0">
                  <span>{product.icon || '📦'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-foreground truncate">
                      {product.displayName}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {order.quantity}× · {formatMoney(order.pricePerUnit)}
                    </span>
                  </div>
                  <div className="text-[11px] tabular-nums">
                    <span className="text-muted-foreground">Você tem </span>
                    <span className={hasStock ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                      {available}
                    </span>
                    <span className="text-muted-foreground"> / precisa </span>
                    <span className="text-foreground font-semibold">{order.quantity}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-game-title tabular-nums text-[14px] font-bold text-foreground">
                    {formatMoney(totalProductValue)}
                  </div>
                  {hasStock ? (
                    <Check size={14} className="text-success inline" />
                  ) : (
                    <X size={14} className="text-danger inline" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bargain result */}
        {showBargainResult && (
          <div
            className={`rounded-[12px] px-3 py-2 text-[13px] font-semibold border ${
              buyer.bargainAccepted
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {buyer.bargainAccepted ? (
              <>💰 Pechincha aceita · preços +{((buyer.bargainBonusApplied ?? 0) * 100).toFixed(1)}%</>
            ) : (
              <>😤 Pechincha recusada · ele tá indo embora</>
            )}
          </div>
        )}

        {/* Actions — iOS buttons, touch target 44px */}
        <div className="flex gap-2 pt-1">
          {showBargainBtn && (
            <button
              onClick={handleBargain}
              disabled={isLoading}
              className="ios-btn ios-btn-secondary flex-1 disabled:opacity-50"
              style={{ background: 'hsl(32 100% 50% / 0.15)', color: 'hsl(32 100% 38%)' }}
            >
              <MessageSquare size={15} />
              Pechinchar
            </button>
          )}

          <button
            onClick={handleReject}
            disabled={isLoading}
            className="ios-btn ios-btn-secondary flex-1 disabled:opacity-50"
            style={{ background: 'hsl(4 100% 61% / 0.10)', color: 'hsl(4 100% 50%)' }}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
            ) : (
              <>
                <X size={15} />
                Recusar
              </>
            )}
          </button>

          <button
            onClick={handleSell}
            disabled={!orderTotals.canFulfillAll || isLoading}
            className={`ios-btn flex-[1.4] ${
              orderTotals.canFulfillAll ? 'ios-btn-primary' : 'ios-btn-secondary opacity-60 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : orderTotals.canFulfillAll ? (
              <>
                <Check size={16} />
                Aceitar
              </>
            ) : (
              <>
                <Package size={15} />
                Sem estoque
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
