// =====================================================================
// useAuctions — hook do sistema de leilões (6h, 25 carros por ciclo)
//
// Responsabilidades:
//   • Listar leilões abertos
//   • Garantir que existe um batch ativo (chama populate_auctions_batch
//     se não há leilões abertos no momento)
//   • Colocar lance via RPC place_auction_bid
//   • Finalizar leilões expirados (cliente que vê expiração dispara)
//   • Listar carros ganhos pendentes de claim e reclamá-los
//   • Realtime: atualizações de lances chegam automaticamente
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildMarketplaceInventory } from '@/data/cars';
import type { OwnedCar, CarAttributes } from '@/types/game';

/** Gera atributos iniciais distribuídos em torno da condição geral (±15). */
function generateAttributes(condition: number): CarAttributes {
  const spread = 15;
  const rand = () => Math.round(condition + (Math.random() * spread * 2 - spread));
  return {
    body:       Math.min(100, Math.max(0, rand())),
    mechanical: Math.min(100, Math.max(0, rand())),
    electrical: Math.min(100, Math.max(0, rand())),
    interior:   Math.min(100, Math.max(0, rand())),
  };
}

// ── Tipos ──────────────────────────────────────────────────────────

export interface AuctionItem {
  id:                 string;
  modelId:            string;
  variantId:          string;
  brand:              string;
  model:              string;
  trim:               string;
  year:               number;
  fipePrice:          number;
  condition:          number;
  mileage:            number;
  icon:               string;
  category:           string;
  endsAt:             string;       // ISO
  status:             'open' | 'closed' | 'paid';
  highestBid:         number | null;
  highestBidderId:    string | null;
  highestBidderName:  string | null;
  bidCount:           number;
}

export interface AuctionWinning {
  id:           string;
  auctionId:    string;
  carData:      Record<string, unknown>;
  amountPaid:   number;
  claimed:      boolean;
  createdAt:    string;
}

export interface UseAuctionsResult {
  auctions:        AuctionItem[];
  winnings:        AuctionWinning[];
  loading:         boolean;
  myUserId:        string | null;
  refresh:         () => Promise<void>;
  placeBid:        (auctionId: string, amount: number) => Promise<{ success: boolean; message: string }>;
  claimWinning:    (winningId: string) => Promise<{ success: boolean; message: string }>;
}

// ── Mapeamento de rows → tipos ────────────────────────────────────

function rowToAuction(row: Record<string, unknown>): AuctionItem {
  return {
    id:                row['id']                 as string,
    modelId:           row['model_id']           as string,
    variantId:         row['variant_id']         as string,
    brand:             row['brand']              as string,
    model:             row['model']              as string,
    trim:              (row['trim']              as string) ?? '',
    year:              Number(row['year']        ?? 0),
    fipePrice:         Number(row['fipe_price']  ?? 0),
    condition:         Number(row['condition_pct'] ?? 0),
    mileage:           Number(row['mileage']     ?? 0),
    icon:              (row['icon']              as string) ?? '🚗',
    category:          (row['category']          as string) ?? '',
    endsAt:            row['ends_at']            as string,
    status:            (row['status']            as AuctionItem['status']) ?? 'open',
    highestBid:        row['highest_bid']        != null ? Number(row['highest_bid']) : null,
    highestBidderId:   (row['highest_bidder_id']   as string | null) ?? null,
    highestBidderName: (row['highest_bidder_name'] as string | null) ?? null,
    bidCount:          Number(row['bid_count']   ?? 0),
  };
}

function rowToWinning(row: Record<string, unknown>): AuctionWinning {
  return {
    id:         row['id'] as string,
    auctionId:  row['auction_id'] as string,
    carData:    (row['car_data'] as Record<string, unknown>) ?? {},
    amountPaid: Number(row['amount_paid'] ?? 0),
    claimed:    !!row['claimed'],
    createdAt:  row['created_at'] as string,
  };
}

// ── Opções ────────────────────────────────────────────────────────

export interface UseAuctionsOptions {
  /** Saldo atual — para validar lances localmente antes da RPC. */
  currentMoney: number;
  /** Limite do cheque especial. */
  overdraftLimit: number;
  /** Adiciona o carro ganho à garagem do jogador. */
  onAddCarToGarage: (car: OwnedCar) => { success: boolean; message: string };
}

