// =====================================================================
// RachaScreen — Sistema de Racha Assíncrono
// Sub-abas Lobbies / Histórico
// Contagem regressiva + animação de corrida + narração + estatísticas
// =====================================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

/**
 * Tempo estimado em segundos para 1000m baseado no score.
 * score 0  → ~35s (popular lento)
 * score 40 → ~25s (popular bom)
 * score 70 → ~16s (esportivo)
 * score 90 → ~12s (supercar)
 */
function calcRaceTimeSec(score: number): number {
  const s = Math.max(0, Math.min(score, 100));
  return Math.max(11, 35 - s * 0.24);
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

/** Formato ss.d */
function fmtTimer(sec: number): string {
  const s = Math.floor(sec);
  const d = Math.floor((sec - s) * 10);
  return `${String(s).padStart(2, '0')}.${d}s`;
}

// ── Constantes do circuito (3 voltas × 1000 m) ───────────────────
const LAPS       = 3;
const LAP_METERS = 1_000;

// Geometria do oval SVG
const TRK_CX = 155, TRK_CY = 87;
const TRK_RX = 118, TRK_RY = 50;

/** Cores por índice de piloto (posição final) */
const PLAYER_COLORS = ['#facc15', '#94a3b8', '#f97316', '#60a5fa'] as const;

/**
 * Converte uma fração de volta (0–1) em coordenadas {x,y} no SVG.
 * Sentido horário, começando no topo (linha de largada).
 */
function trackPt(lapFrac: number): { x: number; y: number } {
  const frac = ((lapFrac % 1) + 1) % 1;
  const θ    = -Math.PI / 2 + frac * 2 * Math.PI;
  return {
    x: TRK_CX + TRK_RX * Math.cos(θ),
    y: TRK_CY + TRK_RY * Math.sin(θ),
  };
}

/**
 * Ruído sinusoidal para simular ultrapassagens.
 * Amplitude: ≈ ±1. Funde suavemente a 0 conforme t → 0.6.
 */
function racingNoise(t: number, seed: number): number {
  const fade = Math.max(0, 1 - t * 1.7);
  return (
    Math.sin(t * 9.3  + seed * 6.1) * 0.40 +
    Math.sin(t * 5.7  + seed * 3.4) * 0.35 +
    Math.sin(t * 14.1 + seed * 8.7) * 0.25
  ) * fade;
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
        myName={myName}
        onConfirm={(car) => {
          const target = joinLobbyTarget;
          setJoinLobbyTarget(null);
          void joinLobby(target, car);
        }}
        onBack={() => setJoinLobbyTarget(null)}
      />
    );
  }

  // ── animação de corrida ───────────────────────────────────────
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
            PvP · {LAPS} voltas · {LAP_METERS * LAPS}m · Até 4 jogadores
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
  const prize    = Math.round(lobby.bet * lobby.players.length * 0.95);

  return (
    <div className="ios-surface rounded-[14px] p-3.5 border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-3">
        <span className="text-3xl shrink-0 animate-bounce">🏆</span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[13px] font-bold text-emerald-400">Resultado disponível!</p>
          <p className="text-[11px] text-muted-foreground">
            {lobby.players.length} pilotos ·{' '}
            {myPlayer && <span>{myPlayer.carIcon} {myPlayer.carName} · </span>}
            Aposta {fmt(lobby.bet)} · Pot {fmt(prize)}
          </p>
        </div>
        <Button size="sm" onClick={onCollect} className="text-[12px] px-4 shrink-0 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white">
          <Flag size={12} />
          Ver corrida
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
  const spotsLeft = lobby.maxPlayers - currentPlayers;

  return (
    <div className={`ios-surface rounded-[14px] p-3.5 space-y-2.5 ${
      isOwn ? 'border border-primary/25 bg-primary/3' : ''
    }`}>
      {/* Linha superior: host + aposta + vagas */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[13px] text-foreground truncate">{lobby.hostName}</span>
            {isOwn && (
              <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full">
                Seu lobby
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-400 font-semibold">{fmt(lobby.bet)}</span>
            <span className="text-muted-foreground">pot {fmt(Math.round(lobby.bet * lobby.maxPlayers * 0.95))}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users size={10} />
              {currentPlayers}/{lobby.maxPlayers}
            </span>
          </div>
        </div>

        {/* Vagas visuais */}
        <div className="flex gap-1 items-center">
          {Array.from({ length: lobby.maxPlayers }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < currentPlayers ? 'bg-primary' : 'bg-muted border border-border'
              }`}
            />
          ))}
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

      {/* Pilotos no lobby */}
      {lobby.players.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5 border-t border-border/20">
          {lobby.players.map((p, i) => (
            <div
              key={p.userId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                i === 0
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <span>{p.carIcon}</span>
              <span className="truncate max-w-[70px]">{p.carName}</span>
              <span className="font-bold opacity-70">IGP {p.igp}</span>
            </div>
          ))}
          {spotsLeft > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted/30 text-muted-foreground border border-dashed border-border/40">
              +{spotsLeft} vaga{spotsLeft > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TrackSVG — pista oval com carros animados
// ══════════════════════════════════════════════════════════════════
interface TrackSVGProps {
  players:  RacePlayerAnim[];
  lapProgs: Record<string, number>; // userId → voltas percorridas (0 → LAPS)
  posMaps:  Record<string, number>; // userId → posição visual em tempo real
  myUserId: string | null;
}

function TrackSVG({ players, lapProgs, posMaps, myUserId }: TrackSVGProps) {
  const sfPt = trackPt(0);

  // Z-ordering: carros mais baixos no SVG (y maior) ficam na frente
  const zSorted = [...players].sort((a, b) => {
    const ya = trackPt((lapProgs[a.userId] ?? 0) % 1).y;
    const yb = trackPt((lapProgs[b.userId] ?? 0) % 1).y;
    return ya - yb;
  });

  return (
    <svg viewBox="0 0 310 178" className="w-full select-none" style={{ maxHeight: 200 }}>
      {/* Fundo */}
      <rect width={310} height={178} fill="#111827" rx={12} />

      {/* Área externa da pista */}
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX + 16} ry={TRK_RY + 16} fill="#1c1917" />

      {/* Asfalto */}
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX} ry={TRK_RY}
        fill="none" stroke="#374151" strokeWidth={28} />

      {/* Gramado interno */}
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX - 16} ry={TRK_RY - 16}
        fill="#14532d" opacity={0.65} />

      {/* Bordas brancas */}
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX + 15} ry={TRK_RY + 15}
        fill="none" stroke="white" strokeWidth={1.2} opacity={0.2} />
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX - 15} ry={TRK_RY - 15}
        fill="none" stroke="white" strokeWidth={1.2} opacity={0.2} />

      {/* Faixa central tracejada */}
      <ellipse cx={TRK_CX} cy={TRK_CY} rx={TRK_RX} ry={TRK_RY}
        fill="none" stroke="#6b7280" strokeWidth={0.8} strokeDasharray="10 8" opacity={0.35} />

      {/* Marcadores de setor S1 / S2 */}
      {([0.333, 0.667] as const).map((frac, i) => {
        const pt = trackPt(frac);
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={3}
              fill="none" stroke="#6b7280" strokeWidth={1.2} opacity={0.5} />
            <text x={pt.x + 5} y={pt.y + 3} fontSize={5.5} fill="#6b7280" opacity={0.6}>
              S{i + 1}
            </text>
          </g>
        );
      })}

      {/* Linha de Largada / Chegada (xadrez) */}
      <line
        x1={sfPt.x} y1={TRK_CY - TRK_RY - 15}
        x2={sfPt.x} y2={TRK_CY - TRK_RY + 15}
        stroke="white" strokeWidth={2.5} opacity={0.85}
      />
      {[0, 1, 2, 3].map(i => (
        <rect key={i}
          x={sfPt.x - 1.5} y={TRK_CY - TRK_RY - 15 + i * 7.5}
          width={3} height={3.5}
          fill={i % 2 === 0 ? 'black' : 'white'} opacity={0.7}
        />
      ))}
      <text x={sfPt.x + 7} y={TRK_CY - TRK_RY - 5}
        fontSize={6} fill="#facc15" fontWeight="bold" opacity={0.9}>
        S/F
      </text>

      {/* Texto central */}
      <text x={TRK_CX} y={TRK_CY - 5} textAnchor="middle"
        fontSize={8} fill="#9ca3af" fontWeight="bold" letterSpacing={1}>
        {LAPS} VOLTAS
      </text>
      <text x={TRK_CX} y={TRK_CY + 7} textAnchor="middle"
        fontSize={7} fill="#6b7280">
        {LAP_METERS * LAPS / 1000}km
      </text>

      {/* Carros — z-ordenados por Y */}
      {zSorted.map(p => {
        const pIdx   = players.indexOf(p);
        const prog   = lapProgs[p.userId] ?? 0;
        const pt     = trackPt(prog % 1);
        const isMe   = p.isMe || p.userId === myUserId;
        const color  = PLAYER_COLORS[pIdx] ?? '#fff';
        const lapNum = Math.min(Math.floor(prog) + 1, LAPS);
        const visPos = posMaps[p.userId] ?? p.position;

        return (
          <g key={p.userId}>
            {isMe && (
              <circle cx={pt.x} cy={pt.y} r={15} fill={color} opacity={0.12} />
            )}
            {/* Sombra */}
            <circle cx={pt.x + 1} cy={pt.y + 2} r={isMe ? 9 : 8}
              fill="black" opacity={0.3} />
            {/* Círculo */}
            <circle cx={pt.x} cy={pt.y} r={isMe ? 9 : 8}
              fill={color} opacity={0.95}
              stroke={isMe ? 'white' : '#111827'}
              strokeWidth={isMe ? 1.8 : 1.2}
            />
            {/* Emoji do carro */}
            <text x={pt.x} y={pt.y + 4} textAnchor="middle"
              fontSize={isMe ? 10 : 9} style={{ userSelect: 'none' }}>
              {p.carIcon}
            </text>
            {/* Volta */}
            <text x={pt.x + (isMe ? 13 : 11)} y={pt.y - 9}
              fontSize={6} fill={color} fontWeight="bold" opacity={0.95}>
              V{lapNum}
            </text>
            {/* Posição visual */}
            <text x={pt.x - (isMe ? 13 : 11)} y={pt.y - 9}
              fontSize={6} fill="white" fontWeight="bold" opacity={0.7}>
              {visPos}°
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// RacingView — contagem regressiva + pista oval + narração
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
  const RACE_DURATION = 24_000; // 24 s de animação para 3 voltas

  const sorted     = useMemo(() => [...players].sort((a, b) => a.position - b.position), [players]);
  const winner     = sorted[0];
  // Tempo total do vencedor em 3 voltas
  const winnerTime = (winner ? calcRaceTimeSec(winner.score) : 25) * LAPS;

  type Phase = 'countdown' | 'racing' | 'done';
  const [phase,        setPhase]        = useState<Phase>('countdown');
  const [countdownNum, setCountdownNum] = useState<number | 'GO!'>(3);
  // lapProgs: voltas percorridas por piloto (0 → LAPS)
  const [lapProgs,     setLapProgs]     = useState<Record<string, number>>(
    () => Object.fromEntries(players.map(p => [p.userId, 0])),
  );
  // posMaps: posição visual em tempo real
  const [posMaps,      setPosMaps]      = useState<Record<string, number>>(
    () => Object.fromEntries(players.map(p => [p.userId, p.position])),
  );
  // currentLaps: volta atual exibida por piloto
  const [currentLaps,  setCurrentLaps]  = useState<Record<string, number>>(
    () => Object.fromEntries(players.map(p => [p.userId, 1])),
  );
  const [elapsed,      setElapsed]      = useState(0);
  const [commentary,   setCommentary]   = useState('');
  const [photoFinish,  setPhotoFinish]  = useState(false);

  const startRef         = useRef<number | null>(null);
  const rafRef           = useRef<number | null>(null);
  const finishedRef      = useRef(false);
  const finishShownRef   = useRef(false);
  const shownCommentsRef = useRef(new Set<number>());
  const onFinishRef      = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Sementes de ruído estáticas (uma por piloto)
  const noiseSeeds = useMemo(
    () => players.map((_, i) => 1.618 + i * Math.PI),
    [players],
  );

  // Amplitude de ruído: maior para carros com score próximo ao vencedor
  const noiseAmps = useMemo(() => {
    const winScore = winner?.score ?? 60;
    return players.map(p => {
      const diff = Math.abs(p.score - winScore);
      // amp ∈ [0.04, 0.13]: carros similares oscilam mais
      return Math.max(0.04, 0.13 - diff * 0.004);
    });
  }, [players, winner]);

  // Foto-finish: diferença de tempo < 0.5 s entre 1º e 2º
  useEffect(() => {
    if (sorted.length >= 2) {
      const t1 = calcRaceTimeSec(sorted[0]!.score);
      const t2 = calcRaceTimeSec(sorted[1]!.score);
      if (Math.abs(t1 - t2) < 0.5) setPhotoFinish(true);
    }
  }, [sorted]);

  const commentaryLines = useMemo(() => {
    const leader = sorted[0];
    const last   = sorted[sorted.length - 1];
    const icons  = sorted.map(p => p.carIcon).join('');
    return [
      { at: 0.04, text: `🟢 ${icons} — Pistão no fundo!` },
      { at: 0.30, text: leader ? `⚡ ${leader.name} na frente!` : '⚡ Luta pela liderança!' },
      { at: 0.50, text: '🔄 2ª volta — ritmo aumenta!' },
      { at: 0.68, text: last && last.userId !== leader?.userId
          ? `🔥 ${last.name} pressiona de trás!`
          : '🔥 Duelo acirrado na pista!' },
      { at: 0.84, text: photoFinish ? '📸 Vai dar foto-finish!' : '🏁 Última volta — tudo ou nada!' },
    ];
  }, [sorted, photoFinish]);

  // ── Contagem regressiva ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    const steps: Array<number | 'GO!'> = [3, 2, 1, 'GO!'];
    let i = 0;
    setCountdownNum(steps[0]!);
    const timer = setInterval(() => {
      i += 1;
      if (i < steps.length) setCountdownNum(steps[i]!);
      if (i >= steps.length - 1) {
        clearInterval(timer);
        setTimeout(() => setPhase('racing'), 700);
      }
    }, 850);
    return () => clearInterval(timer);
  }, [phase]);

  // ── RAF loop (corrida) ────────────────────────────────────────
  const tick = useCallback((now: number) => {
    if (startRef.current === null) startRef.current = now;
    const delta = Math.min(now - startRef.current, RACE_DURATION);
    const t     = delta / RACE_DURATION; // 0 → 1
    const ease  = easeInOut(t);

    setElapsed(ease * winnerTime);

    const nextProgs: Record<string, number> = {};
    const nextLaps:  Record<string, number> = {};

    players.forEach((p, idx) => {
      const targetLaps = (p.finalPct / 100) * LAPS;
      const base       = ease * targetLaps;
      // Ruído: cria ultrapassagens visuais; funde a 0 no final da corrida
      const noise      = racingNoise(t, noiseSeeds[idx]!) * noiseAmps[idx]!;
      const laps       = Math.max(0, Math.min(base + noise, targetLaps));
      nextProgs[p.userId] = laps;
      nextLaps[p.userId]  = Math.min(Math.floor(laps) + 1, LAPS);
    });

    // Posição visual em tempo real (quem está à frente na pista)
    const nextPos: Record<string, number> = {};
    [...players]
      .sort((a, b) => (nextProgs[b.userId] ?? 0) - (nextProgs[a.userId] ?? 0))
      .forEach((p, i) => { nextPos[p.userId] = i + 1; });

    setLapProgs(nextProgs);
    setPosMaps(nextPos);
    setCurrentLaps(nextLaps);

    commentaryLines.forEach((line, i) => {
      if (t >= line.at && !shownCommentsRef.current.has(i)) {
        shownCommentsRef.current.add(i);
        setCommentary(line.text);
      }
    });

    if (ease >= 0.95 && !finishShownRef.current) {
      finishShownRef.current = true;
    }

    if (delta < RACE_DURATION) {
      rafRef.current = requestAnimationFrame(tick);
    } else if (!finishedRef.current) {
      finishedRef.current = true;
      // Garante posição final correta ao encerrar
      const finalProgs: Record<string, number> = {};
      const finalPos:   Record<string, number> = {};
      players.forEach(p => {
        finalProgs[p.userId] = (p.finalPct / 100) * LAPS;
        finalPos[p.userId]   = p.position;
      });
      setLapProgs(finalProgs);
      setPosMaps(finalPos);
      setCurrentLaps(Object.fromEntries(players.map(p => [p.userId, LAPS])));
      setPhase('done');
      setTimeout(() => onFinishRef.current(), 2_500);
    }
  }, [players, winnerTime, commentaryLines, noiseSeeds, noiseAmps]);

  useEffect(() => {
    if (phase !== 'racing') return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Tela de contagem regressiva ───────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="text-center space-y-2">
          <div className="text-[13px] text-muted-foreground uppercase tracking-widest font-semibold">
            Circuito · {LAPS} voltas · {LAP_METERS * LAPS}m
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            {sorted.map(p => (
              <span key={p.userId}>{p.carIcon} {p.name}</span>
            ))}
          </div>
        </div>

        <div
          key={String(countdownNum)}
          className={`font-black tabular-nums leading-none ${
            countdownNum === 'GO!'
              ? 'text-[72px] text-emerald-400 animate-pulse'
              : 'text-[96px] text-primary'
          }`}
        >
          {countdownNum}
        </div>

        <div className="text-[12px] text-muted-foreground">
          {photoFinish ? '📸 Previsão de foto-finish!' : '🏁 Largada em instantes...'}
        </div>

        <div className="w-full max-w-sm space-y-2 px-4">
          {sorted.map((p, i) => (
            <div key={p.userId} className="flex items-center gap-2 ios-surface rounded-[12px] px-3 py-2">
              <span className="text-[18px]">{p.carIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">
                  {p.name}
                  {(p.isMe || p.userId === myUserId) && (
                    <span className="ml-1 text-[10px] text-primary">(você)</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{p.carName}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${igpClass(p.igp)}`}>
                {i === 0 ? '🏆' : ''} IGP {p.igp}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Tela de corrida (pista SVG + lista de pilotos) ────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="ios-surface rounded-[20px] p-4 text-center space-y-1.5 border border-primary/20">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl">🏁</span>
          <span className="font-black text-[16px] text-foreground tracking-wider uppercase">
            Circuito — {LAPS} Voltas
          </span>
          <span className="text-xl">🏁</span>
        </div>
        <div className="font-mono text-[34px] font-black tabular-nums text-primary leading-none">
          {fmtTimer(elapsed)}
        </div>
        <div className="text-[11px] text-muted-foreground min-h-[16px]">
          {commentary || (phase === 'done' ? '🏆 Corrida encerrada!' : '⚡ Em andamento...')}
        </div>
        {photoFinish && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/40 text-yellow-400 text-[10px] font-bold">
            📸 Foto-Finish
          </div>
        )}
      </div>

      {/* Pista SVG */}
      <div className="ios-surface rounded-[16px] p-3 border border-border/30">
        <TrackSVG
          players={sorted}
          lapProgs={lapProgs}
          posMaps={posMaps}
          myUserId={myUserId}
        />
      </div>

      {/* Lista de pilotos com volta e posição */}
      <div className="space-y-2">
        {sorted.map((p, idx) => {
          const isMe   = p.isMe || p.userId === myUserId;
          const color  = PLAYER_COLORS[idx] ?? '#fff';
          const lapNum = currentLaps[p.userId] ?? 1;
          const visPos = posMaps[p.userId] ?? p.position;

          return (
            <div
              key={p.userId}
              className={`ios-surface rounded-[14px] px-3.5 py-2.5 flex items-center gap-3 ${
                isMe ? 'border border-primary/30 bg-primary/3' : ''
              }`}
            >
              {/* Posição visual */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[13px] shrink-0"
                style={{ background: color, color: '#111' }}
              >
                {visPos}
              </div>
              <span className="text-xl">{p.carIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">
                  {p.name}
                  {isMe && <span className="ml-1 text-[10px] text-primary font-normal">(você)</span>}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{p.carName}</div>
              </div>
              {/* Volta atual */}
              <div className="text-right shrink-0">
                <div className="text-[12px] font-bold" style={{ color }}>
                  V{lapNum}/{LAPS}
                </div>
                {phase === 'done' && (
                  <div className={`text-[11px] font-bold ${positionColor(p.position)}`}>
                    {positionMedal(p.position)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {phase === 'done' && (
        <Button className="w-full gap-2 animate-pulse" onClick={onFinish}>
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

  // Estatísticas do meu carro (3 voltas)
  const myTime     = me ? calcRaceTimeSec(me.score) * LAPS : null;
  const myAvg      = myTime ? calcAvgSpeed(myTime / LAPS) : null;
  const myTop      = myTime ? calcTopSpeed(myTime / LAPS) : null;
  const winnerTime = calcRaceTimeSec(sorted[0]?.score ?? 60) * LAPS;
  const timeDiff   = myTime && myTime !== winnerTime
    ? `+${(myTime - winnerTime).toFixed(2)}s`
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
          {me.position === 1 && (
            <div className="text-[12px] text-yellow-400/80 mt-0.5 font-semibold">
              🏎️ {LAPS} voltas em {winnerTime.toFixed(2)}s
            </div>
          )}
          <div className="mt-2 text-[14px] font-semibold text-foreground">
            {me.payout > 0
              ? <span className="text-emerald-400">+{fmt(me.payout)}</span>
              : <span className="text-muted-foreground">Nenhum prêmio</span>
            }
          </div>
          {timeDiff && (
            <div className="mt-1 text-[12px] text-red-400 font-semibold">{timeDiff} do vencedor</div>
          )}
        </div>
      )}

      {/* Estatísticas do meu racha */}
      {me && myTime && myAvg && myTop && (
        <div className="ios-surface rounded-[16px] p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Flag size={11} />
            Estatísticas da Prova — {LAPS} voltas
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Distância"    value={`${(LAP_METERS * LAPS / 1000).toFixed(0)}km`} icon="📏" />
            <StatCard label="Tempo de Prova" value={`${myTime.toFixed(2)}s`} icon="⏱" highlight={me.position === 1} />
            <StatCard label="Vel. Média"   value={`${myAvg} km/h`} icon="🚗" />
            <StatCard label="Vel. Máxima"  value={`${myTop} km/h`} icon="⚡" />
            <StatCard label="IGP"          value={String(me.igp)}  icon="📊" />
            <StatCard label="Score"        value={me.score.toFixed(1)} icon="🎯" />
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
          const t = calcRaceTimeSec(p.score) * LAPS;
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
                  <span>{calcAvgSpeed(t / LAPS)} km/h</span>
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
            {LAPS} voltas · {LAP_METERS * LAPS}m · Lobby aberto até lotar
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
  lobby, carsInGarage, gameState, myName, onConfirm, onBack,
}: {
  lobby:        OpenLobby;
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  myName:       string;
  onConfirm:    (car: OwnedCar) => void;
  onBack:       () => void;
}) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar>(carsInGarage[0]!);
  const canJoin = gameState.money >= lobby.bet;

  // Calcula vantagem relativa vs o melhor IGP do lobby
  const myPerf    = selectedCar ? getFullPerformance(selectedCar) : null;
  const myIgp     = myPerf?.igp ?? 0;
  const bestIgp   = Math.max(...lobby.players.map(p => p.igp), 0);
  const igpDelta  = myIgp - bestIgp;
  const advantage =
    igpDelta > 5  ? 'advantage' :
    igpDelta < -5 ? 'disadvantage' :
    'even';

  const advantageLabel = {
    advantage:    { text: `Você está em vantagem (+${igpDelta} IGP)`, color: 'text-emerald-400' },
    disadvantage: { text: `Você está em desvantagem (${igpDelta} IGP)`, color: 'text-red-400' },
    even:         { text: 'Corrida equilibrada', color: 'text-amber-400' },
  }[advantage];

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
          <span className="font-semibold text-foreground">
            {lobby.players.length}/{lobby.maxPlayers}
            {lobby.maxPlayers - lobby.players.length === 1 && (
              <span className="ml-1.5 text-[11px] text-amber-400 font-bold">— última vaga!</span>
            )}
          </span>
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
          Circuito {LAPS} voltas · {LAP_METERS * LAPS}m — resultado quando lotar
        </div>
      </div>

      {/* Pilotos no lobby */}
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

      {/* Escolha do carro */}
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

        {/* Indicador de vantagem */}
        {myPerf && lobby.players.length > 0 && (
          <div className={`mt-2 text-[12px] font-semibold px-3 py-2 rounded-[10px] bg-muted/30 ${advantageLabel.color}`}>
            {advantageLabel.text}
            {' · '}{myName} · IGP {myIgp}
          </div>
        )}
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
          // Usa myIgp para estimar o tempo (score real não está no RaceRecord) — 3 voltas
          const myTimeSec = calcRaceTimeSec(r.myIgp) * LAPS;

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
                {r.myIgp > 0 && (
                  <span>· IGP {r.myIgp} · ~{myTimeSec.toFixed(1)}s</span>
                )}
                {r.payout > 0 && (
                  <span className="text-emerald-400 font-semibold">· Prêmio {fmt(r.payout)}</span>
                )}
              </div>

              {/* Participantes */}
              {r.participants && r.participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {r.participants.map(p => {
                    const pTimeSec = calcRaceTimeSec(p.igp) * LAPS;
                    return (
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
                        <span className="font-mono">~{pTimeSec.toFixed(1)}s</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
