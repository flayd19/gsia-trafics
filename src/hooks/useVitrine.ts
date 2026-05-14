// =====================================================================
// useVitrine.ts — Vitrine public marketplace hook
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { VitrineOffer, FreightCall, PublishOfferForm, BuyOfferForm } from '@/types/vitrine';
import type { PMREntry } from '@/types/cadeia';

function pmrTag(price: number, pmr: number): 'green' | 'yellow' | 'red' {
  if (pmr <= 0) return 'yellow';
  const ratio = price / pmr;
  if (ratio <= 0.95) return 'green';
  if (ratio <= 1.05) return 'yellow';
  return 'red';
}

function rowToOffer(row: Record<string, unknown>, pmrList: PMREntry[]): VitrineOffer {
  const pmrEntry = pmrList.find(
    (p) => p.productId === row.product_id && p.regionId === row.region_id,
  );
  const offer: VitrineOffer = {
    id:           row.id as string,
    sellerId:     row.seller_id as string,
    sellerName:   row.seller_name as string,
    companyId:    row.company_id as string,
    companyName:  row.company_name as string,
    productId:    row.product_id as string,
    productName:  row.product_name as string,
    regionId:     row.region_id as string,
    totalQty:     Number(row.total_qty),
    availableQty: Number(row.available_qty),
    pricePerUnit: Number(row.price_per_unit),
    minQty:       Number(row.min_qty ?? 1),
    paymentTerms: (row.payment_terms as 'avista' | 'parcelado') ?? 'avista',
    installments: Number(row.installments ?? 1),
    status:       row.status as VitrineOffer['status'],
    expiresAt:    row.expires_at as string | null,
    createdAt:    row.created_at as string,
  };
  if (pmrEntry) {
    offer.pmrTag = pmrTag(offer.pricePerUnit, pmrEntry.price);
  }
  return offer;
}

export interface UseVitrineReturn {
  offers:        VitrineOffer[];
  myOffers:      VitrineOffer[];
  freightCalls:  FreightCall[];
  loading:       boolean;
  error:         string | null;
  publishOffer:  (form: PublishOfferForm) => Promise<{ ok: boolean; error?: string }>;
  buyOffer:      (form: BuyOfferForm, playerCapital: number) => Promise<{ ok: boolean; error?: string; costTotal?: number }>;
  cancelOffer:   (offerId: string) => Promise<{ ok: boolean; error?: string }>;
  acceptFreight: (freightId: string, carrierCompanyId: string) => Promise<{ ok: boolean; error?: string }>;
  deliverFreight:(freightId: string) => Promise<{ ok: boolean; error?: string }>;
  refresh:       () => Promise<void>;
}

