// =====================================================================
// CityScreen — aba "Cidade" do jogo: mapa + ações de compra/construção
//
// Fluxo:
//   • Mapa exibe os ~4700 lotes com cores por status
//   • Click em lote abre dialog com info + botões:
//       Disponível → Comprar (se saldo OK)
//       Seu        → Construir / Melhorar / Vender
//       Outro      → Apenas info
//   • RPCs no useCityLots fazem a comunicação atômica com Supabase
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useCityLots, type CityLot, type BuildingType } from '@/hooks/useCityLots';
import { CityMap } from '@/components/screens/CityMap';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, Home, Store, Factory, Briefcase, Tractor, Warehouse, ShoppingCart,
  ArrowUp, X, Loader2, MapPin, Trees,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

const BUILDING_OPTIONS: Array<{
  type: BuildingType; label: string; icon: React.ReactNode; description: string;
}> = [
  { type: 'house',       label: 'Casa',         icon: <Home size={16} />,      description: 'Residência simples; mais barata.' },
  { type: 'residential', label: 'Edifício',     icon: <Building2 size={16} />, description: 'Prédio residencial; melhor renda.' },
  { type: 'commerce',    label: 'Comércio',     icon: <Store size={16} />,     description: 'Loja ou comércio local.' },
  { type: 'office',      label: 'Escritório',   icon: <Briefcase size={16} />, description: 'Setor corporativo.' },
  { type: 'industry',    label: 'Indústria',    icon: <Factory size={16} />,   description: 'Galpão fabril.' },
  { type: 'farm',        label: 'Sítio',        icon: <Tractor size={16} />,   description: 'Área rural produtiva.' },
  { type: 'garage',      label: 'Garagem',      icon: <Warehouse size={16} />, description: 'Estoque de carros.' },
];

interface CityScreenProps {
  currentMoney: number;
  onMoneyChange: (newMoney: number) => void;
}

