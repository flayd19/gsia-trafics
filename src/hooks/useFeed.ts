// =====================================================================
// useFeed.ts — Social feed "O Diário" hook
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type FeedEventType =
  | 'company_created'
  | 'company_sold'
  | 'big_sale'
  | 'big_purchase'
  | 'loan_taken'
  | 'loan_paid'
  | 'upgrade_applied'
  | 'vitrine_offer'
  | 'freight_delivered'
  | 'bank_deposit'
  | 'manual_post';

export interface FeedEvent {
  id:          string;
  userId:      string;
  playerName:  string;
  eventType:   FeedEventType;
  payload:     Record<string, unknown>;
  text:        string;
  isPublic:    boolean;
  createdAt:   string;
  reactions:   { emoji: string; count: number; myReaction: boolean }[];
}

function rowToEvent(
  row: Record<string, unknown>,
  userId: string | undefined,
  reactionRows: Record<string, unknown>[],
): FeedEvent {
  const eventReactions = reactionRows.filter((r) => r.event_id === row.id);

  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of eventReactions) {
    const emoji = r.emoji as string;
    if (!grouped[emoji]) grouped[emoji] = { count: 0, mine: false };
    grouped[emoji]!.count++;
    if (r.user_id === userId) grouped[emoji]!.mine = true;
  }

  return {
    id:         row.id as string,
    userId:     row.user_id as string,
    playerName: row.player_name as string,
    eventType:  row.event_type as FeedEventType,
    payload:    (row.payload as Record<string, unknown>) ?? {},
    text:       row.text as string,
    isPublic:   row.is_public as boolean,
    createdAt:  row.created_at as string,
    reactions:  Object.entries(grouped).map(([emoji, { count, mine }]) => ({
      emoji,
      count,
      myReaction: mine,
    })),
  };
}

export interface UseFeedReturn {
  events:     FeedEvent[];
  loading:    boolean;
  error:      string | null;
  postEvent:  (text: string, eventType?: FeedEventType, payload?: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  react:      (eventId: string, emoji: string) => Promise<void>;
  refresh:    () => Promise<void>;
  publishGameEvent: (
    eventType: FeedEventType,
    text: string,
    payload?: Record<string, unknown>,
    isPublic?: boolean,
  ) => Promise<void>;
}

export function useFeed(): UseFeedReturn {
  const { user } = useAuth();
  const [events,  setEvents]  = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: eventsData, error: evErr } = await supabase
        .from('feed_events')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (evErr) throw evErr;

      const eventIds = (eventsData ?? []).map((e) => e.id as string);

      let reactionsData: Record<string, unknown>[] = [];
      if (eventIds.length > 0) {
        const { data: rd } = await supabase
          .from('feed_reactions')
          .select('*')
          .in('event_id', eventIds);
        reactionsData = (rd ?? []) as Record<string, unknown>[];
      }

      setEvents(
        (eventsData ?? []).map((row) =>
          rowToEvent(row as Record<string, unknown>, user?.id, reactionsData),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar feed');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const postEvent = useCallback(
    async (
      text: string,
      eventType: FeedEventType = 'manual_post',
      payload: Record<string, unknown> = {},
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };

      const { data: profile } = await supabase
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const playerName = (profile as { display_name?: string } | null)?.display_name ?? user.email ?? 'Anônimo';

      const { error: e } = await supabase.from('feed_events').insert({
        user_id:     user.id,
        player_name: playerName,
        event_type:  eventType,
        payload,
        text,
        is_public:   true,
      });
      if (e) return { ok: false, error: e.message };
      await fetchFeed();
      return { ok: true };
    },
    [user, fetchFeed],
  );

  const publishGameEvent = useCallback(
    async (
      eventType: FeedEventType,
      text: string,
      payload: Record<string, unknown> = {},
      isPublic = true,
    ) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const playerName = (profile as { display_name?: string } | null)?.display_name ?? user.email ?? 'Anônimo';

      await supabase.from('feed_events').insert({
        user_id:     user.id,
        player_name: playerName,
        event_type:  eventType,
        payload,
        text,
        is_public:   isPublic,
      });
    },
    [user],
  );

  const react = useCallback(
    async (eventId: string, emoji: string) => {
      if (!user) return;
      // Toggle: if already reacted, remove; otherwise add
      const existing = await supabase
        .from('feed_reactions')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing.data) {
        await supabase.from('feed_reactions').delete().eq('id', (existing.data as { id: string }).id);
      } else {
        await supabase.from('feed_reactions').insert({ event_id: eventId, user_id: user.id, emoji });
      }
      await fetchFeed();
    },
    [user, fetchFeed],
  );

  return { events, loading, error, postEvent, react, refresh: fetchFeed, publishGameEvent };
}
