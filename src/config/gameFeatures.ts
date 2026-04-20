// Configuração de funcionalidades do jogo
// Use este arquivo para habilitar/desabilitar funcionalidades temporariamente

export const GAME_FEATURES = {
  // Funcionalidades de risco durante viagens
  VEHICLE_BREAKDOWN_ENABLED: true, // Sistema de quebra habilitado
  POLICE_SEIZURE_ENABLED: true,    // Sistema de apreensão habilitado
  
  // Outras funcionalidades
  AUTO_SAVE_ENABLED: true,
  BUYER_GENERATION_ENABLED: true,
  TRIP_STATUS_MESSAGES_ENABLED: true,
  
  // Configurações de debug
  DEBUG_MODE: false,
  FORCE_RESET_ENABLED: true,
  STORE_RESET_ENABLED: true, // Sistema de reset de lojas habilitado
  BUYER_RESET_ENABLED: true, // Sistema de reset de compradores habilitado
};

// Função para verificar se uma funcionalidade está habilitada
export const isFeatureEnabled = (feature: keyof typeof GAME_FEATURES): boolean => {
  return GAME_FEATURES[feature] as boolean;
};

// Função para resetar lojas bloqueadas
export const resetLockedStores = (gameState: any, setGameState: any) => {
  if (!isFeatureEnabled('STORE_RESET_ENABLED')) {
    console.warn('🚫 [STORE RESET] Funcionalidade desabilitada');
    return false;
  }

  const lockedStores = gameState.stores.filter((store: any) => store.owned && store.isLocked);
  
  if (lockedStores.length === 0) {
    console.log('ℹ️ [STORE RESET] Nenhuma loja bloqueada encontrada');
    return false;
  }

  setGameState((prev: any) => {
    const newStores = prev.stores.map((store: any) => {
      if (store.owned && store.isLocked) {
        return {
          ...store,
          isLocked: false,
          products: [] // Limpar produtos da loja
        };
      }
      return store;
    });

    console.log(`🔓 [STORE RESET] ${lockedStores.length} loja(s) desbloqueada(s) e produtos removidos`);
    
    return {
      ...prev,
      stores: newStores
    };
  });

  return true;
};

// Função para resetar compradores (limpar lista de buyers)
export const resetBuyers = (setBuyers: any) => {
  if (!isFeatureEnabled('BUYER_RESET_ENABLED')) {
    console.warn('🚫 [BUYER RESET] Funcionalidade desabilitada');
    return false;
  }

  setBuyers([]);
  console.log('🧹 [BUYER RESET] Lista de compradores limpa');
  
  return true;
};

// Logs para debug
if (GAME_FEATURES.DEBUG_MODE) {
  console.log('🎮 [GAME FEATURES] Configurações carregadas:', GAME_FEATURES);
}