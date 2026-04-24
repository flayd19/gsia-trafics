// =====================================================================
// FornecedoresCarrosScreen — Marketplace de carros (estilo fornecedores)
// =====================================================================
import { useState, useMemo } from 'react';
import { RefreshCw, Search, Tag, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

function CarMarketCard({
  car,
  canAfford,
  hasGarageSpace,
  onBuy,
  onOffer,
}: {
  car: MarketplaceCar;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onBuy: () => void;
  onOffer: (value: number) => void;
}) {
  const [showOffer, setShowOffer] = useState(false);
  const [offerValue, setOfferValue] = useState('');

  const label = conditionLabel(car.condition);
  const colorClass = conditionColor(car.condition);
  const fipeDiff = car.askingPrice - car.fipePrice;
  const isBelowFipe = fipeDiff < 0;
  const diffPct = Math.abs(Math.round((fipeDiff / car.fipePrice) * 100));

  const handleOffer = () => {
    const parsed = parseInt(offerValue.replace(/\D/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      onOffer(parsed);
      setShowOffer(false);
      setOfferValue('');
    }
  };

  return (
    <div className="ios-surface rounded-[16px] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-[14px] bg-muted flex items-center justify-center text-3xl">
          {car.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] text-foreground leading-tight">
            {car.brand} {car.model}
          </div>
          <div className="text-[12px] text-muted-foreground">{car.trim} · {car.year}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">📍 {car.seller}</div>
        </div>
        <Badge variant="outline" className={`text-[10px] font-bold border-current shrink-0 ${colorClass}`}>
          {label}
        </Badge>
      </div>

      {/* Condição bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Condição</span>
          <span className={`text-[11px] font-bold ${colorClass}`}>{car.condition}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${car.condition}%`,
              background: car.condition >= 60 ? 'var(--gradient-primary)' : car.condition >= 35 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'linear-gradient(90deg,#ef4444,#dc2626)',
            }}
          />
        </div>
      </div>

      {/* Preços */}
      <div className="grid grid-cols-2 gap-2">
        <div className="ios-surface-elevated rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">FIPE</div>
          <div className="text-[13px] font-bold text-foreground tabular-nums">{fmt(car.fipePrice)}</div>
        </div>
        <div className="ios-surface-elevated rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Pedido</div>
          <div className={`text-[13px] font-bold tabular-nums ${isBelowFipe ? 'text-emerald-500' : 'text-foreground'}`}>
            {fmt(car.askingPrice)}
          </div>
        </div>
      </div>

      {/* Badge FIPE comparison */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] ${isBelowFipe ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
        {isBelowFipe ? (
          <TrendingDown size={12} className="text-emerald-500" />
        ) : (
          <TrendingUp size={12} className="text-orange-500" />
        )}
        <span className={`text-[11px] font-semibold ${isBelowFipe ? 'text-emerald-500' : 'text-orange-500'}`}>
          {isBelowFipe ? `${diffPct}% abaixo da FIPE` : `${diffPct}% acima da FIPE`}
        </span>
      </div>

      {/* Botões */}
      {showOffer ? (
        <div className="space-y-2">
          <div className="text-[11px] text-muted-foreground font-medium px-1">Quanto você quer oferecer?</div>
          <Input
            type="number"
            placeholder="R$ 0"
            value={offerValue}
            onChange={e => setOfferValue(e.target.value)}
            className="text-[14px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowOffer(false)} className="text-[12px]">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleOffer}
              disabled={!hasGarageSpace || !offerValue}
              className="text-[12px]"
            >
              Enviar Oferta
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[12px] gap-1.5"
            onClick={() => setShowOffer(true)}
            disabled={!hasGarageSpace}
          >
            <Tag size={12} />
            Fazer Oferta
          </Button>
          <Button
            size="sm"
            className="text-[12px] gap-1.5"
            disabled={!canAfford || !hasGarageSpace}
            onClick={onBuy}
          >
            <CheckCircle size={12} />
            {!hasGarageSpace ? 'Garagem cheia' : !canAfford ? 'Sem saldo' : `Comprar ${fmt(car.askingPrice)}`}
          </Button>
        </div>
      )}
    </div>
  );
}

export function FornecedoresCarrosScreen({
  gameState,
  onBuyCar,
  onMakeOffer,
  onRefreshMarketplace,
}: FornecedoresCarrosScreenProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | CarCategory>('all');

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🏪 Fornecedores</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {gameState.marketplaceCars.length} carros disponíveis
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshMarketplace}
          className="gap-1.5 text-[12px]"
        >
          <RefreshCw size={13} />
          Atualizar
        </Button>
      </div>

      {/* Alerta garagem */}
      {!hasGarageSpace && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-[12px] px-3 py-2.5 flex items-center gap-2">
          <span className="text-orange-500 text-sm">⚠️</span>
          <span className="text-[12px] text-orange-600 font-medium">
            Garagem cheia — libere uma vaga ou compre mais espaço
          </span>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar marca, modelo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 text-[14px]"
        />
      </div>

      {/* Filtro de categoria */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            activeCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Lista de carros */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-[14px]">
            Nenhum carro encontrado
          </div>
        ) : (
          filtered.map(car => (
            <CarMarketCard
              key={car.id}
              car={car}
              canAfford={gameState.money >= car.askingPrice}
              hasGarageSpace={hasGarageSpace}
              onBuy={() => onBuyCar(car)}
              onOffer={(value) => onMakeOffer(car.id, value)}
            />
          ))
        )}
      </div>
    </div>
  );
}
