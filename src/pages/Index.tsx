import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { HubScreen }              from '@/screens/HubScreen';
import { EmpresasCadeiaScreen }   from '@/screens/EmpresasCadeiaScreen';
import { MercadoModule }          from '@/screens/modules/MercadoModule';
import { NegociacoesModule }      from '@/screens/modules/NegociacoesModule';
import { FinancasModule }         from '@/screens/modules/FinancasModule';
import { SettingsScreen }         from '@/components/screens/SettingsScreen';
import { useCadeia }              from '@/hooks/useCadeia';
import { supabase }               from '@/integrations/supabase/client';
import type { HubModule }         from '@/types/cadeia';

// ── Module labels ─────────────────────────────────────────────────────

const MODULE_LABELS: Record<Exclude<HubModule, 'hub'>, string> = {
  empresas:    'Minhas Empresas',
  mercado:     'Mercado',
  mapa:        'Mapa',
  negociacoes: 'Negociações',
  financas:    'Finanças',
  perfil:      'Perfil',
};

// ── ModuleShell ───────────────────────────────────────────────────────

interface ModuleShellProps {
  module:   Exclude<HubModule, 'hub'>;
  onBack:   () => void;
  children: React.ReactNode;
}

function ModuleShell({ module, onBack, children }: ModuleShellProps) {
  return (
    <div
      className="flex flex-col min-h-[100dvh] bg-slate-950 text-slate-100"
      style={{
        paddingTop:    'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-800 active:scale-95 transition-all"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} className="text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-white">{MODULE_LABELS[module]}</h1>
      </header>
      <main className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </main>
    </div>
  );
}

// ── Index ─────────────────────────────────────────────────────────────

const Index = () => {
  const { user } = useAuth();
  const [currentModule, setCurrentModule] = useState<HubModule>('hub');

  const cadeia = useCadeia();
  const { state, resetGame } = cadeia;

  const goTo  = (module: HubModule) => setCurrentModule(module);
  const goHub = () => setCurrentModule('hub');

  if (currentModule === 'hub') {
    return <HubScreen cadeia={cadeia} onNavigate={goTo} />;
  }

  const renderModule = () => {
    switch (currentModule) {
      case 'empresas':
        return <EmpresasCadeiaScreen cadeia={cadeia} />;

      case 'mercado':
        return <MercadoModule cadeia={cadeia} />;

      case 'mapa':
        return (
          <div className="flex items-center justify-center h-full p-8 text-slate-500 text-sm">
            Mapa em breve...
          </div>
        );

      case 'negociacoes':
        return <NegociacoesModule cadeia={cadeia} />;

      case 'financas':
        return <FinancasModule cadeia={cadeia} />;

      case 'perfil':
        return (
          <SettingsScreen
            gameState={{
              money:         state.playerCapital,
              gameTime:      { day: 1, hour: 0, minute: 0 },
              employees:     [],
              machines:      [],
              warehouse:     [],
              activeWorks:   [],
              completedWorks: 0,
              totalEarned:   state.totalEarned,
              totalSpent:    state.totalSpent,
            }}
            onSaveGame={() => {}}
            onResetGame={async () => { resetGame(); }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ModuleShell module={currentModule as Exclude<HubModule, 'hub'>} onBack={goHub}>
      {renderModule()}
    </ModuleShell>
  );
};

export default Index;
