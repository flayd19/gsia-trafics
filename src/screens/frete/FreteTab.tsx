// =====================================================================
// FreteTab.tsx — Freight calls list for logistics companies
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState } from 'react';
import { Truck, Package, MapPin, Clock, CheckCircle, X } from 'lucide-react';
import type { UseVitrineReturn } from '@/hooks/useVitrine';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import type { FreightCall } from '@/types/vitrine';
import { REGIONS } from '@/data/cadeia';

const STATUS_LABELS: Record<FreightCall['status'], string> = {
  open:       '🟢 Aberto',
  accepted:   '🔵 Aceito',
  in_transit: '🚛 Em trânsito',
  delivered:  '✅ Entregue',
  cancelled:  '❌ Cancelado',
};

function fmt(v: number) {
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

// ── Accept freight modal ──────────────────────────────────────────────

interface AcceptModalProps {
  call:     FreightCall;
  cadeia:   UseCadeiaReturn;
  onAccept: (carrierCompanyId: string) => void;
  onClose:  () => void;
}

function AcceptModal({ call, cadeia, onAccept, onClose }: AcceptModalProps) {
  const logisticaCompanies = cadeia.state.companies.filter(
    (c) => c.status === 'active' && ['frota_pesada', 'frota_tanque', 'frota_granel', 'frota_bau'].includes(c.typeId),
  );
  const [selectedCompany, setSelectedCompany] = useState(logisticaCompanies[0]?.id ?? '');

  const originRegion = REGIONS.find((r) => r.id === call.originRegionId);
  const destRegion   = REGIONS.find((r) => r.id === call.destRegionId);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-3xl bg-slate-900 border-t border-slate-700/60 p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">Aceitar Frete</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Package size={14} />
            <span>{call.productName} · {call.qty} un</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin size={14} />
            <span>{originRegion?.icon} {originRegion?.name} → {destRegion?.icon} {destRegion?.name}</span>
          </div>
          <div className="text-emerald-400 font-bold text-base mt-1">{fmt(call.freightValue)}</div>
        </div>

        {logisticaCompanies.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            Você precisa de uma empresa de logística ativa para aceitar fretes.
          </p>
        ) : (
          <>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Empresa transportadora</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                {logisticaCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              disabled={!selectedCompany}
              onClick={() => selectedCompany && onAccept(selectedCompany)}
              className="w-full rounded-2xl py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-white active:scale-[0.98] transition-all"
            >
              Aceitar Frete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── FreteTab ──────────────────────────────────────────────────────────

interface Props {
  vitrine: UseVitrineReturn;
  cadeia:  UseCadeiaReturn;
}

export function FreteTab({ vitrine, cadeia }: Props) {
  const { user } = cadeia.state as unknown as { user?: { id: string } };
  const [selectedCall, setSelectedCall] = useState<FreightCall | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [tab, setTab]                   = useState<'open' | 'mine'>('open');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openCalls = vitrine.freightCalls.filter((c) => c.status === 'open');
  const mineCalls = vitrine.freightCalls.filter(
    (c) => c.status !== 'open' && c.status !== 'cancelled',
  );

  const displayed = tab === 'open' ? openCalls : mineCalls;

  const handleAccept = async (call: FreightCall, carrierCompanyId: string) => {
    const res = await vitrine.acceptFreight(call.id, carrierCompanyId);
    setSelectedCall(null);
    showToast(res.ok ? 'Frete aceito! Faça a entrega para receber o pagamento.' : `Erro: ${res.error}`);
  };

  const handleDeliver = async (call: FreightCall) => {
    const res = await vitrine.deliverFreight(call.id);
    showToast(res.ok ? `Entrega confirmada! +${fmt(call.freightValue)} liberado.` : `Erro: ${res.error}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-3">
        {(['open', 'mine'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'open' ? `Disponíveis (${openCalls.length})` : `Meus fretes (${mineCalls.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {displayed.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Truck size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {tab === 'open' ? 'Nenhum frete disponível no momento' : 'Você não tem fretes ativos'}
            </p>
          </div>
        )}

        {displayed.map((call) => {
          const originRegion = REGIONS.find((r) => r.id === call.originRegionId);
          const destRegion   = REGIONS.find((r) => r.id === call.destRegionId);

          return (
            <div
              key={call.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{call.productName}</p>
                  <p className="text-slate-400 text-xs">{call.buyerName} · {call.qty} un</p>
                </div>
                <span className="text-xs text-slate-500">{STATUS_LABELS[call.status]}</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {originRegion?.icon} → {destRegion?.icon}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(call.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">{fmt(call.freightValue)}</span>

                {call.status === 'open' && (
                  <button
                    onClick={() => setSelectedCall(call)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Truck size={12} /> Aceitar
                  </button>
                )}

                {(call.status === 'accepted' || call.status === 'in_transit') && (
                  <button
                    onClick={() => handleDeliver(call)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle size={12} /> Confirmar entrega
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCall && (
        <AcceptModal
          call={selectedCall}
          cadeia={cadeia}
          onAccept={(cid) => handleAccept(selectedCall, cid)}
          onClose={() => setSelectedCall(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
