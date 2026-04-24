// =====================================================================
// FornecedoresCarrosScreen — Marketplace global compartilhado
// Todos os jogadores veem os mesmos carros.
// Quando alguém compra primeiro, o carro fica "Vendido para [nome]".
// Inventário renovado a cada 30 min.
// =====================================================================
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, X, Tag, CheckCircle, TrendingDown, TrendingUp, ChevronLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameState } from '@/types/game';
import type { GlobalCar } from '@/hooks/useGlobalMarketplace';
import { conditionLabel, conditionColor, conditionValueFactor, type CarCategory } from '@/data/cars';

interface FornecedoresCarrosScreenProps {
  gameState: GameState;
  globalCars: GlobalCar[];
  loading: boolean;
  isOnline: boolean;
  minsLeft: number | null;
  onBuyCar: (car: GlobalCar) => Promise<{ success: boolean; message: string }>;
  onMakeOffer: (carId: string, value: number) => Promise<{ success: boolean; message: string; finalPrice?: number }>;
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
};

// ── Painel de oferta ──────────────────────────────────────────────
function OfferPanel({
  car,
  hasGarageSpace,
  onOffer,
  onClose,
}: {
  car: GlobalCar;
  hasGarageSpace: boolean;
  onOffer: (value: number) => void;
  onClose: () => void;
}) {
  const [offerValue, setOfferValue] = useState('');
  const minOffer   = Math.round(car.askingPrice * 0.55);
  const suggested  = Math.round(car.askingPrice * 0.85);

  const handleOffer = () => {
    const parsed = parseInt(offerValue.replace(/\D/g, ''));
    if (!isNaN(parsed) && parsed >= minOffer) onOffer(parsed);
  };

  const parsed   = parseInt(offerValue.replace(/\D/g, '')) || 0;
  const isValid  = parsed >= minOffer;
  const discount = parsed > 0 ? Math.round(((car.askingPrice - parsed) / car.askingPrice) * 100) : 0;

  return (
    <div className="ios-surface rounded-[16px] p-4 space-y-4 border border-blue-500/20">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-foreground">💬 Fazer Proposta</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="text-[12px] text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Preço pedido:</span>
          <span className="font-semibold text-foreground">{fmt(car.askingPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span>Proposta mínima (~45% desc.):</span>
          <span className="font-semibold text-orange-500">{fmt(minOffer)}</span>
        </div>
        <div className="flex justify-between">
          <span>Sugestão razoável (~15% desc.):</span>
          <span className="font-semibold text-emerald-500">{fmt(suggested)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={`Mínimo ${fmt(minOffer)}`}
          value={offerValue}
          onChange={e => setOfferValue(e.target.value.replace(/\D/g, ''))}
          className="text-[15px] font-bold h-11"
          autoFocus
        />
        {parsed > 0 && (
          <div className={`text-[11px] font-semibold text-center ${
            isValid
              ? discount > 15 ? 'text-orange-500' : 'text-emerald-500'
              : 'text-red-500'
          }`}>
            {!isValid
              ? `Muito baixo — mínimo ${fmt(minOffer)}`
              : discount > 15
              ? `Desconto de ${discount}% — pode ser recusado`
              : `Desconto de ${discount}% — boa chance de aceite`}
          </div>
        )}
      </div>

      {/* Botões rápidos */}
      <div className="grid grid-cols-3 gap-2">
        {[0.95, 0.90, 0.85].map(pct => (
          <button
            key={pct}
            onClick={() => setOfferValue(String(Math.round(car.askingPrice * pct)))}
            className="text-[11px] font-semibold bg-muted hover:bg-muted/80 rounded-[10px] py-2 px-1 transition-colors"
          >
            -{Math.round((1 - pct) * 100)}%<br />
            <span className="text-muted-foreground">{fmt(car.askingPrice * pct)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button
          size="sm"
          onClick={handleOffer}
          disabled={!hasGarageSpace || !isValid}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Enviar proposta
        </Button>
      </div>
    </div>
  );
}

// ── Card de detalhe (abre ao clicar num card do grid) ─────────────
function CarDetailSheet({
  car,
  canAfford,
  hasGarageSpace,
  onBuy,
  onOffer,
  onClose,
}: {
  car: GlobalCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onBuy: () => void;
  onOffer: (value: number) => void;
  onClose: () => void;
}) {
  const [showOfferPanel, setShowOfferPanel] = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy]                     = useState(false);

  const label       = conditionLabel(car.condition);
  const colorClass  = conditionColor(car.condition);
  const fipeDiff    = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct     = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));
  const marketValue = Math.round(car.fipePrice * conditionValueFactor(car.condition));
  const isSold      = car.status === 'sold';

  const handleBuy = async () => {
    setBusy(true);
    onBuy();
    setBusy(false);
  };

  const handleOffer = (value: number) => {
    onOffer(value);
    setShowOfferPanel(false);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in">
      {/* Hero */}
      <div className="relative w-full bg-muted" style={{ height: 220 }}>
        <div className={`w-full h-full flex items-center justify-center text-[88px] ${isSold ? 'opacity-40' : ''}`}>
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
          <div className="text-[13px] text-muted-foreground mt-0.5">{car.year} · 📍 {car.seller}</div>
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
              FIPE: {fmt(car.fipePrice)} · Valor de mercado: {fmt(marketValue)}
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

        {!isSold && !hasGarageSpace && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-[12px] px-3 py-2.5 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            <span className="text-[12px] text-orange-600 font-medium">Garagem cheia — libere uma vaga antes de comprar</span>
          </div>
        )}

        {/* Painel de oferta */}
        {!isSold && showOfferPanel && (
          <OfferPanel
            car={car}
            hasGarageSpace={hasGarageSpace}
            onOffer={handleOffer}
            onClose={() => setShowOfferPanel(false)}
          />
        )}
      </div>

      {/* Barra de ação fixa no rodapé */}
      {!showOfferPanel && (
        <div
          className="px-4 pb-6 pt-3 border-t border-border bg-background space-y-2"
          style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
        >
          {isSold ? (
            <Button variant="outline" className="w-full h-12 text-[15px] font-bold" onClick={onClose}>
              Fechar
            </Button>
          ) : (
            <>
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
              <Button
                variant="outline"
                className="w-full h-11 text-[14px] gap-2 border-blue-500/40 text-blue-600 hover:bg-blue-50"
                disabled={!hasGarageSpace || busy}
                onClick={() => setShowOfferPanel(true)}
              >
                <Tag size={14} />
                Fazer uma proposta
              </Button>
            </>
          )}
        </div>
      )}
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
  const fipeDiff    = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct     = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));
  const isSold      = car.status === 'sold';

  return (
    <button
      onClick={onClick}
      className="ios-surface rounded-[14px] overflow-hidden text-left active:scale-[0.97] transition-transform w-full relative"
    >
      {/* Thumbnail */}
      <div className="relative w-full bg-muted flex items-center justify-center" style={{ height: 110 }}>
        <span className={`text-[52px] ${isSold ? 'opacity-30' : ''}`}>{car.icon}</span>

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
        <div className="text-[10px] text-muted-foreground truncate">{car.trim} · {car.year}</div>
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
  minsLeft,
  onBuyCar,
  onMakeOffer,
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

  const handleOffer = (carId: string, value: number) => {
    void onMakeOffer(carId, value).then(result => {
      if (result.success) setSelectedCar(null);
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-2 pb-3 space-y-3 shrink-0">
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
                <span>{minsLeft}min</span>
              </div>
            )}
            <button
              onClick={() => void onRefreshMarketplace()}
              className="w-9 h-9 rounded-full ios-surface flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Atualizar mercado"
            >
              <RefreshCw size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Saldo */}
        <div className="ios-surface rounded-[12px] px-3 py-2 flex justify-between items-center">
          <span className="text-[12px] text-muted-foreground">Seu saldo</span>
          <span className="text-[15px] font-bold text-foreground tabular-nums">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(gameState.money)}
          </span>
        </div>

        {/* Próxima renovação — só mostra quando online */}
        {minsLeft != null && isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-primary/5 border border-primary/10">
            <Clock size={12} className="text-primary shrink-0" />
            <span className="text-[11px] text-primary font-medium">
              {minsLeft === 0
                ? 'Novos carros chegando em instantes…'
                : `Novo lote em ${minsLeft} min — compre antes que acabem!`}
            </span>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar marca ou modelo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-[13px]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filtro de categoria */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCat('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              selectedCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                selectedCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-[40px] mb-3 animate-spin inline-block">🔄</div>
            <p className="text-[14px] font-semibold mt-2">Carregando mercado…</p>
            <p className="text-[12px] mt-1">Buscando carros disponíveis</p>
          </div>
        ) : globalCars.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-3">
            <div className="text-[40px]">🏎️</div>
            <p className="text-[14px] font-semibold">Nenhum carro no momento</p>
            <p className="text-[12px]">Toque em atualizar para tentar novamente</p>
            <button
              onClick={() => void onRefreshMarketplace()}
              className="mt-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold active:scale-95 transition-transform"
            >
              Atualizar mercado
            </button>
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-[40px] mb-3">🔍</div>
            <p className="text-[14px] font-semibold">Nenhum carro encontrado</p>
            <p className="text-[12px] mt-1">Tente outro filtro</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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

      {/* Detail sheet — portal para document.body para evitar conflito de z-index */}
      {selectedCar && createPortal(
        <CarDetailSheet
          car={selectedCar}
          canAfford={gameState.money >= selectedCar.askingPrice}
          hasGarageSpace={hasGarageSpace}
          onBuy={() => handleBuy(selectedCar)}
          onOffer={(value) => handleOffer(selectedCar.id, value)}
          onClose={() => setSelectedCar(null)}
        />,
        document.body
      )}
    </div>
  );
}
