import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameLayout } from '@/components/GameLayout';
import { EmpresaScreen } from '@/components/screens/EmpresaScreen';
import { MercadoScreen } from '@/components/screens/MercadoScreen';
import { PropriedadesScreen } from '@/components/screens/PropriedadesScreen';
import { LicitacoesScreen } from '@/components/screens/LicitacoesScreen';
import { EmpresasScreen } from '@/components/screens/EmpresasScreen';
import { ChatScreen } from '@/components/screens/ChatScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { useConstrutora } from '@/hooks/useConstrutora';
import { useLicitacoes } from '@/hooks/useLicitacoes';
import { useChatMoneySync } from '@/hooks/useChatMoneySync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('empresa');

  // ── Core game logic ──────────────────────────────────────────────
  const {
    gameState,
    gameLoaded,
    isSyncing,
    playerName,
    reputation,

    addMoney,
    spendMoney,
    hireEmployee,
    fireEmployee,
    buyMachine,
    sellMachine,
    buyMaterial,
    startWork,
    resetGame,
    saveGame,
    checkWorkRequirements,
    addEmployeeToWork,
    removeEmployeeFromWork,
    addMachineToWork,
    removeMachineFromWork,
  } = useConstrutora();

  // ── Licitações / Contratos ────────────────────────────────────────
  const {
    licitacoes,
    myWins,
    myBids,
    loading: licLoading,
    successMsg: licSuccessMsg,
    placeBid,
    claimWin,
    consumeWin,
    isLeading,
    myBidFor,
    refreshPool,
  } = useLicitacoes(playerName);

  // ── Chat money sync (background) ─────────────────────────────────
  useChatMoneySync({
    enabled: gameLoaded,
    onIncomingChatMoney: (_msgId, amount) => addMoney(amount),
    onOutgoingChatMoney: (_msgId, amount) => spendMoney(amount),
  });

  // ── Game time string ─────────────────────────────────────────────
  const formatGameTime = () => {
    const { day, hour, minute } = gameState.gameTime;
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `Dia ${day} · ${hh}:${mm}`;
  };

  // ── Handlers com feedback via toast ─────────────────────────────
  const handleHireEmployee = (type: Parameters<typeof hireEmployee>[0]) => {
    const result = hireEmployee(type);
    result.ok ? toast.success(result.message) : toast.error(result.message);
    return result;
  };

  const handleFireEmployee = (instanceId: string) => {
    const result = fireEmployee(instanceId);
    result.ok ? toast.success(result.message) : toast.error(result.message);
    return result;
  };

  const handleBuyMachine = (typeId: string) => {
    const result = buyMachine(typeId);
    result.ok ? toast.success(result.message) : toast.error(result.message);
    return result;
  };

  const handleSellMachine = (instanceId: string) => {
    const result = sellMachine(instanceId);
    result.ok ? toast.success(result.message) : toast.error(result.message);
    return result;
  };

  const handleBuyMaterial = (materialId: string, quantity: number, unitPrice: number) => {
    const result = buyMaterial(materialId, quantity, unitPrice);
    if (!result.ok) toast.error(result.message);
    return result;
  };

  const handleSaveGame = async () => {
    saveGame(); // retorna void — localStorage é síncrono, sempre funciona
    toast.success('Progresso salvo!');
  };

  const handleResetGame = async () => {
    await resetGame();
    toast.info('Jogo reiniciado!');
  };

  // ── Screen router ────────────────────────────────────────────────
  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'empresa':
        return (
          <EmpresaScreen
            gameState={gameState}
            onHireEmployee={handleHireEmployee}
            onFireEmployee={handleFireEmployee}
            onBuyMachine={handleBuyMachine}
            onSellMachine={handleSellMachine}
          />
        );

      case 'mercado':
        return (
          <MercadoScreen
            gameState={gameState}
            onBuyMaterial={handleBuyMaterial}
          />
        );

      case 'propriedades':
        return (
          <PropriedadesScreen
            gameState={gameState}
            playerName={playerName}
            myWins={myWins}
            onConsumeWin={consumeWin}
            onStartWork={startWork}
            onAddEmployeeToWork={addEmployeeToWork}
            onRemoveEmployeeFromWork={removeEmployeeFromWork}
            onAddMachineToWork={addMachineToWork}
            onRemoveMachineFromWork={removeMachineFromWork}
            onPayCollaborator={(amount) => spendMoney(amount)}
          />
        );

      case 'contratos':
        return (
          <LicitacoesScreen
            gameState={gameState}
            licitacoes={licitacoes}
            myWins={myWins}
            myBids={myBids}
            loading={licLoading}
            successMsg={licSuccessMsg}
            onPlaceBid={placeBid}
            onClaimWin={claimWin}
            onConsumeWin={consumeWin}
            onIsLeading={isLeading}
            onMyBidFor={myBidFor}
            onRefreshPool={refreshPool}
            onStartWork={startWork}
            onWorkStarted={() => setCurrentTab('propriedades')}
          />
        );

      case 'empresas':
        return (
          <EmpresasScreen
            gameState={gameState}
            gameLoaded={gameLoaded}
          />
        );

      case 'chat':
        return (
          <ChatScreen
            gameState={gameState}
            onMoneyDeducted={(amount) => spendMoney(amount)}
            onMoneyReceived={(amount) => addMoney(amount)}
            onIncomingChatMoney={(_msgId, amount) => addMoney(amount)}
            onOutgoingChatMoney={(_msgId, amount) => spendMoney(amount)}
            // Car-related stubs (não usados na construtora)
            onCarRemoved={() => { /* sem carros */ }}
            onCarClaimed={() => ({ success: false, message: 'Não disponível' })}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            gameState={gameState}
            onSaveGame={handleSaveGame}
            onResetGame={handleResetGame}
          />
        );

      default:
        return (
          <EmpresaScreen
            gameState={gameState}
            onHireEmployee={handleHireEmployee}
            onFireEmployee={handleFireEmployee}
            onBuyMachine={handleBuyMachine}
            onSellMachine={handleSellMachine}
          />
        );
    }
  };

  // ── Loading state ────────────────────────────────────────────────
  if (!gameLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">🏗️</div>
          <div className="text-muted-foreground text-sm">Carregando construtora...</div>
        </div>
      </div>
    );
  }

  return (
    <GameLayout
      money={gameState.money}
      activeWorksCount={gameState.activeWorks?.filter(w => w.status === 'running').length ?? 0}
      reputation={reputation}
      currentTab={currentTab}
      isSyncing={isSyncing}
      gameTime={{ day: gameState.gameTime.day, time: formatGameTime() }}
      user={user ?? undefined}
      onLogout={async () => { await supabase.auth.signOut(); }}
      onTabChange={setCurrentTab}
    >
      {renderCurrentScreen()}
    </GameLayout>
  );
};

export default Index;
