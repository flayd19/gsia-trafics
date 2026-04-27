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

/** Cores por índice de piloto */
const PLAYER_COLORS = ['#facc15', '#94a3b8', '#f97316', '#60a5fa'] as const;

// ── Pista estilo F1 (segmentos matemáticos) ──────────────────────
// Circuito definido como sequência de segmentos Linha / Bezier Cúbico.
// viewBox: 360 × 210. Sentido horário. Largada no topo à esquerda.
//
//  [Reta Principal] → [T1 hairpin direita] → [Reta de volta]
//  → [T2 curva média direita] → [Chicane] → [T3 hairpin esquerda]
//  → [Seção rápida] → [Volta à reta principal]

type Pt = [number, number];
type Seg =
  | { t: 'L'; p0: Pt; p1: Pt }
  | { t: 'C'; p0: Pt; p1: Pt; p2: Pt; p3: Pt };

function segPt(seg: Seg, u: number): Pt {
  if (seg.t === 'L') {
    return [
      seg.p0[0] + (seg.p1[0] - seg.p0[0]) * u,
      seg.p0[1] + (seg.p1[1] - seg.p0[1]) * u,
    ];
  }
  const v = 1 - u;
  return [
    v*v*v*seg.p0[0] + 3*v*v*u*seg.p1[0] + 3*v*u*u*seg.p2[0] + u*u*u*seg.p3[0],
    v*v*v*seg.p0[1] + 3*v*v*u*seg.p1[1] + 3*v*u*u*seg.p2[1] + u*u*u*seg.p3[1],
  ];
}

function segLen(seg: Seg, steps = 24): number {
  let len = 0, prev = segPt(seg, 0);
  for (let i = 1; i <= steps; i++) {
    const cur = segPt(seg, i / steps);
    const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
    len += Math.sqrt(dx*dx + dy*dy);
    prev = cur;
  }
  return len;
}

// Circuito F1 — 14 segmentos
const F1_SEGS: Seg[] = [
  // S0 — Reta principal (longa, esquerda→direita)
  { t: 'L', p0: [78, 34],  p1: [248, 34] },
  // S1 — Entrada T1 (curva direita suave)
  { t: 'C', p0: [248, 34], p1: [278, 34],  p2: [292, 48],  p3: [292, 72] },
  // S2 — T1 saída e reta de volta (direita, descendo)
  { t: 'L', p0: [292, 72], p1: [292, 98] },
  // S3 — T2 curva direita média (curva mais rápida)
  { t: 'C', p0: [292, 98], p1: [292, 128], p2: [272, 140], p3: [244, 140] },
  // S4 — Reta curta antes da chicane
  { t: 'L', p0: [244, 140], p1: [208, 140] },
  // S5 — Chicane: defletora esquerda
  { t: 'C', p0: [208, 140], p1: [194, 140], p2: [188, 152], p3: [192, 163] },
  // S6 — Chicane: defletora direita
  { t: 'C', p0: [192, 163], p1: [196, 174], p2: [180, 178], p3: [165, 174] },
  // S7 — Reta de fundo (direita→esquerda)
  { t: 'L', p0: [165, 174], p1: [118, 174] },
  // S8 — T3 hairpin esquerda lento
  { t: 'C', p0: [118, 174], p1: [90, 174],  p2: [78, 160],  p3: [78, 140] },
  // S9 — Reta de saída do hairpin (subindo)
  { t: 'L', p0: [78, 140],  p1: [78, 112] },
  // S10 — Kink rápido esquerda
  { t: 'C', p0: [78, 112],  p1: [78, 90],   p2: [68, 78],   p3: [58, 70] },
  // S11 — Curva longa esquerda subindo
  { t: 'C', p0: [58, 70],   p1: [48, 62],   p2: [48, 44],   p3: [62, 38] },
  // S12 — Retorno para a reta principal
  { t: 'C', p0: [62, 38],   p1: [68, 34],   p2: [72, 34],   p3: [78, 34] },
];

// Tabela de lookup: arc-length uniform (600 pontos)
const LOOKUP_N = 600;
interface LookupEntry { x: number; y: number }

function buildF1Lookup(): LookupEntry[] {
  // 1) Calcular comprimento de cada segmento
  const lens = F1_SEGS.map(s => segLen(s));
  const total = lens.reduce((a, b) => a + b, 0);

  // 2) Amostrar LOOKUP_N pontos uniformes ao longo do comprimento total
  const pts: LookupEntry[] = [];
  const steps = LOOKUP_N;

  for (let i = 0; i <= steps; i++) {
    const target = (i / steps) * total;
    // Encontrar o segmento correspondente
    let accum = 0;
    for (let si = 0; si < F1_SEGS.length; si++) {
      const sl = lens[si]!;
      if (accum + sl >= target || si === F1_SEGS.length - 1) {
        const u = sl > 0 ? Math.min(1, (target - accum) / sl) : 0;
        const [x, y] = segPt(F1_SEGS[si]!, u);
        pts.push({ x, y });
        break;
      }
      accum += sl;
    }
  }
  return pts;
}

