// =====================================================================
// useRachaLobby — Sistema PvP de lobby aberto (2-4 jogadores)
// Substitui completamente o useRacing (fila automática + bots)
// =====================================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedCar } from '@/types/game';
import type { RaceRecord, RaceParticipant } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';

// ── Tipos públicos ────────────────────────────────────────────────
export type RachaState =
  | 'idle'       // tela inicial: lista de lobbies
  | 'in_lobby'   // dentro de um lobby aguardando jogadores
  | 'countdown'  // contagem regressiva pré-corrida
  | 'racing'     // corrida animada
  | 'result';    // tela de resultado

export interface LobbyPlayer {
  userId:  string;
  name:    string;
  carName: string;
  carIcon: string;
  igp:     number;
}

export interface OpenLobby {
  id:             string;
  hostId:         string;
  hostName:       string;
  maxPlayers:     number;
  bet:            number;
  players:        LobbyPlayer[];
  status:         'waiting' | 'racing' | 'finished' | 'cancelled';
  createdAt:      string;
}

export interface RacePlayerAnim extends LobbyPlayer {
  score:        number;   // igp × random (resultado final determinístico)
  finalPct:     number;   // progresso final normalizado 0-100
  barProgress:  number;   // valor animado atual 0-100
  position:     number;   // 1-4
  payout:       number;
  isMe:         boolean;
}

// ── RNG determinístico (seed = lobby.id) ────────────────────────
function makeRng(seed: string): () => number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return ((h >>> 0) / 0xFFFFFFFF);
  };
}

// ── Calcula payouts (1º:70% 2º:20% 3º:10% 4º:0% do pot líquido) ─
function calcPayouts(bet: number, numPlayers: number): number[] {
  const total = bet * numPlayers;
  const net   = total * 0.9; // 10% taxa
  const pcts  = [0.70, 0.20, 0.10, 0.00];
  return Array.from({ length: numPlayers }, (_, i) =>
    Math.round(net * (pcts[i] ?? 0))
  );
}

// ── Calcula resultado determinístico ────────────────────────────
function computeRaceResult(
  players: LobbyPlayer[],
  lobbyId: string,
): { sorted: (LobbyPlayer & { score: number; finalPct: number; position: number; payout: number })[] } {
  const rng = makeRng(lobbyId);
  const withScores = players.map(p => ({
    ...p,
    score: p.igp * (0.92 + rng() * 0.16),
  }));

  const sorted = [...withScores].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 1;
  const payouts  = calcPayouts(players[0] ? 0 : 0, players.length); // placeholder
  const betVal   = 0; // will be passed in context, not needed here for position calc
  void betVal;

  return {
    sorted: sorted.map((p, i) => ({
      ...p,
      finalPct:  Math.round((p.score / maxScore) * 100),
      position:  i + 1,
      payout:    payouts[i] ?? 0,
    })),
  };
}

// ── Animação 3 fases ─────────────────────────────────────────────
// Cada barra segue uma trajetória baseada nas fases da corrida:
//   Fase 1 (0-35%): lançamento — aceleração domina
//   Fase 2 (35-70%): meio — balanço potência/câmbio
//   Fase 3 (70-100%): final — velocidade máxima
// O resultado real já foi calculado; a animação converge para ele.
function phaseSpeed(igp: number, phase: 1 | 2 | 3, seed: number): number {
  const base  = igp / 100; // 0-1
  const noise = (Math.sin(seed * 47.3 + phase * 13.7) * 0.5 + 0.5) * 0.15;
  return 0.6 + base * 0.4 + noise; // 0.6-1.15
}

