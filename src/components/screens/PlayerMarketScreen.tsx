import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { GameState, Product, PlayerMarketListing } from '@/types/game';
import { usePlayerMarket } from '@/hooks/usePlayerMarket';
import {
  RefreshCw,
  ShoppingBag,
  PlusCircle,
  Store as StoreIcon,
  Coins,
  Package,
  Search,
  X,
  Clock,
  CheckCircle2,
  Ban,
  Hourglass,
} from 'lucide-react';

interface PlayerMarketScreenProps {
  gameState: GameState;
  products: Product[];
  onReserveStock: (productId: string, quantity: number) => boolean;
  onReturnStock: (productId: string, quantity: number) => void;
  onReceiveStock: (productId: string, quantity: number) => boolean;
  onSpendMoney: (amount: number) => boolean;
  onAddMoney: (amount: number) => void;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
};

const statusLabel = (s: PlayerMarketListing['status']) => {
  switch (s) {
    case 'active': return { label: 'Ativa', color: 'bg-green-600/20 text-green-400 border-green-600/40', icon: <Clock className="w-3 h-3" /> };
    case 'sold': return { label: 'Vendida', color: 'bg-primary/20 text-primary border-primary/40', icon: <CheckCircle2 className="w-3 h-3" /> };
    case 'cancelled': return { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: <Ban className="w-3 h-3" /> };
    case 'expired': return { label: 'Expirada', color: 'bg-orange-600/20 text-orange-400 border-orange-600/40', icon: <Hourglass className="w-3 h-3" /> };
  }
};

