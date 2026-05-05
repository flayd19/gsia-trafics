// =====================================================================
// useLicitacoes — Sistema de licitações (leilão de obras)
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Licitacao, WorkType } from '@/types/game';
import { generateLicitacaoPool } from '@/data/construction';
import { supabase } from '@/integrations/supabase/client';

const POOL_REFRESH_MS  = 30 * 60_000;
const PREP_TIMEOUT_MS  = 30 * 60_000;
const POLL_MS          = 60_000;
const SUPABASE_TIMEOUT = 3_000;
const LS_POOL_KEY      = 'gsia_licitacoes_pool_v1';
const LS_POOL_TS_KEY   = 'gsia_licitacoes_ts_v1';
const LS_MY_WINS_KEY   = 'gsia_my_wins_v1';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

export interface PlacedBid {
  licitacaoId: string;
  valor:       number;
  placedAt:    number;
}

export interface MyWin {
  licitacaoId:   string;
  nome:          string;
  tipo:          WorkType;
  tamanhoM2:     number;
  contractValue: number;
  wonAt:         number;
  prepDeadline:  number;
  licitacao:     Licitacao;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function useLicitacoes(playerName: string) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [myBids,     setMyBids]     = useState<PlacedBid[]>([]);
  const [myWins,     setMyWins]     = useState<MyWin[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const poolRef    = useRef<Licitacao[]>([]);
  const playerRef  = useRef(playerName);
  useEffect(() => { playerRef.current = playerName; }, [playerName]);

  const refreshPool = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);

    let pool: Licitacao[] | null = null;
    try {
      type DbQuery = Promise<{ data: unknown[] | null; error: unknown }>;
      const queryPromise: DbQuery = (supabase as any)
        .from('licitacoes')
        .select('*')
        .eq('status', 'open')
        .order('expires_at', { ascending: true });

      const result = await withTimeout(queryPromise, SUPABASE_TIMEOUT);

      if (result && !result.error && result.data && (result.data as unknown[]).length > 0) {
        pool = (result.data as Record<string, unknown>[]).map(row => ({
          id:            row['id'] as string,
          nome:          row['nome'] as string,
          tipo:          row['tipo'] as WorkType,
          tamanhoM2:     row['tamanho_m2'] as number,
          tempoBaseMin:  row['tempo_base_min'] as number,
          custoEstimado: row['custo_estimado'] as number,
          valorBase:     row['valor_base'] as number,
          requisitos:    row['requisitos'] as Licitacao['requisitos'],
          melhorLance:   row['melhor_lance'] as number | null,
          liderNome:     row['lider_nome'] as string | null,
          liderId:       row['lider_id'] as string | null,
          expiresAt:     new Date(row['expires_at'] as string).getTime(),
          status:        row['status'] as Licitacao['status'],
          winnerId:      row['winner_id'] as string | undefined,
          winnerNome:    row['winner_nome'] as string | undefined,
          prepDeadline:  row['prep_deadline'] ? new Date(row['prep_deadline'] as string).getTime() : undefined,
          batchId:       row['batch_id'] as number,
          createdAt:     new Date(row['created_at'] as string).getTime(),
        }));
      }
    } catch { /* Supabase indisponível */ }

    if (!pool || pool.length === 0) {
      const batchId = Math.floor(Date.now() / POOL_REFRESH_MS);
      pool = generateLicitacaoPool(batchId);
    }

