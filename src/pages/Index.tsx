import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GameLayout } from '@/components/GameLayout';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { GaragemScreen } from '@/components/screens/GaragemScreen';
import { OficinaScreen } from '@/components/screens/OficinaScreen';
import { FornecedoresCarrosScreen } from '@/components/screens/FornecedoresCarrosScreen';
import { CarSalesScreen } from '@/components/screens/CarSalesScreen';
import { PlayerMarketScreen } from '@/components/screens/PlayerMarketScreen';
import RankingScreen from '@/components/screens/RankingScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { useCarGameLogic } from '@/hooks/useCarGameLogic';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState('garagem');
  const [oficinaPendingCar, setOficinaPendingCar] = useState<string | null>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const {
    gameState,
    gameLoaded,
    isSyncing,
    formatGameTime,
    formatMoney,
    reputation,
    garageCarCount,
    totalGarageSlots,

    // Ações
    buyCarFromMarketplace,
    makeOfferOnMarketplace,
    unlockGarageSlot,
    startRepair,
    sendOfferToBuyer,
    resolveBuyerDecision,
    dismissBuyer,
    refreshMarketplace,
    hydrateGameState,

    // Dados
    repairTypes,
    garageSlotDefs,
  } = useCarGameLogic();

  const handleBuyCar = (car: any) => {
    const result = buyCarFromMarketplace(car);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  const handleMakeOffer = (carId: string, value: number) => {
    const result = makeOfferOnMarketplace(carId, value);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  const handleUnlockSlot = (slotId: number) => {
    const result = unlockGarageSlot(slotId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleStartRepair = (carInstanceId: string, repairTypeId: string) => {
    const result = startRepair(carInstanceId, repairTypeId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  const handleSendOffer = (buyerId: string, carInstanceId: string, price: number, includeTradeIn: boolean) => {
    const result = sendOfferToBuyer(buyerId, carInstanceId, price, includeTradeIn);
    if (result.success) {
      toast.info(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  const handleResolveDecision = (buyerId: string) => {
    const result = resolveBuyerDecision(buyerId);
    if (result.accepted) {
      toast.success(result.message);
    } else if (!result.success) {
      toast.error(result.message);
    } else {
      toast.warning(result.message);
    }
    return result;
  };

  const handleGoToOficina = (carInstanceId: string) => {
    setOficinaPendingCar(carInstanceId);
    setCurrentTab('oficina');
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (tab !== 'oficina') setOficinaPendingCar(null);
  };

  const gameTime = {
    day: gameState.gameTime.day,
    time: formatGameTime(),
  };

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeScreen
            gameState={gameState}
            onNavigate={handleTabChange}
          />
        );

      case 'garagem':
        return (
          <GaragemScreen
            gameState={gameState}
            onUnlockSlot={handleUnlockSlot}
            onGoToOficina={handleGoToOficina}
          />
        );

      case 'oficina':
        return (
          <OficinaScreen
            gameState={gameState}
            repairTypes={repairTypes}
            preSelectedCarId={oficinaPendingCar}
            onStartRepair={handleStartRepair}
          />
        );

      case 'fornecedores':
        return (
          <FornecedoresCarrosScreen
            gameState={gameState}
            onBuyCar={handleBuyCar}
            onMakeOffer={handleMakeOffer}
            onRefreshMarketplace={refreshMarketplace}
          />
        );

      case 'vendas':
        return (
          <CarSalesScreen
            gameState={gameState}
            onSendOffer={handleSendOffer}
            onResolveDecision={handleResolveDecision}
            onDismissBuyer={dismissBuyer}
          />
        );

      case 'playermarket':
        return (
          <PlayerMarketScreen
            gameState={gameState as any}
            products={[]}
            onReserveStock={() => {}}
            onReturnStock={() => {}}
            onReceiveStock={() => {}}
            onSpendMoney={() => {}}
            onAddMoney={() => {}}
          />
        );

      case 'ranking':
        return <RankingScreen gameState={gameState as any} />;

      case 'settings':
        return (
          <SettingsScreen
            gameState={gameState as any}
            operationalCosts={{ warehouseCost: 0, driverCosts: 0, totalWeekly: 0 }}
            onSaveGame={async () => { toast.success('Progresso salvo!'); }}
            onResetGame={async () => { toast.info('Reset em desenvolvimento.'); }}
          />
        );

      default:
        return <div className="text-center py-10 text-muted-foreground">Tela não encontrada</div>;
    }
  };

  if (!gameLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 animate-scale-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🚗</div>
          <h2 className="text-3xl font-game-title font-bold text-primary glow-primary">
            GSIA CARROS
          </h2>
          <p className="text-lg font-game-ui text-muted-foreground">
            Preparando sua concessionária…
          </p>
          <div className="w-48 h-2 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary animate-glow-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameLayout
      money={gameState.money}
      garageCount={garageCarCount}
      gameTime={gameTime}
      onTabChange={handleTabChange}
      currentTab={currentTab}
      isSyncing={isSyncing}
      user={user}
      reputation={gameState.reputation}
      onLogout={async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.signOut();
        navigate('/auth');
      }}
    >
      {renderCurrentScreen()}
    </GameLayout>
  );
};

export default Index;
