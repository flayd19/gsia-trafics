// =====================================================================
// CarSalesScreen — Venda de carros para NPCs (ciclos de 30 min)
// =====================================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { Car, ArrowRight, CheckCircle, XCircle, User, Lock, Tag, Layers, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameState, CarBuyerNPC, OwnedCar } from '@/types/game';
import { conditionLabel, conditionColor, conditionValueFactor, CAR_MODELS } from '@/data/cars';
import {
  maxBuyerSlots,
  currentCycleEpoch,
  secondsUntilNextCycle,
  CATEGORY_LABELS,
} from '@/data/carBuyers';

interface CarSalesScreenProps {
  gameState: GameState;
  onSendOffer: (
    buyerId: string,
    carInstanceId: string,
    price: number,
    includeTradeIn: boolean,
    playerTradeInValuation?: number,
  ) => { success: boolean; message: string };
  onResolveDecision: (buyerId: string) => { success: boolean; accepted: boolean; message: string; finalPrice?: number; counterOffer?: number };
  onResolveCounterOffer: (buyerId: string, accept: boolean) => { success: boolean; message: string; accepted?: boolean; finalPrice?: number };
  onDismissBuyer: (buyerId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function fmtCountdown(totalSec: number): string {
  const sec  = Math.max(0, Math.ceil(totalSec));
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

const PERSONALITY_LABELS: Record<string, string> = {
  racional:  '🧠 Racional',
  emocional: '💛 Emocional',
  pechincha: '🤑 Pechincheiro',
  apressado: '⚡ Apressado',
  curioso:   '🤔 Curioso',
};

const PERSONALITY_TIPS: Record<string, string> = {
  racional:  'Conhece os preços. Pague próximo da FIPE.',
  emocional: 'Pode pagar acima da tabela se gostar do carro.',
  pechincha: 'Sempre vai tentar baixar. Cuidado com preço alto.',
  apressado: 'Quer fechar logo. Aceita rápido, mas tem pressa.',
  curioso:   'Indeciso. Pode aceitar se o preço for bom.',
};

// ── Timer global do ciclo ─────────────────────────────────────────

function CycleHeader({ epochLocks }: { epochLocks: number[] }) {
  const [secsLeft, setSecsLeft] = useState(secondsUntilNextCycle());

  useEffect(() => {
    const id = setInterval(() => setSecsLeft(secondsUntilNextCycle()), 1_000);
    return () => clearInterval(id);
  }, []);

  const totalSlots = epochLocks.length;
  const lockedCount = epochLocks.filter(l => l === currentCycleEpoch()).length;

  return (
    <div className="ios-surface rounded-[14px] px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Próximo ciclo de compradores
        </div>
        <div className="text-[18px] font-bold tabular-nums text-primary leading-tight mt-0.5">
          {fmtCountdown(secsLeft)}
        </div>
      </div>
      {lockedCount > 0 && (
        <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-600">
          <Lock size={10} className="mr-1" />
          {lockedCount}/{totalSlots} slots bloqueados
        </Badge>
      )}
    </div>
  );
}

// ── Barra de tempo do comprador (mostra tempo restante no ciclo) ───

function CycleRemainingBar({ buyer }: { buyer: CarBuyerNPC }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, buyer.patience - (Date.now() - buyer.arrivedAt) / 1_000),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - buyer.arrivedAt) / 1_000;
      setRemaining(Math.max(0, buyer.patience - elapsed));
    }, 500);
    return () => clearInterval(id);
  }, [buyer.arrivedAt, buyer.patience]);

  const pct     = (remaining / buyer.patience) * 100;
  const urgency = pct < 25 ? 'text-red-500' : pct < 50 ? 'text-orange-500' : 'text-emerald-500';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground">Disponível por</span>
        <span className={`text-[11px] font-bold tabular-nums ${urgency}`}>
          {fmtCountdown(remaining)}
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

// ── Timer de pensamento (10 s) ─────────────────────────────────────