export function useVitrine(pmrList: PMREntry[] = []): UseVitrineReturn {
  const { user } = useAuth();
  const [offers, setOffers]               = useState<VitrineOffer[]>([]);
  const [freightCalls, setFreightCalls]   = useState<FreightCall[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('vitrine_offers')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (e) throw e;
      setOffers((data ?? []).map((r) => rowToOffer(r as Record<string, unknown>, pmrList)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vitrine');
    } finally {
      setLoading(false);
    }
  }, [pmrList]);

  const fetchFreight = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: e } = await supabase
        .from('freight_calls')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id},carrier_id.eq.${user.id}`)
        .in('status', ['open', 'accepted', 'in_transit'])
        .order('created_at', { ascending: false });

      if (e) throw e;
      setFreightCalls(
        (data ?? []).map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id:               row.id as string,
            originOfferId:    row.origin_offer_id as string | null,
            buyerId:          row.buyer_id as string,
            buyerName:        row.buyer_name as string,
            sellerId:         row.seller_id as string,
            originRegionId:   row.origin_region_id as string,
            destRegionId:     row.dest_region_id as string,
            productId:        row.product_id as string,
            productName:      row.product_name as string,
            qty:              Number(row.qty),
            freightValue:     Number(row.freight_value),
            carrierId:        row.carrier_id as string | null,
            carrierName:      row.carrier_name as string | null,
            carrierCompanyId: row.carrier_company_id as string | null,
            acceptedAt:       row.accepted_at as string | null,
            expectedBy:       row.expected_by as string | null,
            deliveredAt:      row.delivered_at as string | null,
            status:           row.status as FreightCall['status'],
            createdAt:        row.created_at as string,
          } satisfies FreightCall;
        }),
      );
    } catch {
      // freight fetch is non-critical
    }
  }, [user]);

  useEffect(() => {
    fetchOffers();
    fetchFreight();
  }, [fetchOffers, fetchFreight]);

  const myOffers = user
    ? offers.filter((o) => o.sellerId === user.id)
    : [];

  const publishOffer = useCallback(
    async (form: PublishOfferForm): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const sellerName = (profile as { display_name?: string } | null)?.display_name ?? user.email ?? 'Anônimo';

      const { error: e } = await supabase.from('vitrine_offers').insert({
        seller_id:     user.id,
        seller_name:   sellerName,
        company_id:    form.companyId,
        company_name:  form.companyName,
        product_id:    form.productId,
        product_name:  form.productName,
        region_id:     form.regionId,
        total_qty:     form.totalQty,
        available_qty: form.totalQty,
        price_per_unit: form.pricePerUnit,
        min_qty:       form.minQty,
        payment_terms: form.paymentTerms,
        installments:  form.installments,
      });
      if (e) return { ok: false, error: e.message };
      await fetchOffers();
      return { ok: true };
    },
    [user, fetchOffers],
  );

  const buyOffer = useCallback(
    async (
      form: BuyOfferForm,
      playerCapital: number,
    ): Promise<{ ok: boolean; error?: string; costTotal?: number }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };

      const offer = offers.find((o) => o.id === form.offerId);
      if (!offer) return { ok: false, error: 'Oferta não encontrada' };
      if (form.qty < offer.minQty)
        return { ok: false, error: `Quantidade mínima: ${offer.minQty}` };
      if (form.qty > offer.availableQty)
        return { ok: false, error: 'Quantidade indisponível' };

      const freightValue = Math.max(50, offer.pricePerUnit * form.qty * 0.05);
      const productCost  = offer.pricePerUnit * form.qty;
      const costTotal    = productCost + freightValue;

      if (playerCapital < costTotal)
        return { ok: false, error: `Saldo insuficiente (R$ ${costTotal.toFixed(2)})` };

      // Decrement available_qty
      const { error: updateErr } = await supabase
        .from('vitrine_offers')
        .update({ available_qty: offer.availableQty - form.qty })
        .eq('id', offer.id);
      if (updateErr) return { ok: false, error: updateErr.message };

      // Create freight call
      const { data: freight, error: freightErr } = await supabase
        .from('freight_calls')
        .insert({
          origin_offer_id:  offer.id,
          buyer_id:         user.id,
          buyer_name:       user.email ?? 'Comprador',
          seller_id:        offer.sellerId,
          origin_region_id: offer.regionId,
          dest_region_id:   form.destRegionId,
          product_id:       offer.productId,
          product_name:     offer.productName,
          qty:              form.qty,
          freight_value:    freightValue,
        })
        .select()
        .single();
      if (freightErr) return { ok: false, error: freightErr.message };

      // Create escrow
      const freightRow = freight as Record<string, unknown>;
      await supabase.from('escrow_holds').insert({
        freight_call_id: freightRow.id,
        buyer_id:        user.id,
        seller_id:       offer.sellerId,
        product_value:   productCost,
        freight_value:   freightValue,
      });

      await Promise.all([fetchOffers(), fetchFreight()]);
      return { ok: true, costTotal };
    },
    [user, offers, fetchOffers, fetchFreight],
  );

  const cancelOffer = useCallback(
    async (offerId: string): Promise<{ ok: boolean; error?: string }> => {
      const { error: e } = await supabase
        .from('vitrine_offers')
        .update({ status: 'cancelled' })
        .eq('id', offerId)
        .eq('seller_id', user?.id);
      if (e) return { ok: false, error: e.message };
      await fetchOffers();
      return { ok: true };
    },
    [user, fetchOffers],
  );

  const acceptFreight = useCallback(
    async (freightId: string, carrierCompanyId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      const { error: e } = await supabase
        .from('freight_calls')
        .update({
          carrier_id:         user.id,
          carrier_name:       user.email ?? 'Transportador',
          carrier_company_id: carrierCompanyId,
          accepted_at:        new Date().toISOString(),
          status:             'accepted',
        })
        .eq('id', freightId)
        .eq('status', 'open');
      if (e) return { ok: false, error: e.message };
      await fetchFreight();
      return { ok: true };
    },
    [user, fetchFreight],
  );

  const deliverFreight = useCallback(
    async (freightId: string): Promise<{ ok: boolean; error?: string }> => {
      const now = new Date().toISOString();
      const { error: e } = await supabase
        .from('freight_calls')
        .update({ delivered_at: now, status: 'delivered' })
        .eq('id', freightId)
        .eq('carrier_id', user?.id);
      if (e) return { ok: false, error: e.message };

      // Release escrow to seller
      await supabase
        .from('escrow_holds')
        .update({ status: 'released_seller', released_at: now })
        .eq('freight_call_id', freightId);

      await fetchFreight();
      return { ok: true };
    },
    [user, fetchFreight],
  );

  return {
    offers,
    myOffers,
    freightCalls,
    loading,
    error,
    publishOffer,
    buyOffer,
    cancelOffer,
    acceptFreight,
    deliverFreight,
    refresh: async () => { await Promise.all([fetchOffers(), fetchFreight()]); },
  };
}
