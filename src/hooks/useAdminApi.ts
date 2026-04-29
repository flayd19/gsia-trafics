// =====================================================================
// useAdminApi — wrappers tipados das RPCs admin_*.
//
// Cada RPC recebe a senha admin como primeiro parâmetro. A senha vem do
// sessionStorage (gerenciado por lib/adminAuth.ts). Se a senha não estiver
// presente, as funções retornam imediatamente.
// =====================================================================
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logRpcError } from '@/lib/errorLogger';
import { getAdminPassword } from '@/lib/adminAuth';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface AdminPlayer {
  user_id:         string;
  email:           string;
  display_name:    string;
  level:           number;
  total_patrimony: number;
  money:           number;
  races_won:       number;
  updated_at:      string;
}

export interface AdminErrorLog {
  id:             number;
  user_id:        string | null;
  user_email:     string | null;
  function_name:  string;
  error_message:  string;
  error_code:     string | null;
  payload:        unknown;
  created_at:     string;
}

export interface AdminMarketOverview {
  last_refresh:    string | null;
  next_refresh_at: string;
  batch_id:        number;
  total_cars:      number;
  available_cars:  number;
  sold_cars:       number;
  by_category:     Record<string, number>;
}

export interface AdminFullMarketConfig {
  category_weights:  Record<string, number>;
  min_batch:         number;
  max_batch:         number;
  popular_min_ratio: number;
  max_same_model:    number;
  updated_at?:       string;
}

export interface AdminCustomCar {
  id:         string;
  brand:      string;
  model:      string;
  icon:       string;
  category:   string;
  variants:   Array<{ id: string; trim: string; year: number; fipePrice: number }>;
  wiki_pt:    string | null;
  wiki_en:    string | null;
  image_urls: string[] | null;
  active:     boolean;
  created_at: string;
}

const getPw = (): string => {
  const pw = getAdminPassword();
  if (!pw) throw new Error('admin_not_authenticated');
  return pw;
};

