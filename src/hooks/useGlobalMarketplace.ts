/**
 * useGlobalMarketplace — Marketplace compartilhado entre todos os jogadores.
 *
 * Comportamento:
 *  - Somente online: todos os usuários veem os mesmos carros via Supabase
 *  - Supabase indisponível: exibe estado de erro, sem fallback local
 *  - Realtime propaga compras de outros jogadores instantaneamente
 *  - Poll a cada 5 min como seguro caso Realtime não esteja ativo
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildMarketplaceInventory } from '@/data/cars';
import type { MarketplaceCar } from '@/types/game';

export interface GlobalCar extends MarketplaceCar {
  status: 'available' | 'sold';
  buyerName?: string;
  soldAt?: string;
  batchId: number;
}

interface MarketplaceRow {
  id: string;
  model_id: string;
  variant_id: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  fipe_price: number;
  asking_price: number;
  condition_pct: number;
  icon: string;
  category: string;
  seller_name: string;
  status: 'available' | 'sold';
  buyer_name: string | null;
  sold_at: string | null;
  batch_id: number;
}

const REFRESH_MS = 30 * 60 * 1_000; // 30 min entre refreshes de inventario
const POLL_MS    =  5 * 60 * 1_000; // poll a cada 5 min (fallback p/ Realtime)
const db = () => supabase as any;

function rowToGlobalCar(row: MarketplaceRow): GlobalCar {
  return {
    id:           row.id,
    modelId:      row.model_id,
    variantId:    row.variant_id,
    brand:        row.brand,
    model:        row.model,
    trim:         row.trim,
    year:         row.year,
    fipePrice:    row.fipe_price,
    condition:    row.condition_pct,
    askingPrice:  row.asking_price,
    icon:         row.icon,
    category:     row.category as GlobalCar['category'],
    seller:       row.seller_name,
    pendingOffer: null,
    status:       row.status,
    buyerName:    row.buyer_name  ?? undefined,
    soldAt:       row.sold_at     ?? undefined,
    batchId:      row.batch_id,
  };
}

function carsToRows(cars: MarketplaceCar[], batchId: number) {
  return cars.map(car => ({
    id:            `${car.variantId}_b${batchId}`,
    model_id:      car.modelId,
    variant_id:    car.variantId,
    brand:         car.brand,
    model:         car.model,
    trim:          car.trim,
    year:          car.year,
    fipe_price:    car.fipePrice,
    asking_price:  car.askingPrice,
    condition_pct: car.condition,
    icon:          car.icon,
    category:      car.category,
    seller_name:   car.seller,
    status:        'available',
    batch_id:      batchId,
  }));
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function useGlobalMarketplace() {
  const [listings, setListings]           = useState<GlobalCar[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isOnline, setIsOnline]           = useState(false);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [minsLeft, setMinsLeft]           = useState<number | null>(null);
  const mountedRef                        = useRef(true);
  const nextRefreshRef                    = useRef<Date | null>(null);
  const listingsRef                       = useRef<GlobalCar[]>([]);

  // Mantem ref sincronizado para usar em callbacks
  useEffect(() => { listingsRef.current = listings; }, [listings]);

  // -- Fetch listings do Supabase -------------------------------------------
  const fetchListings = useCallback(async (): Promise<GlobalCar[] | null> => {
    try {
      const { data, error } = await db()
        .from('marketplace_global')
        .select('*')
        .order('asking_price', { ascending: true });
      if (error || !data) return null;
      return (data as MarketplaceRow[]).map(rowToGlobalCar);
    } catch { return null; }
  }, []);

  // -- Carga completa: verifica freshness, faz refresh se necessario ---------
  const loadMarketplace = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      // Le o meta (ultimo refresh)
      const { data: meta, error: metaErr } = await db()
        .from('marketplace_meta')
        .select('last_refresh, batch_id')
        .eq('id', 1)
        .maybeSingle();

      if (metaErr) throw metaErr;

      const lastMs = meta?.last_refresh ? new Date(meta.last_refresh).getTime() : 0;
      const stale  = Date.now() - lastMs >= REFRESH_MS || !meta;

      if (stale) {
        // Tenta "ganhar" o slot de refresh (UPDATE atomico -- apenas 1 jogador executa)
        const { data: newBatch, error: rpcErr } = await db()
          .rpc('try_claim_marketplace_refresh');

        if (rpcErr) throw new Error('try_claim_marketplace_refresh: ' + rpcErr.message);

        if (newBatch != null) {
          // Ganhou: gera novo inventario e publica para todos
          const freshCars = buildMarketplaceInventory();
          const rows      = carsToRows(freshCars, newBatch as number);

          const { error: delErr } = await db()
            .from('marketplace_global').delete().lt('batch_id', newBatch);
          if (delErr) throw new Error('delete: ' + delErr.message);

          const { error: insErr } = await db()
            .from('marketplace_global').insert(rows);
          if (insErr) throw new Error('insert (' + rows.length + ' rows): ' + insErr.message);
        }
      }

      // Rele meta para saber quando e o proximo refresh
      const { data: freshMeta } = await db()
        .from('marketplace_meta')
        .select('last_refresh')
        .eq('id', 1)
        .maybeSingle();

      if (freshMeta?.last_refresh && mountedRef.current) {
        const next = new Date(new Date(freshMeta.last_refresh).getTime() + REFRESH_MS);
        setNextRefreshAt(next);
        nextRefreshRef.current = next;
      }

      // Busca os carros
      const cars = await fetchListings();
      if (mountedRef.current) {
        if (cars && cars.length > 0) {
          setListings(cars);
          setIsOnline(true);
        } else {
          // Tabelas existem mas retornaram vazio -- mantem listagem atual se tiver
          setIsOnline(true);
        }
      }
    } catch (err: unknown) {
      // Supabase indisponivel ou erro de insercao -- sem fallback local, exibe estado de erro
      if (mountedRef.current) {
        setIsOnline(false);
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchListings]);

  // -- Compra atomica via RPC ------------------------------------------------
  const buyGlobal = useCallback(async (
    carId: string,
    buyerName: string
  ): Promise<{ success: boolean; message: string }> => {
    const car = listingsRef.current.find(l => l.id === carId);
    if (!car) return { success: false, message: 'Carro nao encontrado.' };
    if (car.status === 'sold') return { success: false, message: 'Este carro ja foi vendido por outro jogador!' };

    try {
      const { data, error } = await db()
        .rpc('buy_marketplace_car', { p_car_id: carId, p_buyer_name: buyerName });

      if (error || !data) return { success: false, message: 'Erro de conexao com o servidor.' };

      if (data.success) {
        setListings(prev => prev.map(l =>
          l.id === carId ? { ...l, status: 'sold' as const, buyerName } : l
        ));
      }
      return { success: data.success, message: data.message };
    } catch {
      return { success: false, message: 'Sem conexao com o servidor. Tente novamente.' };
    }
  }, []);

  // -- Negociacao (client-side) + compra atomica ----------------------------
  const makeOfferGlobal = useCallback(async (
    carId: string,
    offerValue: number,
    buyerName: string,
    playerMoney: number,
    overdraftLimit: number
  ): Promise<{ success: boolean; message: string; finalPrice?: number }> => {
    const car = listingsRef.current.find(l => l.id === carId);
    if (!car)                  return { success: false, message: 'Carro nao encontrado.' };
    if (car.status === 'sold') return { success: false, message: 'Este carro ja foi vendido por outro jogador!' };
    if (offerValue <= 0)       return { success: false, message: 'Oferta invalida.' };

    // Piso da oferta: 90% do preco de listagem
    const minOffer = Math.round(car.askingPrice * 0.90);
    if (offerValue < minOffer)
      return { success: false, message: 'Vendedor recusou sua oferta.' };

    if (playerMoney - offerValue < overdraftLimit)
      return { success: false, message: 'Saldo insuficiente para esta oferta.' };

    const result = await buyGlobal(carId, buyerName);
    if (!result.success) return result;

    const discount = Math.round(((car.askingPrice - offerValue) / car.askingPrice) * 100);
    const msg = discount > 0
      ? `Desconto de ${discount}%! ${car.brand} ${car.model} por ${fmt(offerValue)}.`
      : `Oferta aceita! ${car.brand} ${car.model} adicionado a garagem.`;

    return { success: true, message: msg, finalPrice: offerValue };
  }, [buyGlobal]);

  // -- Countdown (atualiza a cada 30s) --------------------------------------
  useEffect(() => {
    const tick = () => {
      const next = nextRefreshRef.current;
      if (!next) return;
      setMinsLeft(Math.max(0, Math.ceil((next.getTime() - Date.now()) / 60_000)));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  // -- Mount: carga inicial + Realtime + poll de seguranca ------------------
  useEffect(() => {
    mountedRef.current = true;
    void loadMarketplace();

    // Supabase Realtime -- propaga compras de outros jogadores instantaneamente
    const realtimeChannel = db()
      .channel('marketplace-global-sold')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marketplace_global' },
        (payload: { new: MarketplaceRow }) => {
          if (!mountedRef.current) return;
          const row = payload.new;
          if (row.status === 'sold') {
            setListings(prev =>
              prev.map(l =>
                l.id === row.id
                  ? { ...l, status: 'sold' as const, buyerName: row.buyer_name ?? undefined }
                  : l
              )
            );
          }
        },
      )
      .subscribe();

    // Poll de seguranca -- caso Realtime esteja desabilitado no projeto Supabase
    const pollTimer = setInterval(() => {
      if (mountedRef.current) void loadMarketplace();
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      void db().removeChannel(realtimeChannel);
      clearInterval(pollTimer);
    };
  }, [loadMarketplace]);

  return {
    listings,
    loading,
    isOnline,
    errorMsg,
    minsLeft,
    loadMarketplace,
    buyGlobal,
    makeOfferGlobal,
  };
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   