export function CityScreen({ currentMoney, onMoneyChange }: CityScreenProps): JSX.Element {
  const city = useCityLots();
  const [myUserId, setMyUserId]       = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [busy, setBusy]               = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setMyUserId(data.user?.id ?? null);
    });
  }, []);

  const selected: CityLot | null = useMemo(() => {
    if (!selectedId || !city.data) return null;
    return city.data.lots.find(l => l.id === selectedId) ?? null;
  }, [selectedId, city.data]);

  const summary = useMemo(() => {
    if (!city.data || !myUserId) return null;
    const mine = city.data.lots.filter(l => l.owner_user_id === myUserId);
    const total = mine.reduce((s, l) => s + l.base_price, 0);
    return { count: mine.length, total };
  }, [city.data, myUserId]);

  if (city.loading || !city.data) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Carregando mapa de Goianésia...
      </div>
    );
  }

  if (city.error) {
    return (
      <div className="text-center py-12 text-red-500 text-sm">
        {city.error}
      </div>
    );
  }

  const handleBuy = async () => {
    if (!selected) return;
    setBusy(true);
    const r = await city.buyLot(selected.id);
    setBusy(false);
    if (r.success) {
      toast.success(r.message);
      if (r.data?.new_money != null) onMoneyChange(r.data.new_money);
    } else {
      toast.error(r.message);
    }
  };

  const handleSell = async () => {
    if (!selected) return;
    if (!confirm(`Vender este lote por 75% do valor + indenização da construção?`)) return;
    setBusy(true);
    const r = await city.sellLot(selected.id);
    setBusy(false);
    if (r.success) {
      toast.success(`${r.message} Recebeu ${fmt(r.data?.payout ?? 0)}.`);
      if (r.data?.new_money != null) onMoneyChange(r.data.new_money);
      setSelectedId(null);
    } else {
      toast.error(r.message);
    }
  };

  const handleBuild = async (type: BuildingType) => {
    if (!selected) return;
    setBusy(true);
    const r = await city.buildOnLot(selected.id, type);
    setBusy(false);
    if (r.success) {
      toast.success(`${r.message} Custo: ${fmt(r.data?.cost ?? 0)}.`);
      if (r.data?.new_money != null) onMoneyChange(r.data.new_money);
    } else {
      toast.error(r.message);
    }
  };

  const handleUpgrade = async () => {
    if (!selected) return;
    setBusy(true);
    const r = await city.upgradeBuilding(selected.id);
    setBusy(false);
    if (r.success) {
      toast.success(`${r.message} Custo: ${fmt(r.data?.cost ?? 0)}.`);
      if (r.data?.new_money != null) onMoneyChange(r.data.new_money);
    } else {
      toast.error(r.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header com resumo */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-game-title text-xl font-bold flex items-center gap-2">
            <MapPin size={18} className="text-primary" />
            Cidade de Goianésia
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {city.data.lots.length.toLocaleString('pt-BR')} lotes · {city.data.blocks.length} quarteirões
          </p>
        </div>
        {summary && summary.count > 0 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seus lotes</div>
            <div className="text-sm font-bold tabular-nums">{summary.count} · {fmt(summary.total)}</div>
          </div>
        )}
      </div>

      {/* Mapa */}
      <CityMap
        data={city.data}
        myUserId={myUserId}
        selectedLotId={selectedId}
        onLotClick={l => setSelectedId(l.id)}
        height={580}
      />

      {/* Dialog do lote */}
      <Dialog
        open={selected != null}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
      >
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  Lote {selected.id}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selected.neighborhood} · Quarteirão {selected.block_id} · {selected.area_m2} m²
                </DialogDescription>
              </DialogHeader>

              {/* Status atual */}
              <div className="ios-surface rounded-[12px] p-3 space-y-1">
                <StatusRow label="Preço base"        value={fmt(selected.base_price)} bold />
                {selected.owner_user_id ? (
                  <>
                    <StatusRow
                      label="Dono"
                      value={selected.owner_user_id === myUserId ? 'Você' : (selected.owner_name ?? 'Outro player')}
                    />
                    {selected.building_type && (
                      <>
                        <StatusRow
                          label="Construção"
                          value={`${BUILDING_OPTIONS.find(b => b.type === selected.building_type)?.label ?? selected.building_type} · Lv ${selected.building_level}`}
                        />
                      </>
                    )}
                    {selected.last_sold_at && (
                      <StatusRow
                        label="Última transação"
                        value={new Date(selected.last_sold_at).toLocaleDateString('pt-BR')}
                      />
                    )}
                  </>
                ) : (
                  <div className="text-emerald-500 text-xs font-semibold flex items-center gap-1.5">
                    <Trees size={12} /> Disponível para compra
                  </div>
                )}
              </div>

              {/* Ações */}
              {selected.owner_user_id == null ? (
                <Button
                  size="sm"
                  onClick={handleBuy}
                  disabled={busy || currentMoney < selected.base_price}
                  className="w-full gap-1.5"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                  Comprar por {fmt(selected.base_price)}
                </Button>
              ) : selected.owner_user_id === myUserId ? (
                <div className="space-y-2">
                  {/* Construir / trocar tipo */}
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {selected.building_type ? 'Trocar tipo de construção' : 'Construir'} ({fmt(selected.base_price * 0.5)})
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUILDING_OPTIONS.map(opt => (
                      <Button
                        key={opt.type}
                        size="sm"
                        variant={selected.building_type === opt.type ? 'default' : 'outline'}
                        onClick={() => void handleBuild(opt.type)}
                        disabled={busy || currentMoney < selected.base_price * 0.5}
                        className="gap-1.5 text-xs justify-start"
                      >
                        {opt.icon}
                        {opt.label}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/40">
                    {selected.building_type && selected.building_level < 5 && (
                      <Button
                        size="sm"
                        onClick={handleUpgrade}
                        disabled={busy || currentMoney < selected.base_price * (selected.building_level + 1) * 0.4}
                        className="gap-1.5 text-xs"
                      >
                        <ArrowUp size={12} />
                        Melhorar (Lv {selected.building_level + 1})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSell}
                      disabled={busy}
                      className="gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      <X size={12} /> Vender
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Este lote pertence a outro jogador. Você não pode interagir com ele.
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold text-foreground tabular-nums' : 'font-medium text-foreground tabular-nums'}>{value}</span>
    </div>
  );
}
