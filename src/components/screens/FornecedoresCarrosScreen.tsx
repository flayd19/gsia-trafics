// =====================================================================
// FornecedoresCarrosScreen — Marketplace estilo Facebook Marketplace
// =====================================================================
import { useState, useMemo } from 'react';
import { RefreshCw, Search, X, Tag, CheckCircle, TrendingDown, TrendingUp, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameState, MarketplaceCar } from '@/types/game';
import { conditionLabel, conditionColor, conditionValueFactor, type CarCategory } from '@/data/cars';

interface FornecedoresCarrosScreenProps {
  gameState: GameState;
  onBuyCar: (car: MarketplaceCar) => { success: boolean; message: string };
  onMakeOffer: (carId: string, value: number) => { success: boolean; message: string };
  onRefreshMarketplace: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const CATEGORY_LABELS: Record<CarCategory, string> = {
  popular: '🚗 Popular',
  medio: '🚘 Médio',
  suv: '🚙 SUV',
  pickup: '🛻 Pickup',
  esportivo: '🏎️ Esportivo',
  eletrico: '⚡ Elétrico',
};

// ── Card de detalhe (abre ao clicar num card do grid) ─────────────
function CarDetailSheet({
  car,
  canAfford,
  hasGarageSpace,
  onBuy,
  onOffer,
  onClose,
}: {
  car: MarketplaceCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onBuy: () => void;
  onOffer: (value: number) => void;
  onClose: () => void;
}) {
  const [offerValue, setOfferValue] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);