export const PlayerMarketScreen = ({
  gameState,
  products,
  onReserveStock,
  onReturnStock,
  onReceiveStock,
  onSpendMoney,
  onAddMoney,
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

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  // Produtos que o jogador tem em estoque (podem ser anunciados)
  const stockedProducts = useMemo(
    () => products.filter(p => (gameState.stock[p.id] ?? 0) > 0),
    [products, gameState.stock],
  );

  // Coletar pagamentos pendentes ao abrir a tela e a cada 60s
  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      const result = await collectPayouts();
      if (result.success && result.count > 0 && result.total > 0) {
        onAddMoney(result.total);
        toast({
          title: `💰 ${result.count} venda${result.count > 1 ? 's' : ''} P2P paga${result.count > 1 ? 's' : ''}!`,
          description: `Total recebido: ${formatMoney(result.total)}`,
        });
      }
    };
    run();
    const itv = setInterval(run, 60_000);
    return () => clearInterval(itv);
  }, [userId, collectPayouts, onAddMoney]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    activeListings.forEach(l => l.category && set.add(l.category));
    return Array.from(set);
  }, [activeListings]);

  const filteredActive = useMemo(() => {
    return activeListings.filter(l => {
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (search && !l.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activeListings, categoryFilter, search]);

  // Sugerir preço ao abrir o dialog de criação
  useEffect(() => {
    if (!selectedProductId) return;
    const p = products.find(p => p.id === selectedProductId);
    if (p) {
      setPricePerUnit(Math.max(1, Math.round(p.currentPrice * 0.85))); // sugere 85% do preço de rua
      setQuantity(1);
    }
  }, [selectedProductId, products]);

  const handleCreate = async () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    const available = gameState.stock[product.id] ?? 0;
    if (quantity <= 0 || quantity > available) {
      toast({ title: 'Quantidade inválida', description: `Disponível: ${available}`, variant: 'destructive' });
      return;
    }
    if (pricePerUnit <= 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }
    setBusy(true);
    // Reservar estoque localmente antes de criar a oferta
    const reserved = onReserveStock(product.id, quantity);
    if (!reserved) {
      toast({ title: 'Falha ao reservar estoque', variant: 'destructive' });
      setBusy(false);
      return;
    }
    const listing = await createListing({
      product_id: product.id,
      product_name: product.displayName,
      product_icon: product.icon ?? null,
      category: product.category ?? null,
      quantity,
      price_per_unit: pricePerUnit,
    });
    if (!listing) {
      // reverter reserva
      onReturnStock(product.id, quantity);
    }
    setBusy(false);
    if (listing) {
      setCreatingOpen(false);
      setSelectedProductId('');
      setQuantity(1);
      setPricePerUnit(0);
    }
  };

  const handleBuy = async (l: PlayerMarketListing) => {
    if (gameState.money - l.total_price < gameState.overdraftLimit) {
      toast({ title: 'Saldo insuficiente', description: `Necessário: ${formatMoney(l.total_price)}`, variant: 'destructive' });
      return;
    }
    // Verificar capacidade de galpão
    const spaceUsed = Object.values(gameState.stock).reduce((a, b) => a + b, 0);
    if (spaceUsed + l.quantity > gameState.warehouseCapacity) {
      toast({ title: 'Galpão cheio', description: 'Libere espaço antes de comprar', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const result = await purchaseListing(l.id);
    if (result.success) {
      onSpendMoney(l.total_price);
      onReceiveStock(l.product_id, l.quantity);
      toast({
        title: '🛒 Compra P2P realizada!',
        description: `${l.quantity}x ${l.product_name} de ${l.seller_name}`,
      });
    } else {
      toast({ title: 'Falha na compra', description: result.message, variant: 'destructive' });
      await fetchActiveListings();
    }
    setBusy(false);
  };

  const handleCancel = async (l: PlayerMarketListing) => {
    setBusy(true);
    const ok = await cancelListing(l.id);
    if (ok) {
      onReturnStock(l.product_id, l.quantity);
    }
    setBusy(false);
  };

  const handleRefresh = async () => {
    setBusy(true);
    await Promise.all([fetchActiveListings(), fetchMyListings()]);
    setBusy(false);
  };

  if (!userId) {
    return (
      <Card className="game-card p-6 text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h3 className="font-game-title text-xl text-primary">Mercado P2P Bloqueado</h3>
        <p className="text-muted-foreground">
          Entre com sua conta para negociar produtos com outros jogadores em tempo real.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-game-title font-bold flex items-center gap-2">
            <StoreIcon className="w-6 h-6 text-primary" /> Mercado P2P
          </h2>
          <p className="text-sm text-muted-foreground">
            Negocie produtos diretamente com outros jogadores • <span className="text-primary">{userName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={busy || loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Dialog open={creatingOpen} onOpenChange={setCreatingOpen}>
            <DialogTrigger asChild>
              <Button className="btn-luxury" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" /> Nova Oferta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Publicar Oferta</DialogTitle>
                <DialogDescription>
                  O estoque é reservado ao publicar e devolvido se cancelar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder={stockedProducts.length ? 'Selecione um produto' : 'Sem produtos em estoque'} />
                    </SelectTrigger>
                    <SelectContent>
                      {stockedProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span>{p.icon}</span>
                            {p.displayName}
                            <span className="text-muted-foreground text-xs">
                              (Est: {gameState.stock[p.id]})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      max={selectedProductId ? gameState.stock[selectedProductId] : 1}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div>
                    <Label>Preço/un (R$)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pricePerUnit}
                      onChange={e => setPricePerUnit(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>
                {selectedProductId && (
                  <div className="text-sm p-2 rounded bg-muted/40 border border-border">
                    Total: <span className="font-bold text-primary">{formatMoney(quantity * pricePerUnit)}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreatingOpen(false)} disabled={busy}>Cancelar</Button>
                <Button className="btn-luxury" onClick={handleCreate} disabled={busy || !selectedProductId}>
                  {busy ? 'Publicando…' : 'Publicar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Ofertas Ativas ({filteredActive.length})
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Minhas Ofertas ({myListings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3">
          {/* Filtros */}
          <Card className="game-card p-3 flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto…"
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {filteredActive.length === 0 && !loading && (
            <Card className="game-card p-8 text-center text-muted-foreground">
              <div className="text-4xl mb-2">🕊️</div>
              Nenhuma oferta disponível no momento. Seja o primeiro a publicar!
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActive.map(l => {
              const ppuMarket = products.find(p => p.id === l.product_id)?.currentPrice ?? 0;
              const discount = ppuMarket > 0 ? ((ppuMarket - l.price_per_unit) / ppuMarket) * 100 : 0;
              const canAfford = gameState.money - l.total_price >= gameState.overdraftLimit;
              return (
                <Card key={l.id} className="game-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{l.product_icon || '📦'}</span>
                      <div>
                        <div className="font-bold">{l.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          por <span className="text-primary">{l.seller_name}</span> • {relativeTime(l.created_at)}
                        </div>
                      </div>
                    </div>
                    {discount > 0 && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/40">
                        -{discount.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-1 rounded bg-muted/40">
                      <div className="text-muted-foreground">Qtd</div>
                      <div className="font-bold">{l.quantity}</div>
                    </div>
                    <div className="text-center p-1 rounded bg-muted/40">
                      <div className="text-muted-foreground">Un.</div>
                      <div className="font-bold">{formatMoney(l.price_per_unit)}</div>
                    </div>
                    <div className="text-center p-1 rounded bg-primary/10 border border-primary/30">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-bold text-primary">{formatMoney(l.total_price)}</div>
                    </div>
                  </div>
                  <Button
                    className="w-full btn-luxury"
                    disabled={busy || !canAfford}
                    onClick={() => handleBuy(l)}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {canAfford ? 'Comprar' : 'Saldo insuficiente'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="mine" className="space-y-3">
          {myListings.length === 0 && (
            <Card className="game-card p-8 text-center text-muted-foreground">
              Você ainda não publicou ofertas.
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {myListings.map(l => {
              const st = statusLabel(l.status);
              return (
                <Card key={l.id} className="game-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{l.product_icon || '📦'}</span>
                      <div>
                        <div className="font-bold">{l.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.quantity}x • {formatMoney(l.price_per_unit)}/un
                        </div>
                      </div>
                    </div>
                    <Badge className={`${st.color} flex items-center gap-1`}>
                      {st.icon} {st.label}
                    </Badge>
                  </div>
                  <div className="text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-primary">{formatMoney(l.total_price)}</span>
                  </div>
                  {l.status === 'sold' && l.buyer_name && (
                    <div className="text-xs text-muted-foreground">
                      Vendida para <span className="text-primary">{l.buyer_name}</span>
                      {l.paid_out_at ? ' • pago' : ' • será creditado na próxima atualização'}
                    </div>
                  )}
                  {l.status === 'active' && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleCancel(l)} disabled={busy}>
                      <X className="w-4 h-4 mr-2" /> Cancelar e devolver ao galpão
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerMarketScreen;
