// =====================================================================
// UpgradesTab.tsx — Upgrade catalog tab within company detail
// Doc 04v2 — Modular Progression System
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp, Lock, CheckCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const [owned,      setOwned]      = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [buying,     setBuying]     = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<string>('equipment');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOwned = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('company_upgrades')
      .select('upgrade_id')
      .eq('user_id', user.id)
      .eq('company_id', company.id);
    setOwned(new Set((data ?? []).map((r) => (r as { upgrade_id: string }).upgrade_id)));
    setLoading(false);
  }, [user, company.id]);

  useEffect(() => { fetchOwned(); }, [fetchOwned]);

  const upgrades = getUpgradesForType(company.typeId);
  const categories = [...new Set(upgrades.map((u) => u.category))];

  const displayed = upgrades.filter((u) => u.category === activeTab);

  const isUnlocked = (u: UpgradeDef): boolean => {
    if (!u.requiresId) return true;
    return owned.has(u.requiresId);
  };

  const purchase = async (upgrade: UpgradeDef) => {
    if (!user) return;
    if (company.capital < upgrade.cost) {
      showToast(`Caixa insuficiente (R$ ${company.capital.toFixed(2)})`);
      return;
    }
    if (owned.has(upgrade.id)) {
      showToast('Você já possui este upgrade');
      return;
    }
    if (!isUnlocked(upgrade)) {
      showToast('Pré-requisito não atendido');
      return;
    }

    setBuying(upgrade.id);
    const { error: e } = await supabase.from('company_upgrades').insert({
      user_id:    user.id,
      company_id: company.id,
      upgrade_id: upgrade.id,
    });
    if (e) {
      showToast(`Erro: ${e.message}`);
    } else {
      // Deduct from company capital
      cadeia.withdrawFromCompany(company.id, upgrade.cost);
      setOwned((prev) => new Set([...prev, upgrade.id]));
      showToast(`${upgrade.name} instalado!`);
    }
    setBuying(null);
  };

  if (loading) {
    return <div className="text-center text-slate-500 py-8 text-sm">Carregando...</div>;
  }

  if (upgrades.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">
        <ArrowUp size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum upgrade disponível para este tipo de empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Upgrade cards */}
      <div className="space-y-2">
        {displayed.map((upgrade) => {
          const isOwned    = owned.has(upgrade.id);
          const unlocked   = isUnlocked(upgrade);
          const canAfford  = company.capital >= upgrade.cost;
          const isBuying   = buying === upgrade.id;

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
                      Requer: {upgrade.requiresId.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>

                {!isOwned && (
                  <button
                    disabled={!unlocked || !canAfford || !!isBuying}
                    onClick={() => purchase(upgrade)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      unlocked && canAfford
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isBuying ? '...' : fmt(upgrade.cost)}
                  </button>
                )}

                {isOwned && (
                  <span className="shrink-0 text-emerald-400 text-xs font-semibold">Instalado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
