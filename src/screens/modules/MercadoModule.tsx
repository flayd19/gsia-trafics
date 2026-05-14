// =====================================================================
// MercadoModule.tsx — Market module: spot market + vitrine + freight
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState } from 'react';
import { MercadoCadeiaScreen } from '@/screens/MercadoCadeiaScreen';
import { VitrineTab }          from '@/screens/vitrine/VitrineTab';
import { FreteTab }            from '@/screens/frete/FreteTab';
import { useVitrine }          from '@/hooks/useVitrine';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';

type Tab = 'spot' | 'vitrine' | 'frete';

const TABS: { id: Tab; label: string }[] = [
  { id: 'spot',    label: 'Spot' },
  { id: 'vitrine', label: 'Vitrine' },
  { id: 'frete',   label: 'Frete' },
];

interface Props {
  cadeia: UseCadeiaReturn;
}

export function MercadoModule({ cadeia }: Props) {
  const [tab, setTab] = useState<Tab>('spot');
  const vitrine = useVitrine(cadeia.state.pmr);

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
        {tab === 'spot'    && <MercadoCadeiaScreen cadeia={cadeia} />}
        {tab === 'vitrine' && <VitrineTab vitrine={vitrine} cadeia={cadeia} />}
        {tab === 'frete'   && <FreteTab   vitrine={vitrine} cadeia={cadeia} />}
      </div>
    </div>
  );
}