// ── Hook ──────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useAuctions(opts: UseAuctionsOptions): UseAuctionsResult {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [winnings, setWinnings] = useState<AuctionWinning[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const myUserIdRef = useRef<string | null>(null);
  const optsRef     = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  // ── Carrega usuário ─────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        myUserIdRef.current = user.id;
        setMyUserId(user.id);
      }
    })();
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────

  const loadAuctions = useCallback(async () => {
    const { data } = await db()
      .from('auctions')
      .select('*')
      .eq('status', 'open')
      .order('ends_at', { ascending: true })
      .limit(100);
    const list: AuctionItem[] = (data ?? []).map(rowToAuction);
    setAuctions(list);
    return list;
  }, []);

  const loadWinnings = useCallback(async () => {
    const uid = myUserIdRef.current;
    if (!uid) return;
    const { data } = await db()
      .from('auction_winnings')
      .select('*')
      .eq('user_id', uid)
      .eq('claimed', false)
      .order('created_at', { ascending: false });
    const list: AuctionWinning[] = (data ?? []).map(rowToWinning);
    setWinnings(list);
  }, []);

  /**
   * Garante que existe um batch ativo. Se não houver leilões abertos,
   * tenta popular um batch novo (cooldown de 6h gerenciado pelo servidor).
   */
  const ensureBatch = useCallback(async (currentList: AuctionItem[]) => {
    if (currentList.length > 0) return;
    // Gera 25 candidatos a partir do inventário do mercado, embaralhado
    const inventory = buildMarketplaceInventory();
    const sample    = inventory
      .map(c => ({ c, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, 25);
    const rows = sample.map((s, idx) => ({
      id:            `${s.c.variantId}_b0_${idx}`,
      model_id:      s.c.modelId,
      variant_id:    s.c.variantId,
      brand:         s.c.brand,
      model:         s.c.model,
      trim:          s.c.trim,
      year:          s.c.year,
      fipe_price:    s.c.fipePrice,
      condition_pct: s.c.condition,
      mileage:       s.c.mileage,
      icon:          s.c.icon,
      category:      s.c.category,
    }));
    try {
      const { data, error } = await db().rpc('populate_auctions_batch', { p_rows: rows });
      if (error) return;
      const result = data as { claimed: boolean; inserted?: number };
      if (result?.claimed && (result.inserted ?? 0) > 0) {
        await loadAuctions();
      }
    } catch { /* ignora — outro cliente popula */ }
  }, [loadAuctions]);

  // ── Finaliza leilões expirados (no client que detecta) ──────────
  const finalizeExpired = useCallback(async (list: AuctionItem[]) => {
    const now = Date.now();
    const expired = list.filter(a => a.status === 'open' && new Date(a.endsAt).getTime() <= now);
    for (const a of expired) {
      try {
        await db().rpc('finalize_auction', { p_auction_id: a.id });
      } catch { /* idempotente — outro client pode ter finalizado */ }
    }
    if (expired.length > 0) {
      await loadAuctions();
      await loadWinnings();
    }
  }, [loadAuctions, loadWinnings]);

  // ── Refresh combinado ───────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadAuctions();
      await ensureBatch(list);
      await finalizeExpired(list);
      await loadWinnings();
    } finally {
      setLoading(false);
    }
  }, [loadAuctions, ensureBatch, finalizeExpired, loadWinnings]);

  // ── Mount + realtime + tick para finalizar expirados ────────────
  useEffect(() => {
    if (!myUserId) return;
    void refresh();

    // Realtime para auctions e winnings
    const auctionsChannel = db()
      .channel('auctions-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => { void loadAuctions(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_winnings' },
        () => { void loadWinnings(); },
      )
      .subscribe();

    // Tick a cada 30s para detectar expirações + ensure batch
    const tick = setInterval(() => { void refresh(); }, 30_000);

    return () => {
      void db().removeChannel(auctionsChannel);
      clearInterval(tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

  // ── Ações ───────────────────────────────────────────────────────
  const placeBid = useCallback(async (auctionId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Valor inválido.' };
    }
    if (amount > optsRef.current.currentMoney - optsRef.current.overdraftLimit) {
      return { success: false, message: 'Saldo + cheque especial insuficiente.' };
    }
    try {
      const { error } = await db().rpc('place_auction_bid', {
        p_auction_id: auctionId,
        p_amount:     amount,
      });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('bid_too_low'))         return { success: false, message: 'Lance precisa superar o atual.' };
        if (msg.includes('auction_closed'))      return { success: false, message: 'Leilão já encerrou.' };
        if (msg.includes('insufficient_balance')) return { success: false, message: 'Saldo insuficiente.' };
        if (msg.includes('auction_not_found'))   return { success: false, message: 'Leilão não encontrado.' };
        return { success: false, message: 'Falha ao colocar lance.' };
      }
      // Atualização vem via realtime — mas força refresh imediato
      void loadAuctions();
      return { success: true, message: 'Lance registrado!' };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, [loadAuctions]);

  const claimWinning = useCallback(async (winningId: string) => {
    try {
      const { data, error } = await db().rpc('claim_auction_winning', { p_winning_id: winningId });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('already_claimed')) return { success: false, message: 'Carro já reclamado.' };
        if (msg.includes('not_winner'))      return { success: false, message: 'Você não venceu este leilão.' };
        return { success: false, message: 'Falha ao reclamar carro.' };
      }
      const result = data as { car_data: Record<string, unknown>; amount_paid: number } | null;
      if (!result?.car_data) {
        return { success: false, message: 'Dados do carro indisponíveis.' };
      }
      // Constrói OwnedCar a partir do car_data
      const cd = result.car_data;
      const condition = Number(cd.condition ?? 50);
      const car: OwnedCar = {
        instanceId:    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        modelId:       String(cd.modelId),
        variantId:     String(cd.variantId),
        fullName:      `${cd.brand} ${cd.model} ${cd.trim ?? ''}`.trim(),
        brand:         String(cd.brand),
        model:         String(cd.model),
        trim:          String(cd.trim ?? ''),
        year:          Number(cd.year ?? 0),
        icon:          String(cd.icon ?? '🚗'),
        fipePrice:     Number(cd.fipePrice ?? 0),
        condition,
        mileage:       Number(cd.mileage ?? 0),
        purchasePrice: Number(result.amount_paid ?? 0),
        purchasedAt:   Date.now(),
        completedRepairs: [],
        attributes:    generateAttributes(condition),
        acquiredFrom:  'auction',
      };
      const r = optsRef.current.onAddCarToGarage(car);
      void loadWinnings();
      return r;
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, [loadWinnings]);

  return {
    auctions,
    winnings,
    loading,
    myUserId,
    refresh,
    placeBid,
    claimWinning,
  };
}
