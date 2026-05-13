// =====================================================================
// MercadoCadeiaScreen.tsx — Mercado spot + PMR por produto
// Comprar/vender manualmente, ver preços de referência
// =====================================================================

import { useState } from 'react';
import { RefreshCw, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import type { RegionId } from '@/types/cadeia';
import { PRODUCTS, REGIONS, getCompanyType } from '@/data/cadeia';
import { getPMR, getInventoryQty } from '@/lib/cadeiaEngine';

interface Props {
  cadeia: UseCadeiaReturn;
}

function fmt(v: number, decimals = 2): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(decimals)}`;
}

export function MercadoCadeiaScreen({ cadeia }: Props) {
  const { state, buyFromSpotMarket, listOnMarket, refreshMarket } = cadeia;
  const [tab, setTab] = useState<'mercado' | 'pmr' | 'vender'>('mercado');
  const [regionFilter, setRegionFilter] = useState<RegionId | 'todas'>('todas');
  const [productFilter, setProductFilter] = useState<string>('todos');
  const [buyModal, setBuyModal] = useState<{
    listingId: string;
    maxQty: number;
    price: number;
    productId: string;
    sellerName: string;
  } | null>(null);
  const [buyQty, setBuyQty] = useState('');
  const [buyError, setBuyError] = useState('');
  const [sellModal, setSellModal] = useState(false);
  const [sellCompany, setSellCompany] = useState('');
  const [sellProduct, setSellProduct] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellError, setSellError] = useState('');

  const activeCompanies = state.companies.filter((c) => c.status === 'active');

  const filteredListings = state.marketListings.filter((l) => {
    if (l.availableQty <= 0) return false;
    if (regionFilter !== 'todas' && l.regionId !== regionFilter) return false;
    if (productFilter !== 'todos' && l.productId !== productFilter) return false;
    return true;
  });

  function handleBuy() {
    if (!buyModal) return;
    setBuyError('');
    const qty = parseFloat(buyQty);
    if (isNaN(qty) || qty <= 0) { setBuyError('Quantidade inválida.'); return; }
    if (qty > buyModal.maxQty) { setBuyError(`Máximo disponível: ${buyModal.maxQty}`); return; }

    // Comprar com a primeira empresa ativa
    const buyer = activeCompanies[0];
    if (!buyer) { setBuyError('Sem empresa ativa para comprar.'); return; }

    const r = buyFromSpotMarket(buyer.id, buyModal.listingId, qty);
    if (!r.ok) { setBuyError(r.error ?? 'Erro.'); return; }
    setBuyModal(null);
    setBuyQty('');
  }

  function handleSell() {
    setSellError('');
    const qty = parseFloat(sellQty);
    const price = parseFloat(sellPrice);
    if (!sellCompany) { setSellError('Selecione uma empresa.'); return; }
    if (!sellProduct) { setSellError('Selecione um produto.'); return; }
    if (isNaN(qty) || qty <= 0) { setSellError('Quantidade inválida.'); return; }
    if (isNaN(price) || price <= 0) { setSellError('Preço inválido.'); return; }

    const r = listOnMarket(sellCompany, sellProduct, qty, price);
    if (!r.ok) { setSellError(r.error ?? 'Erro.'); return; }
    setSellModal(false);
    setSellQty('');
    setSellPrice('');
  }

  // Produtos disponíveis no estoque da empresa selecionada
  const sellableProducts = sellCompany
    ? (state.companies.find((c) => c.id === sellCompany)?.inventory ?? [])
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-4 pb-0">
        {(['mercado', 'pmr', 'vender'] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-primary text-background'
                : 'bg-background/40 text-muted-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'mercado' ? '🏪 Mercado' : t === 'pmr' ? '📊 PMR' : '📤 Vender'}
          </button>
        ))}
      </div>

      {/* ── Aba: Mercado Spot ──────────────────────────────────── */}
      {tab === 'mercado' && (
        <div className="flex flex-col gap-3 p-4 pb-28 overflow-y-auto">
          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                regionFilter === 'todas' ? 'bg-primary text-background font-bold' : 'bg-background/40'
              }`}
              onClick={() => setRegionFilter('todas')}
            >
              Todas
            </button>
            {REGIONS.map((r) => (
              <button
                key={r.id}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  regionFilter === r.id ? 'bg-primary text-background font-bold' : 'bg-background/40'
                }`}
                onClick={() => setRegionFilter(r.id)}
              >
                {r.icon} {r.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filteredListings.length} ofertas disponíveis
            </p>
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={refreshMarket}
            >
              <RefreshCw size={12} /> Atualizar NPCs
            </button>
          </div>

          {filteredListings.length === 0 ? (
            <div className="ios-card p-8 text-center">
              <ShoppingCart size={36} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma oferta para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredListings.map((listing) => {
                const product = PRODUCTS.find((p) => p.id === listing.productId);
                const pmr = getPMR(state.pmr, listing.productId, listing.regionId);
                const ratio = pmr > 0 ? listing.pricePerUnit / pmr : 1;
                const region = REGIONS.find((r) => r.id === listing.regionId);

                return (
                  <div key={listing.id} className="ios-card p-3 flex items-center gap-3">
                    <span className="text-xl">{product?.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{product?.name ?? listing.productId}</p>
                        {listing.isNPC && (
                          <span className="text-[10px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">NPC</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {region?.icon} {region?.name} • {listing.availableQty.toFixed(1)} {product?.unit}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{listing.sellerName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmt(listing.pricePerUnit)}</p>
                      <p className={`text-[11px] ${ratio > 1.1 ? 'text-red-400' : ratio < 0.95 ? 'text-green-400' : 'text-muted-foreground'}`}>
                        PMR: {ratio > 1 ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}%
                      </p>
                      <button
                        className="btn-gaming px-3 py-1 text-xs mt-1"
                        onClick={() =>
                          setBuyModal({
                            listingId: listing.id,
                            maxQty: listing.availableQty,
                            price: listing.pricePerUnit,
                            productId: listing.productId,
                            sellerName: listing.sellerName,
                          })
                        }
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Aba: PMR ──────────────────────────────────────────── */}
      {tab === 'pmr' && (
        <div className="flex flex-col gap-3 p-4 pb-28 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Preço Médio de Referência por produto e região. Atualizado em tempo real pelas transações.
          </p>
          {PRODUCTS.map((product) => (
            <div key={product.id} className="ios-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{product.icon}</span>
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">Base: {fmt(product.basePrice)} / {product.unit}</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {REGIONS.map((r) => {
                  const pmr = getPMR(state.pmr, product.id, r.id);
                  const diff = ((pmr - product.basePrice) / product.basePrice) * 100;
                  return (
                    <div key={r.id} className="flex flex-col items-center bg-background/40 rounded-lg p-1.5">
                      <span className="text-base">{r.icon}</span>
                      <p className="text-[10px] text-muted-foreground text-center">{r.name}</p>
                      <p className="text-xs font-bold">{fmt(pmr)}</p>
                      <p className={`text-[10px] ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Aba: Vender ───────────────────────────────────────── */}
      {tab === 'vender' && (
        <div className="flex flex-col gap-4 p-4 pb-28 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Coloque produtos do estoque das suas empresas no mercado spot para outros jogadores (e NPCs) comprarem.
          </p>

          {/* Empresa */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Empresa vendedora</p>
            <select
              className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-2 text-sm"
              value={sellCompany}
              onChange={(e) => { setSellCompany(e.target.value); setSellProduct(''); }}
            >
              <option value="">Selecionar empresa...</option>
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Produto */}
          {sellableProducts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Produto</p>
              <div className="flex flex-col gap-1">
                {sellableProducts.map((item) => {
                  const product = PRODUCTS.find((p) => p.id === item.productId);
                  const company = state.companies.find((c) => c.id === sellCompany);
                  const pmr = company
                    ? getPMR(state.pmr, item.productId, company.regionId)
                    : 0;
                  return (
                    <button
                      key={item.productId}
                      className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        sellProduct === item.productId
                          ? 'bg-primary/20 border border-primary/50'
                          : 'bg-background/40 border border-transparent'
                      }`}
                      onClick={() => {
                        setSellProduct(item.productId);
                        setSellPrice(pmr.toFixed(2));
                      }}
                    >
                      <span className="text-xl">{product?.icon ?? '📦'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{product?.name ?? item.productId}</p>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {item.quantity.toFixed(1)} {product?.unit} • PMR: {fmt(pmr)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sellCompany && sellableProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Estoque vazio nesta empresa.</p>
          )}

          {/* Quantidade e preço */}
          {sellProduct && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quantidade</p>
                  <input
                    type="number"
                    className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-2 text-sm"
                    placeholder="Qtd..."
                    value={sellQty}
                    onChange={(e) => setSellQty(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preço/unidade</p>
                  <input
                    type="number"
                    className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-2 text-sm"
                    placeholder="R$..."
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                </div>
              </div>

              {sellError && <p className="text-xs text-red-400">{sellError}</p>}

              <button className="btn-gaming w-full py-3" onClick={handleSell}>
                <Tag size={16} className="inline mr-2" /> Publicar oferta
              </button>
            </>
          )}

          {/* Listagens ativas do jogador */}
          {state.marketListings.filter((l) => !l.isNPC && l.availableQty > 0).length > 0 && (
            <div className="ios-card p-4">
              <p className="text-sm font-semibold mb-3">📤 Suas ofertas ativas</p>
              <div className="flex flex-col gap-2">
                {state.marketListings
                  .filter((l) => !l.isNPC && l.availableQty > 0)
                  .map((l) => {
                    const product = PRODUCTS.find((p) => p.id === l.productId);
                    return (
                      <div key={l.id} className="flex items-center gap-2 text-xs">
                        <span>{product?.icon ?? '📦'}</span>
                        <div className="flex-1">
                          <p>{product?.name}</p>
                          <p className="text-muted-foreground">{l.availableQty.toFixed(1)} {product?.unit} × {fmt(l.pricePerUnit)}</p>
                        </div>
                        <p className="text-muted-foreground">{l.sellerName}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de compra ───────────────────────────────────── */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[hsl(228_30%_12%)] rounded-t-3xl p-5">
            <h3 className="font-bold text-base mb-1">Comprar do mercado</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {PRODUCTS.find((p) => p.id === buyModal.productId)?.name} • {buyModal.sellerName}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
              <div className="bg-background/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Preço/unidade</p>
                <p className="font-bold">{fmt(buyModal.price)}</p>
              </div>
              <div className="bg-background/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className="font-bold">{buyModal.maxQty.toFixed(1)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-1">Quantidade a comprar</p>
            <input
              type="number"
              className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-2 text-sm mb-2"
              value={buyQty}
              onChange={(e) => setBuyQty(e.target.value)}
              placeholder={`Máx ${buyModal.maxQty.toFixed(1)}`}
            />
            {buyQty && !isNaN(parseFloat(buyQty)) && (
              <p className="text-xs text-muted-foreground mb-3">
                Total: {fmt(parseFloat(buyQty) * buyModal.price)}
                {' '}(empresa: {activeCompanies[0]?.name ?? 'N/A'})
              </p>
            )}

            {buyError && <p className="text-xs text-red-400 mb-2">{buyError}</p>}

            <div className="flex gap-2">
              <button
                className="flex-1 py-3 rounded-xl bg-background/40 text-sm"
                onClick={() => { setBuyModal(null); setBuyQty(''); setBuyError(''); }}
              >
                Cancelar
              </button>
              <button className="flex-1 btn-gaming py-3 text-sm" onClick={handleBuy}>
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