// Calculado uma vez no load do módulo
const F1_LOOKUP = buildF1Lookup();
const TRACK_TOTAL_LEN = F1_SEGS.reduce((a, s) => a + segLen(s), 0);

// Path SVG para desenhar a pista (usado só na renderização)
const F1_PATH_D = [
  'M 78 34 L 248 34',
  'C 278 34 292 48 292 72',
  'L 292 98',
  'C 292 128 272 140 244 140',
  'L 208 140',
  'C 194 140 188 152 192 163',
  'C 196 174 180 178 165 174',
  'L 118 174',
  'C 90 174 78 160 78 140',
  'L 78 112',
  'C 78 90 68 78 58 70',
  'C 48 62 48 44 62 38',
  'C 68 34 72 34 78 34 Z',
].join(' ');

/**
 * Converte fração de volta (0-1) em {x,y} no SVG usando lookup table.
 * Determinístico e uniforme em velocidade visual.
 */
function trackPt(lapFrac: number): { x: number; y: number } {
  const frac = ((lapFrac % 1) + 1) % 1;
  const idx  = Math.round(frac * LOOKUP_N);
  return F1_LOOKUP[Math.min(idx, LOOKUP_N)] ?? { x: 165, y: 100 };
}

/**
 * Ruído sinusoidal REDUZIDO para simular ultrapassagens leves.
 * Amplitude: ≈ ±0.5 (bem menor que antes).
 * Funde suavemente a 0 conforme t → 0.55.
 */
function racingNoise(t: number, seed: number): number {
  const fade = Math.max(0, 1 - t * 1.82);
  return (
    Math.sin(t * 7.1  + seed * 5.3) * 0.55 +
    Math.sin(t * 13.4 + seed * 8.9) * 0.45
  ) * fade;
}

// Posição S/F (linha de largada) — ponto 5% na reta principal
const SF_PT = trackPt(0.03);
// Setores: S1 = 33%, S2 = 66%
const S1_PT = trackPt(0.33);
const S2_PT = trackPt(0.66);

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
// TrackSVG — pista estilo F1 com carros animados
// ══════════════════════════════════════════════════════════════════
interface TrackSVGProps {
  players:  RacePlayerAnim[];
  lapProgs: Record<string, number>; // userId → voltas percorridas (0 → LAPS)
  posMaps:  Record<string, number>; // userId → posição visual em tempo real
  myUserId: string | null;
}

// Bordas laterais da pista (offset ±12px do centro)
const TRACK_OUTER_D = [
  'M 78 22 L 248 22',
  'C 286 22 304 40 304 72 L 304 98',
  'C 304 134 280 152 244 152 L 208 152',
  'C 190 152 174 164 178 177',
  'C 182 190 162 194 147 190 L 118 186',
  'C 82 186 66 168 66 140 L 66 112',
  'C 66 84 55 70 45 62',
  'C 34 54 34 36 50 28 C 56 24 66 22 78 22 Z',
].join(' ');

const TRACK_INNER_D = [
  'M 78 46 L 248 46',
  'C 270 46 280 56 280 72 L 280 98',
  'C 280 122 264 128 244 128 L 208 128',
  'C 198 128 202 140 206 149',
  'C 210 158 198 162 183 158 L 118 162',
  'C 98 162 90 152 90 140 L 90 112',
  'C 90 96 81 86 71 78',
  'C 62 70 62 52 74 48 C 76 46 77 46 78 46 Z',
].join(' ');