    if (mountedRef.current) {
      poolRef.current = pool;
      lsSet(LS_POOL_KEY, pool);
      lsSet(LS_POOL_TS_KEY, Date.now());
      setLicitacoes(pool);
      setLoading(false);
      setError(null);
    }
  }, []);

  useEffect(() => {
    const savedPool = lsGet<Licitacao[]>(LS_POOL_KEY);
    const savedTs   = lsGet<number>(LS_POOL_TS_KEY);
    const savedWins = lsGet<MyWin[]>(LS_MY_WINS_KEY);
    if (savedWins) setMyWins(savedWins);

    const isStale = !savedTs || Date.now() - savedTs >= POOL_REFRESH_MS;
    if (!isStale && savedPool && savedPool.length > 0) {
      const now   = Date.now();
      const valid = savedPool.filter(l => l.expiresAt > now && l.status === 'open');
      poolRef.current = valid;
      setLicitacoes(valid);
      setLoading(false);
    } else {
      refreshPool();
    }
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => {
      if (!mountedRef.current) return;
      const now = Date.now();
      setLicitacoes(prev => {
        const updated = prev.filter(l => l.expiresAt > now || l.status !== 'open');
        if (updated.length !== prev.length) {
          poolRef.current = updated;
          lsSet(LS_POOL_KEY, updated);
        }
        return updated;
      });
    }, 30_000);

    const pollTimer = setInterval(() => {
      if (!mountedRef.current) return;
      const ts = lsGet<number>(LS_POOL_TS_KEY) ?? 0;
      if (Date.now() - ts >= POOL_REFRESH_MS) void refreshPool();
    }, POLL_MS);

    return () => { clearInterval(ticker); clearInterval(pollTimer); };
  }, [refreshPool]);

  const placeBid = useCallback(async (
    licitacaoId: string,
    valor: number,
  ): Promise<{ ok: boolean; message: string }> => {
    const lic = poolRef.current.find(l => l.id === licitacaoId);
    if (!lic) return { ok: false, message: 'Licitação não encontrada.' };
    if (lic.status !== 'open') return { ok: false, message: 'Licitação encerrada.' };
    if (lic.expiresAt < Date.now()) return { ok: false, message: 'Prazo expirado.' };
    if (valor <= 0) return { ok: false, message: 'Lance deve ser maior que zero.' };
    if (lic.melhorLance !== null && valor >= lic.melhorLance) {
      return { ok: false, message: `Lance deve ser menor que ${lic.melhorLance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}.` };
    }

    const pName = playerRef.current;
    let supabaseOk = false;
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        const { error: bidErr } = await (supabase as any)
          .from('licitacao_bids')
          .insert({ licitacao_id: licitacaoId, player_id: userId, player_nome: pName, valor });
        if (!bidErr) {
          await (supabase as any)
            .from('licitacoes')
            .update({ melhor_lance: valor, lider_nome: pName, lider_id: userId })
            .eq('id', licitacaoId)
            .gt('melhor_lance', valor);
          supabaseOk = true;
        }
      }
    } catch { /* fallback local */ }

    const bid: PlacedBid = { licitacaoId, valor, placedAt: Date.now() };
    setMyBids(prev => [...prev.filter(b => b.licitacaoId !== licitacaoId), bid]);
    setLicitacoes(prev => prev.map(l => l.id === licitacaoId ? { ...l, melhorLance: valor, liderNome: pName } : l));
    poolRef.current = poolRef.current.map(l => l.id === licitacaoId ? { ...l, melhorLance: valor, liderNome: pName } : l);
    lsSet(LS_POOL_KEY, poolRef.current);

    const msg = supabaseOk ? '🏆 Lance registrado em tempo real!' : '✅ Lance registrado (modo offline).';
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4_000);
    return { ok: true, message: msg };
  }, []);

  const claimWin = useCallback((licitacaoId: string): { ok: boolean; win?: MyWin } => {
    const lic = poolRef.current.find(l => l.id === licitacaoId);
    if (!lic) return { ok: false };
    const myBid = myBids.find(b => b.licitacaoId === licitacaoId);
    if (!myBid) return { ok: false };
    if (lic.melhorLance !== myBid.valor) return { ok: false };
    if (lic.liderNome !== playerRef.current) return { ok: false };

    const now = Date.now();
    const win: MyWin = {
      licitacaoId:   lic.id,
      nome:          lic.nome,
      tipo:          lic.tipo,
      tamanhoM2:     lic.tamanhoM2,
      contractValue: myBid.valor,
      wonAt:         now,
      prepDeadline:  now + PREP_TIMEOUT_MS,
      licitacao:     lic,
    };

    setMyWins(prev => {
      const next = [win, ...prev.filter(w => w.licitacaoId !== licitacaoId)];
      lsSet(LS_MY_WINS_KEY, next);
      return next;
    });
    setLicitacoes(prev => prev.filter(l => l.id !== licitacaoId));
    poolRef.current = poolRef.current.filter(l => l.id !== licitacaoId);
    lsSet(LS_POOL_KEY, poolRef.current);
    return { ok: true, win };
  }, [myBids]);

  const consumeWin = useCallback((licitacaoId: string) => {
    setMyWins(prev => {
      const next = prev.filter(w => w.licitacaoId !== licitacaoId);
      lsSet(LS_MY_WINS_KEY, next);
      return next;
    });
  }, []);

  const pruneExpiredWins = useCallback(() => {
    const now = Date.now();
    setMyWins(prev => {
      const next = prev.filter(w => w.prepDeadline > now);
      lsSet(LS_MY_WINS_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    pruneExpiredWins();
    const t = setInterval(pruneExpiredWins, 60_000);
    return () => clearInterval(t);
  }, [pruneExpiredWins]);

  const isLeading = useCallback((licitacaoId: string): boolean => {
    const lic = licitacoes.find(l => l.id === licitacaoId);
    return lic?.liderNome === playerRef.current;
  }, [licitacoes]);

  const myBidFor = useCallback((licitacaoId: string): number | null => {
    return myBids.find(b => b.licitacaoId === licitacaoId)?.valor ?? null;
  }, [myBids]);

  const openLicitacoes = licitacoes.filter(l => l.status === 'open' && l.expiresAt > Date.now());
  const myActiveBids   = myBids.filter(b => openLicitacoes.some(l => l.id === b.licitacaoId));

  return {
    licitacoes: openLicitacoes,
    myWins,
    myBids:     myActiveBids,
    loading,
    error,
    successMsg,
    placeBid,
    claimWin,
    consumeWin,
    isLeading,
    myBidFor,
    refreshPool,
  };
}
