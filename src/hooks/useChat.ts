// =====================================================================
// useChat — hook do sistema de chat entre jogadores
//
// Responsabilidades:
//   • Listar threads (conversas) do usuário com última mensagem + unread
//   • Carregar mensagens de uma conversa específica (paginado simples)
//   • Enviar texto, dinheiro (RPC atômica) e carro (RPC + remoção da garagem)
//   • Reclamar carros recebidos (RPC + add à garagem do destinatário)
//   • Listar todos os jogadores cadastrados (player_profiles)
//   • Realtime: novas mensagens chegam automaticamente
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedCar } from '@/types/game';

// ── Tipos públicos ────────────────────────────────────────────────────

export type ChatMessageType = 'text' | 'money_sent' | 'car_sent';

export interface ChatMessage {
  id:         string;
  senderId:   string;
  receiverId: string;
  type:       ChatMessageType;
  content:    string | null;
  payload:    {
    amount?:          number;
    car?:             OwnedCar;
    car_instance_id?: string;
    claimed?:         boolean;
  } | null;
  createdAt:  string;
  readAt:     string | null;
}

export interface ChatThread {
  otherUserId:    string;
  otherName:      string;
  lastMessageId:  string;
  lastType:       ChatMessageType;
  lastContent:    string | null;
  lastPayload:    ChatMessage['payload'];
  lastSenderId:   string;
  lastCreatedAt:  string;
  unreadCount:    number;
}

export interface PlayerListEntry {
  userId:      string;
  displayName: string;
  level:       number;
  patrimony:   number;
}

// ── Helpers de mapeamento ─────────────────────────────────────────────

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id:         row['id']           as string,
    senderId:   row['sender_id']    as string,
    receiverId: row['receiver_id']  as string,
    type:       row['type']         as ChatMessageType,
    content:    (row['content']     as string | null) ?? null,
    payload:    (row['payload']     as ChatMessage['payload']) ?? null,
    createdAt:  row['created_at']   as string,
    readAt:     (row['read_at']     as string | null) ?? null,
  };
}

function rowToThread(row: Record<string, unknown>): ChatThread {
  return {
    otherUserId:    row['other_user_id']  as string,
    otherName:      (row['other_name']    as string) ?? 'Jogador',
    lastMessageId:  row['last_message_id']  as string,
    lastType:       row['last_type']        as ChatMessageType,
    lastContent:    (row['last_content']    as string | null) ?? null,
    lastPayload:    (row['last_payload']    as ChatMessage['payload']) ?? null,
    lastSenderId:   row['last_sender_id']   as string,
    lastCreatedAt:  row['last_created_at']  as string,
    unreadCount:    Number(row['unread_count'] ?? 0),
  };
}

// ── Opções do hook ────────────────────────────────────────────────────

export interface UseChatOptions {
  /** Saldo atual do jogador — para validar envios antes de chamar a RPC. */
  currentMoney: number;
  /** Callback após enviar dinheiro: ajusta saldo local imediatamente. */
  onMoneyDeducted: (amount: number) => void;
  /** Callback após enviar carro: remove carro da garagem local. */
  onCarRemoved: (carInstanceId: string) => void;
  /** Callback ao reclamar carro: adiciona à garagem local. */
  onCarClaimed: (car: OwnedCar) => { success: boolean; message: string };
  /** Callback ao reclamar dinheiro/notificação: ajusta saldo se receber dinheiro novo. */
  onMoneyReceived?: (amount: number) => void;
}

export interface UseChatResult {
  /** Lista de jogadores disponíveis (todos cadastrados, exceto eu). */
  allPlayers: PlayerListEntry[];
  /** Conversas existentes do usuário, ordenadas por mais recente. */
  threads: ChatThread[];
  /** Total de mensagens não lidas (badge global). */
  totalUnread: number;
  /** Mensagens da conversa aberta no momento. */
  activeMessages: ChatMessage[];
  /** ID do interlocutor da conversa aberta. */
  activeOtherId: string | null;
  /** Nome do interlocutor da conversa aberta. */
  activeOtherName: string;
  /** Loading flags. */
  loadingPlayers:   boolean;
  loadingThreads:   boolean;
  loadingMessages:  boolean;
  /** ID do usuário atual. */
  myUserId: string | null;

