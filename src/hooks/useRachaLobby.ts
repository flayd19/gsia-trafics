// =====================================================================
// useRachaLobby — Sistema de Racha Assíncrono
// Lobby fica aberto no servidor. Quando lota, o servidor calcula o
// resultado. Jogadores coletam o prêmio quando abrirem o app.
// =====================================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedCar } from '@/types/game';
import type { RaceRecord, RaceParticipant } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';

// ── Tipos públicos ────────────────────────────────────────────────
export type RachaState = 'idle' | 'racing' | 'result';

export interface LobbyPlayer {
  userId:  string;
  name:    string;
  carName: string;
  carIcon: string;
  igp:     number;
}

export interface OpenLobby {
  id:         string;
  hostId:     string;
  hostName:   string;
  maxPlayers: number;
  bet:        number;
  players:    LobbyPlayer[];
  results:    unknown;
  status:     'waiting' | 'finished' | 'cancelled';
  createdAt:  string;
  finishedAt: string | null;
}

export interface RacePlayerAnim extends LobbyPlayer {
  score:       number;
  finalPct:    number;
  barProgress: number;
  position:    number;
  payout:      number;
  isMe:        boolean;
}

// ── Helpers de localStorage ───────────────────────────────────────
const collectedKey = (uid: string) => `racha_collected_${uid}`;

