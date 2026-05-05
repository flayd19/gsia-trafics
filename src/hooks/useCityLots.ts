// =====================================================================
// useCityLots — carrega lotes da cidade do Supabase + realtime
//
// Estratégia de performance:
//   • Carga inicial: SELECT id, owner_user_id, building_type, building_level
//     dos lotes (apenas campos voláteis). A geometria (polygon) e dados
//     estáticos vêm do JSON local (src/data/goianesia-lots.json) que
//     foi commitado pelo script generate-city-lots.mjs.
//   • Merge no client: combina geometria estática + estado dinâmico do banco.
//   • Realtime: UPDATE em city_lots (compras, construções) propaga para
//     todos os jogadores instantaneamente.
//
// Isso evita transferir 1.1MB de geometria do banco a cada load.
// =====================================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logRpcError } from '@/lib/errorLogger';
import staticData from '@/data/goianesia-lots.json';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Tipos ───────────────────────────────────────────────────────────

export type LngLat = [number, number];

export interface CityBlock {
  id:           string;
  polygon:      LngLat[];
  neighborhood: string;
}

export interface StaticLot {
  id:           string;
  block_id:     string;
  polygon:      LngLat[];
  area_m2:      number;
  neighborhood: string;
  base_price:   number;
}

export type BuildingType =
  | 'house' | 'commerce' | 'industry' | 'office'
  | 'residential' | 'farm' | 'garage';

export interface DynamicLotState {
  owner_user_id:  string | null;
  owner_name:     string | null;
  building_type:  BuildingType | null;
  building_level: number;
  last_sold_at:   string | null;
}

export interface CityLot extends StaticLot, DynamicLotState {}

export interface CityData {
  city:         string;
  bbox:         { minLng: number; minLat: number; maxLng: number; maxLat: number };
  cityCenter:   LngLat;
  blocks:       CityBlock[];
  lots:         CityLot[];
  streets:      Array<{ id: string; type: string; path: LngLat[]; name?: string | null }>;
  parks:        Array<{ id: string; name: string; polygon: LngLat[] }>;
  highways:     Array<{ id?: string; name: string; type?: string; path: LngLat[] }>;
  neighborhoods: Array<{ name: string; center: LngLat }>;
  clubs?:       Array<{ id: string; name: string; polygon: LngLat[] }>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useCityLots() {
  const [data,    setData]    = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const dynamicRef = useRef<Map<string, DynamicLotState>>(new Map());

  const buildData = useCallback((): CityData => {
    const sd = staticData as unknown as {
      city: string;
      bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
      cityCenter: LngLat;
      blocks: CityBlock[];
      lots: StaticLot[];
      streets: Array<{ id: string; type: string; path: LngLat[]; name?: string | null }>;
      parks: Array<{ id: string; name: string; polygon: LngLat[] }>;
      highways: Array<{ id?: string; name: string; type?: string; path: LngLat[] }>;
      neighborhoods: Array<{ name: string; center: LngLat }>;
      clubs?: Array<{ id: string; name: string; polygon: LngLat[] }>;
    };

    const dynMap = dynamicRef.current;
    const merged: CityLot[] = sd.lots.map(l => {
      const dyn = dynMap.get(l.id);
      return {
        ...l,
        owner_user_id:  dyn?.owner_user_id  ?? null,
        owner_name:     dyn?.owner_name     ?? null,
        building_type:  dyn?.building_type  ?? null,
        building_level: dyn?.building_level ?? 0,
        last_sold_at:   dyn?.last_sold_at   ?? null,
      };
    });

    return {
      city:          sd.city,
      bbox:          sd.bbox,
      cityCenter:    sd.cityCenter,
      blocks:        sd.blocks,
      lots:          merged,
      streets:       sd.streets,
      parks:         sd.parks,
      highways:      sd.highways,
      neighborhoods: sd.neighborhoods,
      clubs:         sd.clubs ?? [],
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Busca apenas estado dinâmico — todos os lotes
      const { data: rows, error: err } = await db()
        .from('city_lots')
        .select('id, owner_user_id, owner_name, building_type, building_level, last_sold_at');
      if (err) {
        logRpcError('city_lots.select', err);
        setError('Falha ao carregar estado dos lotes.');
      } else {
        const map = new Map<string, DynamicLotState>();
        for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
          map.set(r['id'] as string, {
            owner_user_id:  (r['owner_user_id']  as string | null) ?? null,
            owner_name:     (r['owner_name']     as string | null) ?? null,
            building_type:  (r['building_type']  as BuildingType | null) ?? null,
            building_level: Number(r['building_level'] ?? 0),
            last_sold_at:   (r['last_sold_at']   as string | null) ?? null,
          });
        }
        dynamicRef.current = map;
      }
      setData(buildData());
    } finally {
      setLoading(false);
    }
  }, [buildData]);