export function useAdminApi() {
  // ── Jogadores ─────────────────────────────────────────────────
  const listPlayers = useCallback(async (search?: string): Promise<AdminPlayer[]> => {
    const { data, error } = await db().rpc('admin_list_players', {
      p_admin_password: getPw(),
      p_search:         search ?? null,
      p_limit:          200,
    });
    if (error) {
      logRpcError('admin_list_players', error);
      return [];
    }
    return (data ?? []) as AdminPlayer[];
  }, []);

  const setPlayerMoney = useCallback(async (userId: string, newMoney: number) => {
    const { data, error } = await db().rpc('admin_set_player_money', {
      p_admin_password: getPw(),
      p_target_user_id: userId,
      p_new_money:      newMoney,
    });
    if (error) {
      logRpcError('admin_set_player_money', error, { userId, newMoney });
      throw error;
    }
    return data as number;
  }, []);

  const adjustPlayerMoney = useCallback(async (userId: string, delta: number) => {
    const { data, error } = await db().rpc('admin_adjust_player_money', {
      p_admin_password: getPw(),
      p_target_user_id: userId,
      p_delta:          delta,
    });
    if (error) {
      logRpcError('admin_adjust_player_money', error, { userId, delta });
      throw error;
    }
    return data as number;
  }, []);

  // ── Dedupe ────────────────────────────────────────────────────
  const listDuplicateAccounts = useCallback(async (): Promise<Array<{
    category:        string;
    email:           string;
    count:           number;
    oldest_user_id:  string;
    newest_user_id:  string;
  }>> => {
    const { data, error } = await db().rpc('admin_list_duplicate_accounts', {
      p_admin_password: getPw(),
    });
    if (error) {
      logRpcError('admin_list_duplicate_accounts', error);
      return [];
    }
    return (data ?? []) as Array<{
      category:        string;
      email:           string;
      count:           number;
      oldest_user_id:  string;
      newest_user_id:  string;
    }>;
  }, []);

  const dedupeAccounts = useCallback(async (): Promise<{
    emailsProcessed:        number;
    duplicateUsersDeleted:  number;
    orphanProfilesDeleted:  number;
    orphanProgressDeleted:  number;
  } | null> => {
    const { data, error } = await db().rpc('admin_dedupe_accounts', {
      p_admin_password: getPw(),
    });
    if (error) {
      logRpcError('admin_dedupe_accounts', error);
      throw error;
    }
    const obj = (data ?? {}) as Record<string, number>;
    return {
      emailsProcessed:        obj.emails_processed        ?? 0,
      duplicateUsersDeleted:  obj.duplicate_users_deleted ?? 0,
      orphanProfilesDeleted:  obj.orphan_profiles_deleted ?? 0,
      orphanProgressDeleted:  obj.orphan_progress_deleted ?? 0,
    };
  }, []);

  // ── Mercado ───────────────────────────────────────────────────
  const getMarketOverview = useCallback(async (): Promise<AdminMarketOverview | null> => {
    const { data, error } = await db().rpc('admin_get_market_overview', {
      p_admin_password: getPw(),
    });
    if (error) {
      logRpcError('admin_get_market_overview', error);
      return null;
    }
    return data as AdminMarketOverview;
  }, []);

  const forceMarketRefresh = useCallback(async (): Promise<boolean> => {
    const { error } = await db().rpc('admin_force_market_refresh', {
      p_admin_password: getPw(),
    });
    if (error) {
      logRpcError('admin_force_market_refresh', error);
      return false;
    }
    return true;
  }, []);

  const clearMarketplace = useCallback(async (): Promise<{ deleted: number; newBatchId: number } | null> => {
    const { data, error } = await db().rpc('admin_clear_marketplace', {
      p_admin_password: getPw(),
    });
    if (error) {
      logRpcError('admin_clear_marketplace', error);
      return null;
    }
    const obj = (data ?? {}) as { deleted?: number; new_batch_id?: number };
    return { deleted: obj.deleted ?? 0, newBatchId: obj.new_batch_id ?? 0 };
  }, []);

  // ── Carros ────────────────────────────────────────────────────
  const listCustomCars = useCallback(async (): Promise<AdminCustomCar[]> => {
    const { data, error } = await db()
      .from('admin_custom_cars')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      logRpcError('admin_custom_cars.select', error);
      return [];
    }
    return (data ?? []) as AdminCustomCar[];
  }, []);

  const createCar = useCallback(async (car: {
    id:         string;
    brand:      string;
    model:      string;
    icon:       string;
    category:   string;
    variants:   Array<{ id: string; trim: string; year: number; fipePrice: number }>;
    wikiPt?:    string;
    wikiEn?:    string;
    imageUrls?: string[];
  }): Promise<boolean> => {
    const { error } = await db().rpc('admin_create_car', {
      p_admin_password: getPw(),
      p_id:         car.id,
      p_brand:      car.brand,
      p_model:      car.model,
      p_icon:       car.icon,
      p_category:   car.category,
      p_variants:   car.variants,
      p_wiki_pt:    car.wikiPt ?? null,
      p_wiki_en:    car.wikiEn ?? null,
      p_image_urls: car.imageUrls && car.imageUrls.length > 0 ? car.imageUrls : null,
    });
    if (error) {
      logRpcError('admin_create_car', error, { id: car.id });
      throw error;
    }
    return true;
  }, []);

  const deleteCar = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await db().rpc('admin_delete_car', {
      p_admin_password: getPw(),
      p_id: id,
    });
    if (error) {
      logRpcError('admin_delete_car', error, { id });
      return false;
    }
    return Boolean(data);
  }, []);

  // ── Categorias / config completa ─────────────────────────────
  const getFullMarketConfig = useCallback(async (): Promise<AdminFullMarketConfig | null> => {
    const { data, error } = await db().rpc('get_full_market_config');
    if (error) {
      logRpcError('get_full_market_config', error);
      return null;
    }
    return data as AdminFullMarketConfig;
  }, []);

  const updateFullMarketConfig = useCallback(async (cfg: {
    weights:           Record<string, number>;
    minBatch:          number;
    maxBatch:          number;
    popularMinRatio?:  number;
    maxSameModel?:     number;
  }) => {
    const { error } = await db().rpc('admin_update_full_market_config', {
      p_admin_password:    getPw(),
      p_weights:           cfg.weights,
      p_min_batch:         cfg.minBatch,
      p_max_batch:         cfg.maxBatch,
      p_popular_min_ratio: cfg.popularMinRatio ?? null,
      p_max_same_model:    cfg.maxSameModel ?? null,
    });
    if (error) {
      logRpcError('admin_update_full_market_config', error, { cfg });
      throw error;
    }
  }, []);

  // ── Erros ────────────────────────────────────────────────────
  const listErrorLogs = useCallback(async (filters?: {
    functionName?: string;
    sinceIso?:     string;
    limit?:        number;
  }): Promise<AdminErrorLog[]> => {
    const { data, error } = await db().rpc('admin_list_error_logs', {
      p_admin_password: getPw(),
      p_limit:          filters?.limit ?? 100,
      p_function_name:  filters?.functionName ?? null,
      p_since:          filters?.sinceIso ?? null,
    });
    if (error) {
      logRpcError('admin_list_error_logs', error);
      return [];
    }
    return (data ?? []) as AdminErrorLog[];
  }, []);

  const clearErrorLogs = useCallback(async (olderThanDays: number): Promise<number> => {
    const { data, error } = await db().rpc('admin_clear_error_logs', {
      p_admin_password:   getPw(),
      p_older_than_days:  olderThanDays,
    });
    if (error) {
      logRpcError('admin_clear_error_logs', error);
      return 0;
    }
    return data as number;
  }, []);

  return {
    // Jogadores
    listPlayers,
    setPlayerMoney,
    adjustPlayerMoney,
    listDuplicateAccounts,
    dedupeAccounts,
    // Mercado
    getMarketOverview,
    forceMarketRefresh,
    clearMarketplace,
    // Carros
    listCustomCars,
    createCar,
    deleteCar,
    // Categorias / config
    getFullMarketConfig,
    updateFullMarketConfig,
    // Erros
    listErrorLogs,
    clearErrorLogs,
  };
}