function getCollectedSet(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(collectedKey(uid));
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function markCollected(uid: string, lobbyId: string): void {
  const s = getCollectedSet(uid);
  s.add(lobbyId);
  try { localStorage.setItem(collectedKey(uid), JSON.stringify([...s])); } catch {}
}

function isCollected(uid: string, lobbyId: string): boolean {
  return getCollectedSet(uid).has(lobbyId);
}

// ── Map DB row → OpenLobby ────────────────────────────────────────
function rowToLobby(row: Record<string, unknown>): OpenLobby {
  return {
    id:         row['id'] as string,
    hostId:     row['host_id'] as string,
    hostName:   row['host_name'] as string,
    maxPlayers: row['max_players'] as number,
    bet:        Number(row['bet']),
    players:    (row['players'] as LobbyPlayer[]) ?? [],
    results:    row['results'] ?? null,
    status:     row['status'] as OpenLobby['status'],
    createdAt:  row['created_at'] as string,
    finishedAt: (row['finished_at'] as string | null) ?? null,
  };
}

// ── Map lobby.results.rankings → RacePlayerAnim[] ─────────────────
type RankEntry = {
  userId: string; name: string; carName: string; carIcon: string;
  igp: number; score: number; position: number; payout: number;
};

function lobbyResultsToPlayers(lobby: OpenLobby, myUserId: string | null): RacePlayerAnim[] {
  const raw =
    ((lobby.results as Record<string, unknown> | null)?.['rankings']);
  const rankings: RankEntry[] = Array.isArray(raw) ? (raw as RankEntry[]) : [];
  const maxScore = Math.max(...rankings.map(r => r.score), 1);

  return rankings.map(r => ({
    userId:      r.userId,
    name:        r.name,
    carName:     r.carName,
    carIcon:     r.carIcon,
    igp:         r.igp,
    score:       r.score,
    finalPct:    Math.round((r.score / maxScore) * 100),
    barProgress: Math.round((r.score / maxScore) * 100),
    position:    r.position,
    payout:      r.payout,
    isMe:        r.userId === myUserId,
  }));
}

// ── Hook ──────────────────────────────────────────────────────────
interface UseRachaLobbyOptions {
  onSpendMoney: (amount: number) => boolean;
  onAddMoney:   (amount: number) => void;
  onRaceWon?:   () => void;
}

export function useRachaLobby({ onSpendMoney, onAddMoney, onRaceWon }: UseRachaLobbyOptions) {
  const [state,                setState]                = useState<RachaState>('idle');
  const [openLobbies,          setOpenLobbies]          = useState<OpenLobby[]>([]);
  const [pendingResults,       setPendingResults]       = useState<OpenLobby[]>([]);
  const [currentResultPlayers, setCurrentResultPlayers] = useState<RacePlayerAnim[] | null>(null);
  const [raceHistory,          setRaceHistory]          = useState<RaceRecord[]>([]);
  const [myUserId,             setMyUserId]             = useState<string | null>(null);
  const [myName,               setMyName]               = useState('Jogador');
  const [isLoading,            setIsLoading]            = useState(false);
  const [error,                setError]                = useState<string | null>(null);
  const [successMessage,       setSuccessMessage]       = useState<string | null>(null);

  const myUserIdRef     = useRef<string | null>(null);
  const myNameRef       = useRef<string>('Jogador');
  const onAddMoneyRef   = useRef(onAddMoney);
  const onSpendMoneyRef = useRef(onSpendMoney);
  const onRaceWonRef    = useRef(onRaceWon);
  const listChannelRef  = useRef<unknown>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prêmio pendente — aplicado somente após a animação terminar (finishRace)
  const pendingPayoutRef = useRef<number>(0);
  const pendingIsWinRef  = useRef<boolean>(false);

  useEffect(() => { onAddMoneyRef.current   = onAddMoney;   }, [onAddMoney]);
  useEffect(() => { onSpendMoneyRef.current = onSpendMoney; }, [onSpendMoney]);
  useEffect(() => { onRaceWonRef.current    = onRaceWon;    }, [onRaceWon]);

  // ── Mensagem de sucesso (desaparece em 4s) ────────────────────
  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 4_000);
  }, []);

  // ── Carrega usuário ───────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      myUserIdRef.current = user.id;
      setMyUserId(user.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const name = (data as { display_name?: string } | null)?.display_name ||
        user.email?.split('@')[0] || 'Jogador';
      myNameRef.current = name;
      setMyName(name);
    })();
  }, []);

  // ── Busca lobbies abertos ─────────────────────────────────────
  const fetchLobbies = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('race_lobbies')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setOpenLobbies((data as Record<string, unknown>[]).map(rowToLobby));
  }, []);

  // ── Verifica resultados pendentes ─────────────────────────────
  // Também faz auto-reembolso de lobbies cancelados.
  const checkPendingResults = useCallback(async () => {
    const uid = myUserIdRef.current;
    if (!uid) return;

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('race_lobbies')
      .select('*')
      .in('status', ['finished', 'cancelled'])
      .gte('created_at', since)
      .order('finished_at', { ascending: false })
      .limit(100);

    if (!data) return;

    const lobbies = (data as Record<string, unknown>[]).map(rowToLobby);

    // Auto-reembolso: lobbies cancelados onde participei e não coletei
    const cancelled = lobbies.filter(
      l =>
        l.status === 'cancelled' &&
        l.players.some(p => p.userId === uid) &&
        !isCollected(uid, l.id),
    );
    for (const l of cancelled) {
      markCollected(uid, l.id);
      onAddMoneyRef.current(l.bet);
    }

    // Lobbies finalizados onde participei e não coletei
    const pending = lobbies.filter(
      l =>
        l.status === 'finished' &&
        l.players.some(p => p.userId === uid) &&
        !isCollected(uid, l.id),
    );
    setPendingResults(pending);
  }, []);

  // ── Subscription global da lista ──────────────────────────────
  useEffect(() => {
    void fetchLobbies();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = (supabase as any)
      .channel('race-lobbies-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_lobbies' },
        () => {
          // Debounce: agrupa rafagas de mudanças em 300ms
          if (subDebounceRef.current) clearTimeout(subDebounceRef.current);
          subDebounceRef.current = setTimeout(() => {
            void fetchLobbies();
            void checkPendingResults();
          }, 300);
        },
      )
      .subscribe();
    listChannelRef.current = ch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => void (supabase as any).removeChannel(ch);
  }, [fetchLobbies, checkPendingResults]);

  // Verifica resultados quando usuário carrega
  useEffect(() => {
    if (myUserId) void checkPendingResults();
  }, [myUserId, checkPendingResults]);

  // ── Coletar resultado de um lobby finalizado ──────────────────
  const collectResult = useCallback((lobby: OpenLobby) => {
    const uid = myUserIdRef.current;
    if (!uid) return;

    // Guarda contra dupla-coleta (race condition click / subscription)
    if (isCollected(uid, lobby.id)) return;

    const players  = lobbyResultsToPlayers(lobby, uid);
    const myEntry  = players.find(p => p.isMe);

    // Marca como coletado ANTES de qualquer efeito (evita re-entrada)
    markCollected(uid, lobby.id);

    // Guarda prêmio e vitória para aplicar SOMENTE após a animação terminar
    const myPos = myEntry?.position ?? 0;
    pendingPayoutRef.current = myEntry?.payout ?? 0;
    pendingIsWinRef.current  = myPos === 1;

    setPendingResults(prev => prev.filter(l => l.id !== lobby.id));

    // Histórico local
    const record: RaceRecord = {
      id:           `race_${lobby.id}`,
      opponentName: `${lobby.players.length} jogadores`,
      opponentCar:  '',
      myIgp:        myEntry?.igp ?? 0,
      opponentIgp:  players[0]?.igp ?? 0,
      bet:          lobby.bet,
      won:          myPos === 1,
      payout:       myEntry?.payout ?? 0,
      createdAt:    lobby.finishedAt ?? lobby.createdAt,
      participants: players.map(p => ({
        userId:   p.userId,
        name:     p.name,
        carName:  p.carName,
        carIcon:  p.carIcon,
        igp:      p.igp,
        position: p.position,
        payout:   p.payout,
      } satisfies RaceParticipant)),
      myPosition:   myPos,
      totalPlayers: lobby.players.length,
    };
    setRaceHistory(prev => [record, ...prev].slice(0, 50));

    // Inicia animação de corrida (tela de resultado aparece após 20s)
    setCurrentResultPlayers(players);
    setState('racing');
  }, []);

  // ── Transição racing → result (chamado pelo componente após 20s) ──
  // Aplica o prêmio aqui, só depois que a animação de corrida terminou.
  const finishRace = useCallback(() => {
    if (pendingPayoutRef.current > 0) {
      onAddMoneyRef.current(pendingPayoutRef.current);
      pendingPayoutRef.current = 0;
    }
    if (pendingIsWinRef.current) {
      onRaceWonRef.current?.();
      pendingIsWinRef.current = false;
    }
    setState('result');
  }, []);

  // ── Fechar resultado ──────────────────────────────────────────
  const dismissResult = useCallback(() => {
    setCurrentResultPlayers(null);
    setState('idle');
    void checkPendingResults();
  }, [checkPendingResults]);

  // ── Criar lobby ───────────────────────────────────────────────
  const createLobby = useCallback(async (
    car:        OwnedCar,
    bet:        number,
    maxPlayers: number,
  ) => {
    const uid  = myUserIdRef.current;
    const name = myNameRef.current;
    if (!uid) { setError('Faça login para criar um racha.'); return; }
    if (!onSpendMoneyRef.current(bet)) { setError('Saldo insuficiente.'); return; }

    setIsLoading(true);
    setError(null);

    try {
      const perf     = getFullPerformance(car);
      const mePlayer: LobbyPlayer = {
        userId:  uid,
        name,
        carName: car.fullName,
        carIcon: car.icon,
        igp:     perf.igp,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: err } = await (supabase as any)
        .from('race_lobbies')
        .insert({
          host_id:     uid,
          host_name:   name,
          max_players: maxPlayers,
          bet,
          players:     [mePlayer],
          status:      'waiting',
        });

      if (err) throw new Error((err as { message?: string }).message ?? 'Erro ao criar lobby');

      showSuccess('🏁 Racha criado! Aguardando oponentes...');
      void fetchLobbies();
    } catch (e) {
      onAddMoneyRef.current(bet); // reembolsa
      setError(e instanceof Error ? e.message : 'Erro ao criar lobby');
    } finally {
      setIsLoading(false);
    }
  }, [fetchLobbies, showSuccess]);

  // ── Entrar em lobby ───────────────────────────────────────────
  const joinLobby = useCallback(async (lobby: OpenLobby, car: OwnedCar) => {
    const uid  = myUserIdRef.current;
    const name = myNameRef.current;
    if (!uid) { setError('Faça login para entrar.'); return; }
    if (!onSpendMoneyRef.current(lobby.bet)) { setError('Saldo insuficiente.'); return; }

    setIsLoading(true);
    setError(null);

    try {
      const perf     = getFullPerformance(car);
      const mePlayer: LobbyPlayer = {
        userId:  uid,
        name,
        carName: car.fullName,
        carIcon: car.icon,
        igp:     perf.igp,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .rpc('join_race_lobby', { p_lobby_id: lobby.id, p_player: mePlayer });

      if (err) throw new Error((err as { message?: string }).message ?? 'Lobby indisponível');

      const updated = rowToLobby(data as Record<string, unknown>);

      if (updated.status === 'finished') {
        // Lobby preencheu agora — remove da lista e inicia animação
        void fetchLobbies(); // garante que lobby sai da lista imediatamente
        collectResult(updated);
      } else {
        // Ainda aguardando outros jogadores
        showSuccess('⚡ Você entrou no racha! Aguardando outros jogadores...');
        void fetchLobbies();
      }
    } catch (e) {
      onAddMoneyRef.current(lobby.bet); // reembolsa
      const msg = e instanceof Error ? e.message : 'Erro ao entrar';
      setError(
        msg.includes('lobby_full')            ? 'Lobby cheio.'
        : msg.includes('lobby_not_available') ? 'Lobby não disponível.'
        : msg.includes('already_in_lobby')    ? 'Você já está neste lobby.'
        : msg,
      );
    } finally {
      setIsLoading(false);
    }
  }, [collectResult, fetchLobbies, showSuccess]);

  // ── Sair do lobby (host cancela; outros só saem) ──────────────
  const leaveLobby = useCallback(async (lobbyId: string, bet: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('leave_race_lobby', { p_lobby_id: lobbyId });
    onAddMoneyRef.current(bet); // devolve aposta
    void fetchLobbies();
  }, [fetchLobbies]);

  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (listChannelRef.current) void (supabase as any).removeChannel(listChannelRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (subDebounceRef.current)  clearTimeout(subDebounceRef.current);

      // Garante prêmio mesmo se usuário navegar durante a animação de 20s.
      // O lobby já está marcado como coletado no localStorage, então não há
      // risco de dupla-coleta — apenas aplicamos o crédito pendente.
      if (pendingPayoutRef.current > 0) {
        onAddMoneyRef.current(pendingPayoutRef.current);
        pendingPayoutRef.current = 0;
      }
      if (pendingIsWinRef.current) {
        onRaceWonRef.current?.();
        pendingIsWinRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    openLobbies,
    pendingResults,
    currentResultPlayers,
    raceHistory,
    myUserId,
    myName,
    isLoading,
    error,
    successMessage,
    createLobby,
    joinLobby,
    leaveLobby,
    collectResult,
    finishRace,
    dismissResult,
    refetchLobbies: fetchLobbies,
    checkPendingResults,
  };
}