  // Mount: carrega + assina realtime
  useEffect(() => {
    void refresh();

    const channel = db()
      .channel('city_lots_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'city_lots' },
        (payload: { new: Record<string, unknown> }) => {
          const r = payload.new;
          const id = r['id'] as string;
          if (!id) return;
          dynamicRef.current.set(id, {
            owner_user_id:  (r['owner_user_id']  as string | null) ?? null,
            owner_name:     (r['owner_name']     as string | null) ?? null,
            building_type:  (r['building_type']  as BuildingType | null) ?? null,
            building_level: Number(r['building_level'] ?? 0),
            last_sold_at:   (r['last_sold_at']   as string | null) ?? null,
          });
          setData(buildData());
        },
      )
      .subscribe();

    return () => { void db().removeChannel(channel); };
  }, [refresh, buildData]);

  // ── Ações ─────────────────────────────────────────────────────
  const buyLot = useCallback(async (lotId: string) => {
    const { data: result, error: err } = await db().rpc('buy_lot', { p_lot_id: lotId });
    if (err) {
      logRpcError('buy_lot', err, { lotId });
      const msg = (err.message ?? '').toLowerCase();
      if (msg.includes('insufficient_balance')) return { success: false, message: 'Saldo insuficiente.' };
      if (msg.includes('lot_already_owned'))     return { success: false, message: 'Lote já tem dono.' };
      if (msg.includes('lot_not_found'))         return { success: false, message: 'Lote não encontrado.' };
      return { success: false, message: 'Falha ao comprar.' };
    }
    return { success: true, message: 'Lote comprado!', data: result as { lot_id: string; price: number; new_money: number } };
  }, []);

  const sellLot = useCallback(async (lotId: string) => {
    const { data: result, error: err } = await db().rpc('sell_lot_to_market', { p_lot_id: lotId });
    if (err) {
      logRpcError('sell_lot_to_market', err, { lotId });
      return { success: false, message: 'Falha ao vender.' };
    }
    return { success: true, message: 'Lote vendido!', data: result as { lot_id: string; payout: number; new_money: number } };
  }, []);

  const buildOnLot = useCallback(async (lotId: string, type: BuildingType) => {
    const { data: result, error: err } = await db().rpc('build_on_lot', {
      p_lot_id:        lotId,
      p_building_type: type,
    });
    if (err) {
      logRpcError('build_on_lot', err, { lotId, type });
      const msg = (err.message ?? '').toLowerCase();
      if (msg.includes('insufficient_balance')) return { success: false, message: 'Saldo insuficiente.' };
      if (msg.includes('not_owner'))             return { success: false, message: 'Você não é dono.' };
      return { success: false, message: 'Falha ao construir.' };
    }
    return { success: true, message: 'Construção concluída!', data: result as { lot_id: string; cost: number; new_money: number } };
  }, []);

  const upgradeBuilding = useCallback(async (lotId: string) => {
    const { data: result, error: err } = await db().rpc('upgrade_building', { p_lot_id: lotId });
    if (err) {
      logRpcError('upgrade_building', err, { lotId });
      const msg = (err.message ?? '').toLowerCase();
      if (msg.includes('max_level'))             return { success: false, message: 'Nível máximo atingido.' };
      if (msg.includes('insufficient_balance')) return { success: false, message: 'Saldo insuficiente.' };
      return { success: false, message: 'Falha ao melhorar.' };
    }
    return { success: true, message: 'Construção melhorada!', data: result as { lot_id: string; cost: number; new_money: number } };
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    buyLot,
    sellLot,
    buildOnLot,
    upgradeBuilding,
  };
}
