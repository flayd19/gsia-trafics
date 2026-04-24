import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GameLayout } from '@/components/GameLayout';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { GaragemScreen } from '@/components/screens/GaragemScreen';
import { OficinaScreen } from '@/components/screens/OficinaScreen';
import { ComprarScreen } from '@/components/screens/ComprarScreen';
import { CarSalesScreen } from '@/components/screens/CarSalesScreen';
import RankingScreen from '@/components/screens/RankingScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { useCarGameLogic } from '@/hooks/useCarGameLogic';
import { useGlobalMarketplace, type GlobalCar } from '@/hooks/useGlobalMarketplace';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState('garagem');
  const [oficinaPendingCar, setOficinaPendingCar] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Jogador');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // Fetch display name once user is known
  useEffect(() => {
    if (!user) return;
    supabase
      .from('player_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name || user.email?.split('@')[0] || 'Jogador';
        setPlayerName(name.length > 20 ? name.substring(0, 20) : name);
      });
  }, [user]);

  const {
    gameState,
    gameLoaded,
    isSyncing,
    saveStatus,
    formatGameTime,
    reputation,
    garageCarCount,

    addCarFromGlobal,
    addOwnedCarToGarage,
    removeCarFromGarage,
    unlockGarageSlot,
    startRepair,
    sendOfferToBuyer,
    resolveBuyerDecision,
    dismissBuyer,
    addMoney,
    spendMoney,
    saveGame,
    resetGame,

    repairTypes,
    garageSlotDefs,
  } = useCarGameLogic();

  const {
    listings: globalCars,
    loading: marketplaceLoading,
    isOnline: marketplaceOnline,
    minsLeft,
    loadMarketplace,
    buyGlobal,
    makeOfferGlobal,
  } = useGlobalMarketplace();

  // ── Buy at asking price ──────────────────────────────────────────
  const handleBuyCar = async (car: GlobalCar) => {
    const result = await buyGlobal(car.id, playerName);
    if (result.success) {
      const addResult = addCarFromGlobal(car, car.askingPrice);
      addResult.success ? toast.success(addResult.message) : toast.error(addResult.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  // ── Make offer / negotiate ───────────────────────────────────────
  const handleMakeOffer = async (carId: string, value: number) => {
    const result = await makeOfferGlobal(
      carId,
      value,
      playerName,
      gameState.money,
      (gameState as any).overdraftLimit ?? -50_000
    );
    if (result.success && result.finalPrice != null) {
      const car = globalCars.find(c => c.id === carId);
      if (car) {
        const addResult = addCarFromGlobal(car, result.finalPrice);
        addResult.success ? toast.success(result.message) : toast.error(addResult.message);
      }
    } else if (!result.success) {
      toast.error(result.message);
    }
    return result;
  };

  // ── Other handlers ───────────────────────────────────────────────
  const handleUnlockSlot = (slotId: number) => {
    const result = unlockGarageSlot(slotId);
    result.success ? toast.success(result.message) : toast.error(result.message);
  };

  const handleStartRepair = (carInstanceId: string, repairTypeId: string) => {
    const result = startRepair(carInstanceId, repairTypeId);
    result.success ? toast.success(result.message) : toast.error(result.message);
    return result;
  };

  const handleSendOffer = (buyerId: string, carInstanceId: string, price: number, includeTradeIn: boolean) => {
    const result = sendOfferToBuyer(buyerId, carInstanceId, price, includeTradeIn);
    result.success ? toast.info(result.message) : toast.error(result.message);
    return result;
  };

  const handleResolveDecision = (buyerId: string) => {
    const result = resolveBuyerDecision(buyerId);
    if (result.accepted)      toast.success(result.message);
    else if (!result.success) toast.error(result.message);
    else                      toast.warning(result.message);
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

  const handleSaveGame = async () => {
    const ok = await saveGame();
    ok ? toast.success('Progresso salvo!') : toast.error('Erro ao salvar. Tente novamente.');
  };

  const handleResetGame = async () => {
    await resetGame();
    toast.info('Jogo reiniciado!');
  };

  const gameTime = { day: gameState.gameTime.day, time: formatGameTime() };

  // ── Screen router ────────────────────────────────────────────────
  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'home':
        return <HomeScreen gameState={gameState} onNavigate={handleTabChange} />;

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
          <ComprarScreen
            gameState={gameState}
            globalCars={globalCars}
            loading={marketplaceLoading}
            isOnline={marketplaceOnline}
            minsLeft={minsLeft}
            onBuyCar={handleBuyCar}
            onMakeOffer={handleMakeOffer}
            onRefreshMarketplace={loadMarketplace}
            onSpendMoney={spendMoney}
            onAddMoney={addMoney}
            onAddToGarage={addOwnedCarToGarage}
            onSoldListing={removeCarFromGarage}
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

      case 'ranking':
        return <RankingScreen gameState={gameState as any} />;

      case 'settings':
        return (
          <SettingsScreen
            gameState={gameState as any}
            operationalCosts={{ warehouseCost: 0, driverCosts: 0, totalWeekly: 0 }}
            onSaveGame={handleSaveGame}
            onResetGame={handleResetGame}
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
            {isSyncing ? 'Carregando seu progresso…' : 'Preparando sua concessionária…'}
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
      isSyncing={isSyncing || saveStatus === 'saving'}
      user={user}
      reputation={gameState.reputation}
      onLogout={async () => {
        await saveGame();
        const { supabase: sb } = await import('@/integrations/supabase/client');
        await sb.auth.signOut();
        navigate('/auth');
      }}
    >
      {renderCurrentScreen()}
    </GameLayout>
  );
};

export default Index;
