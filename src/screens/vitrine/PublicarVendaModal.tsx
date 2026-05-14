// =====================================================================
// PublicarVendaModal.tsx — Publish an offer on the vitrine
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import type { UseVitrineReturn } from '@/hooks/useVitrine';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { REGIONS, PRODUCTS } from '@/data/cadeia';

interface Props {
  cadeia:  UseCadeiaReturn;
  vitrine: UseVitrineReturn;
  onClose: () => void;
}

export function PublicarVendaModal({ cadeia, vitrine, onClose }: Props) {
  const { state } = cadeia;
  const [step, setStep] = useState(0);

  // Step 0: pick company + product
  const [companyId,    setCompanyId]    = useState('');
  const [productId,    setProductId]    = useState('');
  // Step 1: qty + price
  const [qty,          setQty]          = useState(100);
  const [price,        setPrice]        = useState(0);
  const [minQty,       setMinQty]       = useState(1);
  // Step 2: payment terms
  const [terms,        setTerms]        = useState<'avista' | 'parcelado'>('avista');
  const [installments, setInstallments] = useState(1);

  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState<string | null>(null);

  const activeCompanies = state.companies.filter((c) => c.status === 'active');
  const company         = activeCompanies.find((c) => c.id === companyId);
  const availableItems  = company
    ? company.inventory.filter((i) => i.quantity > 0)
    : [];
  const product         = PRODUCTS.find((p) => p.id === productId);

  const canNext = () => {
    if (step === 0) return !!companyId && !!productId;
    if (step === 1) return qty > 0 && price > 0 && minQty > 0 && minQty <= qty;
    return true;
  };

  const handleSubmit = async () => {
    if (!company || !product) return;
    setSubmitting(true);
    const result = await vitrine.publishOffer({
      companyId:    company.id,
      companyName:  company.name,
      productId:    product.id,
      productName:  product.name,
      regionId:     company.regionId,
      totalQty:     qty,
      pricePerUnit: price,
      minQty,
      paymentTerms: terms,
      installments: terms === 'avista' ? 1 : installments,
    });
    setSubmitting(false);
    if (result.ok) {
      onClose();
    } else {
      setToast(`Erro: ${result.error}`);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-3xl bg-slate-900 border-t border-slate-700/60 p-5 pb-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">Publicar na Vitrine</h3>
            <p className="text-slate-500 text-xs">Passo {step + 1} de 3</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-blue-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        {/* Step 0 — Company + Product */}
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Empresa vendedora</label>
              <select
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setProductId(''); }}
                className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecionar empresa...</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {company && (
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Produto em estoque</label>
                {availableItems.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sem estoque disponível.</p>
                ) : (
                  <div className="space-y-2">
                    {availableItems.map((item) => {
                      const p = PRODUCTS.find((pr) => pr.id === item.productId);
                      return (
                        <button
                          key={item.productId}
                          onClick={() => setProductId(item.productId)}
                          className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all ${
                            productId === item.productId
                              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                              : 'bg-slate-800 border-slate-700/40 text-white hover:border-slate-500'
                          }`}
                        >
                          <span className="font-medium">{p?.name ?? item.productId}</span>
                          <span className="text-xs ml-2 opacity-60">{item.quantity} {p?.unit}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Qty + Price */}
        {step === 1 && product && (
          <div className="space-y-3">
            <p className="text-white font-semibold">{product.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Quantidade ({product.unit})</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Preço por {product.unit}</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Quantidade mínima por compra</label>
              <input
                type="number"
                min={1}
                max={qty}
                value={minQty}
                onChange={(e) => setMinQty(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            {price > 0 && qty > 0 && (
              <p className="text-slate-400 text-xs">
                Total oferta: <span className="text-white font-semibold">
                  R$ {(price * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Step 2 — Payment terms */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-slate-400 text-xs font-medium">Condições de pagamento</p>
            <div className="space-y-2">
              {(['avista', 'parcelado'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTerms(t)}
                  className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                    terms === t
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800 border-slate-700/40 text-white hover:border-slate-500'
                  }`}
                >
                  <p className="font-semibold">{t === 'avista' ? '💵 À Vista' : '📅 Parcelado'}</p>
                  <p className="text-xs opacity-60 mt-0.5">
                    {t === 'avista' ? 'Pagamento integral na compra' : 'Parcelado em até 12x no escrow'}
                  </p>
                </button>
              ))}
            </div>
            {terms === 'parcelado' && (
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Parcelas</label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {[2, 3, 4, 6, 9, 12].map((n) => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700/40 text-slate-300 font-semibold text-sm hover:bg-slate-700 active:scale-95 transition-all"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}
          {step < 2 ? (
            <button
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-white transition-all ${
                canNext()
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
                  : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                submitting
                  ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]'
              }`}
            >
              {submitting ? 'Publicando...' : 'Publicar Oferta'}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}
