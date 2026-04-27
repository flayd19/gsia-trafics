// =====================================================================
// FornecedoresCarrosScreen — Marketplace global compartilhado
// Todos os jogadores veem os mesmos carros.
// Quando alguém compra primeiro, o carro fica "Vendido para [nome]".
// Inventário renovado a cada 24h.
// =====================================================================
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, X, CheckCircle, TrendingDown, TrendingUp, ChevronLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameState, OwnedCar } from '@/types/game';
import type { GlobalCar } from '@/hooks/useGlobalMarketplace';
import { conditionLabel, conditionColor, fmtKm, type CarCategory } from '@/data/cars';
import { useCarImages } from '@/hooks/useCarImages';
import { generateBasePerformance } from '@/lib/performanceEngine';

interface FornecedoresCarrosScreenProps {
  gameState: GameState;
  globalCars: GlobalCar[];
  loading: boolean;
  isOnline: boolean;
  errorMsg?: string | null;
  minsLeft: number | null;
  onBuyCar: (car: GlobalCar) => Promise<{ success: boolean; message: string }>;
  onBuyAtPrice?: (car: GlobalCar, price: number) => Promise<{ success: boolean; message: string }>;
  onRefreshMarketplace: () => void | Promise<void>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const CATEGORY_LABELS: Record<CarCategory, string> = {
  popular:   '🚗 Popular',
  medio:     '🚘 Médio',
  suv:       '🚙 SUV',
  pickup:    '🛻 Pickup',
  esportivo: '🏎️ Esportivo',
  eletrico:  '⚡ Elétrico',
  classico:  '🏛️ Clássico',
  luxo:      '💎 Luxo',
};

// ── Card de detalhe (abre ao clicar num card do grid) ─────────────
type OfferResult = { accepted: boolean; discount: number };

function CarDetailSheet({
  car,
  canAfford,
  hasGarageSpace,
  onBuy,
  onBuyAtPrice,
  onClose,
}: {
  car: GlobalCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onBuy: () => void;
  onBuyAtPrice?: (car: GlobalCar, price: number) => Promise<{ success: boolean; message: string }>;
  onClose: () => void;
}) {
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy]               = useState(false);
  const [offerResult, setOfferResult] = useState<OfferResult | null>(null);
  const [offerPending, setOfferPending] = useState(false);

