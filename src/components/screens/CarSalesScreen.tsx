// =====================================================================
// CarSalesScreen — Venda de carros para NPCs
// =====================================================================
import { useState, useEffect } from 'react';
import { Clock, Car, DollarSign, ArrowRight, CheckCircle, XCircle, RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { GameState, CarBuyerNPC, OwnedCar } from '@/types/game';
import { conditionLabel, conditionColor, conditionValueFactor } from '@/data/cars';

interface CarSalesScreenProps {
  gameState: GameState;
  onSendOffer: (buyerId: string, carInstanceId: string, price: number, includeTradeIn: boolean) => { success: boolean; message: string };
  onResolveDecision: (buyerId: string) => { success: boolean; accepted: boolean; message: string; finalPrice?: number };
  onDismissBuyer: (buyerId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const PERSONALITY_LABELS: Record<string, string> = {
  racional: '🧠 Racional',
  emocional: '💛 Emocional',
  pechincha: '🤑 Pechincheiro',
  apressado: '⚡ Apressado',
  curioso: '🤔 Curioso',
};

const PERSONALITY_TIPS: Record<string, string> = {
  racional: 'Conhece os preços. Pague próximo da FIPE.',
  emocional: 'Pode pagar acima da tabela se gostar do carro.',
  pechincha: 'Sempre vai tentar baixar. Cuidado com preço alto.',
  apressado: 'Quer fechar logo. Aceita rápido, mas tem pressa.',
  curioso: 'Indeciso. Pode aceitar se o preço for bom.',
};

// Barra de tempo do comprador
function PatienceBar({ buyer }: { buyer: CarBuyerNPC }) {
  const [remaining, setRemaining] = useState(buyer.patience);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - buyer.arrivedAt) / 1000;
      setRemaining(Math.max(0, buyer.patience - elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [buyer.arrivedAt, buyer.patience]);

  const pct = (remaining / buyer.patience) * 100;
  const urgency = pct < 25 ? 'text-red-500' : pct < 50 ? 'text-orange-500' : 'text-green-500';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground">Disponível por</span>
        <span className={`text-[11px] font-bold tabular-nums ${urgency}`}>
          {Math.ceil(remaining)}s
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? '#22c55e' : pct > 25 ? '#f97316' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

// Timer de pensamento (10s)
function ThinkingTimer({ thinkingStartedAt, onTimeUp }: { thinkingStartedAt: number; onTimeUp: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const THINK_TIME = 10;

  useEffect(() => {
    const interval = setInterval(() => {
      const e = (Date.now() - thinkingStartedAt) / 1000;
      setElapsed(e);
      if (e >= THINK_TIME) {
        onTimeUp();
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [thinkingStartedAt, onTimeUp]);

  const pct = Math.min(100, (elapsed / THINK_TIME) * 100);
  const remaining = Math.max(0, THINK_TIME - elapsed);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-primary">
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        <span className="text-[13px] font-semibold">Pensando… {Math.ceil(remaining)}s</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }}
        />
      </div>
    </div>
  );
}

// Card do comprador
function BuyerCard({
  buyer,
  carsInGarage,
  onSendOffer,
  onResolveDecision,
  onDismiss,
}: {
  buyer: CarBuyerNPC;
  carsInGarage: OwnedCar[];
  onSendOffer: (carId: string, price: number, includeTradeIn: boolean) => void;
  onResolveDecision: () => { accepted: boolean; message: string; finalPrice?: number } | void;
  onDismiss: () => void;
}) {
  const [selectedCarId, setSelectedCarId] = useState<string>(carsInGarage[0]?.instanceId ?? '');
  const [askingPrice, setAskingPrice] = useState<string>('');
  const [includeTradeIn, setIncludeTradeIn] = useState(false);
  const [decided, setDecided] = useState<{ accepted: boolean; message: string; finalPrice?: number } | null>(null);

  const selectedCar = carsInGarage.find(c => c.instanceId === selectedCarId);

  // Sugestão de preço baseada na FIPE
  const suggestedPrice = selectedCar
    ? Math.round(selectedCar.fipePrice * conditionValueFactor(selectedCar.condition) * 1.05)
    : 0;

  const handleSuggest = () => {
    if (suggestedPrice > 0) setAskingPrice(String(suggestedPrice));
  };

  const handleSendOffer = () => {
    const price = parseInt(askingPrice.replace(/\D/g, ''));
    if (!selectedCarId || isNaN(price) || price <= 0) return;
    onSendOffer(selectedCarId, price, includeTradeIn && !!buyer.tradeInCar);
  };

  const handleTimeUp = () => {
    const result = onResolveDecision();
    if (result) setDecided(result);
  };

  const tradeInValue = buyer.tradeInCar && includeTradeIn ? (buyer.tradeInValue ?? 0) : 0;
  const effectiveReceiving = Math.max(0, parseInt(askingPrice.replace(/\D/g, '') || '0') - tradeInValue);

  // Se aceito/rejeitado/expirado — mostrar resultado
  if (buyer.state === 'accepted' && !decided) {
    return (
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle size={20} />
          <span className="font-bold">Venda realizada!</span>
        </div>
        <p className="text-[13px] text-muted-foreground">{buyer.name} comprou o carro.</p>
        <Button variant="outline" size="sm" className="w-full" onClick={onDismiss}>
          Dispensar
        </Button>
      </div>
    );
  }

  if (buyer.state === 'rejected' || buyer.state === 'expired') {
    return (
      <div className="ios-surface rounded-[16px] p-4 space-y-3 opacity-70">
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircle size={18} />
          <span className="font-semibold text-[14px]">
            {buyer.state === 'expired' ? 'Tempo esgotado' : 'Oferta recusada'}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">{buyer.name} foi embora.</p>
        <Button variant="ghost" size="sm" className="w-full" onClick={onDismiss}>
          Remover
        </Button>
      </div>
    );
  }

  // Resultado local pós-decisão
  if (decided) {
    return (
      <div className={`ios-surface rounded-[16px] p-4 space-y-3 ${decided.accepted ? 'border border-emerald-500/30' : 'border border-red-500/30'}`}>
        <div className={`flex items-center gap-2 ${decided.accepted ? 'text-emerald-500' : 'text-red-500'}`}>
          {decided.accepted ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span className="font-bold">{decided.accepted ? 'Venda realizada!' : 'Oferta recusada'}</span>
        </div>
        <p className="text-[13px] text-muted-foreground">{decided.message}</p>
        {decided.accepted && decided.finalPrice && (
          <div className="bg-emerald-500/10 rounded-[10px] px-3 py-2">
            <span className="text-[14px] font-bold text-emerald-500">{fmt(decided.finalPrice)}</span>
            <span className="text-[11px] text-muted-foreground ml-2">recebido</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onDismiss}>
          Próximo
        </Button>
      </div>
    );
  }

  return (
    <div className="ios-surface rounded-[16px] p-4 space-y-4">
      {/* Comprador info */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[14px] bg-primary/10 flex items-center justify-center text-2xl">
          {buyer.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-[15px]">{buyer.name}</div>
          <div className="text-[11px] text-muted-foreground">{PERSONALITY_LABELS[buyer.personality]}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 italic">{PERSONALITY_TIPS[buyer.personality]}</div>
        </div>
      </div>

      {/* Barra de paciência */}
      {buyer.state === 'waiting' && <PatienceBar buyer={buyer} />}

      {/* Procura */}
      <div className="bg-muted/40 rounded-[10px] px-3 py-2">
        <span className="text-[11px] text-muted-foreground">Procura: </span>
        <span className="text-[12px] font-semibold text-foreground">
          {buyer.targetCategories.length
            ? buyer.targetCategories.join(', ')
            : 'Qualquer carro'}
        </span>
      </div>

      {/* Trade-in */}
      {buyer.tradeInCar && (
        <div className="space-y-2">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-[12px] px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <Car size={13} className="text-blue-500" />
              <span className="text-[12px] font-semibold text-blue-500">Tem carro para dar na troca</span>
            </div>
            <div className="text-[13px] font-bold text-foreground">
              {buyer.tradeInCar.brand} {buyer.tradeInCar.model} {buyer.tradeInCar.trim}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-medium ${conditionColor(buyer.tradeInCar.condition)}`}>
                {conditionLabel(buyer.tradeInCar.condition)} · {buyer.tradeInCar.condition}%
              </span>
              <span className="text-[13px] font-bold text-foreground">{fmt(buyer.tradeInValue ?? 0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`tradein-${buyer.id}`}
              checked={includeTradeIn}
              onCheckedChange={setIncludeTradeIn}
            />
            <Label htmlFor={`tradein-${buyer.id}`} className="text-[12px]">
              Aceitar troca como parte do pagamento
            </Label>
          </div>
        </div>
      )}

      {/* Formulário de oferta (estado: waiting) */}
      {buyer.state === 'waiting' && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Selecionar Carro
          </div>
          <div className="space-y-2">
            {carsInGarage.length === 0 ? (
              <div className="text-center py-4 text-[13px] text-muted-foreground">
                Garagem vazia — compre um carro primeiro
              </div>
            ) : (
              carsInGarage.map(car => {
                const isSelected = car.instanceId === selectedCarId;
                const mv = Math.round(car.fipePrice * conditionValueFactor(car.condition));
                return (
                  <button
                    key={car.instanceId}
                    onClick={() => { setSelectedCarId(car.instanceId); setAskingPrice(''); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-[12px] border transition-all text-left ${
                      isSelected ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
                    }`}
                  >
                    <span className="text-2xl">{car.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] truncate">{car.brand} {car.model}</div>
                      <div className="text-[10px] text-muted-foreground">{car.trim}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-bold">{fmt(mv)}</div>
                      <div className={`text-[10px] font-medium ${conditionColor(car.condition)}`}>
                        {conditionLabel(car.condition)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedCar && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Quanto você quer receber?
              </div>

              {/* FIPE reference */}
              <div className="bg-muted/30 rounded-[10px] px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
                <div>FIPE: <strong className="text-foreground">{fmt(selectedCar.fipePrice)}</strong></div>
                <div>Valor de mercado (condição atual): <strong className="text-foreground">{fmt(Math.round(selectedCar.fipePrice * conditionValueFactor(selectedCar.condition)))}</strong></div>
                <div className="text-[10px] text-primary mt-1">💡 Compradores pagam até 25% acima dependendo da sorte</div>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">R$</span>
                <input
                  type="number"
                  className="w-full pl-9 pr-3 py-2.5 rounded-[12px] border border-border bg-background text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="0"
                  value={askingPrice}
                  onChange={e => setAskingPrice(e.target.value)}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[12px] text-primary"
                onClick={handleSuggest}
              >
                Usar preço sugerido: {fmt(suggestedPrice)}
              </Button>

              {includeTradeIn && buyer.tradeInValue && (
                <div className="bg-blue-500/10 rounded-[10px] px-3 py-2 text-[12px] text-blue-600 font-medium">
                  Você receberá: {fmt(effectiveReceiving)} (pedido − trade-in)
                </div>
              )}

              <Button
                className="w-full gap-2"
                disabled={!askingPrice || carsInGarage.length === 0}
                onClick={handleSendOffer}
              >
                <ArrowRight size={15} />
                Enviar Proposta
              </Button>
            </>
          )}
        </div>
      )}

      {/* Estado: pensando */}
      {buyer.state === 'thinking' && (
        <ThinkingTimer
          thinkingStartedAt={buyer.thinkingStartedAt ?? Date.now()}
          onTimeUp={handleTimeUp}
        />
      )}
    </div>
  );
}

// Slot vazio (sem comprador)
function EmptyBuyerSlot({ index }: { index: number }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-muted/20 p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
      <div className="w-10 h-10 rounded-[12px] bg-muted flex items-center justify-center text-muted-foreground">
        <User size={20} />
      </div>
      <div className="space-y-0.5">
        <div className="text-[13px] font-semibold text-muted-foreground">Slot {index + 1}</div>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" />
          Aguardando comprador…
          <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
    </div>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export function CarSalesScreen({
  gameState,
  onSendOffer,
  onResolveDecision,
  onDismissBuyer,
}: CarSalesScreenProps) {
  const carsInGarage = gameState.garage.filter(s => s.unlocked && s.car).map(s => s.car!);
  const MAX_SLOTS = 4;

  const activeBuyers = gameState.carBuyers.filter(
    b => b.state === 'waiting' || b.state === 'thinking' || b.state === 'accepted' || b.state === 'rejected'
  );

  // Stats rápidos
  const totalSold = gameState.totalCarsSold ?? 0;
  const totalRevenue = gameState.totalRevenue ?? 0;
  const avgProfit = gameState.carSales.length > 0
    ? Math.round(gameState.carSales.reduce((s, r) => s + r.profit, 0) / gameState.carSales.length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">💰 Vendas</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {activeBuyers.filter(b => b.state === 'waiting').length} comprador(es) disponíve(is)
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vendidos</div>
          <div className="font-game-title tabular-nums text-[15px] font-bold">{totalSold} carros</div>
        </div>
      </div>

      {/* Stats */}
      {totalSold > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="ios-surface rounded-[14px] p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Receita Total</div>
            <div className="font-bold text-[14px] text-emerald-500 tabular-nums">{fmt(totalRevenue)}</div>
          </div>
          <div className="ios-surface rounded-[14px] p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Lucro Médio</div>
            <div className={`font-bold text-[14px] tabular-nums ${avgProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {avgProfit >= 0 ? '+' : ''}{fmt(avgProfit)}
            </div>
          </div>
        </div>
      )}

      {/* Compradores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const buyer = activeBuyers[i];
          if (buyer) {
            return (
              <BuyerCard
                key={buyer.id}
                buyer={buyer}
                carsInGarage={carsInGarage}
                onSendOffer={(carId, price, includeTradeIn) => {
                  onSendOffer(buyer.id, carId, price, includeTradeIn);
                }}
                onResolveDecision={() => {
                  const result = onResolveDecision(buyer.id);
                  if ('accepted' in result) return result;
                }}
                onDismiss={() => onDismissBuyer(buyer.id)}
              />
            );
          }
          return <EmptyBuyerSlot key={`empty-${i}`} index={i} />;
        })}
      </div>

      {/* Histórico recente */}
      {gameState.carSales.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-3">
            Últimas Vendas
          </div>
          <div className="space-y-2">
            {[...gameState.carSales].reverse().slice(0, 5).map(sale => (
              <div key={sale.id} className="ios-surface rounded-[12px] px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">{sale.fullName}</div>
                  <div className="text-[11px] text-muted-foreground">Dia {sale.gameDay}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[13px]">{fmt(sale.salePrice)}</div>
                  <div className={`text-[11px] font-semibold ${sale.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {sale.profit >= 0 ? '+' : ''}{fmt(sale.profit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
