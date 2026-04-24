/**
 * useGlobalMarketplace — Marketplace compartilhado entre todos os jogadores.
 *
 * Comportamento:
 *  - Modo online (Supabase OK): todos os usuários veem os mesmos carros
 *  - Modo offline (tabelas não existem ainda): gera carros localmente como
 *    fallback, o jogador ainda pode comprar (só não é compartilhado)
 *  - Poll a cada 60s para refletir compras de outros jogadores em tempo real
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildMarketplaceInventory, MIN_ASKING_PRICE_RATIO } from '@/data/cars';
import type { MarketplaceCar } from '@/types/game';

export interface GlobalCar extends MarketplaceCar {
  status: 'available' | 'sold';
  buyerName?: string;
  soldAt?: string;
  batchId: number;
  /** true = Supabase indisponível; compra funciona só localmente */
  isLocal?: boolean;
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

const REFRESH_MS = 30 * 60 * 1000; // 30 min
const POLL_MS    =  15 * 1_000;     // fallback poll a cada 15s
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
    isLocal:      false,
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

/** Gera lote local quando o Supabase ainda não tem as tabelas configuradas */
function buildLocalFallback(): GlobalCar[] {
  const batchId = Math.floor(Date.now() / 1000);
  return buildMarketplaceInventory().map(car => ({
    ...car,
    id:       `${car.variantId}_b${batchId}`,
    status:   'available' as const,
    batchId,
    isLocal:  true,
  }));
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function useGlobalMarketplace() {
  const [listings, setListings]           = useState<GlobalCar[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isOnline, setIsOnline]           = useState(false);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [minsLeft, setMinsLeft]           = useState<number | null>(null);
  const mountedRef                        = useRef(true);
  const nextRefreshRef                    = useRef<Date | null>(null);
  const listingsRef                       = useRef<GlobalCar[]>([]);

  // Mantém ref sincronizado para usar em callbacks
  useEffect(() => { listingsRef.current = listings; }, [listings]);

  // ── Fetch listings do Supabase ───────────────────────────────
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

  // ── Carga completa: verifica freshness, faz refresh se necessário ──
  const loadMarketplace = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      // Lê o meta (último refresh)
      const { data: meta, error: metaErr } = await db()
        .from('marketplace_meta')
        .select('last_refresh, batch_id')
        .eq('id', 1)
        .maybeSingle();

      // Tabelas não existem ainda → fallback local
      if (metaErr) throw metaErr;

      const lastMs = meta?.last_refresh ? new Date(meta.last_refresh).getTime() : 0;
      const stale  = Date.now() - lastMs >= REFRESH_MS || !meta;

      if (stale) {
        // Tenta "ganhar" o slot de refresh (UPDATE atômico)
        const { data: newBatch, error: rpcErr } = await db()
          .rpc('try_claim_marketplace_refresh');

        if (rpcErr) throw rpcErr;

        if (newBatch != null) {
          // Ganhou: gera novo inventário e publica
          const freshCars = buildMarketplaceInventory();
          const rows      = carsToRows(freshCars, newBatch as number);
          await db().from('marketplace_global').delete().lt('batch_id', newBatch);
          await db().from('marketplace_global').insert(rows);
        }
      }

      // Relê meta para saber quando é o próximo refresh
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
          // Tabelas existem mas vazias (raro) — fallback local
          setListings(buildLocalFallback());
          setIsOnline(false);
        }
      }
    } catch {
      // Supabase indisponível ou tabelas não configuradas → fallback local
      if (mountedRef.current) {
        setListings(prev => prev.length > 0 ? prev : buildLocalFallback());
        setIsOnline(false);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchListings]);

  // ── Compra atômica via RPC ───────────────────────────────────
  const buyGlobal = useCallback(async (
    carId: string,
    buyerName: string
  ): Promise<{ success: boolean; message: string }> => {
    const car = listingsRef.current.find(l => l.id === carId);

    // Modo offline: compra local imediata
    if (car?.isLocal) {
      if (car.status === 'sold')
        return { success: false, message: 'Este carro já foi vendido.' };
      setListings(prev => prev.map(l =>
        l.id === carId ? { ...l, status: 'sold' as const, buyerName } : l
      ));
      return { success: true, message: `${car.brand} ${car.model} é seu!` };
    }

    // Modo online: RPC atômica no Supabase
    try {
      const { data, error } = await db()
        .rpc('buy_marketplace_car', { p_car_id: carId, p_buyer_name: buyerName });
      if (error || !data) return { success: false, message: 'Erro de conexão.' };
      if (data.success) {
        setListings(prev => prev.map(l =>
          l.id === carId ? { ...l, status: 'sold' as const, buyerName } : l
        ));
      }
      return { success: data.success, message: data.message };
    } catch { return { success: false, message: 'Erro de conexão.' }; }
  }, []);

  // ── Negociação (client-side) + compra atômica ───────────────
  const makeOfferGlobal = useCallback(async (
    carId: string,
    offerValue: number,
    buyerName: string,
    playerMoney: number,
    overdraftLimit: number
  ): Promise<{ success: boolean; message: string; finalPrice?: number }> => {
    const car = listingsRef.current.find(l => l.id === carId);
    if (!car)                  return { success: false, message: 'Carro não encontrado.' };
    if (car.status === 'sold') return { success: false, message: 'Este carro já foi vendido por outro jogador!' };
    if (offerValue <= 0)       return { success: false, message: 'Oferta inválida.' };

    // Piso da oferta: o maior entre 90 % do preço pedido e 22 % da FIPE.
    const minOffer = Math.max(
      Math.round(car.askingPrice * 0.90),
      Math.round(car.fipePrice * MIN_ASKING_PRICE_RATIO),
    );
    if (offerValue < minOffer)
      return { success: false, message: 'Vendedor recusou sua oferta.' };

    if (playerMoney - offerValue < overdraftLimit)
      return { success: false, message: 'Saldo insuficiente para esta oferta.' };

    const result = await buyGlobal(carId, buyerName);
    if (!result.success) return result;

    const discount = Math.round(((car.askingPrice - offerValue) / car.askingPrice) * 100);
    const msg = discount > 0
      ? `Desconto de ${discount}%! ${car.brand} ${car.model} por ${fmt(offerValue)}.`
      : `Oferta aceita! ${car.brand} ${car.model} adicionado à garagem.`;

    return { success: true, message: msg, finalPrice: offerValue };
  }, [buyGlobal]);

  // ── Countdown (atualiza a cada 30s) ─────────────────────────
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

  // ── Mount: carga inicial + Realtime + poll de fallback ───────────
  useEffect(() => {
    mountedRef.current = true;
    void loadMarketplace();

    // Supabase Realtime — propaga compras de outros jogadores instantaneamente.
    // Funciona quando o projeto tem Realtime habilitado na tabela marketplace_global.
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
                  ? {
                      ...l,
                      status:    'sold' as const,
                      buyerName: row.buyer_name ?? undefined,
                      soldAt:    row.sold_at    ?? undefined,
                    }
                  : l
              )
            );
          }
        }
      )
      .subscribe();

    // Poll de fallback (15 s) — cobre ambientes sem Realtime habilitado
    const poll = setInterval(async () => {
      if (!mountedRef.current) return;
      if (nextRefreshRef.current && Date.now() > nextRefreshRef.current.getTime()) {
        void loadMarketplace();
        return;
      }
      if (!isOnline) return;
      const cars = await fetchListings();
      if (cars && mountedRef.current) setListings(cars);
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      void db().removeChannel(realtimeChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { listings, loading, isOnline, minsLeft, loadMarketplace, buyGlobal, makeOfferGlobal };
}