  const { getImgForInstance } = useCarImages();
  const imgUrl  = getImgForInstance(car.modelId, car.id);
  const label   = conditionLabel(car.condition);
  const colorClass  = conditionColor(car.condition);
  const fipeDiff    = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct     = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));
  const isSold      = car.status === 'sold';

  const handleBuy = async () => {
    setBusy(true);
    onBuy();
    setBusy(false);
  };

  const handleOffer = async (pct: number) => {
    if (!onBuyAtPrice || busy || offerPending) return;
    setOfferResult(null);
    setOfferPending(true);
    // Breve suspense para dar a sensação de o vendedor "pensar"
    await new Promise(r => setTimeout(r, 700));
    const accepted = Math.random() < 0.5; // totalmente aleatório
    if (accepted) {
      const discPrice = Math.round(car.askingPrice * (1 - pct / 100));
      setOfferResult({ accepted: true, discount: pct });
      setBusy(true);
      setOfferPending(false);
      await onBuyAtPrice(car, discPrice);
      setBusy(false);
    } else {
      setOfferResult({ accepted: false, discount: pct });
      setOfferPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in">
      {/* Hero */}
      <div className="relative w-full bg-muted overflow-hidden" style={{ height: 220 }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${car.brand} ${car.model}`}
            className={`w-full h-full object-cover ${isSold ? 'opacity-40' : ''}`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-full h-full items-center justify-center text-[88px] ${isSold ? 'opacity-40' : ''}`}
          style={{ display: imgUrl ? 'none' : 'flex' }}
        >
          {car.icon}
        </div>
        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/70 rounded-2xl px-6 py-3 text-center">
              <div className="text-white text-[13px] font-bold">VENDIDO</div>
              {car.buyerName && (
                <div className="text-white/80 text-[11px] mt-0.5">para {car.buyerName}</div>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow active:scale-95"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow ${
          isSold ? 'bg-slate-500'
          : car.condition >= 75 ? 'bg-emerald-500'
          : car.condition >= 50 ? 'bg-amber-500'
          : car.condition >= 30 ? 'bg-orange-500'
          : 'bg-red-500'
        }`}>
          {isSold ? 'Vendido' : `${label} ${car.condition}%`}
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {toast && (
          <div className={`px-4 py-3 rounded-[12px] text-[13px] font-semibold text-white ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {toast.msg}
          </div>
        )}

        {/* Sold banner */}
        {isSold && (
          <div className="bg-slate-500/10 border border-slate-400/30 rounded-[12px] px-3 py-2.5 text-center">
            <div className="text-[13px] font-bold text-foreground">🔒 Este carro já foi vendido</div>
            {car.buyerName && (
              <div className="text-[11px] text-muted-foreground mt-0.5">Comprado por <span className="font-semibold">{car.buyerName}</span></div>
            )}
          </div>
        )}

        {/* Nome e preço */}
        <div>
          <div className={`font-game-title text-2xl font-bold tabular-nums ${isSold ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {fmt(car.askingPrice)}
          </div>
          <div className="text-[16px] font-semibold text-foreground mt-1">
            {car.brand} {car.model} {car.trim}
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5">
            {car.year} · {fmtKm(car.mileage)} · 📍 {car.seller}
          </div>
        </div>

        {/* FIPE comparison */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-[12px] ${isBelowFipe ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
          {isBelowFipe
            ? <TrendingDown size={16} className="text-emerald-500 shrink-0" />
            : <TrendingUp   size={16} className="text-orange-500 shrink-0" />}
          <div>
            <div className={`text-[13px] font-bold ${isBelowFipe ? 'text-emerald-600' : 'text-orange-600'}`}>
              {isBelowFipe ? `${diffPct}% abaixo da FIPE` : `${diffPct}% acima da FIPE`}
            </div>
            <div className="text-[11px] text-muted-foreground">
              FIPE: {fmt(car.fipePrice)}
            </div>
          </div>
        </div>

        {/* Barra de condição */}
        <div className="ios-surface rounded-[14px] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground">Condição do veículo</span>
            <span className={`text-[13px] font-bold ${colorClass}`}>{car.condition}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${car.condition}%`,
                background:
                  car.condition >= 60 ? 'var(--gradient-primary)'
                  : car.condition >= 35 ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                  : 'linear-gradient(90deg,#ef4444,#dc2626)',
              }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {car.condition >= 80 ? 'Ótimo estado — pronto para revenda'
              : car.condition >= 60 ? 'Bom estado — pequenos reparos podem valorizar'
              : car.condition >= 40 ? 'Estado razoável — recomendo levar à oficina'
              : 'Estado ruim — necessita reparos urgentes'}
          </div>
        </div>

        {/* Atributos de Performance */}
        {(() => {
          const fakeOwnedCar = { instanceId: car.id, modelId: car.modelId, fipePrice: car.fipePrice } as OwnedCar;
          const perf = generateBasePerformance(fakeOwnedCar);
          const igpColor = perf.igp > 75 ? '#10b981' : perf.igp > 50 ? '#f59e0b' : '#ef4444';
          const igpBg    = perf.igp > 75 ? 'bg-emerald-500/10 border-emerald-500/25'
                         : perf.igp > 50 ? 'bg-amber-500/10 border-amber-500/25'
                         : 'bg-red-500/10 border-red-500/25';
          const statBar = (label: string, icon: string, val: number) => (
            <div key={label} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1">{icon} {label}</span>
                <span className="font-bold text-foreground tabular-nums">{val}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${val}%`,
                  background: val >= 70
                    ? 'linear-gradient(90deg,#10b981,#059669)'
                    : val >= 40
                    ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                    : 'linear-gradient(90deg,#ef4444,#dc2626)',
                }} />
              </div>
            </div>
          );
          return (
            <div className={`ios-surface rounded-[14px] p-3.5 border ${igpBg}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex flex-col items-center w-12 shrink-0">
                  <div className="text-[38px] font-black tabular-nums leading-none" style={{ color: igpColor }}>
                    {perf.igp}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">IGP</div>
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="font-semibold text-[12px] text-foreground">
                    {perf.traction}
                    {perf._hasTurbo && <span className="ml-1.5 text-blue-400 text-[11px]">· 💨 Turbo</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {perf._hp} cv · {perf._torqueNm} Nm · 0–100 em {perf._0to100}s · {perf._topSpeedKmh} km/h
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {statBar('Velocidade', '🏁', perf.topSpeed)}
                {statBar('Aceleração', '⚡', perf.acceleration)}
                {statBar('Potência',   '💪', perf.power)}
                {statBar('Torque',     '🔄', perf.torque)}
                {statBar('Grip',       '🛞', perf.grip)}
                {statBar('Estabilid.', '🎯', perf.stability)}
              </div>
            </div>
          );
        })()}

        {/* ── Seção de Proposta ─────────────────────────────── */}
        {!isSold && onBuyAtPrice && hasGarageSpace && canAfford && (
          <div className="ios-surface rounded-[14px] p-3.5 space-y-2.5">
            <div className="text-[12px] font-semibold text-foreground">🤝 Fazer Proposta</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              Tente negociar um desconto. O vendedor decide na hora — pode aceitar ou não.
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([3, 5, 7] as const).map(pct => {
                const discPrice = Math.round(car.askingPrice * (1 - pct / 100));
                return (
                  <button
                    key={pct}
                    disabled={busy || offerPending}
                    onClick={() => { void handleOffer(pct); }}
                    className="flex flex-col items-center py-2.5 rounded-[10px] bg-primary/10 border border-primary/20 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <span className="text-[12px] font-bold text-primary">-{pct}%</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{fmt(discPrice)}</span>
                  </button>
                );
              })}
            </div>
            {offerPending && (
              <div className="px-3 py-2 rounded-[10px] bg-muted text-[12px] text-muted-foreground text-center animate-pulse">
                Aguardando resposta do vendedor…
              </div>
            )}
            {offerResult && !offerPending && (
              <div className={`px-3 py-2 rounded-[10px] text-[12px] font-semibold ${
                offerResult.accepted
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-red-500/15 text-red-600'
              }`}>
                {offerResult.accepted
                  ? `✅ Proposta aceita! Comprando por ${fmt(Math.round(car.askingPrice * (1 - offerResult.discount / 100)))}…`
                  : '❌ Vendedor recusou. Tente outro desconto ou compre pelo preço cheio.'}
              </div>
            )}
          </div>
        )}

        {!isSold && !hasGarageSpace && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-[12px] px-3 py-2.5 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            <span className="text-[12px] text-orange-600 font-medium">Garagem cheia — libere uma vaga antes de comprar</span>
          </div>
        )}

      </div>

      {/* Barra de ação fixa no rodapé */}
      <div
        className="px-4 pb-6 pt-3 border-t border-border bg-background"
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
      >
        {isSold ? (
          <Button variant="outline" className="w-full h-12 text-[15px] font-bold" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-[15px] font-bold gap-2"
            disabled={!canAfford || !hasGarageSpace || busy}
            onClick={handleBuy}
          >
            <CheckCircle size={16} />
            {!hasGarageSpace
              ? 'Garagem cheia'
              : !canAfford
              ? 'Saldo insuficiente'
              : `Comprar por ${fmt(car.askingPrice)}`}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Card compacto no grid ────────────────────────────────────────
function MarketplaceCard({
  car,
  canAfford,
  hasGarageSpace,
  onClick,
}: {
  car: GlobalCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onClick: () => void;
}) {
  const { getImgForInstance } = useCarImages();
  const cardImgUrl = getImgForInstance(car.modelId, car.id);
  const fipeDiff   = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct     = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));
  const isSold      = car.status === 'sold';

  return (
    <button
      onClick={onClick}
      className="ios-surface rounded-[14px] overflow-hidden text-left active:scale-[0.97] transition-transform w-full relative"
    >
      {/* Thumbnail */}
      <div className="relative w-full bg-muted flex items-center justify-center overflow-hidden" style={{ height: 110 }}>
        {cardImgUrl ? (
          <img
            src={cardImgUrl}
            alt={`${car.brand} ${car.model}`}
            className={`w-full h-full object-cover ${isSold ? 'opacity-30' : ''}`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className={`text-[52px] items-center justify-center ${isSold ? 'opacity-30' : ''}`}
          style={{ display: cardImgUrl ? 'none' : 'flex' }}
        >{car.icon}</span>

        {/* FIPE badge — só quando disponível */}
        {!isSold && (
          <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${isBelowFipe ? 'bg-emerald-500' : 'bg-orange-500'}`}>
            {isBelowFipe ? `▼${diffPct}%` : `▲${diffPct}%`}
          </div>
        )}

        {/* Condition dot */}
        {!isSold && (
          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
            car.condition >= 75 ? 'bg-emerald-400'
            : car.condition >= 50 ? 'bg-amber-400'
            : car.condition >= 30 ? 'bg-orange-400'
            : 'bg-red-400'
          }`} />
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <span className="text-white text-[10px] font-bold tracking-wider uppercase">Vendido</span>
            {car.buyerName && (
              <span className="text-white/75 text-[9px] mt-0.5 px-1 text-center leading-tight">
                para {car.buyerName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 py-2.5 space-y-0.5">
        <div className={`font-game-title text-[16px] font-bold tabular-nums ${isSold ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {fmt(car.askingPrice)}
        </div>
        <div className="text-[11px] font-semibold text-foreground leading-tight truncate">{car.brand} {car.model}</div>
        <div className="text-[10px] text-muted-foreground truncate">{car.trim} · {car.year} · {fmtKm(car.mileage)}</div>
        <div className="text-[10px] text-muted-foreground truncate">📍 {car.seller}</div>
        {!isSold && !hasGarageSpace && <div className="text-[9px] text-orange-500 font-semibold mt-0.5">Garagem cheia</div>}
        {!isSold && !canAfford && hasGarageSpace && <div className="text-[9px] text-red-500 font-semibold mt-0.5">Saldo insuficiente</div>}
      </div>
    </button>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export function FornecedoresCarrosScreen({
  gameState,
  globalCars,
  loading,
  isOnline,
  errorMsg,
  minsLeft,
  onBuyCar,
  onBuyAtPrice,
  onRefreshMarketplace,
}: FornecedoresCarrosScreenProps) {
  const [search, setSearch]         = useState('');
  const [selectedCat, setSelectedCat] = useState<CarCategory | 'all'>('all');
  const [selectedCar, setSelectedCar] = useState<GlobalCar | null>(null);

  const garage        = gameState.garage ?? [];
  const hasGarageSpace = garage.some(s => s.unlocked && !s.car);
  const availableCount = globalCars.filter(c => c.status === 'available').length;

  const cars = useMemo(() => {
    let list = globalCars;
    if (selectedCat !== 'all') list = list.filter(c => c.category === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.trim.toLowerCase().includes(q)
      );
    }
    // Available first, sold last
    return [...list].sort((a, b) => {
      if (a.status === b.status) return a.askingPrice - b.askingPrice;
      return a.status === 'available' ? -1 : 1;
    });
  }, [globalCars, selectedCat, search]);

  const categories = useMemo(() => {
    const seen = new Set<CarCategory>();
    globalCars.forEach(c => seen.add(c.category));
    return Array.from(seen);
  }, [globalCars]);

  const handleBuy = (car: GlobalCar) => {
    void onBuyCar(car).then(result => {
      if (result.success) setSelectedCar(null);
    });
  };

  return (
    <>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="px-0 pt-2 pb-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-foreground">Comprar Veículos</h2>
              <p className="text-[12px] text-muted-foreground">
                {loading ? 'Carregando…' : `${availableCount} disponíveis · ${globalCars.length - availableCount} vendidos`}
                {!loading && !isOnline && globalCars.length > 0 && (
                  <span className="ml-1 text-amber-500">· modo local</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && minsLeft != null && isOnline && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  <Clock size={10} />
                  <span>{minsLeft >= 60
                    ? `${Math.floor(minsLeft / 60)}h${minsLeft % 60 > 0 ? ` ${minsLeft % 60}m` : ''}`
                    : `${minsLeft}min`}
                  </span>
                </div>
              )}
              <button
                onClick={() => void onRefreshMarketplace()}
                className="w-9 h-9 rounded-full ios-surface flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Atualizar mercado"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
              </button>
            </div>
          </div>

          {/* Busca */}
          {!loading && globalCars.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar marca, modelo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-[13px]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Filtro por categoria */}
          {!loading && categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                onClick={() => setSelectedCat('all')}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  selectedCat === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    selectedCat === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Car grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw size={28} className="animate-spin text-primary" />
            <p className="text-[13px] text-muted-foreground font-medium">Carregando mercado…</p>
          </div>
        ) : globalCars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-5xl">🚗</div>
            <p className="text-[14px] font-semibold text-foreground">Mercado vazio</p>
            {errorMsg ? (
              <p className="text-[11px] text-red-500 text-center px-4 font-mono break-all">{errorMsg}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center">
                Nenhum carro disponível no momento.
              </p>
            )}
            <button
              onClick={() => void onRefreshMarketplace()}
              className="mt-1 px-4 py-2 rounded-[12px] bg-primary text-primary-foreground text-[13px] font-semibold active:scale-95 transition-transform"
            >
              Tentar novamente
            </button>
          </div>
        ) : cars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-[14px] font-semibold text-foreground">Nenhum resultado</p>
            <p className="text-[12px] text-muted-foreground">Tente outro filtro ou busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-4">
            {cars.map(car => (
              <MarketplaceCard
                key={car.id}
                car={car}
                canAfford={gameState.money >= car.askingPrice}
                hasGarageSpace={hasGarageSpace}
                onClick={() => setSelectedCar(car)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet — full-screen overlay via portal */}
      {selectedCar && createPortal(
        <CarDetailSheet
          car={selectedCar}
          canAfford={gameState.money >= selectedCar.askingPrice}
          hasGarageSpace={hasGarageSpace}
          onBuy={() => handleBuy(selectedCar)}
          onBuyAtPrice={onBuyAtPrice}
          onClose={() => setSelectedCar(null)}
        />,
        document.body
      )}
    </>
  );
}
