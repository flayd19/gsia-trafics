// =====================================================================
// PlayerMarketScreen — Mercado P2P de Carros
// Permite anunciar carros da garagem e comprar de outros jogadores
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  ShoppingBag,
  PlusCircle,
  Clock,
  CheckCircle2,
  Ban,
  Hourglass,
  Search,
  X,
  Car,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { GameState, OwnedCar, PlayerMarketListing, PlayerMarketListingStatus } from '@/types/game';
import { usePlayerMarket } from '@/hooks/usePlayerMarket';

interface PlayerMarketScreenProps {
  gameState: GameState;
  products: unknown[];        // mantido por compatibilidade — ignorado
  onReserveStock: () => void;
  onReturnStock: () => void;
  onReceiveStock: () => void;
  onSpendMoney: (amount: number) => boolean;
  onAddMoney: (amount: number) => void;
  /** Callback: comprador recebe o carro após compra bem-sucedida */
  onAddToGarage: (car: OwnedCar, paidPrice: number) => { success: boolean; message: string };
  /** Callback: vendedor — remove carro da garagem quando listing é vendido */
  onSoldListing: (carInstanceId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
};

const statusInfo = (s: string) => {
  switch (s) {
    case 'active':    return { label: 'Ativa',      color: 'bg-green-600/20 text-green-400 border-green-600/40',   icon: <Clock size={11} /> };
    case 'sold':      return { label: 'Vendido',     color: 'bg-primary/20 text-primary border-primary/40',         icon: <CheckCircle2 size={11} /> };
    case 'collected': return { label: 'Recebido',    color: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40', icon: <CheckCircle2 size={11} /> };
    case 'cancelled': return { label: 'Cancelado',   color: 'bg-muted text-muted-foreground border-border',          icon: <Ban size={11} /> };
    default:          return { label: 'Expirado',    color: 'bg-orange-600/20 text-orange-400 border-orange-600/40', icon: <Hourglass size={11} /> };
  }
};

// ── Helpers de condição ───────────────────────────────────────────
function conditionBadgeClass(c: number) {
  if (c >= 80) return 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10';
  if (c >= 50) return 'text-amber-500 border-amber-500/40 bg-amber-500/10';
  return 'text-red-500 border-red-500/40 bg-red-500/10';
}
function conditionLabel(c: number) {
  if (c >= 80) return 'Ótimo';
  if (c >= 60) return 'Bom';
  if (c >= 40) return 'Regular';
  return 'Ruim';
}

// ── Card de anúncio ───────────────────────────────────────────────
function ListingCard({
  listing,
  isOwn,
  canAfford,
  hasGarageSpace,
  onBuy,
  onCancel,
}: {
  listing: PlayerMarketListing;
  isOwn: boolean;
  canAfford: boolean;
  hasGarageSpace: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const si        = statusInfo(listing.status);
  const isActive  = listing.status === 'active';
  const condition = listing.car_data?.condition;

  return (
    <div className="ios-surface rounded-[14px] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-[12px] bg-muted flex items-center justify-center text-2xl shrink-0">
          {listing.product_icon ?? '🚗'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-foreground truncate">{listing.product_name}</div>
          <div className="text-[11px] text-muted-foreground">
            Vendedor: {listing.seller_name}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{relativeTime(listing.created_at)}</div>
        </div>
        <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${si.color}`}>
          {si.icon}
          {si.label}
        </Badge>
      </div>

      {/* Condição do veículo */}
      {condition !== undefined && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${condition}%`,
                  background: condition >= 60
                    ? 'var(--gradient-primary, #22c55e)'
                    : condition >= 35
                    ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                    : 'linear-gradient(90deg,#ef4444,#dc2626)',
                }}
              />
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold shrink-0 ${conditionBadgeClass(condition)}`}
            >
              {conditionLabel(condition)} · {condition}%
            </Badge>
          </div>
          {listing.car_data?.mileage != null && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>🛣️</span>
              <span className="tabular-nums font-medium">
                {new Intl.NumberFormat('pt-BR').format(listing.car_data.mileage)} km
              </span>
            </div>
          )}
        </div>
      )}

      {/* Descrição do vendedor */}
      {listing.description && (
        <p className="text-[12px] text-muted-foreground italic leading-relaxed border-l-2 border-primary/30 pl-2">
          "{listing.description}"
        </p>
      )}

      {/* Preço + ação */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-game-title text-xl font-bold text-foreground tabular-nums">
            {fmt(listing.total_price)}
          </div>
          {listing.category && (
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{listing.category}</div>
          )}
        </div>

        {isActive && (
          isOwn ? (
            <Button variant="outline" size="sm" className="text-[12px] text-red-500 border-red-500/30" onClick={onCancel}>
              Cancelar anúncio
            </Button>
          ) : (
            <Button
              size="sm"
              className="text-[12px]"
              disabled={!canAfford || !hasGarageSpace}
              onClick={onBuy}
            >
              {!hasGarageSpace ? 'Garagem cheia' : !canAfford ? 'Sem saldo' : 'Comprar'}
            </Button>
          )
        )}
      </div>

      {listing.status === 'sold' && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-[10px] px-3 py-2">
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          <div className="text-[12px] text-emerald-600 font-semibold">
            Vendido{listing.buyer_name ? ` para ${listing.buyer_name}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tela principal ────────────────────────────────────────────────
export const PlayerMarketScreen = ({
  gameState,
  onSpendMoney,
  onAddMoney,
  onAddToGarage,
  onSoldListing,
}: PlayerMarketScreenProps) => {
  const {
    activeListings,
    myListings,
    loading,
    userId,
    userName,
    fetchActiveListings,
    fetchMyListings,
    createListing,
    purchaseListing,
    cancelListing,
    collectPayouts,
  } = usePlayerMarket();

  const [search, setSearch] = useState('');
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const [askingPrice, setAskingPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'mercado' | 'meus'>('mercado');

  const MAX_DESC = 150;

  // Vaga disponível para o comprador
  const hasGarageSpace = gameState.garage.some(s => s.unlocked && !s.car);

  // Detecta vendas concluídas e remove o carro da garagem do vendedor
  const processedSalesRef = useRef(new Set<string>());
  useEffect(() => {
    myListings
      .filter(l => (l.status === 'sold' || l.status === ('collected' as PlayerMarketListingStatus)))
      .forEach(l => {
        if (!processedSalesRef.current.has(l.id)) {
          processedSalesRef.current.add(l.id);
          onSoldListing(l.product_id); // product_id = instanceId do carro vendido
        }
      });
  }, [myListings, onSoldListing]);

  // Carros na garagem disponíveis para anunciar (não em reparo, não anunciados)
  const carsInGarage: OwnedCar[] = gameState.garage
    .filter(s => s.unlocked && s.car && !s.car.inRepair)
    .map(s => s.car!);

  // Verifica se um carro já está anunciado
  const listedCarIds = new Set(
    myListings.filter(l => l.status === 'active').map(l => l.product_id)
  );
  const availableCars = carsInGarage.filter(c => !listedCarIds.has(c.instanceId));

  const filtered = activeListings.filter(l =>
    !search || l.product_name.toLowerCase().includes(search.toLowerCase())
  );

  // Pagamentos pendentes a recolher (status 'sold', ainda não coletados)
  const pendingPayouts = myListings.filter(l => l.status === 'sold');
  const pendingTotal = pendingPayouts.reduce((s, l) => s + l.total_price, 0);

  // Dispara fetch quando userId estiver disponível (evita skip por userId=null no mount)
  useEffect(() => {
    if (!userId) return;
    void fetchActiveListings();
    void fetchMyListings();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    fetchActiveListings();
    fetchMyListings();
  };

  const handleCreate = async () => {
    const car = availableCars.find(c => c.instanceId === selectedCarId);
    if (!car || !askingPrice) return;
    const price = parseInt(askingPrice.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      await createListing({
        product_id:   car.instanceId,
        product_name: `${car.brand} ${car.model} ${car.trim} ${car.year}`,
        product_icon: car.icon,
        category:     'carro',
        quantity:     1,
        price_per_unit: price,
        car_data:     car,
        description:  description.trim() || null,
      });
      // Remove o carro da garagem do vendedor imediatamente ao anunciar
      onSoldListing(car.instanceId);
      toast({ title: 'Anúncio criado!', description: `${car.brand} ${car.model} anunciado por ${fmt(price)}` });
      setCreatingOpen(false);
      setSelectedCarId('');
      setAskingPrice('');
      setDescription('');
      fetchMyListings();
    } catch {
      toast({ title: 'Erro ao criar anúncio', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleBuy = async (listing: PlayerMarketListing) => {
    // 1. Verificar vaga na garagem antes de qualquer coisa
    if (!hasGarageSpace) {
      toast({ title: 'Garagem cheia!', description: 'Libere uma vaga antes de comprar.', variant: 'destructive' });
      return;
    }

    // 2. Validar preço
    const price = Number.isFinite(listing.total_price) && listing.total_price > 0
      ? listing.total_price
      : listing.price_per_unit * listing.quantity;

    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: 'Preço inválido', description: 'Não foi possível determinar o valor.', variant: 'destructive' });
      return;
    }

    // 3. Debitar dinheiro (verificação de saldo incluída)
    if (!onSpendMoney(price)) {
      toast({ title: 'Saldo insuficiente', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      // 4. RPC atômica — marca como vendido no Supabase
      const result = await purchaseListing(listing.id);

      if (result.success) {
        // 5. Adicionar carro à garagem do comprador
        if (listing.car_data) {
          const addResult = onAddToGarage(listing.car_data, price);
          if (!addResult.success) {
            // Não conseguiu adicionar (improvável — já checamos vaga)
            onAddMoney(price); // estorna
            toast({ title: 'Erro ao adicionar à garagem', description: addResult.message, variant: 'destructive' });
            return;
          }
          toast({ title: '🚗 Carro comprado!', description: addResult.message });
        } else {
          // car_data ausente (listagem antiga sem dados) — só confirma compra
          toast({ title: 'Compra realizada!', description: `${listing.product_name} comprado por ${fmt(price)}` });
        }
        fetchActiveListings();
      } else {
        // RPC falhou (carro já vendido por outro) — estorna
        onAddMoney(price);
        toast({ title: 'Falha na compra', description: result.message ?? 'Tente novamente.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao comprar', variant: 'destructive' });
      onAddMoney(price);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (listingId: string) => {
    const listing = myListings.find(l => l.id === listingId);
    setBusy(true);
    try {
      await cancelListing(listingId);
      // Devolve o carro para a garagem do vendedor ao cancelar o anúncio
      if (listing?.car_data) {
        onAddToGarage(listing.car_data, listing.car_data.purchasePrice);
      }
      toast({ title: 'Anúncio cancelado' });
      fetchMyListings();
      fetchActiveListings();
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleCollect = async () => {
    setBusy(true);
    try {
      const result = await collectPayouts();
      if (result.total > 0) {
        onAddMoney(result.total);
        toast({ title: `${fmt(result.total)} recebidos!`, description: `${result.count} venda(s) recebida(s)` });
      }
      fetchMyListings();
    } catch {
      toast({ title: 'Erro ao receber', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🤝 Mercado P2P</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Compre e venda carros com outros jogadores
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="gap-1.5 text-[12px]">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Receber pagamentos */}
      {pendingPayouts.length > 0 && (
        <div
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-[12px] px-4 py-3 flex items-center justify-between cursor-pointer"
          onClick={handleCollect}
        >
          <div>
            <div className="font-semibold text-[14px] text-emerald-600">
              {pendingPayouts.length} venda(s) para receber
            </div>
            <div className="text-[11px] text-emerald-600/80">{fmt(pendingTotal)} disponíveis</div>
          </div>
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-[12px]" disabled={busy}>
            Receber
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-[12px] p-1">
        {(['mercado', 'meus'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
              activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {tab === 'mercado' ? `🏪 Mercado (${activeListings.length})` : `📋 Meus anúncios (${myListings.filter(l => l.status === 'active').length})`}
          </button>
        ))}
      </div>

      {activeTab === 'mercado' && (
        <>
          {/* Busca */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar carro…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-[14px]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Anunciar carro */}
          <Dialog open={creatingOpen} onOpenChange={setCreatingOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" disabled={availableCars.length === 0}>
                <PlusCircle size={15} />
                {availableCars.length === 0 ? 'Nenhum carro disponível para anunciar' : 'Anunciar meu carro'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Anunciar carro</DialogTitle>
                <DialogDescription>
                  Escolha um carro da garagem e defina o preço de venda.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Seletor de carro */}
                <div className="space-y-2">
                  <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Carro</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableCars.map(car => (
                      <button
                        key={car.instanceId}
                        onClick={() => setSelectedCarId(car.instanceId)}
                        className={`w-full flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all ${
                          selectedCarId === car.instanceId
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <span className="text-xl">{car.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] truncate">{car.brand} {car.model} {car.trim}</div>
                          <div className="text-[10px] text-muted-foreground">{car.year} · Condição {car.condition}%</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preço */}
                <div className="space-y-1.5">
                  <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Preço de venda</div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="R$ 0"
                    value={askingPrice}
                    onChange={e => setAskingPrice(e.target.value.replace(/\D/g, ''))}
                    className="text-[15px] font-bold"
                  />
                  {selectedCarId && (() => {
                    const car = availableCars.find(c => c.instanceId === selectedCarId);
                    return car ? (
                      <div className="text-[10px] text-muted-foreground">
                        FIPE de referência: {fmt(car.fipePrice)} · Condição: {car.condition}%
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Descrição opcional */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Descrição <span className="normal-case font-normal">(opcional)</span>
                    </div>
                    <span className={`text-[10px] tabular-nums ${description.length > MAX_DESC ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {description.length}/{MAX_DESC}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={MAX_DESC}
                    placeholder="Ex: Carro bem conservado, único dono, sem batidas…"
                    value={description}
                    onChange={e => setDescription(e.target.value.slice(0, MAX_DESC))}
                    className="w-full px-3 py-2 rounded-[12px] border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreatingOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={busy || !selectedCarId || !askingPrice}>
                  Publicar anúncio
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Listagens do mercado */}
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-[13px]">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-5xl">🤝</div>
              <div className="text-[14px] font-semibold text-muted-foreground">
                {search ? 'Nenhum carro encontrado' : 'Nenhum anúncio no momento'}
              </div>
              <div className="text-[11px] text-muted-foreground">Seja o primeiro a anunciar um carro!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(listing => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isOwn={listing.seller_id === userId}
                  canAfford={gameState.money >= (Number.isFinite(listing.total_price) ? listing.total_price : listing.price_per_unit * listing.quantity)}
                  hasGarageSpace={hasGarageSpace}
                  onBuy={() => handleBuy(listing)}
                  onCancel={() => handleCancel(listing.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ABA: MEUS ANÚNCIOS ─────────────────────────────────── */}
      {activeTab === 'meus' && (
        <>
          {/* Botão anunciar carro — também disponível na aba meus */}
          <Dialog open={creatingOpen} onOpenChange={setCreatingOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" disabled={availableCars.length === 0}>
                <PlusCircle size={15} />
                {availableCars.length === 0 ? 'Nenhum carro disponível para anunciar' : 'Anunciar meu carro'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Anunciar carro</DialogTitle>
                <DialogDescription>
                  Escolha um carro da garagem e defina o preço de venda.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Carro</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableCars.map(car => (
                      <button
                        key={car.instanceId}
                        onClick={() => setSelectedCarId(car.instanceId)}
                        className={`w-full flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all ${
                          selectedCarId === car.instanceId
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <span className="text-xl">{car.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] truncate">{car.brand} {car.model} {car.trim}</div>
                          <div className="text-[10px] text-muted-foreground">{car.year} · Condição {car.condition}%</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Preço de venda</div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="R$ 0"
                    value={askingPrice}
                    onChange={e => setAskingPrice(e.target.value.replace(/\D/g, ''))}
                    className="text-[15px] font-bold"
                  />
                  {selectedCarId && (() => {
                    const car = availableCars.find(c => c.instanceId === selectedCarId);
                    return car ? (
                      <div className="text-[10px] text-muted-foreground">
                        FIPE de referência: {fmt(car.fipePrice)} · Condição: {car.condition}%
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Descrição <span className="normal-case font-normal">(opcional)</span>
                    </div>
                    <span className={`text-[10px] tabular-nums ${description.length > MAX_DESC ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {description.length}/{MAX_DESC}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={MAX_DESC}
                    placeholder="Ex: Carro bem conservado, único dono, sem batidas…"
                    value={description}
                    onChange={e => setDescription(e.target.value.slice(0, MAX_DESC))}
                    className="w-full px-3 py-2 rounded-[12px] border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreatingOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={busy || !selectedCarId || !askingPrice}>
                  Publicar anúncio
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Lista de meus anúncios */}
          {myListings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-5xl">📋</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Você não tem anúncios</div>
              <div className="text-[11px] text-muted-foreground">Anuncie um carro da sua garagem acima.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map(listing => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isOwn={true}
                  canAfford={false}
                  hasGarageSpace={hasGarageSpace}
                  onBuy={() => {}}
                  onCancel={() => handleCancel(listing.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