  /** Abre uma conversa com outro jogador (carrega histórico). */
  openConversation: (otherUserId: string, otherName: string) => Promise<void>;
  /** Fecha conversa ativa. */
  closeConversation: () => void;
  /** Envia mensagem de texto. */
  sendText: (text: string) => Promise<{ success: boolean; message: string }>;
  /** Envia dinheiro. */
  sendMoney: (amount: number, message?: string) => Promise<{ success: boolean; message: string }>;
  /** Envia carro. */
  sendCar: (car: OwnedCar, message?: string) => Promise<{ success: boolean; message: string }>;
  /** Reclama carro recebido (mensagem do tipo car_sent). */
  claimCar: (messageId: string) => Promise<{ success: boolean; message: string }>;
  /** Recarrega lista de threads e jogadores. */
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useChat(opts: UseChatOptions): UseChatResult {
  const [myUserId,        setMyUserId]        = useState<string | null>(null);
  const [allPlayers,      setAllPlayers]      = useState<PlayerListEntry[]>([]);
  const [threads,         setThreads]         = useState<ChatThread[]>([]);
  const [activeMessages,  setActiveMessages]  = useState<ChatMessage[]>([]);
  const [activeOtherId,   setActiveOtherId]   = useState<string | null>(null);
  const [activeOtherName, setActiveOtherName] = useState<string>('');
  const [loadingPlayers,  setLoadingPlayers]  = useState(false);
  const [loadingThreads,  setLoadingThreads]  = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const myUserIdRef     = useRef<string | null>(null);
  const activeOtherRef  = useRef<string | null>(null);
  const optsRef         = useRef(opts);
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
  const loadAllPlayers = useCallback(async () => {
    const uid = myUserIdRef.current;
    if (!uid) return;
    setLoadingPlayers(true);
    try {
      const { data } = await db()
        .from('player_profiles')
        .select('user_id, display_name, level, total_patrimony')
        .neq('user_id', uid)
        .order('total_patrimony', { ascending: false })
        .limit(500);
      const list: PlayerListEntry[] = (data ?? []).map((r: Record<string, unknown>) => ({
        userId:      r['user_id']        as string,
        displayName: (r['display_name']  as string) ?? 'Jogador',
        level:       Number(r['level']   ?? 1),
        patrimony:   Number(r['total_patrimony'] ?? 0),
      }));
      setAllPlayers(list);
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    const uid = myUserIdRef.current;
    if (!uid) return;
    setLoadingThreads(true);
    try {
      const { data } = await db().rpc('list_chat_threads');
      const list: ChatThread[] = (data ?? []).map(rowToThread);
      setThreads(list);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadMessages = useCallback(async (otherUserId: string) => {
    const uid = myUserIdRef.current;
    if (!uid) return;
    setLoadingMessages(true);
    try {
      const { data } = await db()
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${uid},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${uid})`
        )
        .order('created_at', { ascending: true })
        .limit(200);
      const msgs: ChatMessage[] = (data ?? []).map(rowToMessage);
      setActiveMessages(msgs);
      // Marca como lidas
      void db().rpc('mark_chat_thread_read', { p_other_id: otherUserId });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Refresh combinado ──────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([loadAllPlayers(), loadThreads()]);
  }, [loadAllPlayers, loadThreads]);

  // ── Mount: carrega tudo + subscription realtime ────────────────
  useEffect(() => {
    if (!myUserId) return;
    void refresh();

    // Subscription: nova mensagem onde o usuário é remetente OU destinatário
    const channel = db()
      .channel(`chat_${myUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: { new: Record<string, unknown> }) => {
          const msg = rowToMessage(payload.new);
          // Filtra apenas mensagens do usuário (RLS já garante, mas defensivo)
          if (msg.senderId !== myUserId && msg.receiverId !== myUserId) return;

          // Se a conversa aberta é do remetente/destinatário, adiciona à lista
          const otherId = msg.senderId === myUserId ? msg.receiverId : msg.senderId;
          if (activeOtherRef.current === otherId) {
            setActiveMessages(prev => [...prev, msg]);
            // Se sou o destinatário e a conversa está aberta, marca como lido
            if (msg.receiverId === myUserId) {
              void db().rpc('mark_chat_thread_read', { p_other_id: otherId });
            }
          }

          // Atualiza saldo se chegou dinheiro
          if (msg.type === 'money_sent' && msg.receiverId === myUserId && msg.payload?.amount) {
            optsRef.current.onMoneyReceived?.(msg.payload.amount);
          }

          // Sempre recarrega threads para atualizar última mensagem + badges
          void loadThreads();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        () => {
          // Update (read_at, claimed) — apenas recarrega thread/mensagens
          void loadThreads();
          if (activeOtherRef.current) void loadMessages(activeOtherRef.current);
        },
      )
      .subscribe();

    return () => {
      void db().removeChannel(channel);
    };
  }, [myUserId, refresh, loadThreads, loadMessages]);

  // ── Ações ──────────────────────────────────────────────────────
  const openConversation = useCallback(async (otherUserId: string, otherName: string) => {
    activeOtherRef.current = otherUserId;
    setActiveOtherId(otherUserId);
    setActiveOtherName(otherName);
    await loadMessages(otherUserId);
  }, [loadMessages]);

  const closeConversation = useCallback(() => {
    activeOtherRef.current = null;
    setActiveOtherId(null);
    setActiveOtherName('');
    setActiveMessages([]);
    void loadThreads();
  }, [loadThreads]);

  const sendText = useCallback(async (text: string) => {
    const uid = myUserIdRef.current;
    const other = activeOtherRef.current;
    if (!uid || !other) return { success: false, message: 'Conversa não aberta.' };
    if (!text.trim()) return { success: false, message: 'Mensagem vazia.' };
    if (text.length > 500) return { success: false, message: 'Mensagem muito longa.' };

    const { error } = await db()
      .from('chat_messages')
      .insert({
        sender_id:   uid,
        receiver_id: other,
        type:        'text',
        content:     text.trim(),
      });
    if (error) return { success: false, message: 'Falha ao enviar mensagem.' };
    return { success: true, message: 'Enviado.' };
  }, []);

  const sendMoney = useCallback(async (amount: number, message?: string) => {
    const uid = myUserIdRef.current;
    const other = activeOtherRef.current;
    if (!uid || !other) return { success: false, message: 'Conversa não aberta.' };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: 'Valor inválido.' };
    if (amount > optsRef.current.currentMoney) return { success: false, message: 'Saldo insuficiente.' };

    try {
      const { error } = await db().rpc('send_money_to_player', {
        p_receiver_id: other,
        p_amount:      amount,
        p_message:     message ?? null,
      });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('insufficient_balance')) return { success: false, message: 'Saldo insuficiente.' };
        if (msg.includes('cannot_send_to_self'))  return { success: false, message: 'Não é possível enviar para si mesmo.' };
        if (msg.includes('receiver_not_found'))   return { success: false, message: 'Destinatário não encontrado.' };
        return { success: false, message: 'Falha ao enviar dinheiro.' };
      }
      // Ajusta saldo local
      optsRef.current.onMoneyDeducted(amount);
      return { success: true, message: 'Dinheiro enviado!' };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, []);

  const sendCar = useCallback(async (car: OwnedCar, message?: string) => {
    const uid = myUserIdRef.current;
    const other = activeOtherRef.current;
    if (!uid || !other) return { success: false, message: 'Conversa não aberta.' };

    try {
      const { error } = await db().rpc('send_car_to_player', {
        p_receiver_id:    other,
        p_car_instance_id: car.instanceId,
        p_car_data:        car,
        p_message:         message ?? null,
      });
      if (error) {
        return { success: false, message: 'Falha ao enviar carro.' };
      }
      // Remove o carro da garagem local APÓS confirmação do servidor
      optsRef.current.onCarRemoved(car.instanceId);
      return { success: true, message: `${car.brand} ${car.model} enviado!` };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, []);

  const claimCar = useCallback(async (messageId: string) => {
    try {
      const { data, error } = await db().rpc('claim_received_car', { p_message_id: messageId });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('already_claimed')) return { success: false, message: 'Carro já reclamado.' };
        if (msg.includes('not_recipient'))   return { success: false, message: 'Você não pode reclamar este carro.' };
        return { success: false, message: 'Falha ao reclamar.' };
      }
      const car = data as OwnedCar | null;
      if (!car) return { success: false, message: 'Dados do carro indisponíveis.' };
      const result = optsRef.current.onCarClaimed(car);
      return result;
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, []);

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return {
    allPlayers,
    threads,
    totalUnread,
    activeMessages,
    activeOtherId,
    activeOtherName,
    loadingPlayers,
    loadingThreads,
    loadingMessages,
    myUserId,
    openConversation,
    closeConversation,
    sendText,
    sendMoney,
    sendCar,
    claimCar,
    refresh,
  };
}
