/**
 * useGameSync — Sync de progresso do jogo (save/load/backup).
 *
 * Estratégia:
 *  - Sempre salva local (localStorage) como source-of-truth imediato
 *  - Tenta espelhar no Supabase em background (best-effort, não bloqueia)
 *  - No modo teste local (alife/123) pula Supabase completamente
 *  - Se backend cair, circuit breaker abre e para de spam
 *  - Toasts de erro com cooldown de 1min
 */
import { useCallback, useEffect, useRef } from 'react';
import { GameState } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  safeCall,
  readLocalSave,
  writeLocalSave,
  throttledToast,
  isLocalSession,
} from '@/lib/safeSync';

interface GameSyncHookResult {
  saveGameProgress: (gameState: GameState) => Promise<boolean>;
  loadGameProgress: () => Promise<GameState | null>;
  createBackup: (gameState: GameState, type?: 'manual' | 'auto' | 'crash') => Promise<boolean>;
  loadBackup: (backupId: string) => Promise<GameState | null>;
}

// =========================================================
// Helpers
// =========================================================
const MIN_SAVE_INTERVAL_MS = 5_000;

const gameStateToRpcPayload = (userId: string, gs: GameState) => ({
  p_user_id: userId,
  p_money: gs.money,
  p_overdraft_limit: gs.overdraftLimit,
  p_last_interest_calculation: gs.lastInterestCalculation,
  p_game_day: gs.gameTime.day,
  p_game_hour: gs.gameTime.hour,
  p_game_minute: gs.gameTime.minute,
  p_last_game_update: gs.gameTime.lastUpdate,
  p_warehouse_level: gs.warehouseLevel || 1,
  p_warehouse_capacity: gs.warehouseCapacity,
  p_current_warehouse: gs.currentWarehouse,
  p_last_weekly_cost_paid: gs.lastWeeklyCostPaid,
  p_lawyer_hired: gs.lawyerHired || false,
  p_tow_truck_hired: gs.towTruckHired || false,
  p_completed_orders: gs.completedOrders,
  p_completed_sales_in_cycle: gs.completedSalesInCycle,
  p_last_buyer_generation: gs.lastBuyerGeneration || 1,
  p_last_price_update: gs.lastPriceUpdate,
  p_is_waiting_for_new_buyers: gs.isWaitingForNewBuyers || false,
  p_new_buyers_timer_start: gs.newBuyersTimerStart || 0,
  p_new_buyers_timer_duration: gs.newBuyersTimerDuration || 30,
  p_vehicles: gs.vehicles || [],
  p_drivers: gs.drivers || [],
  p_stock: gs.stock || {},
  p_buyers: gs.buyers || [],
  p_current_trips: gs.currentTrips || [],
  p_pending_deliveries: gs.pendingDeliveries || [],
  p_police_interceptions: gs.policeInterceptions || [],
  p_vehicle_sales: gs.vehicleSales || [],
  p_product_sales: gs.productSales || [],
  p_stores: gs.stores || [],
  // Campos adicionais (persistidos no Supabase via migration FIX_SAVE_COMPLETO)
  p_reputation: gs.reputation || { level: 1, xp: 0, totalXp: 0 },
  p_pending_pickups: gs.pendingPickups || [],
  p_product_stats: gs.productStats || {},
  p_motorcycles: gs.motorcycles || [],
});

type GameProgressRow = {
  money?: number;
  overdraft_limit?: number;
  last_interest_calculation?: number;
  game_day?: number;
  game_hour?: number;
  game_minute?: number;
  last_game_update?: number;
  warehouse_level?: number;
  warehouse_capacity?: number;
  current_warehouse?: string;
  last_weekly_cost_paid?: number;
  lawyer_hired?: boolean;
  tow_truck_hired?: boolean;
  completed_orders?: number;
  completed_sales_in_cycle?: number;
  last_buyer_generation?: number;
  last_price_update?: number;
  is_waiting_for_new_buyers?: boolean;
  new_buyers_timer_start?: number;
  new_buyers_timer_duration?: number;
  vehicles?: unknown[];
  drivers?: unknown[];
  motorcycles?: unknown[];
  stock?: Record<string, unknown>;
  buyers?: unknown[];
  current_trips?: unknown[];
  pending_deliveries?: unknown[];
  pending_pickups?: unknown[];
  product_stats?: Record<string, unknown>;
  police_interceptions?: unknown[];
  vehicle_sales?: unknown[];
  product_sales?: unknown[];
  stores?: unknown[];
  reputation?: Record<string, unknown>;
};

