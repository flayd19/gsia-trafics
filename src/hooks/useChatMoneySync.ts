// =====================================================================
// useChatMoneySync — sincronização BACKGROUND de transferências de $ do chat
//
// Por quê: o hook completo `useChat` só monta quando o jogador abre a tela
// de chat. Mas créditos de dinheiro precisam ser aplicados ao saldo MESMO
// quando o jogador está em qualquer outra tela — caso contrário o autosave
// pode sobrescrever a coluna `money` do servidor com o valor antigo do
// JSONB, fazendo o crédito sumir.
//
// Este hook é leve: assina realtime na tabela `chat_messages` para mensagens
// `money_sent` envolvendo o usuário, e ao montar reconcilia retroativamente
// quaisquer mensagens que possam ter chegado offline.
//
// Idempotência via callbacks `onIncomingChatMoney(id, amount)` e
// `onOutgoingChatMoney(id, amount)` — o consumidor (useCarGameLogic) verifica
// se o ID já foi processado em `_processedChatMoneyIds` e ignora repetições.
// =====================================================================
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface UseChatMoneySyncOptions {
  /** Aplica crédito idempotente — só credita se id ainda não processado. */
  onIncomingChatMoney: (messageId: string, amount: number) => void;
  /** Aplica débito idempotente — só debita se id ainda não processado. */
  onOutgoingChatMoney: (messageId: string, amount: number) => void;
  /** Espera até este flag ficar true para começar a sincronizar (após game load). */
  enabled: boolean;
}

export function useChatMoneySync(opts: UseChatMoneySyncOptions): void {
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const myUserIdRef = useRef<string | null>(null);

  // ── Reconcilia mensagens money_sent existentes ────────────────
  const reconcile = useCallback(async () => {
    const uid = myUserIdRef.current;
    if (!uid) return;
    try {
      const { data } = await db()
        .from('chat_messages')
        .select('id, sender_id, receiver_id, payload')
        .eq('type', 'money_sent')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(100);
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const id     = row['id'] as string | undefined;
        const sender = row['sender_id'] as string | undefined;
        const recv   = row['receiver_id'] as string | undefined;
        const payload = row['payload'] as { amount?: number } | null;
        const amount = Number(payload?.amount ?? 0);
        if (!id || !amount || !Number.isFinite(amount) || amount <= 0) continue;
        if (recv === uid) {
          optsRef.current.onIncomingChatMoney(id, amount);
        } else if (sender === uid) {
          optsRef.current.onOutgoingChatMoney(id, amount);
        }
      }
    } catch {
      /* silencioso — best-effort */
    }
  }, []);

  // ── Mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof db>['channel'] | null = null;

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      myUserIdRef.current = user.id;

      // Reconciliação retroativa (recupera tudo que possa ter sido perdido)
      await reconcile();

      // Subscription realtime para créditos/débitos novos
      channel = db()
        .channel(`chat_money_sync_${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            if ((row['type'] as string) !== 'money_sent') return;
            const id     = row['id'] as string;
            const sender = row['sender_id'] as string;
            const recv   = row['receiver_id'] as string;
            const pl     = row['payload'] as { amount?: number } | null;
            const amount = Number(pl?.amount ?? 0);
            if (!id || !amount || !Number.isFinite(amount) || amount <= 0) return;
            if (recv === user.id) {
              optsRef.current.onIncomingChatMoney(id, amount);
            } else if (sender === user.id) {
              // Débito do remetente (quando enviamos por outro device, por ex.)
              optsRef.current.onOutgoingChatMoney(id, amount);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void db().removeChannel(channel);
      }
    };
  }, [opts.enabled, reconcile]);
}
