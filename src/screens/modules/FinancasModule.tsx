// =====================================================================
// FinancasModule.tsx — Finance module: reports + bank + calendar
// Doc 07 — Financial System
// =====================================================================

import { useState } from 'react';
import { RelatoriosScreen } from '@/screens/RelatoriosScreen';
import { BancoModule }      from '@/screens/banco/BancoModule';
import { useBanco }         from '@/hooks/useBanco';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';

type Tab = 'relatorios' | 'banco';

const TABS: { id: Tab; label: string }[] = [
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'banco',      label: 'Banco' },
];

interface Props {
  cadeia: UseCadeiaReturn;
}

export function FinancasModule({ cadeia }: Props) {
  const [tab, setTab] = useState<Tab>('relatorios');
  const banco = useBanco();

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-slate-800/60 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'relatorios' && <RelatoriosScreen cadeia={cadeia} />}
        {tab === 'banco'      && <BancoModule banco={banco} cadeia={cadeia} />}
      </div>
    </div>
  );
}