const rowToGameState = (data: GameProgressRow): GameState => ({
  money: Number(data.money) || 40000,
  vehicles: (data.vehicles as GameState['vehicles']) || [],
  drivers: (data.drivers as GameState['drivers']) || [],
  motorcycles: (data.motorcycles as GameState['motorcycles']) || [],
  stock: (data.stock as GameState['stock']) || {},
  inventory: 0,
  warehouseCapacity: data.warehouse_capacity || 1080,
  warehouseLevel: data.warehouse_level || 1,
  currentWarehouse: data.current_warehouse || 'rua36',
  currentTrips: (data.current_trips as GameState['currentTrips']) || [],
  lawyerHired: data.lawyer_hired || false,
  towTruckHired: data.tow_truck_hired || false,
  lastPriceUpdate: data.last_price_update || 0,
  lastWeeklyCostPaid: data.last_weekly_cost_paid || 1,
  policeInterceptions: (data.police_interceptions as GameState['policeInterceptions']) || [],
  overdraftLimit: Number(data.overdraft_limit) || -30000,
  lastInterestCalculation: data.last_interest_calculation || 1,
  completedOrders: data.completed_orders || 0,
  completedSalesInCycle: data.completed_sales_in_cycle || 0,
  isWaitingForNewBuyers: data.is_waiting_for_new_buyers || false,
  newBuyersTimerStart: data.new_buyers_timer_start || 0,
  newBuyersTimerDuration: data.new_buyers_timer_duration || 30,
  lastBuyerGeneration: data.last_buyer_generation || 1,
  gameTime: {
    day: data.game_day || 1,
    hour: data.game_hour || 6,
    minute: data.game_minute || 0,
    lastUpdate: data.last_game_update || 0,
  },
  pendingDeliveries: (data.pending_deliveries as GameState['pendingDeliveries']) || [],
  pendingPickups: (data.pending_pickups as GameState['pendingPickups']) || [],
  vehicleSales: (data.vehicle_sales as GameState['vehicleSales']) || [],
  productSales: (data.product_sales as GameState['productSales']) || [],
  productStats: (data.product_stats as GameState['productStats']) || {},
  stores: (data.stores as GameState['stores']) || [],
  // buyers agora carrega o que foi salvo (era hardcoded [] antes)
  buyers: (data.buyers as GameState['buyers']) || [],
  // Reputação: fallback pro default se o banco ainda não tem a coluna
  reputation: (data.reputation as unknown as GameState['reputation']) || {
    level: 1,
    xp: 0,
    totalXp: 0,
  },
  pending_deliveries: (data.pending_deliveries as GameState['pendingDeliveries']) || [],
  completed_orders: data.completed_orders || 0,
});

