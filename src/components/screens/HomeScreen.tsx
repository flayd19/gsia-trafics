import { TrendingUp, TrendingDown, Car, DollarSign, Wrench, ShoppingBag } from 'lucide-react';
import type { GameState } from '@/types/game';
import { conditionValueFactor } from '@/data/cars';
import { ensureReputation, levelProgress, xpRequiredForLevel, MAX_LEVEL } from '@/lib/reputation';

interface HomeScreenProps {
  gameState: GameState;
  onNavigate: (tab: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function HomeScreen({ gameState, onNavigate }: HomeScreenProps) {
  const rep = ensureReputation(gameState.reputation);
  const isMaxLevel = rep.level >= MAX_LEVEL;
  const xpNeeded = isMaxLevel ? 0 : xpRequiredForLevel(rep.level + 1);
  const xpPct = Math.round(levelProgress(rep) * 100);

  const carsInGarage = gameState.garage.filter(s => s.unlocked && s.car).map(s => s.car!);
  const garageValue = carsInGarage.reduce((sum, car) => sum + Math.round(car.fipePrice * conditionValueFactor(car.condition)), 0);

  const totalCarsBought = gameState.totalCarsBought ?? 0;
  const totalCarsSold = gameState.totalCarsSold ?? 0;
  const totalRevenue = gameState.totalRevenue ?? 0;
  const totalSpent = gameState.totalSpent ?? 0;
  const netProfit = totalRevenue - totalSpent;

  const lastSales = [...(gameState.carSales ?? [])].reverse().slice(0, 3);
  const pendingRepairs = gameState.activeRepairs ?? [];
  const activeBuyers = (gameState.carBuyers ?? []).filter(b => b.state === 'waiting' || b.state === 'thinking');

  const quickActions = [
    { icon: ShoppingBag, label: 'Comprar Carro', sub: `${gameState.marketplaceCars.length} disponíveis`, tab: 'fornecedores', color: 'text-blue-500 bg-blue-500/10' },
    { icon: DollarSign, label: 'Vender', sub: `${activeBuyers.length} comprador(es)`, tab: 'vendas', color: 'text-emerald-500 bg-emerald-500/10' },
    { icon: Wrench, label: 'Oficina', sub: `${carsInGarage.length} na garagem`, tab: 'oficina', color: 'text-orange-500 bg-orange-500/10' },
    { icon: Car, label: 'Garagem', sub: `${carsInGarage.length} / ${gameState.garage.filter(s => s.unlocked).length} vagas`, tab: 'garagem', color: 'text-purple-500 bg-purple-500/10' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-game-title text-2xl font-bold text-foreground tracking-tight">
          Bem-vindo, Alife!
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Dia {gameState.gameTime.day} &middot; Compre, conserte e venda carros
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="ios-surface rounded-[16px] p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Garagem</div>
          <div className="font-game-title text-2xl font-bold text-foreground">{carsInGarage.length}</div>
          <div className="text-[11px] text-muted-foreground">carros</div>
          <div className="text-[12px] font-semibold text-emerald-500">{fmt(garageValue)}</div>
        </div>
        <div className="ios-surface rounded-[16px] p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lucro Total</div>
          <div className={`font-game-title text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {netProfit >= 0 ? '+' : ''}{fmt(netProfit)}
          </div>
          <div className="text-[11px] text-muted-foreground">{totalCarsSold} vendidos</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="ios-surface rounded-[14px] p-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Comprados</div>
          <div className="font-bold text-[16px] text-foreground">{totalCarsBought}</div>
        </div>
        <div className="ios-surface rounded-[14px] p-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Vendidos</div>
          <div className="font-bold text-[16px] text-foreground">{totalCarsSold}</div>
        </div>
        <div className="ios-surface rounded-[14px] p-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Reparos</div>
          <div className="font-bold text-[16px] text-foreground">{pendingRepairs.length}</div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-3">
          Acesso Rapido
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ icon: Icon, label, sub, tab, color }) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className="ios-surface rounded-[14px] p-4 text-left space-y-2 active:scale-[0.98] transition-transform"
            >
              <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <div className="font-semibold text-[13px] text-foreground">{label}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeBuyers.length > 0 && (
        <div
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-[12px] px-4 py-3 cursor-pointer active:opacity-80"
          onClick={() => onNavigate('vendas')}
        >
          <div className="font-semibold text-[14px] text-emerald-600">
            {activeBuyers.length} comprador(es) esperando!
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Toque para ver as propostas</div>
        </div>
      )}

      {pendingRepairs.length > 0 && (
        <div
          className="bg-primary/10 border border-primary/30 rounded-[12px] px-4 py-3 cursor-pointer active:opacity-80"
          onClick={() => onNavigate('oficina')}
        >
          <div className="font-semibold text-[14px] text-primary">
            {pendingRepairs.length} carro(s) em reparo
          </div>
          <div className="text-[11px] text-primary/70 mt-0.5">Toque para acompanhar</div>
        </div>
      )}

      {lastSales.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-3">
            Ultimas Vendas
          </div>
          <div className="space-y-2">
            {lastSales.map(sale => (
              <div key={sale.id} className="ios-surface rounded-[12px] px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">{sale.fullName}</div>
                  <div className="text-[11px] text-muted-foreground">Dia {sale.gameDay}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[13px]">{fmt(sale.salePrice)}</div>
                  <div className={`text-[11px] font-semibold flex items-center gap-0.5 justify-end ${sale.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {sale.profit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {sale.profit >= 0 ? '+' : ''}{fmt(sale.profit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[15px] text-foreground">Nivel {rep.level}</div>
            <div className="text-[11px] text-muted-foreground">
              {isMaxLevel ? 'Nivel maximo!' : `${rep.xp} / ${xpNeeded} XP`}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>{totalCarsSold} vendidos</div>
            <div>{totalCarsBought} comprados</div>
          </div>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${xpPct}%`, background: 'var(--gradient-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}
