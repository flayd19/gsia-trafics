import { useState, useEffect, useCallback } from 'react';
import { Store, StoreProduct, Product } from '@/types/game';

interface StoreAutoSalesState {
  [storeId: string]: {
    progress: number;
    isActive: boolean;
    lastSaleTime: number;
  };
}

interface UseStoresProps {
  stores: Store[];
  products: Product[];
  onStoreSaleComplete: (storeId: string, productId: string, quantity: number, profit: number) => void;
  gameState?: any; // Para acessar o estado do jogo
}

export const useStores = ({ stores, products, onStoreSaleComplete, gameState }: UseStoresProps) => {
  const [salesState, setSalesState] = useState<StoreAutoSalesState>({});

  // Inicializar estado apenas para visualização - vendas são gerenciadas globalmente
  useEffect(() => {
    const newState: StoreAutoSalesState = {};
    stores.forEach(store => {
      if (store.owned && store.products.length > 0) {
        newState[store.id] = {
          progress: Math.random() * 100, // Progress simulado para visualização
          isActive: store.products.some(p => p.quantity > 0),
          lastSaleTime: Date.now()
        };
      }
    });
    setSalesState(newState);
  }, [stores]);

  // Timer apenas para atualizar interface visual - não executa vendas reais
  useEffect(() => {
    const interval = setInterval(() => {
      setSalesState(prev => {
        const newState = { ...prev };
        
        Object.keys(newState).forEach(storeId => {
          const store = stores.find(s => s.id === storeId);
          if (!store || !store.owned) return;
          
          const hasStock = store.products.some(product => product.quantity > 0);
          if (hasStock) {
            // Simular progresso visual baseado no sellInterval
            const elapsed = Date.now() - newState[storeId].lastSaleTime;
            const progress = (elapsed % store.sellInterval) / store.sellInterval * 100;
            
            newState[storeId] = {
              ...newState[storeId],
              progress,
              isActive: true
            };
          } else {
            newState[storeId] = {
              ...newState[storeId],
              progress: 0,
              isActive: false
            };
          }
        });
        
        return newState;
      });
    }, 100); // Atualizar visual a cada 100ms

    return () => clearInterval(interval);
  }, [stores]);

  return salesState;
};