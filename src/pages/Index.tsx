import { useState, useEffect, useRef } from 'react';
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
import { RachaScreen } from '@/components/screens/RachaScreen';
import { useCarGameLogic } from '@/hooks/useCarGameLogic';
import type { TuneUpgrade } from '@/types/performance';
import { useGlobalMarketplace, type GlobalCar } from '@/hooks/useGlobalMarketplace';
import { supabase } from '@/integrations/supabase/client';
import { conditionValueFactor } from '@/data/cars';
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
    runDiagnosis,
    sendOfferToBuyer,
    resolveBuyerDecision,
    resolveCounterOffer,
    dismissBuyer,
    addMoney,
    spendMoney,
    addAsyncRaceWon,
    saveGame,
    resetGame,

    repairTypes,
    garageSlotDefs,
    applyCarTune,
  } = useCarGameLogic();

  const {
    listings: globalCars,
    loading: marketplaceLoading,
    isOnline: marketplaceOnline,
    minsLeft,
    loadMarketplace,
    buyGlobal,
    errorMsg: marketplaceError,
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

  const handleRunDiagnosis = (carInstanceId: string) => {
    const result = runDiagnosis(carInstanceId);
    return result;
  };

  const handleSendOffer = (buyerId: string, carInstanceId: string, price: number, includeTradeIn: boolean) => {
    const result = sendOfferToBuyer(buyerId, carInstanceId, price, includeTradeIn);
    result.success ? toast.info(result.message) : toast.error(result.message);
    return result;
  };

  const handleResolveDecision = (buyerId: string) => {
    const result = resolveBuyerDecision(buyerId);
    if (result.accepted)              toast.success(result.message);
    else if (result.counterOffer)     toast.info(result.message);
    else if (!result.success)         toast.error(result.message);
    else                              toast.warning(result.message);
    return result;
  };

  const handleResolveCounterOffer = (buyerId: string, accept: boolean) => {
    const result = resolveCounterOffer(buyerId, accept);
    if (result.accepted)      toast.success(result.message);
    else if (!result.success) toast.error(result.message);
    else                      toast.info(result.message);
    return result;
  };

  const handleUpdateCarTunes = (carInstanceId: string, upgrades: TuneUpgrade[]) => {
    applyCarTune(carInstanceId, upgrades);
  };

  const handleGoToOficina = (carInstanceId: string) => {
    setOficinaPendingCar(carInstanceId);
    setCurrentTab('oficina');
  };

  // ── Publicação de ranking em background ─────────────────────────
  // Roda independentemente de qual aba está aberta.
  // Faz upsert sempre que o patrimônio muda (com debounce de 5 s)
  // e também a cada 2 minutos como keep-alive.
  const lastPublishedPatrimonyRef = useRef<number | null>(null);
  const rankingDebounceRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !gameLoaded) return;

    const calcPatrimony = () => {
      const carValue = (gameState.garage ?? [])
        .filter(s => s.car)
        .reduce((sum, s) => sum + s.car!.fipePrice * conditionValueFactor(s.car!.condition), 0);
      return Math.round(gameState.money + carValue);
    };

    const calcRacesWon = () =>
      (gameState.garage ?? [])
        .filter(s => s.car?.raceHistory)
        .reduce((sum, s) => sum + (s.car!.raceHistory!.filter(r => r.won).length), 0);

    const publish = async () => {
      const patrimony = calcPatrimony();
      if (lastPublishedPatrimonyRef.current === patrimony) return;
      lastPublishedPatrimonyRef.current = patrimony;

      const displayName =
        (user.user_metadata?.display_name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Jogador';

      await (supabase as any)
        .from('player_profiles')
        .upsert(
          {
            user_id:         user.id,
            display_name:    displayName,
            total_patrimony: patrimony,
            level:           gameState.reputation?.level ?? 1,
            races_won:       calcRacesWon(),
            updated_at:      new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    };

    // Debounce: aguarda 5 s sem mudanças antes de publicar
    if (rankingDebounceRef.current) clearTimeout(rankingDebounceRef.current);
    rankingDebounceRef.current = setTimeout(() => void publish(), 5_000);

    return () => {
      if (rankingDebounceRef.current) clearTimeout(rankingDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.money, gameState.garage, gameState.reputation?.level, gameLoaded, user]);

  // Keep-alive: publica a cada 2 minutos mesmo sem mudanças
  useEffect(() => {
    if (!user || !gameLoaded) return;
    const interval = setInterval(() => {
      lastPublishedPatrimonyRef.current = null; // força re-publish
    }, 2 * 60_000);
    return () => clearInterval(interval);
  }, [user, gameLoaded]);

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
            onRunDiagnosis={handleRunDiagnosis}
            onApplyTune={(carInstanceId, upgrades) => applyCarTune(carInstanceId, upgrades)}
            onSpendMoney={spendMoney}
          />
        );

      case 'fornecedores':
        return (
          <ComprarScreen
            gameState={gameState}
            globalCars={globalCars}
            loading={marketplaceLoading}
            isOnline={marketplaceOnline}
            errorMsg={marketplaceError}
            minsLeft={minsLeft}
            onBuyCar={handleBuyCar}
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
            onResolveCounterOffer={handleResolveCounterOffer}
            onDismissBuyer={dismissBuyer}
          />
        );

      case 'rachas':
        return (
          <RachaScreen
            gameState={gameState}
            onSpendMoney={spendMoney}
            onAddMoney={addMoney}
            onRaceWon={addAsyncRaceWon}
            onUpdateCarTunes={handleUpdateCarTunes}
          />
        );

      case 'ranking':
        return <RankingScreen gameState={gameState as any} gameLoaded={gameLoaded} />;

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
