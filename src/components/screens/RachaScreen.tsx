// =====================================================================
// RachaScreen — Sistema de Racha Assíncrono
// Sub-abas Lobbies / Histórico
// Animação de corrida 20s + estatísticas 1000m
// =====================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Plus, Users, Clock, RefreshCw, ArrowLeft, Trophy, ChevronRight, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState, OwnedCar } from '@/types/game';
import type { TuneUpgrade, RaceRecord } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';
import {
  useRachaLobby,
  type OpenLobby,
  type RacePlayerAnim,
} from '@/hooks/useRachaLobby';

// ── Props ────────────────────────────────────────────────────────
interface RachaScreenProps {
  gameState:        GameState;
  onSpendMoney:     (amount: number) => boolean;
  onAddMoney:       (amount: number) => void;
  onRaceWon?:       () => void;
  onUpdateCarTunes: (carInstanceId: string, upgrades: TuneUpgrade[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v);

const BET_PRESETS = [500, 1_000, 5_000, 10_000, 25_000];

function igpClass(igp: number) {
  if (igp > 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  if (igp > 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  return 'text-red-400 bg-red-500/10 border-red-500/25';
}

function positionMedal(pos: number) {
  return pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}º`;
}

function positionColor(pos: number) {
  if (pos === 1) return 'text-yellow-400';
  if (pos === 2) return 'text-gray-300';
  if (pos === 3) return 'text-amber-600';
  return 'text-muted-foreground';
}

/** Tempo estimado em segundos para 1000m baseado no score do servidor */
function calcRaceTimeSec(score: number): number {
  return Math.max(12, 40 - score * 0.22);
}

/** Velocidade máxima estimada (km/h) */
function calcTopSpeed(timeSec: number): number {
  const avgKmh = (1000 / timeSec) * 3.6;
  return Math.round(avgKmh * 1.42);
}

/** Velocidade média (km/h) */
function calcAvgSpeed(timeSec: number): number {
  return Math.round((1000 / timeSec) * 3.6);
}

/** Easing suave para a animação da barra */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Formato mm:ss.d */
function fmtTimer(sec: number): string {
  const s = Math.floor(sec);
  const d = Math.floor((sec - s) * 10);
  return `${String(s).padStart(2, '0')}.${d}s`;
}

// ── Componente principal ─────────────────────────────────────────
export function RachaScreen({ gameState, onSpendMoney, onAddMoney, onRaceWon }: RachaScreenProps) {
  const carsInGarage = gameState.garage
    .filter(s => s.unlocked && s.car)
    .map(s => s.car!);

  const [showCreate,      setShowCreate]      = useState(false);
  const [joinLobbyTarget, setJoinLobbyTarget] = useState<OpenLobby | null>(null);

  const {
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
    refetchLobbies,
  } = useRachaLobby({ onSpendMoney, onAddMoney, onRaceWon });

  // ── criar racha ───────────────────────────────────────────────
  if (showCreate) {
    return (
      <CreateLobbyView
        carsInGarage={carsInGarage}
        gameState={gameState}
        onConfirm={(car, bet, maxPlayers) => {
          setShowCreate(false);
          void createLobby(car, bet, maxPlayers);
        }}
        onBack={() => setShowCreate(false)}
      />
    );
  }

  // ── entrar em lobby ───────────────────────────────────────────
  if (joinLobbyTarget) {
    return (
      <JoinLobbyView
        lobby={joinLobbyTarget}
        carsInGarage={carsInGarage}
        gameState={gameState}
        onConfirm={(car) => {
          const target = joinLobbyTarget;
          setJoinLobbyTarget(null);
          void joinLobby(target, car);
        }}
        onBack={() => setJoinLobbyTarget(null)}
      />
    );
  }

  // ── animação de corrida (20s) ─────────────────────────────────
  if (state === 'racing' && currentResultPlayers) {
    return (
      <RacingView
        players={currentResultPlayers}
        myUserId={myUserId}
        onFinish={finishRace}
      />
    );
  }

  // ── resultado com estatísticas ────────────────────────────────
  if (state === 'result' && currentResultPlayers) {
    return (
      <ResultView
        players={currentResultPlayers}
        myUserId={myUserId}
        onBack={dismissResult}
      />
    );
  }

  // ── idle — lista principal ────────────────────────────────────
  return (
    <LobbyListView
      openLobbies={openLobbies}
      pendingResults={pendingResults}
      carsInGarage={carsInGarage}
      gameState={gameState}
      myUserId={myUserId}
      myName={myName}
      isLoading={isLoading}
      error={error}
      successMessage={successMessage}
      raceHistory={raceHistory}
      onShowCreate={() => setShowCreate(true)}
      onJoinTarget={(lobby) => setJoinLobbyTarget(lobby)}
      onRefresh={refetchLobbies}
      onCollect={collectResult}
      onLeave={leaveLobby}
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-views
// ══════════════════════════════════════════════════════════════════

// ── Lista principal com sub-abas ──────────────────────────────────
interface LobbyListViewProps {
  openLobbies:    OpenLobby[];
  pendingResults: OpenLobby[];
  carsInGarage:   OwnedCar[];
  gameState:      GameState;
  myUserId:       string | null;
  myName:         string;
  isLoading:      boolean;
  error:          string | null;
  successMessage: string | null;
  raceHistory:    RaceRecord[];
  onShowCreate:   () => void;
  onJoinTarget:   (lobby: OpenLobby) => void;
  onRefresh:      () => void;
  onCollect:      (lobby: OpenLobby) => void;
  onLeave:        (lobbyId: string, bet: number) => void;
}

function LobbyListView({
  openLobbies, pendingResults, carsInGarage, gameState,
  myUserId, isLoading, error, successMessage, raceHistory,
  onShowCreate, onJoinTarget, onRefresh, onCollect, onLeave,
}: LobbyListViewProps) {
  type Tab = 'lobbies' | 'historico';
  const [tab, setTab] = useState<Tab>('lobbies');

  const myActiveLobbies = openLobbies.filter(
    l => l.players.some(p => p.userId === myUserId),
  );
  const joinableLobbies = openLobbies.filter(
    l => !l.players.some(p => p.userId === myUserId),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            Rachas
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            PvP · 1000m · Até 4 jogadores
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-1.5 text-[12px]"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          {carsInGarage.length > 0 && tab === 'lobbies' && (
            <Button size="sm" className="gap-1.5 text-[12px]" onClick={onShowCreate}>
              <Plus size={14} />
              Criar
            </Button>
          )}
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        {(['lobbies', 'historico'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
              tab === t
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'lobbies' ? (
              <span className="flex items-center justify-center gap-1.5">
                <Zap size={12} />
                Lobbies
                {pendingResults.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-yellow-400 text-black text-[9px] font-black flex items-center justify-center">
                    {pendingResults.length}
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Trophy size={12} />
                Histórico
                {raceHistory.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({raceHistory.length})
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mensagens */}
      {successMessage && (
        <div className="px-4 py-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[12px] font-medium">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 rounded-[12px] bg-red-500/10 border border-red-500/25 text-red-400 text-[12px]">
          {error}
        </div>
      )}

      {/* ── Aba: Lobbies ─────────────────────────────────────────── */}
      {tab === 'lobbies' && (
        <>
          {carsInGarage.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-5xl">🏁</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Garagem vazia</div>
              <div className="text-[11px] text-muted-foreground">Compre um carro para participar</div>
            </div>
          ) : (
            <>
              {/* Resultados pendentes */}
              {pendingResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold px-1 flex items-center gap-1.5">
                    🏆 Resultados Disponíveis
                    <span className="w-4 h-4 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center">
                      {pendingResults.length}
                    </span>
                  </div>
                  {pendingResults.map(lobby => (
                    <PendingResultCard
                      key={lobby.id}
                      lobby={lobby}
                      myUserId={myUserId}
                      onCollect={() => onCollect(lobby)}
                    />
                  ))}
                </div>
              )}

              {/* Meus rachas ativos */}
              {myActiveLobbies.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-primary/80 font-semibold px-1">
                    Meus Rachas
                  </div>
                  {myActiveLobbies.map(lobby => (
                    <LobbyCard
                      key={lobby.id}
                      lobby={lobby}
                      canJoin={false}
                      isOwn={true}
                      onJoin={() => {}}
                      onLeave={() => onLeave(lobby.id, lobby.bet)}
                    />
                  ))}
                </div>
              )}

              {/* Lobbies abertos */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                  Lobbies Abertos
                </div>
                {joinableLobbies.length === 0 ? (
                  <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
                    <div className="text-3xl">🕹️</div>
                    <div className="text-[13px] text-muted-foreground">Nenhum lobby aberto</div>
                    <div className="text-[11px] text-muted-foreground">Crie um racha para começar!</div>
                  </div>
                ) : (
                  joinableLobbies.map(lobby => (
                    <LobbyCard
                      key={lobby.id}
                      lobby={lobby}
                      canJoin={gameState.money >= lobby.bet}
                      onJoin={() => onJoinTarget(lobby)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Aba: Histórico ───────────────────────────────────────── */}
      {tab === 'historico' && (
        <RaceHistoryTab history={raceHistory} />
      )}
    </div>
  );
}

// ── Card de resultado pendente ────────────────────────────────────
function PendingResultCard({
  lobby, myUserId, onCollect,
}: {
  lobby:     OpenLobby;
  myUserId:  string | null;
  onCollect: () => void;
}) {
  const myPlayer = lobby.players.find(p => p.userId === myUserId);

  return (
    <div className="ios-surface rounded-[14px] p-3.5 border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-3">
        <span className="text-3xl shrink-0">🏆</span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[13px] font-bold text-emerald-400">Resultado disponível!</p>
          <p className="text-[11px] text-muted-foreground">
            {lobby.players.length} jogadores ·{' '}
            {myPlayer && <span>{myPlayer.carIcon} {myPlayer.carName} · </span>}
            Aposta {fmt(lobby.bet)}
          </p>
        </div>
        <Button size="sm" onClick={onCollect} className="text-[12px] px-4 shrink-0 gap-1">
          <Flag size={12} />
          Correr
        </Button>
      </div>
    </div>
  );
}

// ── Card de lobby ─────────────────────────────────────────────────
function LobbyCard({
  lobby, canJoin, isOwn = false, onJoin, onLeave,
}: {
  lobby:    OpenLobby;
  canJoin:  boolean;
  isOwn?:   boolean;
  onJoin:   () => void;
  onLeave?: () => void;
}) {
  const currentPlayers = lobby.players.length;

  return (
    <div className={`ios-surface rounded-[14px] p-3.5 flex items-center gap-3 ${
      isOwn ? 'border border-primary/20 bg-primary/3' : ''
    }`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[13px] text-foreground truncate">{lobby.hostName}</span>
          {isOwn && (
            <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full">
              Seu lobby
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {lobby.players[0]?.carName ?? '—'}
          {lobby.players[0]?.igp != null && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${igpClass(lobby.players[0].igp)}`}>
              IGP {lobby.players[0].igp}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-400 font-semibold">{fmt(lobby.bet)}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users size={10} />
            {currentPlayers}/{lobby.maxPlayers}
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: lobby.maxPlayers }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < currentPlayers ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {!isOwn && (
        <Button
          size="sm"
          disabled={!canJoin}
          onClick={onJoin}
          className="text-[12px] px-3 shrink-0"
        >
          Entrar
        </Button>
      )}

      {isOwn && onLeave && (
        <Button
          size="sm"
          variant="outline"
          onClick={onLeave}
          className="text-[11px] px-2.5 shrink-0 text-red-400 border-red-500/30 hover:bg-red-500/10"
        >
          Sair
        </Button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// RacingView — animação de 20 segundos
// ══════════════════════════════════════════════════════════════════
function RacingView({
  players,
  myUserId,
  onFinish,
}: {
  players:  RacePlayerAnim[];
  myUserId: string | null;
  onFinish: () => void;
}) {
  const RACE_DURATION = 20_000; // 20 segundos

  const sorted     = [...players].sort((a, b) => a.position - b.position);
  const winner     = sorted[0];
  const winnerTime = calcRaceTimeSec(winner?.score ?? 60);

  // Progresso animado de cada carro (0→finalPct)
  const [progresses, setProgresses] = useState<Record<string, number>>(
    () => Object.fromEntries(players.map(p => [p.userId, 0])),
  );
  const [elapsed,   setElapsed]   = useState(0);
  const [finished,  setFinished]  = useState(false);
  const [finishIdx, setFinishIdx] = useState<number | null>(null); // posição exibida quando chega

  const startRef     = useRef<number | null>(null);
  const rafRef       = useRef<number | null>(null);
  const finishedRef  = useRef(false);
  const onFinishRef  = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  const tick = useCallback((now: number) => {
    if (startRef.current === null) startRef.current = now;
    const delta = Math.min(now - startRef.current, RACE_DURATION);
    const t     = delta / RACE_DURATION;            // 0 → 1
    const ease  = easeInOut(t);

    // Timer exibido: sobe até o tempo do vencedor
    setElapsed(ease * winnerTime);

    // Barra de cada piloto
    const next: Record<string, number> = {};
    players.forEach(p => {
      next[p.userId] = ease * p.finalPct;
    });
    setProgresses(next);

    // Detecta chegada do vencedor (barra ≥ 95%)
    if (ease >= 0.95 && finishIdx === null) {
      setFinishIdx(winner?.position ?? 1);
    }

    if (delta < RACE_DURATION) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (!finishedRef.current) {
        finishedRef.current = true;
        setFinished(true);
        // Auto-avança para resultado após 2.5s
        setTimeout(() => onFinishRef.current(), 2_500);
      }
    }
  }, [players, winnerTime, winner, finishIdx]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Inicia apenas uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const laneColors: Record<number, string> = {
    1: 'bg-yellow-400',
    2: 'bg-gray-300',
    3: 'bg-amber-500',
    4: 'bg-blue-400',
  };

  return (
    <div className="space-y-4">
      {/* Header da corrida */}
      <div className="ios-surface rounded-[20px] p-5 text-center space-y-2 border border-primary/20">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🏁</span>
          <span className="font-black text-[18px] text-foreground tracking-wider uppercase">
            1000M — EM CORRIDA
          </span>
          <span className="text-2xl">🏁</span>
        </div>

        {/* Timer */}
        <div className="font-mono text-[38px] font-black tabular-nums text-primary leading-none">
          {fmtTimer(elapsed)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {finished ? '🏆 Corrida encerrada!' : '⚡ Em andamento...'}
        </div>
      </div>

      {/* Pista — cada piloto */}
      <div className="space-y-3">
        {sorted.map((p, idx) => {
          const isMe   = p.isMe || p.userId === myUserId;
          const prog   = progresses[p.userId] ?? 0;
          const color  = laneColors[idx + 1] ?? 'bg-primary';
          const arrived = prog >= p.finalPct * 0.99;

          return (
            <div
              key={p.userId}
              className={`ios-surface rounded-[16px] p-3.5 space-y-2 ${
                isMe ? 'border border-primary/30 bg-primary/3' : ''
              }`}
            >
              {/* Linha de info */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.carIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5 truncate">
                    {p.name}
                    {isMe && (
                      <span className="text-[10px] text-primary font-normal">(você)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {p.carName}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${igpClass(p.igp)}`}>
                    IGP {p.igp}
                  </span>
                  {arrived && finished && (
                    <div className={`mt-1 text-[11px] font-bold ${positionColor(p.position)}`}>
                      {positionMedal(p.position)}
                    </div>
                  )}
                </div>
              </div>

              {/* Pista com barra de progresso */}
              <div className="relative h-5 rounded-full overflow-hidden bg-muted/40 border border-border/20">
                {/* Linhas da pista */}
                {[25, 50, 75].map(pct => (
                  <div
                    key={pct}
                    className="absolute top-0 bottom-0 w-px bg-border/20"
                    style={{ left: `${pct}%` }}
                  />
                ))}

                {/* Barra de progresso */}
                <div
                  className={`absolute left-0 top-0 bottom-0 ${color} transition-none rounded-full`}
                  style={{ width: `${prog}%` }}
                />

                {/* Ícone do carro na barra */}
                <div
                  className="absolute top-0 bottom-0 flex items-center transition-none"
                  style={{
                    left: `calc(${Math.max(prog - 2, 0)}% - 10px)`,
                    fontSize: '14px',
                    lineHeight: 1,
                  }}
                >
                  {p.carIcon}
                </div>

                {/* Bandeirada */}
                {arrived && (
                  <div className="absolute right-1 top-0 bottom-0 flex items-center">
                    <span className="text-[12px]">🏁</span>
                  </div>
                )}
              </div>

              {/* Porcentagem */}
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>0m</span>
                <span className="text-primary font-semibold">{Math.round(prog * 10)}m / 1000m</span>
                <span>1000m</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão manual (caso queira pular) */}
      {finished && (
        <Button
          className="w-full gap-2 animate-pulse"
          onClick={onFinish}
        >
          <Trophy size={16} />
          Ver Resultado
        </Button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ResultView — classificação final + estatísticas 1000m
// ══════════════════════════════════════════════════════════════════
function ResultView({
  players, myUserId, onBack,
}: {
  players:  RacePlayerAnim[];
  myUserId: string | null;
  onBack:   () => void;
}) {
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const me     = sorted.find(p => p.isMe || p.userId === myUserId);

  // Estatísticas do meu carro
  const myTime    = me ? calcRaceTimeSec(me.score) : null;
  const myAvg     = myTime ? calcAvgSpeed(myTime) : null;
  const myTop     = myTime ? calcTopSpeed(myTime) : null;
  const winnerTime = calcRaceTimeSec(sorted[0]?.score ?? 60);
  const diff       = myTime && myTime !== winnerTime
    ? `+${(myTime - winnerTime).toFixed(1)}s`
    : null;

  return (
    <div className="space-y-4">
      {/* Meu resultado */}
      {me && (
        <div className={`ios-surface rounded-[20px] p-5 text-center border-2 ${
          me.position === 1 ? 'border-yellow-400/50 bg-yellow-400/5'
          : me.position === 2 ? 'border-gray-400/50 bg-gray-400/5'
          : me.position === 3 ? 'border-amber-600/50 bg-amber-600/5'
          : 'border-border bg-muted/20'
        }`}>
          <div className="text-6xl mb-2">{positionMedal(me.position)}</div>
          <div className={`font-black text-[28px] ${positionColor(me.position)}`}>
            {me.position === 1 ? 'VITÓRIA!'
             : me.position === 2 ? '2º LUGAR'
             : me.position === 3 ? '3º LUGAR'
             : `${me.position}º LUGAR`}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-foreground">
            {me.payout > 0
              ? <span className="text-emerald-400">+{fmt(me.payout)}</span>
              : <span className="text-muted-foreground">Nenhum prêmio</span>
            }
          </div>
          {diff && (
            <div className="mt-1 text-[12px] text-red-400 font-semibold">{diff} do vencedor</div>
          )}
        </div>
      )}

      {/* Estatísticas do meu racha */}
      {me && myTime && myAvg && myTop && (
        <div className="ios-surface rounded-[16px] p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Flag size={11} />
            Estatísticas da Prova — 1000m
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Distância" value="1.000m" icon="📏" />
            <StatCard
              label="Tempo de Prova"
              value={`${myTime.toFixed(2)}s`}
              icon="⏱"
              highlight={me.position === 1}
            />
            <StatCard label="Vel. Média" value={`${myAvg} km/h`} icon="🚗" />
            <StatCard label="Vel. Máxima" value={`${myTop} km/h`} icon="⚡" />
            <StatCard label="IGP" value={String(me.igp)} icon="📊" />
            <StatCard
              label="Score"
              value={me.score.toFixed(1)}
              icon="🎯"
            />
          </div>

          {/* Linha do vencedor para comparação */}
          {me.position !== 1 && sorted[0] && (
            <div className="border-t border-border/40 pt-3 space-y-1">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                Vencedor
              </div>
              <div className="flex items-center gap-2">
                <span>{sorted[0].carIcon}</span>
                <span className="text-[12px] text-foreground font-semibold flex-1 truncate">
                  {sorted[0].name}
                </span>
                <span className="text-[12px] text-yellow-400 font-mono font-bold">
                  {calcRaceTimeSec(sorted[0].score).toFixed(2)}s
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classificação completa */}
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Classificação Final
        </div>
        {sorted.map(p => {
          const t = calcRaceTimeSec(p.score);
          return (
            <div
              key={p.userId}
              className={`flex items-center gap-3 p-2.5 rounded-[12px] ${
                p.isMe || p.userId === myUserId
                  ? 'bg-primary/5 border border-primary/20'
                  : 'bg-muted/20'
              }`}
            >
              <span className="text-[18px] w-8 text-center shrink-0">
                {positionMedal(p.position)}
              </span>
              <span className="text-xl">{p.carIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">
                  {p.name}
                  {(p.isMe || p.userId === myUserId) && (
                    <span className="ml-1.5 text-[10px] text-primary font-normal">(você)</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span>{p.carName}</span>
                  <span>·</span>
                  <span className="font-mono text-yellow-300/70">{t.toFixed(2)}s</span>
                  <span>·</span>
                  <span>{calcAvgSpeed(t)} km/h</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {p.payout > 0
                  ? <div className="text-[12px] font-bold text-emerald-400">+{fmt(p.payout)}</div>
                  : <div className="text-[12px] text-muted-foreground">—</div>
                }
                <div className="text-[10px] text-muted-foreground">
                  IGP {p.igp}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button className="w-full gap-2" onClick={onBack}>
        <ArrowLeft size={14} />
        Voltar aos Lobbies
      </Button>
    </div>
  );
}

// ── Cartão de estatística individual ─────────────────────────────
function StatCard({
  label, value, icon, highlight = false,
}: {
  label:      string;
  value:      string;
  icon:       string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-[12px] p-3 space-y-1 ${
      highlight ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-muted/30'
    }`}>
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`text-[16px] font-black tabular-nums ${
        highlight ? 'text-yellow-400' : 'text-foreground'
      }`}>
        {value}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Create / Join views
// ══════════════════════════════════════════════════════════════════

function CreateLobbyView({
  carsInGarage, gameState, onConfirm, onBack,
}: {
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  onConfirm:    (car: OwnedCar, bet: number, maxPlayers: number) => void;
  onBack:       () => void;
}) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar>(carsInGarage[0]!);
  const [bet,         setBet]         = useState(1_000);
  const [customBet,   setCustomBet]   = useState(false);
  const [betInput,    setBetInput]    = useState('');
  const [maxPlayers,  setMaxPlayers]  = useState(2);

  const canCreate = selectedCar && bet > 0 && bet <= gameState.money;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 shrink-0"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-[17px] text-foreground">🏁 Criar Racha</h2>
          <p className="text-[11px] text-muted-foreground">
            1000m · Lobby aberto até lotar
          </p>
        </div>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {fmt(gameState.money)}
        </span>
      </div>

      {/* Carro */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Escolha o Carro
        </div>
        <div className="space-y-2">
          {carsInGarage.map(car => {
            const perf = getFullPerformance(car);
            const sel  = selectedCar?.instanceId === car.instanceId;
            return (
              <button
                key={car.instanceId}
                onClick={() => setSelectedCar(car)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-[14px] text-left transition-all active:scale-[0.98] ${
                  sel
                    ? 'bg-primary/10 border border-primary/40'
                    : 'ios-surface border border-transparent'
                }`}
              >
                <span className="text-3xl">{car.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{car.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{car.year}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] font-black border ${igpClass(perf.igp)}`}>
                  IGP {perf.igp}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Máx. jogadores */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Máx. Jogadores
        </div>
        <div className="flex gap-2">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setMaxPlayers(n)}
              className={`flex-1 py-3 rounded-[12px] text-[15px] font-bold transition-all active:scale-95 ${
                maxPlayers === n ? 'bg-primary text-primary-foreground' : 'ios-surface text-foreground'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Aposta */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Aposta
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {BET_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setBet(p); setCustomBet(false); setBetInput(''); }}
              className={`px-3 py-2 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                !customBet && bet === p ? 'bg-primary text-primary-foreground' : 'ios-surface text-foreground'
              }`}
            >
              {fmt(p)}
            </button>
          ))}
          <button
            onClick={() => setCustomBet(v => !v)}
            className={`px-3 py-2 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
              customBet ? 'bg-primary text-primary-foreground' : 'ios-surface text-foreground'
            }`}
          >
            Outro
          </button>
        </div>
        {customBet && (
          <input
            type="number"
            inputMode="numeric"
            value={betInput}
            onChange={e => {
              setBetInput(e.target.value);
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setBet(Math.round(v));
            }}
            placeholder="Valor personalizado"
            className="w-full ios-surface rounded-[12px] px-4 py-3 text-[14px] text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary mb-3"
          />
        )}
        <div className="ios-surface rounded-[14px] p-4 space-y-2.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Pot total</span>
            <span className="font-bold text-foreground">{fmt(bet * maxPlayers)}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">🥇 1º lugar recebe</span>
            <span className="font-bold text-emerald-400">{fmt(Math.round(bet * maxPlayers * 0.95))}</span>
          </div>
          <div className="border-t border-border/40 pt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Taxa do sistema</span>
            <span>5%</span>
          </div>
        </div>
        {bet > gameState.money && (
          <p className="text-[13px] text-red-400 mt-2 font-semibold">⚠️ Saldo insuficiente</p>
        )}
      </div>

      <Button
        className="w-full h-12 text-[15px] font-bold gap-2"
        disabled={!canCreate}
        onClick={() => onConfirm(selectedCar!, bet, maxPlayers)}
      >
        <Zap size={16} />
        Criar Racha · {fmt(bet)}
      </Button>
    </div>
  );
}

function JoinLobbyView({
  lobby, carsInGarage, gameState, onConfirm, onBack,
}: {
  lobby:        OpenLobby;
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  onConfirm:    (car: OwnedCar) => void;
  onBack:       () => void;
}) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar>(carsInGarage[0]!);
  const canJoin = gameState.money >= lobby.bet;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 shrink-0"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="font-bold text-[17px] text-foreground flex-1">⚡ Entrar no Racha</h2>
      </div>

      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Host</span>
          <span className="font-semibold text-foreground">{lobby.hostName}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Vagas</span>
          <span className="font-semibold text-foreground">{lobby.players.length}/{lobby.maxPlayers}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Aposta</span>
          <span className="font-bold text-emerald-400">{fmt(lobby.bet)}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">🥇 1º lugar recebe</span>
          <span className="font-bold text-yellow-400">{fmt(Math.round(lobby.bet * lobby.maxPlayers * 0.95))}</span>
        </div>
        <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <Flag size={9} />
          Corrida de 1000m — resultado automático quando lotar
        </div>
      </div>

      {lobby.players.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            No lobby
          </div>
          <div className="space-y-2">
            {lobby.players.map(p => (
              <div key={p.userId} className="ios-surface flex items-center gap-3 rounded-[12px] px-3 py-2.5">
                <span className="text-2xl">{p.carIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.carName}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${igpClass(p.igp)}`}>
                  IGP {p.igp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Seu Carro
        </div>
        <div className="space-y-2">
          {carsInGarage.map(car => {
            const perf = getFullPerformance(car);
            const sel  = selectedCar?.instanceId === car.instanceId;
            return (
              <button
                key={car.instanceId}
                onClick={() => setSelectedCar(car)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-[14px] text-left transition-all active:scale-[0.98] ${
                  sel
                    ? 'bg-primary/10 border border-primary/40'
                    : 'ios-surface border border-transparent'
                }`}
              >
                <span className="text-3xl">{car.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{car.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{car.year}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] font-black border ${igpClass(perf.igp)}`}>
                  IGP {perf.igp}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!canJoin && (
        <p className="text-[13px] text-red-400 font-semibold">⚠️ Saldo insuficiente para esta aposta</p>
      )}

      <Button
        className="w-full h-12 text-[15px] font-bold gap-2"
        disabled={!canJoin || !selectedCar}
        onClick={() => onConfirm(selectedCar!)}
      >
        <Zap size={16} />
        Confirmar · {fmt(lobby.bet)}
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Histórico completo (sub-aba)
// ══════════════════════════════════════════════════════════════════
function RaceHistoryTab({ history }: { history: RaceRecord[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-14 space-y-2">
        <div className="text-5xl">🏁</div>
        <div className="text-[14px] font-semibold text-muted-foreground">Sem corridas ainda</div>
        <div className="text-[11px] text-muted-foreground">
          Participe de um racha para ver seu histórico aqui
        </div>
      </div>
    );
  }

  const wins   = history.filter(r => r.won || r.myPosition === 1).length;
  const total  = history.length;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalEarned = history.reduce((s, r) => s + (r.payout > 0 ? r.payout - r.bet : -r.bet), 0);

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="ios-surface rounded-[16px] p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
          <Trophy size={11} />
          Resumo Geral
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[20px] font-black text-foreground">{total}</div>
            <div className="text-[10px] text-muted-foreground">Corridas</div>
          </div>
          <div>
            <div className="text-[20px] font-black text-yellow-400">{wins}</div>
            <div className="text-[10px] text-muted-foreground">Vitórias</div>
          </div>
          <div>
            <div className="text-[20px] font-black text-emerald-400">{winPct}%</div>
            <div className="text-[10px] text-muted-foreground">Win rate</div>
          </div>
        </div>
        {/* Saldo líquido */}
        <div className={`mt-3 pt-3 border-t border-border/40 text-center text-[13px] font-bold ${
          totalEarned >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {totalEarned >= 0 ? '+' : ''}{fmt(totalEarned)} líquido
        </div>
      </div>

      {/* Lista de corridas */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Corridas ({total})
        </div>
        {history.map(r => {
          const pos       = r.myPosition ?? (r.won ? 1 : 2);
          const netResult = r.payout > 0 ? r.payout - r.bet : -r.bet;

          return (
            <div key={r.id} className="ios-surface rounded-[14px] p-3.5 space-y-2">
              {/* Linha principal */}
              <div className="flex items-center gap-3">
                <span className="text-[22px]">{positionMedal(pos)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground">
                    {r.participants
                      ? `${r.totalPlayers ?? '?'} pilotos · ${pos}º lugar`
                      : `vs. ${r.opponentName}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock size={9} />
                    {new Date(r.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className={`text-[14px] font-black tabular-nums ${
                  netResult >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {netResult >= 0 ? '+' : ''}{fmt(netResult)}
                </div>
              </div>

              {/* Sub-info */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border/20 pt-2">
                <span>Aposta {fmt(r.bet)}</span>
                {r.myIgp > 0 && <span>· IGP {r.myIgp}</span>}
                {r.payout > 0 && <span className="text-emerald-400 font-semibold">· Prêmio {fmt(r.payout)}</span>}
              </div>

              {/* Participantes */}
              {r.participants && r.participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {r.participants.map(p => (
                    <div
                      key={p.userId}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                        p.position === 1
                          ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                          : 'bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <span>{positionMedal(p.position)}</span>
                      <span className="truncate max-w-[80px]">{p.name}</span>
                      <ChevronRight size={8} className="shrink-0 opacity-50" />
                      <span className="font-mono">{calcRaceTimeSec(p.igp + 10).toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
