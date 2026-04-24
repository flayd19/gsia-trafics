/**
 * useGlobalMarketplace — Marketplace compartilhado entre todos os jogadores.
 *
 * - Todos os usuários veem os mesmos carros (tabela marketplace_global no Supabase)
 * - Quando alguém compra, o carro fica marcado como "Vendido para [nome]"
 * - A cada 30 minutos o inventário é renovado (novos carros entram)
 * - O primeiro usuário a carregar após 30 min "ganha" o slot de refresh e publica o novo lote
 * - Poll a cada 60s para refletir compras de outros jogadores em tempo real
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

const REFRESH_MS = 30 * 60 * 1000; // 30 minutos
const POLL_MS    = 60 * 1000;       // poll a cada 60s
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
    id:           `${car.variantId}_b${batchId}`,
    model_id:     car.modelId,
    variant_id:   car.variantId,
    brand:        car.brand,
    model:        car.model,
    trim:         car.trim,
    year:         car.year,
    fipe_price:   car.fipePrice,
    asking_price: car.askingPrice,
    condition_pct: car.condition,
    icon:         car.icon,
    category:     car.category,
    seller_name:  car.seller,
    status:       'available',
    batch_id:     batchId,
  }));
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function useGlobalMarketplace() {
  const [listings, setListings]           = useState<GlobalCar[]>([]);
  const [loading, setLoading]             = useState(true);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [minsLeft, setMinsLeft]           = useState<number | null>(null);
  const mountedRef                        = useRef(true);
  const nextRefreshRef                    = useRef<Date | null>(null);

  // ── Fetch current listings from Supabase ────────────────────
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

  // ── Full load: check freshness, maybe refresh, fetch all ────
  const loadMarketplace = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      // Get meta
      const { data: meta } = await db()
        .from('marketplace_meta')
        .select('last_refresh, batch_id')
        .eq('id', 1)
        .maybeSingle();

      const lastMs  = meta?.last_refresh ? new Date(meta.last_refresh).getTime() : 0;
      const ageMs   = Date.now() - lastMs;
      const stale   = ageMs >= REFRESH_MS || !meta;

      if (stale) {
        // Try to claim the refresh slot (atomic UPDATE that only succeeds once)
        const { data: newBatch } = await db().rpc('try_claim_marketplace_refresh');

        if (newBatch != null) {
          // We won — generate new inventory and push to Supabase
          const freshCars = buildMarketplaceInventory();
          const rows      = carsToRows(freshCars, newBatch as number);

          // Purge old batches then insert new
          await db().from('marketplace_global').delete().lt('batch_id', newBatch);
          await db().from('marketplace_global').insert(rows);
        }
        // (if newBatch === null, another client already claimed it — just fetch below)
      }

      // Re-read meta for next refresh time
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

      // Fetch listings
      const cars = await fetchListings();
      if (cars && mountedRef.current) setListings(cars);
    } catch { /* Supabase indisponível — listagem fica vazia */ }
    finally { if (mountedRef.current) setLoading(false); }
  }, [fetchListings]);

  // ── Atomic buy via RPC ───────────────────────────────────────
  const buyGlobal = useCallback(async (
    carId: string,
    buyerName: string
  ): Promise<{ success: boolean; message: string }> => {
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

  // ── Make offer (client-side negotiation, then atomic buy) ───
  const makeOfferGlobal = useCallback(async (
    carId: string,
    offerValue: number,
    buyerName: string,
    playerMoney: number,
    overdraftLimit: number
  ): Promise<{ success: boolean; message: string; finalPrice?: number }> => {
    const car = listings.find(l => l.id === carId);
    if (!car)               return { success: false, message: 'Carro não encontrado.' };
    if (car.status === 'sold') return { success: false, message: 'Este carro já foi vendido por outro jogador!' };
    if (offerValue <= 0)    return { success: false, message: 'Oferta inválida.' };
    if (playerMoney - offerValue < overdraftLimit)
      return { success: false, message: 'Saldo insuficiente para esta oferta.' };

    const accepted = offerValue >= car.askingPrice * 0.80
      ? true
      : Math.random() < (offerValue / car.askingPrice) * 0.85;

    if (!accepted)
      return { success: false, message: `Proposta de ${fmt(offerValue)} recusada. Tente um valor maior.` };

    const result = await buyGlobal(carId, buyerName);
    if (!result.success) return result;

    const msg = offerValue >= car.askingPrice * 0.90
      ? `Oferta aceita! ${car.brand} ${car.model} na garagem.`
      : `Desconto de ${Math.round(((car.askingPrice - offerValue) / car.askingPrice) * 100)}%! ${car.brand} ${car.model} por ${fmt(offerValue)}.`;

    return { success: true, message: msg, finalPrice: offerValue };
  }, [listings, buyGlobal]);

  // ── Countdown timer (atualiza a cada 30s) ───────────────────
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

  // ── Mount: load + poll ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    void loadMarketplace();

    const poll = setInterval(async () => {
      if (!mountedRef.current) return;
      // Refresh completo se passou 30 min
      if (nextRefreshRef.current && Date.now() > nextRefreshRef.current.getTime()) {
        void loadMarketplace();
        return;
      }
      // Senão só atualiza quem comprou
      const cars = await fetchListings();
      if (cars && mountedRef.current) setListings(cars);
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
    };
  }, []);

  return { listings, loading, minsLeft, loadMarketplace, buyGlobal, makeOfferGlobal };
}
