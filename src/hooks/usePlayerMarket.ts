import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  PlayerMarketListing,
  CreateListingInput,
  PurchaseResult,
  PayoutResult,
} from '@/types/game';
import { toast } from '@/hooks/use-toast';
import { safeCall, isLocalSession, throttledToast } from '@/lib/safeSync';

/**
 * Hook para o Mercado P2P entre jogadores.
 *
 * Comportamento resiliente:
 *  - Modo teste local (isLocalSession): não faz nenhum fetch, retorna listas vazias
 *  - Modo normal: usa safeCall (circuit breaker + timeout) em todas chamadas
 *  - Auto-refresh desliga quando o circuit está aberto (volta sozinho em 60s)
 */
export const usePlayerMarket = () => {
  const [activeListings, setActiveListings] = useState<PlayerMarketListing[]>([]);
  const [myListings, setMyListings] = useState<PlayerMarketListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Jogador');

  // Obter o usuário atual e seu nome
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Em modo teste local, pega direto do auth mock via supabase.auth (que vai retornar null),
      // então o hook fica com userId=null e os useEffects de fetch não rodam
      if (isLocalSession()) {
        if (!mounted) return;
        setUserId(null);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(user?.id ?? null);

      if (user) {
        const res = await safeCall(
          'p2p:profile',
          async () => {
            const { data, error } = await supabase
              .from('player_profiles')
              .select('display_name')
              .eq('user_id', user.id)
              .maybeSingle();
            if (error) throw error;
            return data;
          },
          { timeoutMs: 5_000 }
        );
        if (!mounted) return;
        const display =
          (res.data as { display_name?: string } | null)?.display_name ||
          user.email?.split('@')[0] ||
          'Jogador';
        setUserName(display);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // -------------------------------------------------------
  // Fetch ofertas ativas
  // -------------------------------------------------------
  const fetchActiveListings = useCallback(async () => {
    if (isLocalSession()) return;
    setLoading(true);
    setError(null);

    const res = await safeCall(
      'p2p:active',
      async () => {
        const { data, error } = await supabase
          .from('player_market_listings' as any)
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        return data;
      },
      { timeoutMs: 8_000 }
    );

    setLoading(false);

    if (res.ok) {
      const list = ((res.data ?? []) as unknown) as PlayerMarketListing[];
      setActiveListings(list.filter((l) => l.seller_id !== userId));
    } else if (!res.skipped) {
      setError('Falha ao buscar ofertas');
    }
  }, [userId]);

  // -------------------------------------------------------
  // Fetch minhas ofertas
  // -------------------------------------------------------
  const fetchMyListings = useCallback(async () => {
    if (isLocalSession() || !userId) return;
    setError(null);

    const res = await safeCall(
      'p2p:mine',
      async () => {
        const { data, error } = await supabase
          .from('player_market_listings' as any)
          .select('*')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        return data;
      },
      { timeoutMs: 8_000 }
    );

    if (res.ok) {
      setMyListings(((res.data ?? []) as unknown) as PlayerMarketListing[]);
    } else if (!res.skipped) {
      setError('Falha ao buscar minhas ofertas');
    }
  }, [userId]);

  // -------------------------------------------------------
  // Criar oferta
  // -------------------------------------------------------
  const createListing = useCallback(
    async (input: CreateListingInput): Promise<PlayerMarketListing | null> => {
      if (isLocalSession()) {
        toast({
          title: 'Indisponível em teste local',
          description: 'O Mercado P2P exige conta real.',
          variant: 'destructive',
        });
        return null;
      }
      if (!userId) {
        toast({
          title: 'Não autenticado',
          description: 'Faça login para usar o Mercado P2P',
          variant: 'destructive',
        });
        return null;
      }
      setError(null);

      const res = await safeCall(
        'p2p:create',
        async () => {
          const payload = {
            seller_id: userId,
            seller_name: userName,
            product_id: input.product_id,
            product_name: input.product_name,
            product_icon: input.product_icon ?? null,
            category: input.category ?? null,
            quantity: input.quantity,
            price_per_unit: input.price_per_unit,
            status: 'active',
          };
          const { data, error } = await supabase
            .from('player_market_listings' as any)
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        { timeoutMs: 10_000 }
      );

      if (res.ok && res.data) {
        const listing = (res.data as unknown) as PlayerMarketListing;
        setMyListings((prev) => [listing, ...prev]);
        toast({
          title: 'Oferta publicada!',
          description: `${input.quantity}x ${input.product_name}`,
        });
        return listing;
      }

      throttledToast('p2p-error', {
        title: 'Erro ao publicar oferta',
        description: 'Sem conexão com o servidor. Tente mais tarde.',
        variant: 'destructive',
      });
      return null;
    },
    [userId, userName]
  );

  // -------------------------------------------------------
  // Comprar (RPC atômica)
  // -------------------------------------------------------
  const purchaseListing = useCallback(
    async (listingId: string): Promise<PurchaseResult> => {
      if (isLocalSession()) {
        return { success: false, message: 'Indisponível em teste local' };
      }
      if (!userId) {
        return { success: false, message: 'Usuário não autenticado' };
      }

      const res = await safeCall(
        'p2p:purchase',
        async () => {
          const { data, error } = await supabase.rpc(
            'purchase_market_listing' as any,
            { p_listing_id: listingId }
          );
          if (error) throw error;
          return data;
        },
        { timeoutMs: 10_000 }
      );

      if (!res.ok) {
        return {
          success: false,
          message: res.skipped
            ? 'Servidor indisponível'
            : 'Falha ao comprar',
        };
      }

      const result = (res.data as unknown) as PurchaseResult;
      if (result?.success) {
        setActiveListings((prev) => prev.filter((l) => l.id !== listingId));
      }
      return result ?? { success: false, message: 'Resposta vazia do servidor' };
    },
    [userId]
  );

  // -------------------------------------------------------
  // Cancelar
  // -------------------------------------------------------
  const cancelListing = useCallback(async (listingId: string): Promise<boolean> => {
    if (isLocalSession()) return false;

    const res = await safeCall(
      'p2p:cancel',
      async () => {
        const { data, error } = await supabase.rpc('cancel_market_listing' as any, {
          p_listing_id: listingId,
        });
        if (error) throw error;
        return data;
      },
      { timeoutMs: 10_000 }
    );

    if (!res.ok) {
      throttledToast('p2p-error', {
        title: 'Erro ao cancelar',
        description: 'Sem conexão com o servidor.',
        variant: 'destructive',
      });
      return false;
    }

    const result = res.data as { success: boolean; message?: string };
    if (result?.success) {
      setMyListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: 'cancelled' as const } : l))
      );
      toast({ title: 'Oferta cancelada' });
      return true;
    }
    toast({
      title: 'Falha ao cancelar',
      description: result?.message,
      variant: 'destructive',
    });
    return false;
  }, []);

  // -------------------------------------------------------
  // Coletar pagamentos
  // -------------------------------------------------------
  const collectPayouts = useCallback(async (): Promise<PayoutResult> => {
    if (isLocalSession()) {
      return { success: false, total: 0, count: 0, listings: [], message: 'Modo teste local' };
    }
    if (!userId) {
      return { success: false, total: 0, count: 0, listings: [], message: 'Não autenticado' };
    }

    const res = await safeCall(
      'p2p:payouts',
      async () => {
        const { data, error } = await supabase.rpc('collect_market_payouts' as any);
        if (error) throw error;
        return data;
      },
      { timeoutMs: 10_000 }
    );

    if (!res.ok) {
      return {
        success: false,
        total: 0,
        count: 0,
        listings: [],
        message: res.skipped ? 'Servidor indisponível' : 'Falha ao coletar',
      };
    }

    const result = (res.data as unknown) as PayoutResult;
    if (result?.count > 0) {
      void fetchMyListings();
    }
    return result ?? { success: false, total: 0, count: 0, listings: [] };
  }, [userId, fetchMyListings]);

  // -------------------------------------------------------
  // Auto-refresh (desabilitado em modo local)
  // -------------------------------------------------------
  useEffect(() => {
    if (isLocalSession() || !userId) return;
    void fetchActiveListings();
    void fetchMyListings();
    const interval = setInterval(() => {
      void fetchActiveListings();
      void fetchMyListings();
    }, 30_000);
    return () => clearInterval(interval);
  }, [userId, fetchActiveListings, fetchMyListings]);

  return {
    activeListings,
    myListings,
    loading,
    error,
    userId,
    userName,
    fetchActiveListings,
    fetchMyListings,
    createListing,
    purchaseListing,
    cancelListing,
    collectPayouts,
  };
};
