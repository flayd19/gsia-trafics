import { useState, useEffect, useCallback } from 'react';
import { Store } from '@/types/game';

interface AutoSalesState {
  [storeId: string]: {
    progress: number;
    isActive: boolean;
    lastSaleTime: number;
  };
}

interface UseAutoSalesProps {
  stores: Store[];
  onSaleComplete: (storeId: string, productId: string, quantity: number) => void;
}

export const useAutoSales = ({ stores, onSaleComplete }: UseAutoSalesProps) => {
  const [salesState, setSalesState] = useState<AutoSalesState>({});
  const SALE_INTERVAL = 2000; // 2 segundos

  // Inicializar estado para lojas ativas
  useEffect(() => {
    const newState: AutoSalesState = {};
    stores.forEach(store => {
      if (store.owned && store.products.length > 0) {
        newState[store.id] = salesState[store.id] || {
          progress: 0,
          isActive: true,
          lastSaleTime: Date.now()
        };
      }
    });
    setSalesState(newState);
  }, [stores]);

  // Função para selecionar produto aleatório da loja
  const selectRandomProductFromStore = useCallback((store: Store) => {
    const productsWithStock = store.products.filter(product => product.quantity > 0);
    if (productsWithStock.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * productsWithStock.length);
    return productsWithStock[randomIndex];
  }, []);

  // Função para processar venda
  const processSale = useCallback((storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store || !store.owned) return;

    const selectedProduct = selectRandomProductFromStore(store);
    if (!selectedProduct) {
      // Parar vendas se não há produtos em estoque
      setSalesState(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          isActive: false,
          progress: 0
        }
      }));
      return;
    }

    // Executar venda
    onSaleComplete(storeId, selectedProduct.productId, 1);
    
    // Resetar progresso
    setSalesState(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        progress: 0,
        lastSaleTime: Date.now()
      }
    }));
  }, [stores, selectRandomProductFromStore, onSaleComplete]);

  // Timer principal
  useEffect(() => {
    const interval = setInterval(() => {
      setSalesState(prev => {
        const newState = { ...prev };
        
        Object.keys(newState).forEach(storeId => {
          const state = newState[storeId];
          const store = stores.find(s => s.id === storeId);
          
          if (!store || !store.owned) {
            delete newState[storeId];
            return;
          }

          // Verificar se há produtos em estoque na loja
          const hasStock = store.products.some(product => product.quantity > 0);
          if (!hasStock) {
            newState[storeId] = {
              ...state,
              isActive: false,
              progress: 0
            };
            return;
          }

          // Ativar vendas se há estoque
          if (!state.isActive && hasStock) {
            newState[storeId] = {
              ...state,
              isActive: true,
              lastSaleTime: Date.now()
            };
          }

          // Atualizar progresso
          if (state.isActive) {
            const elapsed = Date.now() - state.lastSaleTime;
            const progress = Math.min((elapsed / store.sellInterval) * 100, 100);
            
            newState[storeId] = {
              ...state,
              progress
            };

            // Processar venda quando completar
            if (progress >= 100) {
              setTimeout(() => processSale(storeId), 0);
            }
          }
        });
        
        return newState;
      });
    }, 50); // Atualizar a cada 50ms para suavidade

    return () => clearInterval(interval);
  }, [stores, processSale]);

  return salesState;
};