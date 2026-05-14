// =====================================================================
// VitrineTab.tsx — Public marketplace listings with PMR indicators
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState } from 'react';
import { RefreshCw, Plus, Package, MapPin, ShoppingCart, X } from 'lucide-react';
import type { UseVitrineReturn } from '@/hooks/useVitrine';
import type { VitrineOffer } from '@/types/vitrine';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { REGIONS, PRODUCTS } from '@/data/cadeia';
import { PublicarVendaModal } from './PublicarVendaModal';

const PMR_COLORS = {
  green:  'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  yellow: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  red:    'text-red-400 bg-red-900/30 border-red-700/40',
};

const PMR_LABELS = {
  green:  '🟢 Abaixo do PMR',
  yellow: '🟡 No PMR',
  red:    '🔴 Acima do PMR',
};

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

// ── Buy modal ─────────────────────────────────────────────────────────

interface BuyModalProps {
  offer:         VitrineOffer;
  playerCapital: number;
  onConfirm:     (qty: number, destRegionId: string) => void;
  onClose:       () => void;
}

function BuyModal({ offer, playerCapital, onConfirm, onClose }: BuyModalProps) {
  const [qty, setQty] = useState(offer.minQty);
  const [destRegion, setDestRegion] = useState(REGIONS[0]!.id);

  const freightEst = Math.max(50, offer.pricePerUnit * qty * 0.05);
  const total      = offer.pricePerUnit * qty + freightEst;
  const canBuy     = playerCapital >= total && qty >= offer.minQty && qty <= offer.availableQty;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-3xl bg-slate-900 border-t border-slate-700/60 p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">Comprar</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3">
          <p className="text-white font-semibold">{offer.productName}</p>
          <p className="text-slate-400 text-xs mt-0.5">{offer.companyName} · {offer.sellerName}</p>
          <p className="text-slate-300 text-sm mt-1">{fmt(offer.pricePerUnit)} / unidade</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">
              Quantidade (min: {offer.minQty}, disp: {offer.availableQty})
            </label>
            <input
              type="number"
              min={offer.minQty}
              max={offer.availableQty}
              step={offer.minQty}
              value={qty}
              onChange={(e) => setQty(Math.max(offer.minQty, Number(e.target.value)))}
              className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">Entregar em</label>
            <select
              value={destRegion}
              onChange={(e) => setDestRegion(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Produto ({qty} un)</span>
            <span className="text-white">{fmt(offer.pricePerUnit * qty)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Frete (estimativa)</span>
            <span className="text-white">{fmt(freightEst)}</span>
          </div>
          <div className="border-t border-slate-700/40 pt-1.5 flex justify-between font-semibold">
            <span className="text-slate-300">Total</span>
            <span className={total > playerCapital ? 'text-red-400' : 'text-emerald-400'}>{fmt(total)}</span>
          </div>
        </div>

        <button
          onClick={() => canBuy && onConfirm(qty, destRegion)}
          disabled={!canBuy}
          className={`w-full rounded-2xl py-3 font-bold text-white transition-all ${
            canBuy
              ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
              : 'bg-slate-700 opacity-50 cursor-not-allowed'
          }`}
        >
          {total > playerCapital ? 'Saldo insuficiente' : 'Confirmar compra'}
        </button>
      </div>
    </div>
  );
}

// ── VitrineTab ────────────────────────────────────────────────────────

interface Props {
  vitrine: UseVitrineReturn;
  cadeia:  UseCadeiaReturn;
}

export function VitrineTab({ vitrine, cadeia }: Props) {
  const [filter, setFilter]               = useState('');
  const [selectedOffer, setSelectedOffer] = useState<VitrineOffer | null>(null);
  const [showPublish, setShowPublish]     = useState(false);
  const [buying, setBuying]               = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = vitrine.offers.filter(
    (o) =>
      !filter ||
      o.productName.toLowerCase().includes(filter.toLowerCase()) ||
      o.companyName.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleBuy = async (qty: number, destRegionId: string) => {
    if (!selectedOffer) return;
    setBuying(true);
    const res = await vitrine.buyOffer(
      { offerId: selectedOffer.id, qty, destRegionId },
      cadeia.state.playerCapital,
    );
    setBuying(false);
    setSelectedOffer(null);
    if (res.ok) {
      // deduct from local player capital
      cadeia.depositToCompany && showToast(`Compra realizada! Frete em andamento.`);
    } else {
      showToast(`Erro: ${res.error}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar produto ou empresa..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700/50 text-white placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => vitrine.refresh()}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/50 hover:bg-slate-700 active:scale-95 transition-all"
          >
            <RefreshCw size={16} className={`text-slate-400 ${vitrine.loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowPublish(true)}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>
        <p className="text-slate-500 text-xs">{filtered.length} oferta{filtered.length !== 1 ? 's' : ''} ativas</p>
      </div>

      {/* Offers list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {vitrine.loading && !filtered.length && (
          <div className="text-center text-slate-500 py-12 text-sm">Carregando...</div>
        )}
        {!vitrine.loading && !filtered.length && (
          <div className="text-center text-slate-500 py-12">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma oferta encontrada</p>
          </div>
        )}
        {filtered.map((offer) => {
          const region = REGIONS.find((r) => r.id === offer.regionId);
          const pmrStyle = offer.pmrTag ? PMR_COLORS[offer.pmrTag] : '';
          return (
            <button
              key={offer.id}
              onClick={() => setSelectedOffer(offer)}
              className="w-full text-left rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 hover:border-slate-600 active:scale-[0.99] transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{offer.productName}</p>
                  <p className="text-slate-400 text-xs truncate">{offer.companyName} · {offer.sellerName}</p>
                </div>
                {offer.pmrTag && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${pmrStyle}`}>
                    {PMR_LABELS[offer.pmrTag]}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-bold text-base">{fmt(offer.pricePerUnit)}</span>
                <span className="text-slate-400">/{PRODUCTS.find((p) => p.id === offer.productId)?.unit ?? 'un'}</span>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Package size={11} />
                  {offer.availableQty} disponível
                </span>
                {region && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {region.icon} {region.name}
                  </span>
                )}
                {offer.paymentTerms === 'parcelado' && (
                  <span className="text-blue-400">{offer.installments}x</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Buy modal */}
      {selectedOffer && (
        <BuyModal
          offer={selectedOffer}
          playerCapital={cadeia.state.playerCapital}
          onConfirm={handleBuy}
          onClose={() => setSelectedOffer(null)}
        />
      )}

      {/* Publish modal */}
      {showPublish && (
        <PublicarVendaModal
          cadeia={cadeia}
          vitrine={vitrine}
          onClose={() => setShowPublish(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