function TrackSVG({ players, lapProgs, posMaps, myUserId }: TrackSVGProps) {
  // Z-ordering: carros mais baixos no SVG (y maior) ficam na frente
  const zSorted = [...players].sort((a, b) => {
    const ya = trackPt((lapProgs[a.userId] ?? 0) % 1).y;
    const yb = trackPt((lapProgs[b.userId] ?? 0) % 1).y;
    return ya - yb;
  });

  // Kerbs nas apexes principais (decoração de corrida)
  const kerbPts = [
    trackPt(0.12), // T1 hairpin
    trackPt(0.25), // T2
    trackPt(0.42), // chicane
    trackPt(0.60), // T3 hairpin
    trackPt(0.82), // kink
  ];

  return (
    <svg viewBox="0 0 360 210" className="w-full select-none" style={{ maxHeight: 220 }}>
      {/* Fundo grama */}
      <rect width={360} height={210} fill="#0f1a0f" rx={14} />

      {/* Zona gramada interna */}
      <path d={TRACK_OUTER_D} fill="#1a3a1a" opacity={0.8} />

      {/* Asfalto (entre outer e inner) */}
      <path d={F1_PATH_D} fill="none" stroke="#3d4451" strokeWidth={26} />

      {/* Asfalto central mais escuro */}
      <path d={F1_PATH_D} fill="none" stroke="#2e3340" strokeWidth={22} />

      {/* Gramado interno claro */}
      <path d={TRACK_INNER_D} fill="#163016" opacity={0.9} />

      {/* Bordas da pista */}
      <path d={F1_PATH_D} fill="none" stroke="#1a1f2e" strokeWidth={28}
        strokeDasharray="1 0" opacity={0} />
      {/* Linha branca externa */}
      <path d={F1_PATH_D} fill="none" stroke="white" strokeWidth={27}
        strokeOpacity={0.12} />
      {/* Linha branca interna */}
      <path d={F1_PATH_D} fill="none" stroke="white" strokeWidth={17}
        strokeOpacity={0} />

      {/* Faixa de asfalto visível */}
      <path d={F1_PATH_D} fill="none" stroke="#4a5160" strokeWidth={24} />
      <path d={F1_PATH_D} fill="none" stroke="white" strokeWidth={24.5}
        strokeOpacity={0.07} />
      <path d={F1_PATH_D} fill="none" stroke="#374151" strokeWidth={23} />

      {/* Linha central tracejada branca */}
      <path d={F1_PATH_D} fill="none" stroke="rgba(255,255,255,0.18)"
        strokeWidth={0.8} strokeDasharray="12 10" />

      {/* Bordas brancas da pista */}
      <path d={F1_PATH_D} fill="none" stroke="white" strokeWidth={26}
        strokeOpacity={0.15} />

      {/* Kerbs nas apexes (listras vermelhas/brancas) */}
      {kerbPts.map((pt, i) => (
        <g key={i}>
          <rect x={pt.x - 5} y={pt.y - 3} width={10} height={6}
            fill={i % 2 === 0 ? '#dc2626' : '#ffffff'}
            opacity={0.7} rx={1}
            transform={`rotate(${i * 30}, ${pt.x}, ${pt.y})`} />
        </g>
      ))}

      {/* Marcadores de setor S1 / S2 */}
      {[{ pt: S1_PT, label: 'S1', color: '#22c55e' },
        { pt: S2_PT, label: 'S2', color: '#f59e0b' }].map(({ pt, label, color }) => (
        <g key={label}>
          <line x1={pt.x - 5} y1={pt.y - 5} x2={pt.x + 5} y2={pt.y + 5}
            stroke={color} strokeWidth={2.5} opacity={0.8} />
          <line x1={pt.x + 5} y1={pt.y - 5} x2={pt.x - 5} y2={pt.y + 5}
            stroke={color} strokeWidth={2.5} opacity={0.8} />
          <text x={pt.x + 8} y={pt.y + 4} fontSize={6} fill={color}
            fontWeight="bold" opacity={0.9}>{label}</text>
        </g>
      ))}

      {/* Linha de Largada/Chegada (xadrez) */}
      {[0, 1, 2, 3].map(i => (
        <rect key={i}
          x={SF_PT.x - 1.5} y={SF_PT.y - 8 + i * 4}
          width={3} height={4}
          fill={i % 2 === 0 ? '#000' : '#fff'} opacity={0.85} />
      ))}
      <text x={SF_PT.x + 6} y={SF_PT.y - 4}
        fontSize={5.5} fill="#facc15" fontWeight="bold" opacity={0.95}>S/F</text>

      {/* Nome do circuito */}
      <text x={180} y={100} textAnchor="middle"
        fontSize={7.5} fill="#6b7280" fontWeight="bold" letterSpacing={1.5} opacity={0.6}>
        CIRCUITO · {LAPS}V · {LAP_METERS * LAPS / 1000}KM
      </text>

      {/* Total length info */}
      <text x={180} y={112} textAnchor="middle"
        fontSize={5.5} fill="#4b5563" opacity={0.5}>
        {Math.round(TRACK_TOTAL_LEN)}m SVG · F1-Style
      </text>

      {/* ── Carros — z-ordenados por Y ────────────────────────────── */}
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
            {/* Halo do jogador */}
            {isMe && (
              <circle cx={pt.x} cy={pt.y} r={14} fill={color} opacity={0.15} />
            )}
            {/* Sombra */}
            <circle cx={pt.x + 1} cy={pt.y + 1.5} r={isMe ? 8.5 : 7.5}
              fill="black" opacity={0.4} />
            {/* Círculo do carro */}
            <circle cx={pt.x} cy={pt.y} r={isMe ? 8.5 : 7.5}
              fill={color} opacity={0.95}
              stroke={isMe ? 'white' : '#111827'}
              strokeWidth={isMe ? 2 : 1.2}
            />
            {/* Emoji */}
            <text x={pt.x} y={pt.y + 3.5} textAnchor="middle"
              fontSize={isMe ? 9 : 8} style={{ userSelect: 'none' }}>
              {p.carIcon}
            </text>
            {/* Volta */}
            <text x={pt.x + (isMe ? 12 : 10)} y={pt.y - 8}
              fontSize={5.5} fill={color} fontWeight="bold" opacity={0.95}>
              V{lapNum}
            </text>
            {/* Posição */}
            <text x={pt.x - (isMe ? 12 : 10)} y={pt.y - 8}
              fontSize={5.5} fill="white" fontWeight="bold" opacity={0.75}>
              {positionMedal(visPos)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// RacingView — Animação da corrida com pista F1
// ══════════════════════════════════════════════════════════════════
interface RacingViewProps {
  players:   RacePlayerAnim[];
  myUserId:  string | null;
  onFinish:  () => void;
}

function RacingView({ players, myUserId, onFinish }: RacingViewProps) {
  const DURATION_MS = 5000 + players.length * 500;

  const [lapProgs, setLapProgs] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.userId, 0]))
  );
  const [posMaps, setPosMaps] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.userId, p.position]))
  );
  const [timeLeft, setTimeLeft] = useState(Math.ceil(DURATION_MS / 1000));
  const startRef   = useRef<number | null>(null);
  const rafRef     = useRef<number | null>(null);
  const finishedRef = useRef(false);

  // BUG FIX: refs estáveis para `players`, `DURATION_MS` e `onFinish`. Sem isso,
  // o useEffect re-rodava toda vez que o pai re-renderizava (subscription do
  // Supabase, polling, etc.), recriando a animação e fazendo a corrida parecer
  // "mais rápida" para alguns jogadores. O array de dependências agora é vazio:
  // a animação é montada exatamente uma vez por instância do componente.
  const playersRef    = useRef(players);
  const durationRef   = useRef(DURATION_MS);
  const onFinishRef   = useRef(onFinish);
  useEffect(() => { playersRef.current  = players; });
  useEffect(() => { durationRef.current = DURATION_MS; });
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    const playersSnapshot = playersRef.current;
    const duration = durationRef.current;
    const maxScore = Math.max(...playersSnapshot.map(p => p.score), 1);

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t       = Math.min(1, elapsed / duration);
      const eased   = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const newProgs: Record<string, number> = {};
      playersSnapshot.forEach((p, idx) => {
        const speed = 0.85 + (p.score / maxScore) * 0.15;
        const noise = racingNoise(t, idx * 7.3 + 1.1);
        const amp   = Math.max(0.01, 0.06 - Math.abs(p.score / maxScore - 0.5) * 0.04);
        newProgs[p.userId] = eased * LAPS * speed + noise * amp;
      });
      setLapProgs(newProgs);

      // Recalcular posições em tempo real pelo progresso na volta
      const sorted = [...playersSnapshot].sort((a, b) =>
        (newProgs[b.userId] ?? 0) - (newProgs[a.userId] ?? 0)
      );
      const newPos: Record<string, number> = {};
      sorted.forEach((p, i) => { newPos[p.userId] = i + 1; });
      setPosMaps(newPos);

      setTimeLeft(Math.max(0, Math.ceil((duration - elapsed) / 1000)));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        // Fixar posições finais (baseado em score real, não animação)
        const finalPos: Record<string, number> = {};
        playersSnapshot.forEach(p => { finalPos[p.userId] = p.position; });
        setPosMaps(finalPos);
        // Fixar lapProgs em LAPS para todos
        const finalProgs: Record<string, number> = {};
        playersSnapshot.forEach(p => { finalProgs[p.userId] = LAPS; });
        setLapProgs(finalProgs);
        setTimeout(() => onFinishRef.current(), 600);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // Intencionalmente vazio: animação roda uma vez por mount, lê valores via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* Header da corrida */}
      <div className="flex items-center justify-between px-1">
        <span className="font-game-title text-lg font-bold text-foreground flex items-center gap-2">
          🏎️ Corrida em andamento
        </span>
        <span className="text-[13px] font-mono text-primary font-bold">
          {timeLeft > 0 ? `${timeLeft}s` : '🏁'}
        </span>
      </div>

      {/* Pista */}
      <TrackSVG
        players={players}
        lapProgs={lapProgs}
        posMaps={posMaps}
        myUserId={myUserId}
      />

      {/* Classificação em tempo real */}
      <div className="space-y-1.5">
        {[...players]
          .sort((a, b) => (posMaps[a.userId] ?? a.position) - (posMaps[b.userId] ?? b.position))
          .map(p => {
            const pos   = posMaps[p.userId] ?? p.position;
            const laps  = lapProgs[p.userId] ?? 0;
            const isMe  = p.isMe || p.userId === myUserId;
            const color = PLAYER_COLORS[players.indexOf(p)] ?? '#94a3b8';
            return (
              <div key={p.userId}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[12px] ios-surface ${
                  isMe ? 'border border-primary/30 bg-primary/5' : ''
                }`}
              >
                <span className="text-base w-6 text-center">{positionMedal(pos)}</span>
                <span className="text-lg">{p.carIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-semibold ${isMe ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {p.name}
                    </span>
                    {isMe && <span className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded">você</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{p.carName}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold" style={{ color }}>
                    V{Math.min(Math.floor(laps) + 1, LAPS)}/{LAPS}
                  </div>
                  <div className="text-[10px] text-muted-foreground">IGP {p.igp}</div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ResultView — Resultado final da corrida
// Apenas 1º lugar recebe prêmio
// ══════════════════════════════════════════════════════════════════
interface ResultViewProps {
  players:  RacePlayerAnim[];
  myUserId: string | null;
  onBack:   () => void;
}

function ResultView({ players, myUserId, onBack }: ResultViewProps) {
  const sorted   = [...players].sort((a, b) => a.position - b.position);
  const me       = players.find(p => p.isMe || p.userId === myUserId);
  const myPos    = me?.position ?? 0;
  const won      = myPos === 1;
  const pot      = players.reduce((s, p) => s + p.payout, 0);
  const winner   = sorted[0];
  const totalDistanceKm = (LAPS * LAP_METERS) / 1000;

  // Helpers — preferem tempos reais do motor (totalTimeSec/bestLapSec) quando
  // disponíveis (lobbies novos), senão derivam do score (lobbies legacy).
  const getTimeSec = (p: typeof players[number]) =>
    p.totalTimeSec ?? calcRaceTimeSec(p.score);
  const getBestLap = (p: typeof players[number]) =>
    p.bestLapSec ?? calcRaceTimeSec(p.score) / LAPS;

  // Tempo do líder (referência para cálculo de gaps)
  const leaderTime = winner ? getTimeSec(winner) : 0;
  // Volta mais rápida — usa bestLapSec real quando disponível
  const fastestLap = sorted.reduce(
    (best, p) => {
      const lap = getBestLap(p);
      return lap < best.time ? { time: lap, name: p.name, carIcon: p.carIcon } : best;
    },
    { time: Infinity, name: '', carIcon: '' },
  );

  return (
    <div className="space-y-4">
      {/* Banner resultado */}
      <div className={`rounded-[16px] p-4 text-center ${
        won
          ? 'bg-emerald-500/10 border border-emerald-500/25'
          : 'bg-muted/30 border border-border'
      }`}>
        <div className="text-4xl mb-1">
          {won ? '🏆' : myPos === 2 ? '🥈' : myPos === 3 ? '🥉' : '😤'}
        </div>
        <div className={`font-bold text-lg ${won ? 'text-emerald-400' : 'text-foreground'}`}>
          {won ? 'VOCÊ VENCEU!' : myPos === 2 ? '2º Lugar' : myPos === 3 ? '3º Lugar' : `${myPos}º Lugar`}
        </div>
        {won && me && me.payout > 0 && (
          <div className="text-emerald-400 font-semibold text-[14px] mt-1">
            +{fmt(me.payout)} recebidos 🤑
          </div>
        )}
        {!won && (
          <div className="text-muted-foreground text-[12px] mt-1">
            Apenas o 1º lugar recebe o prêmio
          </div>
        )}
        {won && (
          <div className="text-emerald-300/70 text-[11px] mt-1">
            +10 XP de reputação 🔥
          </div>
        )}
      </div>

      {/* ── Resumo da corrida ───────────────────────────────────── */}
      <div className="ios-surface rounded-[14px] p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          📊 Resumo da Corrida
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pilotos</span>
            <span className="font-semibold text-foreground">{players.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Distância</span>
            <span className="font-semibold text-foreground">{totalDistanceKm} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Voltas</span>
            <span className="font-semibold text-foreground">{LAPS}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pot total</span>
            <span className="font-semibold text-emerald-400">{fmt(pot)}</span>
          </div>
          <div className="flex justify-between col-span-2 pt-1.5 mt-0.5 border-t border-border/30">
            <span className="text-muted-foreground flex items-center gap-1">⚡ Volta mais rápida</span>
            <span className="font-mono font-semibold text-amber-400">
              {fastestLap.carIcon} {fmtTimer(fastestLap.time)} <span className="text-muted-foreground font-normal">— {fastestLap.name}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Classificação final com stats completas ─────────────── */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Classificação Final
        </div>
        {sorted.map(p => {
          const isMe       = p.isMe || p.userId === myUserId;
          const color      = PLAYER_COLORS[players.indexOf(p)] ?? '#94a3b8';
          const timeSec    = getTimeSec(p);
          const gap        = p.position === 1 ? 0 : timeSec - leaderTime;
          const topSpeed   = calcTopSpeed(timeSec);
          const avgSpeed   = calcAvgSpeed(timeSec);
          const lapTime    = getBestLap(p);
          return (
            <div key={p.userId}
              className={`px-3 py-2.5 rounded-[12px] ios-surface ${
                isMe ? 'border border-primary/30 bg-primary/5' : ''
              }`}
            >
              {/* Linha principal: pos + nome + payout */}
              <div className="flex items-center gap-2.5">
                <span className="text-xl w-7 text-center">{positionMedal(p.position)}</span>
                <span className="text-lg">{p.carIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[13px] font-semibold ${isMe ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {p.name}
                    </span>
                    {isMe && <span className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded">você</span>}
                    <span className="text-[10px] text-muted-foreground">· IGP {p.igp}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{p.carName}</div>
                </div>
                <div className="text-right">
                  {p.position === 1 && p.payout > 0 ? (
                    <div className="text-[12px] font-bold text-emerald-400">+{fmt(p.payout)}</div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">sem prêmio</div>
                  )}
                </div>
              </div>

              {/* Linha de stats: tempo, gap, vel. máx, vel. média, volta */}
              <div className="grid grid-cols-5 gap-1.5 mt-2 pt-2 border-t border-border/30">
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Tempo</div>
                  <div className="text-[11px] font-mono font-semibold" style={{ color }}>
                    {fmtTimer(timeSec)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Gap</div>
                  <div className={`text-[11px] font-mono font-semibold ${gap === 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {gap === 0 ? '—' : `+${gap.toFixed(1)}s`}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Vel. Máx</div>
                  <div className="text-[11px] font-mono font-semibold text-foreground">
                    {topSpeed} <span className="text-muted-foreground font-normal text-[9px]">km/h</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Vel. Méd</div>
                  <div className="text-[11px] font-mono font-semibold text-foreground">
                    {avgSpeed} <span className="text-muted-foreground font-normal text-[9px]">km/h</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Volta</div>
                  <div className="text-[11px] font-mono font-semibold text-foreground">
                    {fmtTimer(lapTime)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Highlights da corrida (eventos narrativos do motor) ── */}
      {(() => {
        // Coleta todos os eventos não-triviais e ordena por volta + tipo
        const highlights = sorted.flatMap(p =>
          (p.events ?? [])
            .filter(ev => ev.type !== 'fastest_lap') // já mostrado no resumo
            .map(ev => ({ ...ev, player: p })),
        );
        if (highlights.length === 0) return null;
        // Limita a 6 highlights mais relevantes (largadas + maiores impactos)
        const ranked = [...highlights]
          .sort((a, b) => {
            // Largadas primeiro, depois por volta crescente, depois por |timeImpact| desc
            const startBoost = (e: typeof a) =>
              e.type === 'great_start' || e.type === 'poor_start' ? 0 : 1;
            const sb = startBoost(a) - startBoost(b);
            if (sb !== 0) return sb;
            const lapDiff = (a.lap ?? 99) - (b.lap ?? 99);
            if (lapDiff !== 0) return lapDiff;
            return Math.abs(b.timeImpact) - Math.abs(a.timeImpact);
          })
          .slice(0, 6);
        return (
          <div className="ios-surface rounded-[14px] p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              🎬 Highlights da Corrida
            </div>
            <div className="space-y-1.5">
              {ranked.map((h, i) => {
                const isMeRow = h.player.isMe || h.player.userId === myUserId;
                const positive = h.timeImpact < 0;
                return (
                  <div
                    key={`${h.player.userId}_${i}`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] text-[11px] ${
                      isMeRow ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <span className="text-base shrink-0">
                      {h.type === 'great_start'    ? '🚀' :
                       h.type === 'poor_start'     ? '😬' :
                       h.type === 'consistent_pace' ? '🎯' :
                       h.type === 'minor_mistake'  ? '⚠️' : '⏱️'}
                    </span>
                    <span className="text-base shrink-0">{h.player.carIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate ${isMeRow ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {h.player.name}
                        {isMeRow && <span className="text-[9px] text-primary font-bold bg-primary/10 px-1 ml-1 rounded">você</span>}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {h.description}
                        {h.lap && <span className="opacity-70"> · Volta {h.lap}</span>}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-semibold shrink-0 ${
                        positive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {positive ? '−' : '+'}{Math.abs(h.timeImpact).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Comparativo: você vs vencedor ──────────────────────── */}
      {me && winner && me.userId !== winner.userId && (
        <div className="ios-surface rounded-[14px] p-3 space-y-2 border border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
            ⚔️ Você vs {winner.name}
          </div>
          {(() => {
            const myTime    = getTimeSec(me);
            const winTime   = getTimeSec(winner);
            const myTopV    = calcTopSpeed(myTime);
            const winTopV   = calcTopSpeed(winTime);
            const myAvgV    = calcAvgSpeed(myTime);
            const winAvgV   = calcAvgSpeed(winTime);
            const rows: Array<{ label: string; you: string; winner: string; better: boolean }> = [
              {
                label: 'Tempo',
                you: fmtTimer(myTime),
                winner: fmtTimer(winTime),
                better: myTime < winTime,
              },
              {
                label: 'Vel. Máx',
                you: `${myTopV} km/h`,
                winner: `${winTopV} km/h`,
                better: myTopV > winTopV,
              },
              {
                label: 'Vel. Média',
                you: `${myAvgV} km/h`,
                winner: `${winAvgV} km/h`,
                better: myAvgV > winAvgV,
              },
              {
                label: 'IGP do carro',
                you: `${me.igp}`,
                winner: `${winner.igp}`,
                better: me.igp > winner.igp,
              },
            ];
            return rows.map(r => (
              <div key={r.label} className="grid grid-cols-3 items-center text-[12px] gap-2">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`text-center font-mono font-semibold ${r.better ? 'text-emerald-400' : 'text-foreground'}`}>
                  {r.you}
                </span>
                <span className="text-right font-mono font-semibold text-amber-400">
                  {r.winner}
                </span>
              </div>
            ));
          })()}
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/20 mt-1">
            <span className="text-emerald-400 font-semibold">verde</span> = você está à frente nesta métrica
          </div>
        </div>
      )}

      {/* ── Desempenho por setor (apenas se motor disponível) ─── */}
      {me?.sectorScores && (
        <div className="ios-surface rounded-[14px] p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            🏁 Seu Desempenho por Setor
          </div>
          <div className="space-y-1.5">
            {([
              { key: 'straight' as const, label: 'Reta principal',  hint: 'Vel. máx + potência' },
              { key: 'accel'    as const, label: 'Aceleração',      hint: 'Saídas de curva' },
              { key: 'chicane'  as const, label: 'Chicane',         hint: 'Aero + grip + câmbio' },
              { key: 'hairpin'  as const, label: 'Hairpin',         hint: 'Curva fechada' },
            ]).map(({ key, label, hint }) => {
              const myV       = me.sectorScores![key];
              // Compara com a média dos outros pilotos no mesmo setor
              const others    = players.filter(p => p.userId !== me.userId && p.sectorScores);
              const avgOthers = others.length > 0
                ? others.reduce((s, p) => s + (p.sectorScores![key] ?? 0), 0) / others.length
                : myV;
              const diff      = myV - avgOthers;
              const tone      = diff > 5  ? 'text-emerald-400' :
                                diff < -5 ? 'text-red-400'     : 'text-muted-foreground';
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground">{label}</span>
                      <span className="font-mono font-bold text-foreground">{myV}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${myV}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono ${tone} shrink-0`}>
                        {diff > 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0)} vs média
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5">{hint}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Suas estatísticas pessoais (sempre visível) ─────────── */}
      {me && (
        <div className="ios-surface rounded-[14px] p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            🏁 Suas Estatísticas
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {(() => {
              const myTime = getTimeSec(me);
              const myBest = getBestLap(me);
              return [
                { label: 'Posição',      value: `${me.position}º de ${players.length}` },
                { label: 'Tempo total',  value: fmtTimer(myTime) },
                { label: 'Vel. Máx',     value: `${calcTopSpeed(myTime)} km/h` },
                { label: 'Vel. Média',   value: `${calcAvgSpeed(myTime)} km/h` },
                { label: 'Melhor volta', value: fmtTimer(myBest) },
                { label: 'IGP do carro', value: `${me.igp}` },
              ];
            })().map(({ label, value }) => (
              <div key={label} className="ios-surface rounded-[10px] py-2 px-2 !shadow-none bg-muted/30">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-[13px] font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onBack} className="w-full" variant="outline">
        <ArrowLeft size={14} className="mr-1.5" />
        Voltar aos Lobbies
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CreateLobbyView — Criar novo racha
// ══════════════════════════════════════════════════════════════════
interface CreateLobbyViewProps {
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  onConfirm:    (car: OwnedCar, bet: number, maxPlayers: number) => void;
  onBack:       () => void;
}

function CreateLobbyView({ carsInGarage, gameState, onConfirm, onBack }: CreateLobbyViewProps) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar | null>(carsInGarage[0] ?? null);
  const [bet,         setBet]         = useState(BET_PRESETS[1]);
  const [maxPlayers,  setMaxPlayers]  = useState(2);

  const pot = Math.round(bet * maxPlayers * 0.95);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted/50">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <h2 className="font-game-title text-lg font-bold">Criar Racha</h2>
      </div>

      {/* Seleção de carro */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Seu Carro
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {carsInGarage.map(car => {
            const isSelected = car.instanceId === selectedCar?.instanceId;
            return (
              <button
                key={car.instanceId}
                onClick={() => setSelectedCar(car)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] ios-surface text-left transition-all ${
                  isSelected ? 'border border-primary/40 bg-primary/5' : 'border border-transparent'
                }`}
              >
                <span className="text-xl">{car.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground truncate">{car.fullName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Cond. {car.condition}% · {car.year}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 rounded-full">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aposta */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Aposta por Piloto
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {BET_PRESETS.map(b => (
            <button
              key={b}
              onClick={() => setBet(b)}
              className={`flex-1 py-2 text-[12px] font-semibold rounded-[10px] transition-all ${
                bet === b
                  ? 'bg-primary text-primary-foreground'
                  : 'ios-surface text-muted-foreground hover:text-foreground'
              }`}
            >
              {fmt(b)}
            </button>
          ))}
        </div>
        <div className="text-center text-[11px] text-muted-foreground">
          Pot total (3% de taxa): <span className="text-emerald-400 font-semibold">{fmt(pot)}</span> para o 1º lugar
        </div>
      </div>

      {/* Número de jogadores */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Jogadores
        </div>
        <div className="flex gap-1.5">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setMaxPlayers(n)}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-[10px] transition-all flex items-center justify-center gap-1 ${
                maxPlayers === n
                  ? 'bg-primary text-primary-foreground'
                  : 'ios-surface text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={12} />
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Saldo */}
      <div className="flex items-center justify-between px-1 text-[12px]">
        <span className="text-muted-foreground">Seu saldo</span>
        <span className={gameState.money >= bet ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
          {fmt(gameState.money)}
        </span>
      </div>

      <Button
        className="w-full"
        disabled={!selectedCar || gameState.money < bet}
        onClick={() => selectedCar && onConfirm(selectedCar, bet, maxPlayers)}
      >
        <Flag size={14} className="mr-1.5" />
        Criar Racha · {fmt(bet)}
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// JoinLobbyView — Entrar em racha existente
// ══════════════════════════════════════════════════════════════════
interface JoinLobbyViewProps {
  lobby:        OpenLobby;
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  myName:       string;
  onConfirm:    (car: OwnedCar) => void;
  onBack:       () => void;
}

function JoinLobbyView({ lobby, carsInGarage, gameState, onConfirm, onBack }: JoinLobbyViewProps) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar | null>(carsInGarage[0] ?? null);
  const pot = Math.round(lobby.bet * lobby.maxPlayers * 0.95);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted/50">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <h2 className="font-game-title text-lg font-bold">Entrar no Racha</h2>
      </div>

      {/* Info do lobby */}
      <div className="ios-surface rounded-[14px] p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Organizador</span>
          <span className="font-semibold text-foreground">{lobby.hostName}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Aposta</span>
          <span className="font-semibold text-emerald-400">{fmt(lobby.bet)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Prêmio (só 1º)</span>
          <span className="font-semibold text-emerald-400">{fmt(pot)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Pilotos</span>
          <span className="font-semibold text-foreground">
            {lobby.players.length}/{lobby.maxPlayers}
          </span>
        </div>
      </div>

      {/* Seleção de carro */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Seu Carro
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {carsInGarage.map(car => {
            const isSelected = car.instanceId === selectedCar?.instanceId;
            return (
              <button
                key={car.instanceId}
                onClick={() => setSelectedCar(car)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] ios-surface text-left transition-all ${
                  isSelected ? 'border border-primary/40 bg-primary/5' : 'border border-transparent'
                }`}
              >
                <span className="text-xl">{car.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground truncate">{car.fullName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Cond. {car.condition}% · {car.year}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 rounded-full">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-[12px]">
        <span className="text-muted-foreground">Seu saldo</span>
        <span className={gameState.money >= lobby.bet ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
          {fmt(gameState.money)}
        </span>
      </div>

      <Button
        className="w-full"
        disabled={!selectedCar || gameState.money < lobby.bet}
        onClick={() => selectedCar && onConfirm(selectedCar)}
      >
        <Zap size={14} className="mr-1.5" />
        Entrar · {fmt(lobby.bet)}
      </Button>
    </div>
  );
}