function ThinkingTimer({ thinkingStartedAt, onTimeUp }: { thinkingStartedAt: number; onTimeUp: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const THINK_TIME = 10;
  // Ref para evitar que mudanças de referência de onTimeUp reiniciem o timer
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    const id = setInterval(() => {
      const e = (Date.now() - thinkingStartedAt) / 1_000;
      setElapsed(e);
      if (e >= THINK_TIME) { onTimeUpRef.current(); clearInterval(id); }
    }, 200);
    return () => clearInterval(id);
  // Só reinicia o timer se thinkingStartedAt mudar — onTimeUp via ref
  }, [thinkingStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct       = Math.min(100, (elapsed / THINK_TIME) * 100);
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

// ── Badge de requisito do comprador ──────────────────────────────

function RequirementBadge({ buyer }: { buyer: CarBuyerNPC }) {
  if (buyer.requirementType === 'model' && buyer.targetModelName) {
    return (
      <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-[10px] px-3 py-2">
        <Tag size={12} className="text-violet-500 shrink-0" />
        <div>
          <span className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">Modelo específico</span>
          <div className="text-[13px] font-bold text-foreground">{buyer.targetModelName}</div>
        </div>
      </div>
    );
  }

  if (buyer.targetCategories.length > 0) {
    const cat = buyer.targetCategories[0];
    return (
      <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-[10px] px-3 py-2">
        <Layers size={12} className="text-blue-500 shrink-0" />
        <div>
          <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Categoria</span>
          <div className="text-[13px] font-bold text-foreground">{CATEGORY_LABELS[cat] ?? cat}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 rounded-[10px] px-3 py-2">
      <span className="text-[12px] text-muted-foreground">Aceita qualquer carro</span>
    </div>
  );
}

// ── Filtra carros da garagem compatíveis com o comprador ──────────

function filterCompatibleCars(cars: OwnedCar[], buyer: CarBuyerNPC): OwnedCar[] {
  if (!buyer.requirementType) return cars; // legado
  if (buyer.requirementType === 'model' && buyer.targetModelId) {
    return cars.filter(c => c.modelId === buyer.targetModelId);
  }
  if (buyer.requirementType === 'category' && buyer.targetCategories.length > 0) {
    return cars.filter(c => {
      const model = CAR_MODELS.find(m => m.id === c.modelId);
      return model && buyer.targetCategories.includes(model.category);
    });
  }
  return cars;
}

// ── Card do comprador ─────────────────────────────────────────────

function BuyerCard({
  buyer,
  carsInGarage,
  onSendOffer,
  onResolveDecision,
  onResolveCounterOffer,
  onDismiss,
}: {
  buyer: CarBuyerNPC;
  carsInGarage: OwnedCar[];
  onSendOffer: (
    carId: string,
    price: number,
    includeTradeIn: boolean,
    playerTradeInValuation?: number,
  ) => void;
  onResolveDecision: () => { accepted: boolean; message: string; finalPrice?: number; counterOffer?: number } | void;
  onResolveCounterOffer: (accept: boolean) => void;
  onDismiss: () => void;
}) {
  const compatibleCars = filterCompatibleCars(carsInGarage, buyer);

  const [selectedCarId, setSelectedCarId]       = useState<string>(compatibleCars[0]?.instanceId ?? '');
  const [askingPrice, setAskingPrice]           = useState<string>('');
  // Valoração do trade-in pelo jogador (em reais). null = usa valor do comprador.
  const [tradeInValuation, setTradeInValuation] = useState<number | null>(null);
  const [decided, setDecided] = useState<{ accepted: boolean; message: string; finalPrice?: number } | null>(null);

  const selectedCar = compatibleCars.find(c => c.instanceId === selectedCarId)
    ?? carsInGarage.find(c => c.instanceId === selectedCarId);

  const suggestedPrice = selectedCar
    ? Math.round(selectedCar.fipePrice * conditionValueFactor(selectedCar.condition) * 1.05)
    : 0;

  // Teto e piso da valoração do trade-in
  const tradeInMaxValue = useMemo(() => {
    if (!buyer.tradeInCar) return 0;
    return Math.round(buyer.tradeInCar.fipePrice * conditionValueFactor(buyer.tradeInCar.condition));
  }, [buyer.tradeInCar]);

  // A troca é incluída automaticamente se o comprador tiver um veículo para oferecer.
  // O jogador pode ajustar a valoração, mas não pode ativar/desativar a troca manualmente.
  const effectiveTradeInVal = buyer.tradeInCar
    ? (tradeInValuation ?? buyer.tradeInValue ?? 0)
    : 0;

  const numericAskingPrice = parseInt(askingPrice.replace(/\D/g, '') || '0');
  const cashReceived       = Math.max(0, numericAskingPrice - effectiveTradeInVal);

  const handleSendOffer = () => {
    if (!selectedCarId || numericAskingPrice <= 0) return;
    const useTradeIn = !!buyer.tradeInCar;
    onSendOffer(
      selectedCarId,
      numericAskingPrice,
      useTradeIn,
      useTradeIn ? (tradeInValuation ?? buyer.tradeInValue ?? undefined) : undefined,
    );
  };

  const handleTimeUp = () => {
    const result = onResolveDecision();
    if (!result) return;
    // Se há contraproposta, o buyer.state muda para 'countering' e o componente
    // re-renderiza para a UI de contra — NÃO definir decided para evitar conflito.
    if (result.counterOffer !== undefined) return;
    setDecided(result);
  };

  // ── estados terminais ────────────────────────────────────────────
  if (buyer.state === 'accepted' && !decided) {
    return (
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle size={20} />
          <span className="font-bold">Venda realizada!</span>
        </div>
        <p className="text-[13px] text-muted-foreground">{buyer.name} comprou o carro.</p>
        <Button variant="outline" size="sm" className="w-full" onClick={onDismiss}>Dispensar</Button>
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
        <Button variant="ghost" size="sm" className="w-full" onClick={onDismiss}>Remover</Button>
      </div>
    );
  }

  // ── Estado: contraproposta aguardando resposta do jogador ──────────
  if (buyer.state === 'countering' && buyer.counterOffer !== undefined) {
    const counterAmt  = buyer.counterOffer;
    const tradeInVal  = buyer.tradeInCar ? (tradeInValuation ?? buyer.tradeInValue ?? 0) : 0;
    const cashReceive = Math.max(0, counterAmt - tradeInVal);
    return (
      <div className="ios-surface rounded-[16px] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-amber-500/10 flex items-center justify-center text-2xl">
            {buyer.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-foreground text-[15px]">{buyer.name}</div>
            <div className="text-[11px] text-amber-500 font-medium">💬 Fez uma contraproposta</div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[14px] px-4 py-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">
            Máximo que estou disposto a pagar
          </div>
          <div className="text-[28px] font-black text-foreground tabular-nums leading-tight">
            {fmt(counterAmt)}
          </div>
          {buyer.tradeInCar && tradeInVal > 0 && (
            <div className="pt-1 border-t border-amber-500/20 space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Troca — {buyer.tradeInCar.brand} {buyer.tradeInCar.model}</span>
                <span className="text-blue-400 font-semibold">−{fmt(tradeInVal)}</span>
              </div>
              <div className="flex justify-between text-[12px] font-bold">
                <span className="text-muted-foreground">Você recebe em dinheiro</span>
                <span className="text-emerald-500">{fmt(cashReceive)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onResolveCounterOffer(false)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[12px] border border-red-500/30 text-red-500 text-[13px] font-semibold hover:bg-red-500/5 transition-colors"
          >
            <XCircle size={15} />
            Recusar
          </button>
          <button
            type="button"
            onClick={() => onResolveCounterOffer(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[12px] bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 transition-colors"
          >
            <CheckCircle size={15} />
            Aceitar {fmt(counterAmt)}
          </button>
        </div>
      </div>
    );
  }

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
            <span className="text-[11px] text-muted-foreground ml-2">recebido em dinheiro</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onDismiss}>Próximo</Button>
      </div>
    );
  }

  // ── estado normal (waiting / thinking) ──────────────────────────
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

      {/* Requisito do comprador */}
      <RequirementBadge buyer={buyer} />

      {/* Barra de tempo do ciclo */}
      {buyer.state === 'waiting' && <CycleRemainingBar buyer={buyer} />}

      {/* ── Seção de trade-in ──────────────────────────────────────── */}
      {buyer.tradeInCar && (
        <div className="space-y-3">
          {/* Info do carro oferecido */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-[12px] px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Car size={13} className="text-blue-500" />
              <span className="text-[12px] font-semibold text-blue-500">Tem carro para dar na troca</span>
            </div>
            <div className="text-[13px] font-bold text-foreground leading-tight">
              {buyer.tradeInCar.brand} {buyer.tradeInCar.model} {buyer.tradeInCar.trim}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-medium ${conditionColor(buyer.tradeInCar.condition)}`}>
                {conditionLabel(buyer.tradeInCar.condition)} · {buyer.tradeInCar.condition}%
              </span>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">FIPE {fmt(buyer.tradeInCar.fipePrice)}</div>
                <div className="text-[12px] font-bold text-foreground">
                  Mercado: {fmt(tradeInMaxValue)}
                </div>
              </div>
            </div>
          </div>

          {/* Painel de valoração da troca — sempre visível quando há trade-in */}
          <div className="bg-muted/30 rounded-[12px] p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Quanto você dá pelo carro do comprador?
            </div>

            {/* Slider de valoração */}
            <input
              type="range"
              min={0}
              max={tradeInMaxValue}
              step={Math.max(500, Math.round(tradeInMaxValue / 200))}
              value={tradeInValuation ?? (buyer.tradeInValue ?? 0)}
              onChange={e => setTradeInValuation(Number(e.target.value))}
              className="w-full accent-primary"
            />

            {/* Labels min / max */}
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>R$ 0 (só dinheiro)</span>
              <span>{fmt(tradeInMaxValue)} (máx.)</span>
            </div>

            {/* Valor atual + comparação com estimativa do comprador */}
            <div className="flex items-center justify-between bg-background rounded-[10px] px-3 py-2 border border-border">
              <div>
                <div className="text-[10px] text-muted-foreground">Sua avaliação</div>
                <div className="text-[15px] font-bold text-foreground tabular-nums">
                  {fmt(tradeInValuation ?? (buyer.tradeInValue ?? 0))}
                </div>
              </div>
              {/* Indicador vs. estimativa do comprador */}
              {(() => {
                const myVal    = tradeInValuation ?? (buyer.tradeInValue ?? 0);
                const buyerVal = buyer.tradeInValue ?? 0;
                if (myVal < buyerVal * 0.8) {
                  return (
                    <div className="flex items-center gap-1 text-amber-500 text-[11px] font-medium">
                      <TrendingDown size={13} />
                      Abaixo do esperado
                    </div>
                  );
                }
                if (myVal > buyerVal * 1.05) {
                  return (
                    <div className="flex items-center gap-1 text-emerald-500 text-[11px] font-medium">
                      <TrendingUp size={13} />
                      Generoso
                    </div>
                  );
                }
                return (
                  <div className="text-[11px] text-muted-foreground">Estimativa justa</div>
                );
              })()}
            </div>

            {/* Botão de atalho: usar estimativa do comprador */}
            {buyer.tradeInValue && (
              <button
                type="button"
                onClick={() => setTradeInValuation(buyer.tradeInValue ?? 0)}
                className="text-[11px] text-primary underline underline-offset-2 w-full text-center"
              >
                Usar estimativa do comprador: {fmt(buyer.tradeInValue)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Formulário de oferta ───────────────────────────────────── */}
      {buyer.state === 'waiting' && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Selecionar Carro
          </div>

          {compatibleCars.length === 0 ? (
            <div className="text-center py-4 rounded-[12px] bg-amber-500/10 border border-amber-500/20">
              <div className="text-[13px] font-semibold text-amber-600">Nenhum carro compatível</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Este comprador precisa de:{' '}
                {buyer.requirementType === 'model'
                  ? buyer.targetModelName
                  : (CATEGORY_LABELS[buyer.targetCategories[0]] ?? buyer.targetCategories[0])}
              </div>
            </div>
          ) : (
            compatibleCars.map(car => {
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

          {selectedCar && compatibleCars.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Seu preço de venda
              </div>
              <div className="bg-muted/30 rounded-[10px] px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
                <div>FIPE: <strong className="text-foreground">{fmt(selectedCar.fipePrice)}</strong></div>
                <div>
                  Valor de mercado:{' '}
                  <strong className="text-foreground">
                    {fmt(Math.round(selectedCar.fipePrice * conditionValueFactor(selectedCar.condition)))}
                  </strong>
                </div>
                <div className="text-[10px] text-primary mt-1">
                  💡 Compradores pagam até 25% acima dependendo da sorte
                </div>
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
                onClick={() => setAskingPrice(String(suggestedPrice))}
              >
                Usar preço sugerido: {fmt(suggestedPrice)}
              </Button>

              {/* Resumo da negociação */}
              <div className="bg-muted/20 border border-border rounded-[12px] px-3 py-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Resumo da proposta
                </div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço pedido pelo carro</span>
                    <span className="font-semibold text-foreground">{numericAskingPrice > 0 ? fmt(numericAskingPrice) : '—'}</span>
                  </div>
                  {buyer.tradeInCar && effectiveTradeInVal > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Desconto (troca)</span>
                      <span className="font-semibold">− {fmt(effectiveTradeInVal)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                    <span className="text-foreground">Você recebe em dinheiro</span>
                    <span className={cashReceived > 0 ? 'text-emerald-500' : 'text-muted-foreground'}>
                      {numericAskingPrice > 0 ? fmt(cashReceived) : '—'}
                    </span>
                  </div>
                  {buyer.tradeInCar && effectiveTradeInVal > 0 && (
                    <div className="text-[11px] text-blue-600">
                      + carro de troca avaliado em {fmt(effectiveTradeInVal)}
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={!askingPrice || numericAskingPrice <= 0 || compatibleCars.length === 0}
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

// ── Slot bloqueado ────────────────────────────────────────────────

function LockedSlot({ slotIndex }: { slotIndex: number }) {
  const [secsLeft, setSecsLeft] = useState(secondsUntilNextCycle());

  useEffect(() => {
    const id = setInterval(() => setSecsLeft(secondsUntilNextCycle()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-[16px] border border-dashed border-amber-500/30 bg-amber-500/5 p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
      <div className="w-10 h-10 rounded-[12px] bg-amber-500/10 flex items-center justify-center">
        <Lock size={18} className="text-amber-500" />
      </div>
      <div className="space-y-0.5">
        <div className="text-[13px] font-semibold text-amber-600">Slot {slotIndex + 1} bloqueado</div>
        <div className="text-[11px] text-muted-foreground">
          Novo comprador em <span className="font-bold tabular-nums text-amber-600">{fmtCountdown(secsLeft)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Slot vazio (aguardando comprador no ciclo) ─────────────────────

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

// ── Tela principal ────────────────────────────────────────────────

export function CarSalesScreen({
  gameState,
  onSendOffer,
  onResolveDecision,
  onDismissBuyer,
}: CarSalesScreenProps) {
  const level        = gameState.reputation.level;
  const totalSlots   = maxBuyerSlots(level);
  const slotLocks    = gameState.buyerSlotLocks ?? [];
  const cycleEpoch   = currentCycleEpoch();

  const carsInGarage = gameState.garage.filter(s => s.unlocked && s.car).map(s => s.car!);

  const activeBuyers = gameState.carBuyers.filter(
    b => b.state === 'waiting' || b.state === 'thinking' || b.state === 'countering' || b.state === 'accepted' || b.state === 'rejected',
  );

  const totalSold   = gameState.totalCarsSold ?? 0;
  const totalRevenue = gameState.totalRevenue ?? 0;
  const avgProfit   = gameState.carSales.length > 0
    ? Math.round(gameState.carSales.reduce((s, r) => s + r.profit, 0) / gameState.carSales.length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">💰 Vendas</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {activeBuyers.filter(b => b.state === 'waiting').length} comprador(es) disponíve(is) · {totalSlots} slots
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vendidos</div>
          <div className="font-game-title tabular-nums text-[15px] font-bold">{totalSold} carros</div>
        </div>
      </div>

      {/* Ciclo global */}
      <CycleHeader epochLocks={slotLocks} />

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

      {/* Nota sobre próximo desbloqueio de slot */}
      {level % 10 !== 0 && (
        <div className="text-[11px] text-muted-foreground px-1">
          {`Nível ${Math.ceil(level / 10) * 10} → ${2 + Math.ceil(level / 10)} slots`}
        </div>
      )}

      {/* Grid de slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: totalSlots }, (_, i) => {
          const isLocked = (slotLocks[i] ?? -1) === cycleEpoch;
          if (isLocked) return <LockedSlot key={`locked-${i}`} slotIndex={i} />;

          const buyer = activeBuyers.find(b => (b.slotIndex ?? activeBuyers.indexOf(b)) === i);
          if (buyer) {
            return (
              <BuyerCard
                key={buyer.id}
                buyer={buyer}
                carsInGarage={carsInGarage}
                onSendOffer={(carId, price, includeTradeIn, playerTradeInValuation) =>
                  onSendOffer(buyer.id, carId, price, includeTradeIn, playerTradeInValuation)
                }
                onResolveDecision={() => {
                  const result = onResolveDecision(buyer.id);
                  if (result.success && 'accepted' in result) return result;
                }}
                onResolveCounterOffer={(accept) => onResolveCounterOffer(buyer.id, accept)}
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