  const label = conditionLabel(car.condition);
  const colorClass = conditionColor(car.condition);
  const fipeDiff = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));
  const marketValue = Math.round(car.fipePrice * conditionValueFactor(car.condition));

  const handleOffer = () => {
    const parsed = parseInt(offerValue.replace(/\D/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      onOffer(parsed);
      setShowOfferInput(false);
      setOfferValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* Hero foto */}
      <div className="relative w-full bg-muted" style={{ height: 220 }}>
        <div className="w-full h-full flex items-center justify-center text-[88px]">
          {car.icon}
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow active:scale-95"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        {/* Condition badge sobreposto */}
        <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow ${
          car.condition >= 75 ? 'bg-emerald-500' : car.condition >= 50 ? 'bg-amber-500' : car.condition >= 30 ? 'bg-orange-500' : 'bg-red-500'
        }`}>
          {label} {car.condition}%
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Nome e preço */}
        <div>
          <div className="font-game-title text-2xl font-bold text-foreground">{fmt(car.askingPrice)}</div>
          <div className="text-[16px] font-semibold text-foreground mt-1">
            {car.brand} {car.model} {car.trim}
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5">{car.year} · 📍 {car.seller}</div>
        </div>

        {/* FIPE comparison */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-[12px] ${isBelowFipe ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
          {isBelowFipe
            ? <TrendingDown size={16} className="text-emerald-500 shrink-0" />
            : <TrendingUp size={16} className="text-orange-500 shrink-0" />
          }
          <div>
            <div className={`text-[13px] font-bold ${isBelowFipe ? 'text-emerald-600' : 'text-orange-600'}`}>
              {isBelowFipe ? `${diffPct}% abaixo da FIPE` : `${diffPct}% acima da FIPE`}
            </div>
            <div className="text-[11px] text-muted-foreground">FIPE: {fmt(car.fipePrice)} · Valor de mercado: {fmt(marketValue)}</div>
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
                  car.condition >= 60
                    ? 'var(--gradient-primary)'
                    : car.condition >= 35
                    ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                    : 'linear-gradient(90deg,#ef4444,#dc2626)',
              }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {car.condition >= 80
              ? 'Ótimo estado — pronto para revenda'
              : car.condition >= 60
              ? 'Bom estado — pequenos reparos podem valorizar'
              : car.condition >= 40
              ? 'Estado razoável — recomendo levar à oficina'
              : 'Estado ruim — necessita reparos urgentes'}
          </div>
        </div>

        {!hasGarageSpace && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-[12px] px-3 py-2.5 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            <span className="text-[12px] text-orange-600 font-medium">Garagem cheia — libere uma vaga antes de comprar</span>
          </div>
        )}

        {/* Oferta inline */}
        {showOfferInput && (
          <div className="ios-surface rounded-[14px] p-3.5 space-y-3">
            <div className="text-[13px] font-semibold text-foreground">Sua proposta</div>
            <Input
              type="number"
              placeholder="R$ 0"
              value={offerValue}
              onChange={e => setOfferValue(e.target.value)}
              className="text-[15px] font-bold"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowOfferInput(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleOffer} disabled={!hasGarageSpace || !offerValue}>
                Enviar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Barra de ação fixa no rodapé */}
      {!showOfferInput && (
        <div className="px-4 pb-6 pt-3 border-t border-border bg-background space-y-2" style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}>
          <Button
            className="w-full h-12 text-[15px] font-bold gap-2"
            disabled={!canAfford || !hasGarageSpace}
            onClick={onBuy}
          >
            <CheckCircle size={16} />
            {!hasGarageSpace ? 'Garagem cheia' : !canAfford ? 'Saldo insuficiente' : `Comprar por ${fmt(car.askingPrice)}`}
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 text-[14px] gap-2"
            disabled={!hasGarageSpace}
            onClick={() => setShowOfferInput(true)}
          >
            <Tag size={14} />
            Fazer uma proposta
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Card compacto estilo Facebook Marketplace ──────────────────────
function MarketplaceCard({
  car,
  canAfford,
  hasGarageSpace,
  onClick,
}: {
  car: MarketplaceCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onClick: () => void;
}) {
  const fipeDiff = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));

  return (
    <button
      onClick={onClick}
      className="ios-surface rounded-[14px] overflow-hidden text-left active:scale-[0.97] transition-transform w-full"
    >
      {/* Foto / ícone */}
      <div className="relative w-full bg-muted flex items-center justify-center" style={{ height: 110 }}>
        <span className="text-[52px]">{car.icon}</span>
        {/* FIPE badge */}
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${isBelowFipe ? 'bg-emerald-500' : 'bg-orange-500'}`}>
          {isBelowFipe ? `▼${diffPct}%` : `▲${diffPct}%`}
        </div>
        {/* Condition dot */}
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          car.condition >= 75 ? 'bg-emerald-400' : car.condition >= 50 ? 'bg-amber-400' : car.condition >= 30 ? 'bg-orange-400' : 'bg-red-400'
        }`} />
      </div>

      {/* Info */}
      <div className="px-2.5 py-2.5 space-y-0.5">
        <div className="font-game-title text-[16px] font-bold text-foreground tabular-nums">
          {fmt(car.askingPrice)}
        </div>
        <div className="text-[11px] font-semibold text-foreground leading-tight truncate">
          {car.brand} {car.model}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{car.trim} · {car.year}</div>
        <div className="text-[10px] text-muted-foreground truncate">📍 {car.seller}</div>
        {!hasGarageSpace && (
          <div className="text-[9px] text-orange-500 font-semibold mt-0.5">Garagem cheia</div>
        )}
        {!canAfford && hasGarageSpace && (
          <div className="text-[9px] text-red-500 font-semibold mt-0.5">Saldo insuficiente</div>
        )}
      </div>
    </button>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export function FornecedoresCarrosScreen({
  gameState,
  onBuyCar,
  onMakeOffer,
  onRefreshMarketplace,
}: FornecedoresCarrosScreenProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | CarCategory>('all');
  const [selectedCar, setSelectedCar] = useState<MarketplaceCar | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const hasGarageSpace = gameState.garage.some(s => s.unlocked && !s.car);
  const categories: CarCategory[] = ['popular', 'medio', 'suv', 'pickup', 'esportivo', 'eletrico'];

  const filtered = useMemo(() => {
    return gameState.marketplaceCars.filter(car => {
      const matchSearch =
        !search ||
        `${car.brand} ${car.model} ${car.trim}`.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === 'all' || car.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [gameState.marketplaceCars, search, activeCategory]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBuy = (car: MarketplaceCar) => {
    const result = onBuyCar(car);
    showToast(result.message, result.success);
    if (result.success) setSelectedCar(null);
  };

  const handleOffer = (carId: string, value: number) => {
    const result = onMakeOffer(carId, value);
    showToast(result.message, result.success);
    if (result.success) setSelectedCar(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🏪 Marketplace</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {gameState.marketplaceCars.length} carros disponíveis
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefreshMarketplace} className="gap-1.5 text-[12px]">
          <RefreshCw size={13} />
          Atualizar
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar marca, modelo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 text-[14px]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filtros de categoria */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            activeCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
              activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Grid 2 colunas estilo Facebook Marketplace */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-[14px]">
          Nenhum carro encontrado
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(car => (
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

      {/* Sheet de detalhe */}
      {selectedCar && (
        <CarDetailSheet
          car={selectedCar}
          canAfford={gameState.money >= selectedCar.askingPrice}
          hasGarageSpace={hasGarageSpace}
          onBuy={() => handleBuy(selectedCar)}
          onOffer={(value) => handleOffer(selectedCar.id, value)}
          onClose={() => setSelectedCar(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full text-white text-[13px] font-semibold shadow-lg animate-fade-in ${
            toast.ok ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  );
}
