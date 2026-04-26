// =====================================================================
// useRacing — Sistema de rachas com matchmaking Supabase + bots
// =====================================================================
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedCar } from '@/types/game';
import type { RaceRecord } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';

// ── Tipos internos ────────────────────────────────────────────────
export type RaceState =
  | 'idle'
  | 'searching'
  | 'countdown'
  | 'racing'
  | 'result';

export interface Opponent {
  id: string;
  name: string;
  carName: string;
  igp: number;
  isBot: boolean;
}

export interface RaceResult {
  won: boolean;
  myScore: number;
  opponentScore: number;
  myIgp: number;
  opponentIgp: number;
  payout: number;
  bet: number;
  record: RaceRecord;
}

// ── Bot name pool ────────────────────────────────────────────────
const BOT_NAMES = [
  'Cabuloso_BH', 'TurboZé', 'PistãoLoko', 'RodaDentada', 'VelocidadeBruta',
  'Machedon', 'FumacaAzul', 'GiroAlto', 'AceleradorFull', 'NitroSilva',
  'PedeSuave', 'CachimboQuente', 'RodinhasFogo', 'AsfaltoCinza', 'EscapeBooks',
];
const BOT_CARS = [
  'Celta Sport', 'Civic Si', 'Uno Turbo', 'Corsa Tigra', 'Golf VR6',
  'Escort XR3', 'Omega 3.0', 'Vectra GTS', 'Astra GSi', 'Del Rey Prata',
];

function randomBot(targetIgp: number): Opponent {
  const spread = 6 + Math.random() * 6;
  const igp    = Math.min(99, Math.max(1, Math.round(targetIgp + (Math.random() < 0.5 ? -spread : spread))));
  return {
    id:      `bot_${Date.now()}`,
    name:    BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    carName: BOT_CARS[Math.floor(Math.random() * BOT_CARS.length)],
    igp,
    isBot: true,
  };
}

// ── Anti-abuse ────────────────────────────────────────────────────
const RACE_WINDOW_MS   = 5 * 60_000; // 5 minutos
const MAX_RACES_WINDOW = 10;

interface AntiAbuse {
  timestamps: number[];
}

const _antiAbuse: AntiAbuse = { timestamps: [] };

function checkAntiAbuse(): boolean {
  const now   = Date.now();
  _antiAbuse.timestamps = _antiAbuse.timestamps.filter(t => now - t < RACE_WINDOW_MS);
  return _antiAbuse.timestamps.length < MAX_RACES_WINDOW;
}

function recordRace(): void {
  _antiAbuse.timestamps.push(Date.now());
}

