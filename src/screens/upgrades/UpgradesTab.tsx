// =====================================================================
// UpgradesTab.tsx — Upgrade catalog (fully offline, stored in Company)
// =====================================================================

import { useState } from 'react';
import { ArrowUp, Lock, CheckCircle, Zap } from 'lucide-react';
import type { Company } from '@/types/cadeia';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { getUpgradesForType, type UpgradeDef } from '@/data/upgrades';

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

const CATEGORY_ICONS: Record<string, string> = {
  equipment:        '⚙️',
  structure:        '🏗️',
  employee_slot:    '👷',
  permanent_unlock: '🔓',
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment:        'Equipamentos',
  structure:        'Estrutura',
  employee_slot:    'Vagas',
  permanent_unlock: 'Desbloqueios',
};

interface Props {
  company: Company;
  cadeia:  UseCadeiaReturn;
}

export function UpgradesTab({ company, cadeia }: Props) {
  const [activeTab, setActiveTab] = useState<string>('equipment');
  const [toast, setToast]         = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const owned = new Set(company.upgrades ?? []);
  const upgrades = getUpgradesForType(company.typeId);
  const categories = [...new Set(upgrades.map((u) => u.category))];
  const displayed = upgrades.filter((u) => u.category === activeTab);

  const isUnlocked = (u: UpgradeDef): boolean => {
    if (!u.requiresId) return true;
    return owned.has(u.requiresId);
  };

  const purchase = (upgrade: UpgradeDef) => {
    if (owned.has(upgrade.id))    { showToast('Você já possui este upgrade.'); return; }
    if (!isUnlocked(upgrade))     { showToast('Pré-requisito não atendido.'); return; }
    if (company.capital < upgrade.cost) {
      showToast(`Caixa insuficiente. Custo: ${fmt(upgrade.cost)}`);
      return;
    }
    const r = cadeia.buyUpgrade(company.id, upgrade.id, upgrade.cost);
    if (r.ok) showToast(`✅ ${upgrade.name} instalado!`);
    else showToast(r.error ?? 'Erro ao adquirir upgrade.');
  };

  if (upgrades.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12 px-4">
        <ArrowUp size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum upgrade disponível para este tipo de empresa.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === cat
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Info bar */}
      <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 px-3 py-2 text-xs text-slate-400 flex justify-between">
        <span>{owned.size} upgrade{owned.size !== 1 ? 's' : ''} instalado{owned.size !== 1 ? 's' : ''}</span>
        <span>Caixa: <span className="text-white font-semibold">{fmt(company.capital)}</span></span>
      </div>

      {/* Upgrade cards */}
      <div className="space-y-2">
        {displayed.map((upgrade) => {
          const isOwned   = owned.has(upgrade.id);
          const unlocked  = isUnlocked(upgrade);
          const canAfford = company.capital >= upgrade.cost;

          return (
            <div
              key={upgrade.id}
              className={`rounded-2xl border p-4 transition-all ${
                isOwned
                  ? 'bg-emerald-900/10 border-emerald-700/30'
                  : unlocked
                  ? 'bg-slate-800/60 border-slate-700/40'
                  : 'bg-slate-800/30 border-slate-700/20 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isOwned ? (
                      <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    ) : !unlocked ? (
                      <Lock size={16} className="text-slate-500 shrink-0" />
                    ) : (
                      <Zap size={16} className="text-blue-400 shrink-0" />
                    )}
                    <p className="font-semibold text-white text-sm truncate">
                      {upgrade.name}
                      <span className="ml-1.5 text-[10px] text-slate-500 font-normal">T{upgrade.tier}</span>
                    </p>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">{upgrade.description}</p>
                  {!unlocked && upgrade.requiresId && (
                    <p className="text-amber-400/70 text-[10px] mt-1">
                      🔒 Requer: {upgrade.requiresId.replace(/_/g, ' ')}
                    </p>
                  )}
                  {/* Effects preview */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(upgrade.effects).map(([key, val]) => (
                      <span key={key} className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-lg">
                        {key.replace(/_/g, ' ')}: {String(val)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  {isOwned ? (
                    <span className="text-emerald-400 text-xs font-semibold">✅ Instalado</span>
                  ) : (
                    <button
                      disabled={!unlocked || !canAfford}
                      onClick={() => purchase(upgrade)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        unlocked && canAfford
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {fmt(upgrade.cost)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
