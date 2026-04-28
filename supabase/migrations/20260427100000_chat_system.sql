-- =====================================================================
-- Migration: Sistema de chat entre jogadores com envio de dinheiro/carros
--
-- Componentes:
--   • chat_messages — tabela única para todas as mensagens (texto, dinheiro, carro)
--   • RPC send_money_to_player    — débito atômico do remetente, crédito do destinatário, mensagem
--   • RPC send_car_to_player      — anexa car_data à mensagem (carro removido da garagem pelo cliente ANTES)
--   • RPC claim_received_car      — destinatário reclama carro recebido (cliente adiciona à garagem)
--   • RPC list_chat_threads       — lista conversas do usuário com última mensagem
--   • RLS para garantir privacidade entre conversas
-- =====================================================================

BEGIN;

-- ── Tabela ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('text', 'money_sent', 'car_sent')),
  content      text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

-- Index para listar conversas rapidamente: par (sender, receiver) + ordenação
CREATE INDEX IF NOT EXISTS chat_messages_pair_idx ON public.chat_messages
  (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_receiver_idx ON public.chat_messages
  (receiver_id, created_at DESC) WHERE read_at IS NULL;

-- ── Realtime ─────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own chat messages" ON public.chat_messages;
CREATE POLICY "users see own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "users send their own messages" ON public.chat_messages;
CREATE POLICY "users send their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "receivers can mark as read" ON public.chat_messages;
CREATE POLICY "receivers can mark as read" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- ── RPC: enviar dinheiro (atômico) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_money_to_player(
  p_receiver_id uuid,
  p_amount      numeric,
  p_message     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id    uuid := auth.uid();
  v_sender_money numeric;
  v_message_id   uuid;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'cannot_send_to_self' USING ERRCODE = 'P0001';
  END IF;

  -- Trava remetente para débito atômico
  SELECT money INTO v_sender_money
    FROM public.game_progress
    WHERE user_id = v_sender_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sender_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_sender_money < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  -- Verifica destinatário existe
  IF NOT EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = p_receiver_id) THEN
    RAISE EXCEPTION 'receiver_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Débito + crédito
  UPDATE public.game_progress
    SET money = money - p_amount, updated_at = now()
    WHERE user_id = v_sender_id;

  UPDATE public.game_progress
    SET money = money + p_amount, updated_at = now()
    WHERE user_id = p_receiver_id;

  -- Mensagem
  INSERT INTO public.chat_messages (sender_id, receiver_id, type, content, payload)
    VALUES (
      v_sender_id, p_receiver_id, 'money_sent', p_message,
      jsonb_build_object('amount', p_amount)
    )
    RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_money_to_player(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_money_to_player(uuid, numeric, text) TO authenticated;

-- ── RPC: enviar carro (apenas cria mensagem; remoção da garagem é cliente-side) ──
CREATE OR REPLACE FUNCTION public.send_car_to_player(
  p_receiver_id    uuid,
  p_car_instance_id text,
  p_car_data        jsonb,
  p_message         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id  uuid := auth.uid();
  v_message_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'cannot_send_to_self' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = p_receiver_id) THEN
    RAISE EXCEPTION 'receiver_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.chat_messages (sender_id, receiver_id, type, content, payload)
    VALUES (
      v_sender_id, p_receiver_id, 'car_sent', p_message,
      jsonb_build_object(
        'car_instance_id', p_car_instance_id,
        'car',             p_car_data,
        'claimed',         false
      )
    )
    RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_car_to_player(uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_car_to_player(uuid, text, jsonb, text) TO authenticated;

-- ── RPC: reclamar carro recebido (retorna car_data para o cliente adicionar à garagem) ──
CREATE OR REPLACE FUNCTION public.claim_received_car(
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_msg     public.chat_messages;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_msg
    FROM public.chat_messages
    WHERE id = p_message_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.receiver_id != v_user_id THEN
    RAISE EXCEPTION 'not_recipient' USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.type != 'car_sent' THEN
    RAISE EXCEPTION 'not_car_message' USING ERRCODE = 'P0001';
  END IF;
  IF (v_msg.payload->>'claimed')::boolean IS TRUE THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.chat_messages
    SET payload = jsonb_set(payload, '{claimed}', 'true'::jsonb)
    WHERE id = p_message_id;

  RETURN v_msg.payload->'car';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_received_car(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_received_car(uuid) TO authenticated;

-- ── RPC: listar threads do usuário ─────────────────────────────────
-- Retorna a última mensagem de cada conversa única em que o usuário participa,
-- juntando o display_name do interlocutor.
CREATE OR REPLACE FUNCTION public.list_chat_threads()
RETURNS TABLE (
  other_user_id   uuid,
  other_name      text,
  last_message_id uuid,
  last_type       text,
  last_content    text,
  last_payload    jsonb,
  last_sender_id  uuid,
  last_created_at timestamptz,
  unread_count    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      m.*,
      CASE WHEN m.sender_id = v_user_id THEN m.receiver_id ELSE m.sender_id END AS other,
      ROW_NUMBER() OVER (
        PARTITION BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id)
        ORDER BY m.created_at DESC
      ) AS rn
    FROM public.chat_messages m
    WHERE m.sender_id = v_user_id OR m.receiver_id = v_user_id
  ),
  unread AS (
    SELECT
      sender_id AS other,
      COUNT(*) AS cnt
    FROM public.chat_messages
    WHERE receiver_id = v_user_id AND read_at IS NULL
    GROUP BY sender_id
  )
  SELECT
    r.other,
    COALESCE(p.display_name, 'Jogador') AS other_name,
    r.id, r.type, r.content, r.payload, r.sender_id, r.created_at,
    COALESCE(u.cnt, 0) AS unread_count
  FROM ranked r
  LEFT JOIN public.player_profiles p ON p.user_id = r.other
  LEFT JOIN unread u ON u.other = r.other
  WHERE r.rn = 1
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_chat_threads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_chat_threads() TO authenticated;

-- ── RPC: marcar conversa como lida ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_chat_thread_read(p_other_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  UPDATE public.chat_messages
    SET read_at = now()
    WHERE receiver_id = v_user_id
      AND sender_id   = p_other_id
      AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_thread_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_thread_read(uuid) TO authenticated;

COMMIT;
