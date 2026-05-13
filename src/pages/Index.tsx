import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameLayout } from '@/components/GameLayout';
import { InicioScreen } from '@/screens/InicioScreen';
import { EmpresasCadeiaScreen } from '@/screens/EmpresasCadeiaScreen';
import { MercadoCadeiaScreen } from '@/screens/MercadoCadeiaScreen';
import { RelatoriosScreen } from '@/screens/RelatoriosScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { useCadeia } from '@/hooks/useCadeia';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('inicio');

  const cadeia = useCadeia();
  const { state, resetGame } = cadeia;

  const activeCompaniesCount = state.companies.filter((c) => c.status === 'active').length;
  const unreadCount = state.notifications.filter((n) => !n.read).length;

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'inicio':
        return (
          <InicioScreen
            cadeia={cadeia}
            onNavigate={setCurrentTab}
          />
        );
      case 'empresas':
        return <EmpresasCadeiaScreen cadeia={cadeia} />;
      case 'mercado':
        return <MercadoCadeiaScreen cadeia={cadeia} />;
      case 'relatorios':
        return <RelatoriosScreen cadeia={cadeia} />;
      case 'settings':
        return (
          <SettingsScreen
            gameState={{
              money: state.playerCapital,
              gameTime: { day: 1, hour: 0, minute: 0 },
              employees: [],
              machines: [],
              warehouse: [],
              activeWorks: [],
              completedWorks: 0,
              totalEarned: state.totalEarned,
              totalSpent: state.totalSpent,
            }}
            onSaveGame={() => {/* auto-save já ativo */}}
            onResetGame={async () => { resetGame(); }}
          />
        );
      default:
        return (
          <InicioScreen
            cadeia={cadeia}
            onNavigate={setCurrentTab}
          />
        );
    }
  };

  return (
    <GameLayout
      money={state.playerCapital}
      companiesCount={activeCompaniesCount}
      currentTab={currentTab}
      user={user ?? undefined}
      onLogout={async () => { await supabase.auth.signOut(); }}
      onTabChange={setCurrentTab}
      playerName={state.playerName}
      unreadCount={unreadCount}
    >
      {renderCurrentScreen()}
    </GameLayout>
  );
};

export default Index;
