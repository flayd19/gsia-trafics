import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameSync } from '@/hooks/useGameSync';
import { useGameLogic } from '@/hooks/useGameLogic';
import { GameLayout } from '@/components/GameLayout';

import { HomeScreen } from '@/components/screens/HomeScreen';
import { MarketplaceScreen } from '@/components/screens/MarketplaceScreen';
import { WarehouseScreen } from '@/components/screens/WarehouseScreen';
import { TripsScreen } from '@/components/screens/TripsScreen';
import { SalesScreen } from '@/components/screens/SalesScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { StoresScreen } from '@/components/screens/StoresScreen';
import { PlayerMarketScreen } from '@/components/screens/PlayerMarketScreen';
import { SuppliersScreen } from '@/components/screens/SuppliersScreen';
import RankingScreen from '@/components/screens/RankingScreen';
import { INITIAL_GAME_STATE } from '@/data/gameData';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { saveGameProgress, loadGameProgress } = useGameSync();
  
  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
  }, [user, loading, navigate]);
  const [currentTab, setCurrentTab] = useState('warehouse');


  const { toast } = useToast();
  
  const {
    gameState,
    products,
    buyers,
    gameLoaded,
    isSyncing,
    formatGameTime,
    getWarehouseOccupation,
    getOperationalCosts,
    canAcceptTrip,
    canUseVehicle,
    buyVehicle,
    sellVehicle,
    hireDriver,
    assignDriver,
    unassignDriver,
    makeTrip,
    makeTripWithMultipleProducts,
    sellToBuyer,
    rejectBuyer,
    tryBargain,
    sellAll,
    calculateTripCost,
    upgradeWarehouse,
    saveGameManually,
    resetGameProgress,

    warehouses,
    marketplaceVehicles,
    marketplaceDrivers,
    payLawyer,
    payTowTruck,
    payTowTruckForBreakdown,
    forceResetVehicle,
    forceBreakdown,
    forceSeizure,
    buyStore,
    sellStore,
    depositProductInStore,
    depositProductsBatch,
    storeSaleComplete,
    renameStore,
    hydrateGameState,
    reservePlayerMarketStock,
    returnPlayerMarketStock,
    receivePlayerMarketStock,
    spendPlayerMarketMoney,
    addPlayerMarketMoney,
    buyFromSupplier,
    dispatchPickupVehicle,
    calculatePickupCost,
    computePickupLoadForVehicle,
    getSupplierUnitPrice,
    cancelPendingPickup,
    pickupExpirationMs,
    maxBuyers,
   } = useGameLogic();


  // Carregar progresso salvo ao autenticar
  useEffect(() => {
    if (!loading && user) {
      (async () => {
        const saved = await loadGameProgress();
        if (saved) {
          hydrateGameState(saved);
        }
      })();
    }
  }, [user, loading]);

  // Auto-save profissional:
  //  - ref sempre aponta pro gameState mais novo (zero deps instáveis)
  //  - interval fixo de 30s salva em background (best-effort)
  //  - salva também ao fechar/esconder aba (beforeunload + visibilitychange)
  //  - saveGameProgress já tem min-interval, circuit breaker e fallback local
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (loading || !user) return;

    const AUTO_SAVE_INTERVAL_MS = 30_000;

    const doSave = () => {
      if (gameStateRef.current.gameTime.day > 0) {
        void saveGameProgress(gameStateRef.current);
      }
    };

    const interval = setInterval(doSave, AUTO_SAVE_INTERVAL_MS);

    const onBeforeUnload = () => doSave();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') doSave();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      // salva uma última vez ao desmontar
      doSave();
    };
  }, [user, loading, saveGameProgress]);

  const handleBuyVehicle = (item: any) => {
    const success = buyVehicle(item);
    if (success) {
      toast({
        title: "Veículo comprado!",
        description: `${item.name} adicionado à sua frota.`,
      });
    } else {
      toast({
        title: "Compra falhou",
        description: "Dinheiro insuficiente.",
        variant: "destructive",
      });
    }
    return success;
  };

  const handleHireDriver = (item: any) => {
    const success = hireDriver(item);
    if (success) {
      toast({
        title: "Motorista contratado!",
        description: `${item.name} se juntou à sua equipe.`,
      });
    } else {
      toast({
        title: "Contratação falhou",
        description: "Dinheiro insuficiente ou motorista já contratado.",
        variant: "destructive",
      });
    }
    return success;
  };

  const handleSellAll = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const quantity = gameState.stock[productId] || 0;
    const value = quantity * (product?.currentPrice || 0);
    
    const success = sellAll(productId);
    if (success) {
      toast({
        title: "Venda realizada!",
        description: `${quantity} ${product?.displayName} vendidos por ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      });
    } else {
      toast({
        title: "Venda falhou",
        description: "Vendas podem estar bloqueadas ou produto inexistente.",
        variant: "destructive",
      });
    }
    return success;
  };
  
  const handleResetGame = async () => {
    await resetGameProgress();
  };

  const handleSaveGame = async () => {
    await saveGameManually();
  };

  const warehouseOccupation = getWarehouseOccupation();
  const operationalCosts = getOperationalCosts();
  const gameTime = {
    day: gameState.gameTime.day,
    time: `${gameState.gameTime.hour.toString().padStart(2, '0')}:${gameState.gameTime.minute.toString().padStart(2, '0')}`
  };
  const totalStock = Object.values(gameState.stock as Record<string, number>)
    .reduce((sum: number, qty: number) => sum + qty, 0);

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeScreen 
            gameState={gameState}
            warehouseOccupation={warehouseOccupation}
            products={products}
          />
        );
      case 'marketplace':
        return (
          <MarketplaceScreen 
            gameState={gameState}
            marketplaceVehicles={marketplaceVehicles}
            marketplaceDrivers={marketplaceDrivers}
            onBuyVehicle={handleBuyVehicle}
            onHireDriver={handleHireDriver}
          />
        );
      case 'warehouse':
        return (
          <WarehouseScreen 
            gameState={gameState}
            products={products}
            warehouseOccupation={warehouseOccupation}
            warehouses={warehouses}
            upgradeWarehouse={upgradeWarehouse}
          />
        );
      case 'trips':
        return (
          <TripsScreen
            gameState={gameState}
            products={products}
            payLawyer={(id: string) => payLawyer(id)}
            payTowTruck={(id: string) => payTowTruck(id)}
            payTowTruckForBreakdown={(id: string) => payTowTruckForBreakdown(id)}
            onAssignDriver={assignDriver}
            onUnassignDriver={unassignDriver}
            onSellVehicle={sellVehicle}
            availableDrivers={gameState.drivers.filter(d => !d.assigned)}
            onForceReset={forceResetVehicle}
            onDispatchPickup={dispatchPickupVehicle}
            calculatePickupCost={calculatePickupCost}
            computePickupLoadForVehicle={computePickupLoadForVehicle}
          />
        );
      case 'suppliers':
        return (
          <SuppliersScreen
            gameState={gameState}
            products={products}
            onBuyFromSupplier={buyFromSupplier}
            getSupplierUnitPrice={getSupplierUnitPrice}
            onCancelPendingPickup={cancelPendingPickup}
            pickupExpirationMs={pickupExpirationMs}
          />
        );
      case 'sales':
        return (
          <SalesScreen
            gameState={gameState}
            products={products}
            buyers={buyers}
            maxBuyers={maxBuyers}
            onSellToBuyer={sellToBuyer}
            onRejectBuyer={rejectBuyer}
            onBargain={tryBargain}
          />
        );

      case 'stores':
        return (
          <StoresScreen 
            gameState={gameState}
            products={products}
            stores={gameState.stores}
            onBuyStore={buyStore}
            onSellStore={sellStore}
            onDepositProduct={depositProductInStore}
            onDepositMultipleProducts={(storeId, items) => depositProductsBatch(storeId, items)}
            onStoreSaleComplete={storeSaleComplete}
            onRenameStore={renameStore}
          />
        );

      case 'settings':
        return (
          <SettingsScreen 
            gameState={gameState}
            operationalCosts={{
              warehouseCost: 0,
              driverCosts: 0,
              totalWeekly: 0
            }}
            onSaveGame={async () => { await saveGameManually(); }}
            onResetGame={async () => { await resetGameProgress(); }}
          />
        );
      case 'playermarket':
        return (
          <PlayerMarketScreen
            gameState={gameState}
            products={products}
            onReserveStock={reservePlayerMarketStock}
            onReturnStock={returnPlayerMarketStock}
            onReceiveStock={receivePlayerMarketStock}
            onSpendMoney={spendPlayerMarketMoney}
            onAddMoney={addPlayerMarketMoney}
          />
        );
      case 'ranking':
        return (
          <RankingScreen
            gameState={gameState}
          />
        );
      default:
        return <div>Tela não encontrada</div>;
    }
  };

  if (!gameLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 animate-scale-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🚛</div>
          <h2 className="text-3xl font-game-title font-bold text-primary glow-primary">
            GSIA TRAFICS
          </h2>
          <p className="text-lg font-game-ui text-muted-foreground">
            Preparando seu império...
          </p>
          <div className="w-48 h-2 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary animate-glow-pulse rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameLayout
        money={gameState.money}
        vehicles={gameState.vehicles.length}
        stockItems={totalStock}
        gameTime={gameTime}
        onTabChange={setCurrentTab}
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
