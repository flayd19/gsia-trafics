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
import { ChatScreen } from '@/components/screens/ChatScreen';
import { EmployeesScreen } from '@/components/screens/EmployeesScreen';
import { useCarGameLogic } from '@/hooks/useCarGameLogic';
import { useChatMoneySync } from '@/hooks/useChatMoneySync';
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
    applyIncomingChatMoney,
    applyOutgoingChatMoney,
    addAsyncRaceWon,
    saveGame,
    resetGame,

    repairTypes,
    garageSlotDefs,
    applyCarTune,

    hireEmployee,
    fireEmployee,
    updateEmployeeConfig,

    payWarrantyClaim,
    refuseWarrantyClaim,
    dismissWarrantyClaim,
  } = useCarGameLogic();

  // ── Sync de transferências de $ via chat (background, sempre ativo) ──
  // Aplica créditos/débitos idempotentes via _processedChatMoneyIds antes
  // que o autosave possa sobrescrever a coluna money do servidor com saldo
  // antigo do JSONB. Roda mesmo quando a tela de chat não está aberta.
  useChatMoneySync({
    enabled: gameLoaded,
    onIncomingChatMoney: applyIncomingChatMoney,
    onOutgoingChatMoney: applyOutgoingChatMoney,
  });

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

  // ── Buy at negotiated price ──────────────────────────────────────
  const handleBuyAtPrice = async (car: GlobalCar, price: number) => {
    const result = await buyGlobal(car.id, playerName);
    if (result.success) {
      const addResult = addCarFromGlobal(car, price);
      const diff = car.askingPrice - price;
      if (diff > 0) addMoney(diff);
      addResult.success
        ? toast.success(`Comprado com ${Math.round((diff / car.askingPrice) * 100)}% de desconto! 🎉`)
        : toast.error(addResult.message);
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
    return runDiagnosis(carInstanceId);
  };

  const handleSendOffer = (
    buyerId: string,
    carInstanceId: string,
    price: number,
    includeTradeIn: boolean,
    playerTradeInValuation?: number,
  ) => {
    const result = sendOfferToBuyer(buyerId, carInstanceId, price, includeTradeIn, playerTradeInValuation);
    result.success ? toast.info(result.message) : toast.error(result.message);
    return result;
  };

  const handleResolveDecision = (buyerId: string) => {
    const result = resolveBuyerDecision(buyerId);
    if (result.accepted)          toast.success(result.message);
    else if (result.counterOffer) toast.info(result.message);
    else if (!result.success)     toast.error(result.message);
    else                          toast.warning(result.message);
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

    if (rankingDebounceRef.current) clearTimeout(rankingDebounceRef.current);
    rankingDebounceRef.current = setTimeout(() => void publish(), 5_000);

    return () => {
      if (rankingDebounceRef.current) clearTimeout(rankingDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.money, gameState.garage, gameState.reputation?.level, gameLoaded, user]);

  useEffect(() => {
    if (!user || !gameLoaded) return;
    const interval = setInterval(() => {
      lastPublishedPatrimonyRef.current = null;
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
            onBuyAtPrice={handleBuyAtPrice}
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
            onPayWarrantyClaim={payWarrantyClaim}
            onRefuseWarrantyClaim={refuseWarrantyClaim}
            onDismissWarrantyClaim={dismissWarrantyClaim}
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

      case 'chat':
        return (
          <ChatScreen
            gameState={gameState}
            onIncomingChatMoney={applyIncomingChatMoney}
            onOutgoingChatMoney={applyOutgoingChatMoney}
            onMoneyDeducted={(amount) => spendMoney(amount)}
            onMoneyReceived={(amount) => addMoney(amount)}
            onCarRemoved={(carInstanceId) => removeCarFromGarage(carInstanceId)}
            onCarClaimed={(car) => addOwnedCarToGarage(car, 0)}
          />
        );

      case 'employees':
        return (
          <EmployeesScreen
            gameState={gameState}
            onHireEmployee={hireEmployee}
            onFireEmployee={fireEmployee}
            onUpdateEmployeeConfig={updateEmployeeConfig}
          />
        );

      case 'ranking':
        return <RankingScreen gameState={gameState} />;

      case 'settings':
        return (
          <SettingsScreen
            gameState={gameState}
            onSaveGame={handleSaveGame}
            onResetGame={handleResetGame}
          />
        );

      default:
        return <HomeScreen gameState={gameState} onNavigate={handleTabChange} />;
    }
  };

  if (loading || !gameLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">🏎️</div>
          <div className="text-muted-foreground text-sm">Carregando jogo...</div>
        </div>
      </div>
    );
  }

  return (
    <GameLayout
      money={gameState.money}
      garageCount={garageCarCount}
      reputation={reputation}
      currentTab={currentTab}
      isSyncing={isSyncing}
      gameTime={gameTime}
      user={user ?? undefined}
      onLogout={async () => {
        await supabase.auth.signOut();
      }}
      onTabChange={handleTabChange}
    >
      {renderCurrentScreen()}
    </GameLayout>
  );
};

export default Index;