function barAt(
  t: number,
  finalPct: number,
  igp: number,
  seed: number,
): number {
  const easeOut    = (x: number) => 1 - (1 - x) * (1 - x);
  const easeInOut  = (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  // Progressão natural por fase
  let natural: number;
  if (t <= 0.35) {
    natural = easeOut(t / 0.35) * phaseSpeed(igp, 1, seed) * 0.35;
  } else if (t <= 0.70) {
    const p1 = easeOut(1) * phaseSpeed(igp, 1, seed) * 0.35;
    natural  = p1 + easeInOut((t - 0.35) / 0.35) * phaseSpeed(igp, 2, seed) * 0.35;
  } else {
    const p1 = phaseSpeed(igp, 1, seed) * 0.35;
    const p2 = phaseSpeed(igp, 2, seed) * 0.35;
    natural  = p1 + p2 + easeOut((t - 0.70) / 0.30) * phaseSpeed(igp, 3, seed) * 0.30;
  }

  // Ruído visual (decresce no final)
  const nAmp   = (1 - t * t) * 0.06;
  const noise  = Math.sin(seed * 37.5 + t * 53.1) * nAmp;
  natural      = Math.max(0, Math.min(1, natural + noise));

  // Convergência para resultado real (cresce com t²)
  const conv = t * t;
  const blended = natural * (1 - conv) + t * conv;

  return Math.max(0, Math.min(100, blended * finalPct));
}

// ── Hook ─────────────────────────────────────────────────────────
interface UseRachaLobbyOptions {
  onSpendMoney: (amount: number) => boolean;
  onAddMoney:   (amount: number) => void;
}

export function useRachaLobby({ onSpendMoney, onAddMoney }: UseRachaLobbyOptions) {
  const [state,         setState]         = useState<RachaState>('idle');
  const [openLobbies,   setOpenLobbies]   = useState<OpenLobby[]>([]);
  const [currentLobby,  setCurrentLobby]  = useState<OpenLobby | null>(null);
  const [countdown,     setCountdown]     = useState(3);
  const [racePlayers,   setRacePlayers]   = useState<RacePlayerAnim[]>([]);
  const [raceHistory,   setRaceHistory]   = useState<RaceRecord[]>([]);
  const [myUserId,      setMyUserId]      = useState<string | null>(null);
  const [myName,        setMyName]        = useState('Jogador');
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const lobbyChannelRef  = useRef<ReturnType<typeof (supabase as any).channel> | null>(null);
  const listChannelRef   = useRef<ReturnType<typeof (supabase as any).channel> | null>(null);
  const animFrameRef     = useRef<number | null>(null);
  const currentBetRef    = useRef<number>(0);

  // ── Carrega usuário ────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data } = await (supabase as any)
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.display_name) setMyName(data.display_name);
      else setMyName(user.email?.split('@')[0] ?? 'Jogador');
    })();
  }, []);

  // ── Helpers para mapear row do banco ──────────────────────────
  function rowToLobby(row: Record<string, unknown>): OpenLobby {
    return {
      id:         row['id'] as string,
      hostId:     row['host_id'] as string,
      hostName:   row['host_name'] as string,
      maxPlayers: row['max_players'] as number,
      bet:        row['bet'] as number,
      players:    (row['players'] as LobbyPlayer[]) ?? [],
      status:     row['status'] as OpenLobby['status'],
      createdAt:  row['created_at'] as string,
    };
  }

  // ── Busca lobbies abertos ─────────────────────────────────────
  const fetchLobbies = useCallback(async () => {
    const { data, error: err } = await (supabase as any)
      .from('race_lobbies')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(20);

    if (err || !data) return;
    setOpenLobbies((data as Record<string, unknown>[]).map(rowToLobby));
  }, []);

  // ── Subscription: lista global de lobbies ─────────────────────
  useEffect(() => {
    void fetchLobbies();

    const ch = (supabase as any)
      .channel('race-lobbies-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_lobbies' },
        () => void fetchLobbies(),
      )
      .subscribe();

    listChannelRef.current = ch;
    return () => void (supabase as any).removeChannel(ch);
  }, [fetchLobbies]);

  // ── Subscription: lobby atual ─────────────────────────────────
  const subscribeLobby = useCallback((lobbyId: string) => {
    // Remove canal anterior se existir
    if (lobbyChannelRef.current) {
      void (supabase as any).removeChannel(lobbyChannelRef.current);
    }

    const ch = (supabase as any)
      .channel(`lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'race_lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = rowToLobby(payload.new);
          setCurrentLobby(updated);

          if (updated.status === 'racing') {
            void startRace(updated);
          }
          if (updated.status === 'cancelled') {
            // Devolver aposta se estava no lobby
            onAddMoney(currentBetRef.current);
            setState('idle');
            setCurrentLobby(null);
          }
        },
      )
      .subscribe();

    lobbyChannelRef.current = ch;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Criar lobby ───────────────────────────────────────────────
  const createLobby = useCallback(async (
    car:        OwnedCar,
    bet:        number,
    maxPlayers: number,
  ) => {
    if (!myUserId) { setError('Faça login para criar um racha.'); return; }
    if (!onSpendMoney(bet)) { setError('Saldo insuficiente.'); return; }

    setIsLoading(true);
    setError(null);
    currentBetRef.current = bet;

    try {
      const perf = getFullPerformance(car);
      const mePlayer: LobbyPlayer = {
        userId:  myUserId,
        name:    myName,
        carName: car.fullName,
        carIcon: car.icon,
        igp:     perf.igp,
      };

      const { data, error: err } = await (supabase as any)
        .from('race_lobbies')
        .insert({
          host_id:     myUserId,
          host_name:   myName,
          max_players: maxPlayers,
          bet,
          players:     [mePlayer],
          status:      'waiting',
        })
        .select()
        .single();

      if (err || !data) throw new Error(err?.message ?? 'Erro ao criar lobby');

      const lobby = rowToLobby(data as Record<string, unknown>);
      setCurrentLobby(lobby);
      subscribeLobby(lobby.id);
      setState('in_lobby');
    } catch (e) {
      onAddMoney(bet); // devolve aposta
      setError(e instanceof Error ? e.message : 'Erro ao criar lobby');
    } finally {
      setIsLoading(false);
    }
  }, [myUserId, myName, onSpendMoney, onAddMoney, subscribeLobby]);

  // ── Entrar em lobby ───────────────────────────────────────────
  const joinLobby = useCallback(async (lobby: OpenLobby, car: OwnedCar) => {
    if (!myUserId) { setError('Faça login para entrar.'); return; }
    if (!onSpendMoney(lobby.bet)) { setError('Saldo insuficiente.'); return; }

    setIsLoading(true);
    setError(null);
    currentBetRef.current = lobby.bet;

    try {
      const perf = getFullPerformance(car);
      const mePlayer: LobbyPlayer = {
        userId:  myUserId,
        name:    myName,
        carName: car.fullName,
        carIcon: car.icon,
        igp:     perf.igp,
      };

      const { data, error: err } = await (supabase as any)
        .rpc('join_race_lobby', {
          p_lobby_id: lobby.id,
          p_player:   mePlayer,
        });

      if (err) throw new Error(err.message ?? 'Lobby indisponível');

      const updated = rowToLobby(data as Record<string, unknown>);
      setCurrentLobby(updated);
      subscribeLobby(updated.id);

      if (updated.status === 'racing') {
        void startRace(updated);
      } else {
        setState('in_lobby');
      }
    } catch (e) {
      onAddMoney(lobby.bet);
      const msg = e instanceof Error ? e.message : 'Erro ao entrar';
      setError(
        msg.includes('lobby_full')          ? 'Lobby cheio.'
        : msg.includes('lobby_not_available') ? 'Lobby não disponível.'
        : msg.includes('already_in_lobby')    ? 'Você já está neste lobby.'
        : msg,
      );
    } finally {
      setIsLoading(false);
    }
  }, [myUserId, myName, onSpendMoney, onAddMoney, subscribeLobby]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sair do lobby ─────────────────────────────────────────────
  const leaveLobby = useCallback(async () => {
    if (!currentLobby) return;
    await (supabase as any).rpc('leave_race_lobby', { p_lobby_id: currentLobby.id });
    // O Realtime tratará o 'cancelled' se host; aqui refletimos imediatamente
    onAddMoney(currentBetRef.current);
    currentBetRef.current = 0;
    setState('idle');
    setCurrentLobby(null);
    if (lobbyChannelRef.current) {
      void (supabase as any).removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
  }, [currentLobby, onAddMoney]);

  // ── Iniciar corrida ───────────────────────────────────────────
  const startRace = useCallback(async (lobby: OpenLobby) => {
    setState('countdown');

    // Countdown 3, 2, 1…
    await new Promise<void>(resolve => {
      let c = 3;
      setCountdown(c);
      const id = setInterval(() => {
        c--;
        if (c <= 0) { clearInterval(id); setCountdown(0); resolve(); }
        else setCountdown(c);
      }, 1_000);
    });

    setState('racing');

    // Calcula resultado determinístico usando lobby.id como seed
    const { sorted } = computeRaceResult(lobby.players, lobby.id);
    const bet        = lobby.bet;
    const payouts    = calcPayouts(bet, sorted.length);
    const meIdx      = sorted.findIndex(p => p.userId === myUserId);

    // Instancia jogadores com payout e flag isMe
    const players: RacePlayerAnim[] = sorted.map((p, i) => ({
      ...p,
      payout:      payouts[i] ?? 0,
      barProgress: 0,
      isMe:        p.userId === myUserId,
      // seed único por jogador baseado na posição para noise diferente
      _seed: i + 1,
    } as RacePlayerAnim & { _seed: number }));

    setRacePlayers(players.map(p => ({ ...p, barProgress: 0 })));

    // Animação 3-5 segundos
    const duration = 3_000 + Math.random() * 2_000;
    const startMs  = Date.now();

    await new Promise<void>(resolve => {
      const tick = () => {
        const t = Math.min(1, (Date.now() - startMs) / duration);

        setRacePlayers(prev =>
          prev.map((p, i) => ({
            ...p,
            barProgress: barAt(t, p.finalPct, p.igp, i + 1),
          }))
        );

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          setRacePlayers(prev =>
            prev.map(p => ({ ...p, barProgress: p.finalPct }))
          );
          resolve();
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    });

    // Aplica payout do jogador local
    const myResult = players[meIdx];
    if (myResult) {
      if (myResult.payout > 0) onAddMoney(myResult.payout);
      // (a aposta já foi debitada ao entrar/criar)
    }

    // Salva histórico
    const myPos = meIdx + 1;
    const record: RaceRecord = {
      id:           `race_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      opponentName: `${sorted.length} jogadores`,
      opponentCar:  '',
      myIgp:        players[meIdx]?.igp ?? 0,
      opponentIgp:  sorted[0]?.igp ?? 0,
      bet,
      won:          myPos === 1,
      payout:       myResult?.payout ?? 0,
      createdAt:    new Date().toISOString(),
      participants: players.map(p => ({
        userId:   p.userId,
        name:     p.name,
        carName:  p.carName,
        carIcon:  p.carIcon,
        igp:      p.igp,
        position: p.position,
        payout:   p.payout,
      })),
      myPosition:   myPos,
      totalPlayers: sorted.length,
    };
    setRaceHistory(prev => [record, ...prev].slice(0, 50));

    // Persiste resultado no banco (apenas o host ou quem entrou por último)
    try {
      await (supabase as any).rpc('finish_race_lobby', {
        p_lobby_id: lobby.id,
        p_results:  { rankings: players },
      });
    } catch {
      // ignora falha de persistência
    }

    setState('result');
  }, [myUserId, onAddMoney]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset ─────────────────────────────────────────────────────
  const resetRace = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (lobbyChannelRef.current) {
      void (supabase as any).removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    currentBetRef.current = 0;
    setState('idle');
    setCurrentLobby(null);
    setRacePlayers([]);
    setCountdown(3);
    setError(null);
  }, []);

  // ── Cleanup no unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (lobbyChannelRef.current) void (supabase as any).removeChannel(lobbyChannelRef.current);
      if (listChannelRef.current)  void (supabase as any).removeChannel(listChannelRef.current);
    };
  }, []);

  return {
    state,
    openLobbies,
    currentLobby,
    countdown,
    racePlayers,
    raceHistory,
    myUserId,
    myName,
    isLoading,
    error,
    createLobby,
    joinLobby,
    leaveLobby,
    resetRace,
    refetchLobbies: fetchLobbies,
  };
}