// =========================================================
// Hook
// =========================================================
export const useGameSync = (): GameSyncHookResult => {
  const { user } = useAuth();
  const lastSaveRef = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------
  // SAVE
  // -------------------------------------------------------
  const saveGameProgress = useCallback(
    async (gameState: GameState): Promise<boolean> => {
      if (!user) return false;

      const now = Date.now();
      if (now - lastSaveRef.current < MIN_SAVE_INTERVAL_MS) return false;
      lastSaveRef.current = now;

      // 1. Sempre grava local (source of truth imediato)
      const localOk = writeLocalSave(user.id, gameState);

      // 2. Em modo teste local, para por aqui
      if (isLocalSession()) return localOk;

      // 3. Espelha no Supabase (best-effort)
      const res = await safeCall(
        'save:upsert',
        async () => {
          // Cast: tipos gerados do Supabase ainda não conhecem os params novos
          // (p_reputation, p_pending_pickups, p_product_stats, p_motorcycles).
          // O banco aceita via FIX_SAVE_COMPLETO.sql.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = gameStateToRpcPayload(user.id, gameState) as any;
          const { error } = await supabase.rpc(
            'upsert_game_progress_safe',
            payload
          );
          if (error) throw error;
          return true;
        },
        { timeoutMs: 10_000 }
      );

      if (!res.ok && !res.skipped) {
        throttledToast('save-error', {
          title: 'Progresso salvo localmente',
          description: 'Sem conexão com o servidor. Sincroniza quando voltar.',
        });
      }

      // 4. Log de atividade (fire-and-forget, sem bloquear)
      if (res.ok) {
        void safeCall(
          'activity:save',
          async () => {
            await supabase.from('activity_logs').insert({
              user_id: user.id,
              action_type: 'save',
              action_data: {
                game_day: gameState.gameTime.day,
                money: gameState.money,
                vehicles_count: gameState.vehicles?.length ?? 0,
                stores_count:
                  gameState.stores?.filter((s) => s.owned).length ?? 0,
              },
            });
            return true;
          },
          { timeoutMs: 5_000 }
        );
      }

      return localOk;
    },
    [user]
  );

  // -------------------------------------------------------
  // LOAD
  // -------------------------------------------------------
  const loadGameProgress = useCallback(async (): Promise<GameState | null> => {
    if (!user) return null;

    // 1. Em modo teste local → só localStorage
    if (isLocalSession()) {
      return readLocalSave<GameState>(user.id);
    }

    // 2. Em modo normal, tenta Supabase
    const res = await safeCall(
      'load:select',
      async () => {
        const { data, error } = await supabase
          .from('game_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      },
      { timeoutMs: 10_000 }
    );

    if (res.ok && res.data) {
      const gs = rowToGameState(res.data as GameProgressRow);
      // cache local pra próximas vezes (fallback offline)
      writeLocalSave(user.id, gs);
      return gs;
    }

    // 3. Fallback: tenta localStorage
    return readLocalSave<GameState>(user.id);
  }, [user]);

  // -------------------------------------------------------
  // BACKUP
  // -------------------------------------------------------
  const createBackup = useCallback(
    async (
      gameState: GameState,
      type: 'manual' | 'auto' | 'crash' = 'manual'
    ): Promise<boolean> => {
      if (!user) return false;

      // Modo teste local: backup local com timestamp
      if (isLocalSession()) {
        try {
          const key = `gsia_local_backup_${user.id}_${Date.now()}_${type}`;
          localStorage.setItem(key, JSON.stringify(gameState));
          if (type === 'manual') {
            throttledToast('backup-ok', {
              title: 'Backup criado',
              description: 'Backup salvo no navegador.',
            });
          }
          return true;
        } catch {
          return false;
        }
      }

      const res = await safeCall(
        'backup:create',
        async () => {
          const { error } = await supabase.rpc('create_game_backup', {
            p_user_id: user.id,
            p_backup_type: type,
          });
          if (error) throw error;
          return true;
        },
        { timeoutMs: 10_000 }
      );

      if (res.ok && type === 'manual') {
        throttledToast('backup-ok', {
          title: 'Backup criado',
          description: 'Seu progresso foi salvo como backup manual.',
        });
      }
      return res.ok;
    },
    [user]
  );

  // -------------------------------------------------------
  // LOAD BACKUP
  // -------------------------------------------------------
  const loadBackup = useCallback(
    async (backupId: string): Promise<GameState | null> => {
      if (!user || isLocalSession()) return null;

      const res = await safeCall(
        'backup:load',
        async () => {
          const { data, error } = await supabase
            .from('game_backups')
            .select('backup_data')
            .eq('id', backupId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        { timeoutMs: 10_000 }
      );

      if (!res.ok || !res.data) return null;

      const row = res.data as { backup_data: GameProgressRow };
      return rowToGameState(row.backup_data);
    },
    [user]
  );

  // -------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveGameProgress,
    loadGameProgress,
    createBackup,
    loadBackup,
  };
};