// ── Hook ─────────────────────────────────────────────────────────
export function useRacing() {
  const [state,        setState]        = useState<RaceState>('idle');
  const [opponent,     setOpponent]     = useState<Opponent | null>(null);
  const [countdown,    setCountdown]    = useState(3);
  const [raceProgress, setRaceProgress] = useState({ me: 0, opp: 0 });
  const [result,       setResult]       = useState<RaceResult | null>(null);
  const [raceHistory,  setRaceHistory]  = useState<RaceRecord[]>([]);

  const roomIdRef    = useRef<string | null>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // ── Animação de corrida ───────────────────────────────────────
  const animateRace = useCallback((myFinalScore: number, oppFinalScore: number): Promise<void> => {
    return new Promise(resolve => {
      const duration = 3000 + Math.random() * 2000; // 3-5 segundos
      const startMs  = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startMs;
        const t       = Math.min(1, elapsed / duration);

        // Progressão não-linear com variações
        const ease = (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
        const noise = () => (Math.random() - 0.5) * 0.05;

        const myProg  = Math.min(100, ease(t) * myFinalScore  * 100 / 100 + (t < 0.9 ? noise() * 10 : 0));
        const oppProg = Math.min(100, ease(t) * oppFinalScore * 100 / 100 + (t < 0.9 ? noise() * 10 : 0));

        setRaceProgress({ me: Math.max(0, myProg), opp: Math.max(0, oppProg) });

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          setRaceProgress({ me: myFinalScore, opp: oppFinalScore });
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }, []);

  // ── Countdown ────────────────────────────────────────────────
  const runCountdown = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      let c = 3;
      setCountdown(c);
      const id = setInterval(() => {
        c--;
        if (c <= 0) {
          clearInterval(id);
          setCountdown(0);
          resolve();
        } else {
          setCountdown(c);
        }
      }, 1000);
    });
  }, []);

  // ── Iniciar busca ────────────────────────────────────────────
  const joinRace = useCallback(async (
    car: OwnedCar,
    bet: number,
    playerName: string,
    onSpendMoney: (amount: number) => boolean,
    onAddMoney:   (amount: number) => void,
    onUpdateHistory: (carInstanceId: string, record: RaceRecord) => void,
  ) => {
    if (!checkAntiAbuse()) {
      return { success: false, message: 'Limite de corridas atingido. Aguarde 5 minutos.' };
    }

    if (!onSpendMoney(bet)) {
      return { success: false, message: 'Saldo insuficiente para a aposta.' };
    }

    cancelledRef.current = false;
    setState('searching');
    setRaceProgress({ me: 0, opp: 0 });
    setResult(null);

    const myIgp = getFullPerformance(car).igp;

    // Tenta matchmaking Supabase por 10 s
    let foundOpponent: Opponent | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? `anon_${Date.now()}`;

      // Primeiro: tenta encontrar sala esperando com IGP similar (±15)
      const { data: room } = await (supabase as any)
        .from('race_rooms')
        .select('*')
        .eq('status', 'waiting')
        .gte('player1_igp', myIgp - 15)
        .lte('player1_igp', myIgp + 15)
        .limit(1)
        .maybeSingle() as { data: Record<string, unknown> | null };

      if (room && room['id'] && room['player1_id'] !== userId) {
        // Entrou como player2
        await (supabase as any)
          .from('race_rooms')
          .update({
            status:         'ready',
            player2_id:     userId,
            player2_name:   playerName,
            player2_car_name: car.fullName,
            player2_igp:    myIgp,
          })
          .eq('id', room['id']);

        roomIdRef.current = room['id'] as string;
        foundOpponent = {
          id:      room['player1_id'] as string,
          name:    room['player1_name'] as string,
          carName: room['player1_car_name'] as string,
          igp:     room['player1_igp'] as number,
          isBot:   false,
        };
      } else {
        // Cria nova sala e espera 10 s
        const { data: newRoom } = await (supabase as any)
          .from('race_rooms')
          .insert({
            player1_id:       userId,
            player1_name:     playerName,
            player1_car_name: car.fullName,
            player1_igp:      myIgp,
            bet,
            is_bot:           false,
          })
          .select('id')
          .single();

        if (newRoom) roomIdRef.current = newRoom.id;

        // Espera até 10 s por adversário real
        await new Promise<void>(resolve => {
          searchTimer.current = setTimeout(resolve, 10_000);
        });

        if (cancelledRef.current) {
          // Cancela sala e devolve aposta
          if (roomIdRef.current) {
            await (supabase as any)
              .from('race_rooms')
              .update({ status: 'cancelled' })
              .eq('id', roomIdRef.current);
          }
          onAddMoney(bet);
          setState('idle');
          return { success: false, message: 'Busca cancelada.' };
        }

        // Verifica se alguém entrou
        if (roomIdRef.current) {
          const { data: updatedRoom } = await (supabase as any)
            .from('race_rooms')
            .select('*')
            .eq('id', roomIdRef.current)
            .single();

          if (updatedRoom?.player2_id) {
            foundOpponent = {
              id:      updatedRoom.player2_id,
              name:    updatedRoom.player2_name,
              carName: updatedRoom.player2_car_name,
              igp:     updatedRoom.player2_igp,
              isBot:   false,
            };
          }
        }
      }
    } catch {
      // Sem conexão — usa bot
    }

    // Sem adversário real: usa bot
    if (!foundOpponent) {
      foundOpponent = randomBot(myIgp);
    }

    if (cancelledRef.current) {
      onAddMoney(bet);
      setState('idle');
      return { success: false, message: 'Busca cancelada.' };
    }

    setOpponent(foundOpponent);
    setState('countdown');

    await runCountdown();

    if (cancelledRef.current) {
      onAddMoney(bet);
      setState('idle');
      return { success: false, message: 'Corrida cancelada.' };
    }

    setState('racing');

    // Cálculo do resultado
    const myScore   = myIgp            * (0.92 + Math.random() * 0.16);
    const oppScore  = foundOpponent.igp * (0.92 + Math.random() * 0.16);
    const won       = myScore > oppScore;
    const pot       = bet * 2;
    const payout    = won ? Math.round(pot * 0.90) : 0;

    // Progresso visual em %
    const maxScore = Math.max(myScore, oppScore, 1);
    await animateRace(
      Math.round((myScore  / maxScore) * 100),
      Math.round((oppScore / maxScore) * 100),
    );

    const record: RaceRecord = {
      id:            `race_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      opponentName:  foundOpponent.name,
      opponentCar:   foundOpponent.carName,
      myIgp,
      opponentIgp:   foundOpponent.igp,
      bet,
      won,
      payout,
      createdAt:     new Date().toISOString(),
    };

    // Atualiza histórico local
    setRaceHistory(prev => [record, ...prev].slice(0, 50));
    onUpdateHistory(car.instanceId, record);

    if (won) onAddMoney(payout);

    // Atualiza sala no Supabase
    if (roomIdRef.current && !foundOpponent.isBot) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase as any)
          .from('race_rooms')
          .update({
            status:      'finished',
            player1_score: myScore,
            winner_id:   won ? user?.id : foundOpponent.id,
            finished_at: new Date().toISOString(),
          })
          .eq('id', roomIdRef.current);
      } catch {
        // ignora erro de persistência
      }
    }

    recordRace();
    setResult({ won, myScore, opponentScore: oppScore, myIgp, opponentIgp: foundOpponent.igp, payout, bet, record });
    setState('result');

    return { success: true, message: won ? 'Você venceu!' : 'Você perdeu.' };
  }, [animateRace, runCountdown]);

  // ── Cancelar busca ────────────────────────────────────────────
  const cancelSearch = useCallback(() => {
    cancelledRef.current = true;
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────
  const resetRace = useCallback(() => {
    setState('idle');
    setOpponent(null);
    setResult(null);
    setRaceProgress({ me: 0, opp: 0 });
    setCountdown(3);
    roomIdRef.current = null;
  }, []);

  return {
    state,
    opponent,
    countdown,
    raceProgress,
    result,
    raceHistory,
    joinRace,
    cancelSearch,
    resetRace,
  };
}
