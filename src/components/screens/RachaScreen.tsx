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
 * Tempo estimado da CORRIDA INTEIRA em segundos.
 * Base calibrada em 3 voltas × 2000m (6 km):
 *   score 0   → 180s/3V  (carro popular ruim, ~120 km/h média)
 *   score 50  → 120s/3V  (carro mediano,      ~180 km/h média)
 *   score 100 → 85s/3V   (supercar,           ~255 km/h média)
 * Escalado linearmente para qualquer número de voltas:
 *   10V score 50 → 400s  (~180 km/h média sobre 20 km) ✓
 */
function calcRaceTimeSec(score: number, totalLaps = 3): number {
  const s = Math.max(0, Math.min(score, 100));
  const basePer3Laps = Math.max(85, 180 - s * 0.95);
  return basePer3Laps * totalLaps / 3;
}

/**
 * Velocidade média em km/h para uma dada distância e tempo.
 * BUG FIX: antes a função assumia distância fixa de 1000m, mas o caller
 * passava o tempo total da corrida (3 voltas), produzindo velocidades 3x
 * menores que o esperado (ex.: 60 km/h ao invés de 180 km/h).
 */
function calcAvgSpeedKmh(distanceMeters: number, timeSec: number): number {
  if (timeSec <= 0) return 0;
  return Math.round((distanceMeters / timeSec) * 3.6);
}

/**
 * Velocidade máxima estimada (km/h). Aproximadamente 1.42× a média —
 * carros atingem o pico em retas e desaceleram em curvas.
 */
function calcTopSpeedKmh(distanceMeters: number, timeSec: number): number {
  return Math.round(calcAvgSpeedKmh(distanceMeters, timeSec) * 1.42);
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

// ── Constantes do circuito ────────────────────────────────────────
const DEFAULT_LAPS = 5;          // Padrão ao criar lobby
const LAP_METERS   = 2_000;      // 2 km por volta

/** Paleta de cores dos pilotos */
const PLAYER_COLORS = ['#facc15', '#94a3b8', '#f97316', '#60a5fa'] as const;

/**
 * Retorna a cor de um piloto durante a corrida.
 * Regra: o JOGADOR LOCAL sempre fica amarelo (índice 0) para fácil identificação.
 * Os demais recebem cores pelos índices 1-3, ordenados por userId (ordem
 * estável e arbitrária — NÃO revela posição final).
 * Não usar durante o ResultView, onde a cor por posição faz sentido.
 */
function raceColor(
  player: { userId: string; isMe?: boolean },
  allPlayers: { userId: string; isMe?: boolean }[],
  myUserId: string | null,
): string {
  if (player.isMe || player.userId === myUserId) return PLAYER_COLORS[0];
  const others = allPlayers
    .filter(p => !p.isMe && p.userId !== myUserId)
    .sort((a, b) => a.userId.localeCompare(b.userId));
  const idx = others.findIndex(p => p.userId === player.userId);
  return PLAYER_COLORS[(idx + 1) as 1 | 2 | 3] ?? '#94a3b8';
}

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
 * Tangente (ângulo em radianos) na fração de volta — aponta na direção do
 * movimento. Usado para rotacionar o ícone do carro alinhado à pista.
 */
function trackTangent(lapFrac: number): number {
  const ahead = trackPt(lapFrac + 0.004);
  const back  = trackPt(lapFrac - 0.004);
  return Math.atan2(ahead.y - back.y, ahead.x - back.x);
}

/**
 * Multiplicador de velocidade visual baseado no setor da pista.
 * Carros aceleram em retas (>1) e desaceleram em curvas (<1).
 * Soma das integrais ≈ 1.0 para preservar tempo total da volta.
 *
 * Setores aproximados (frações):
 *   0.00–0.20 reta principal (rápida)
 *   0.20–0.30 T1 hairpin (lento)
 *   0.30–0.42 reta de volta + T2 (médio)
 *   0.42–0.55 chicane (médio-baixo)
 *   0.55–0.72 T3 hairpin + reta saída (lento→rápido)
 *   0.72–0.90 kink + curvas longas (médio)
 *   0.90–1.00 retorno à reta (rápido)
 */
function speedFactorAtFrac(frac: number): number {
  const f = ((frac % 1) + 1) % 1;
  if (f < 0.20)      return 1.45;          // reta principal
  if (f < 0.30)      return 0.65;          // T1 hairpin
  if (f < 0.42)      return 1.10;          // reta + T2
  if (f < 0.55)      return 0.85;          // chicane
  if (f < 0.62)      return 0.60;          // T3 hairpin (apex)
  if (f < 0.72)      return 1.20;          // saída do hairpin
  if (f < 0.85)      return 0.90;          // kink
  if (f < 0.95)      return 0.95;          // curva longa
  return 1.40;                              // retorno à reta
}

/**
 * Distância euclidiana entre dois pontos da pista (usada para detectar
 * batalhas próximas no SVG).
 */
function trackDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  const [selectedLaps,    setSelectedLaps]    = useState(DEFAULT_LAPS);

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
        onConfirm={(car, bet, maxPlayers, laps) => {
          setSelectedLaps(laps);
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
        totalLaps={selectedLaps}
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
        totalLaps={selectedLaps}
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
            PvP · 5–15 voltas · até 30 km · Até 4 jogadores
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
                      myUserId={myUserId}
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
                      myUserId={myUserId}
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

// ── Aba Histórico de corridas ─────────────────────────────────────
function RaceHistoryTab({ history }: { history: RaceRecord[] }) {
  if (history.length === 0) {
    return (
      <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
        <div className="text-4xl">📜</div>
        <div className="text-[14px] font-semibold text-foreground">Nenhuma corrida ainda</div>
        <div className="text-[11px] text-muted-foreground">
          Participe de um racha para ver o histórico aqui.
        </div>
      </div>
    );
  }

  // Estatísticas agregadas
  const total       = history.length;
  const wins        = history.filter(h => h.won).length;
  const winRate     = Math.round((wins / total) * 100);
  const totalEarned = history.reduce((s, h) => s + (h.won ? h.payout : 0), 0);
  const totalBet    = history.reduce((s, h) => s + h.bet, 0);
  const netProfit   = totalEarned - totalBet;

  return (
    <div className="space-y-3">
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="ios-surface rounded-[12px] p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vitórias</div>
          <div className="text-[16px] font-bold text-emerald-400 tabular-nums">
            {wins}/{total}
          </div>
          <div className="text-[10px] text-muted-foreground">{winRate}%</div>
        </div>
        <div className="ios-surface rounded-[12px] p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Apostado</div>
          <div className="text-[14px] font-bold text-foreground tabular-nums">{fmt(totalBet)}</div>
        </div>
        <div className="ios-surface rounded-[12px] p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lucro</div>
          <div className={`text-[14px] font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netProfit >= 0 ? '+' : ''}{fmt(netProfit)}
          </div>
        </div>
      </div>

      {/* Lista de corridas */}
      <div className="space-y-1.5">
        {history.map(record => {
          const positionLabel = record.myPosition
            ? positionMedal(record.myPosition)
            : (record.won ? '🥇' : '—');
          const totalPlayers  = record.totalPlayers ?? 2;
          const date = new Date(record.createdAt);
          const dateLabel = date.toLocaleString('pt-BR', {
            day:   '2-digit',
            month: '2-digit',
            hour:  '2-digit',
            minute:'2-digit',
          });
          return (
            <div
              key={record.id}
              className={`px-3 py-2.5 rounded-[12px] ios-surface ${
                record.won ? 'border border-emerald-500/20 bg-emerald-500/5' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl w-9 text-center">{positionLabel}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-foreground">
                      {record.won ? 'Vitória' : record.myPosition ? `${record.myPosition}º Lugar` : 'Derrota'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      · {totalPlayers} pilotos
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {dateLabel} · IGP {record.myIgp}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">aposta {fmt(record.bet)}</div>
                  <div
                    className={`text-[12px] font-bold tabular-nums ${
                      record.won ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}
                  >
                    {record.won ? `+${fmt(record.payout)}` : `-${fmt(record.bet)}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
  lobby, canJoin, isOwn = false, myUserId, onJoin, onLeave,
}: {
  lobby:    OpenLobby;
  canJoin:  boolean;
  isOwn?:   boolean;
  myUserId: string | null;
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
          {lobby.players.map((p, i) => {
            const isMe = p.userId === myUserId;
            return (
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
                {/* IGP é exibido apenas para o próprio jogador (privacidade competitiva). */}
                {isMe && <span className="font-bold opacity-70">IGP {p.igp}</span>}
              </div>
            );
          })}
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
// TrackSVG — pista estilo F1 com carros animados, trails e overlays
// ══════════════════════════════════════════════════════════════════

/** Ponto histórico do trail de cada carro (fade ao longo do tempo). */
interface TrailPoint {
  x: number;
  y: number;
  age: number; // 0 = recente, 1 = mais antigo (vai sumir)
}

/** Overlay de evento que aparece flutuando perto de um carro. */
interface LiveEvent {
  userId:    string;
  emoji:     string;
  text:      string;
  /** Tempo em ms restante de exibição (animação). */
  remaining: number;
}

interface TrackSVGProps {
  players:    RacePlayerAnim[];
  lapProgs:   Record<string, number>;
  posMaps:    Record<string, number>;
  myUserId:   string | null;
  totalLaps:  number;
  /** Histórico de posições por carro (últimas N posições para trail). */
  trails:     Record<string, TrailPoint[]>;
  /** Eventos ativos para mostrar como overlay flutuante. */
  liveEvents: LiveEvent[];
  /** Indicador se algum carro acabou de cruzar a linha (pisca a bandeira). */
  flagPulse:  boolean;
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

function TrackSVG({
  players, lapProgs, posMaps, myUserId, totalLaps, trails, liveEvents, flagPulse,
}: TrackSVGProps) {
  // Z-ordering: carros mais baixos no SVG (y maior) ficam na frente
  const zSorted = [...players].sort((a, b) => {
    const ya = trackPt((lapProgs[a.userId] ?? 0) % 1).y;
    const yb = trackPt((lapProgs[b.userId] ?? 0) % 1).y;
    return ya - yb;
  });

  // Detecta batalhas em andamento — carros próximos no SVG acendem halo pulsante
  const battlingIds = new Set<string>();
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      const pa = trackPt((lapProgs[a.userId] ?? 0) % 1);
      const pb = trackPt((lapProgs[b.userId] ?? 0) % 1);
      if (trackDistance(pa, pb) < 16) {
        battlingIds.add(a.userId);
        battlingIds.add(b.userId);
      }
    }
  }

  // Kerbs nas apexes principais (decoração de corrida)
  const kerbPts = [
    trackPt(0.12), // T1 hairpin
    trackPt(0.25), // T2
    trackPt(0.42), // chicane
    trackPt(0.60), // T3 hairpin
    trackPt(0.82), // kink
  ];

  return (
    <svg viewBox="0 0 360 210" className="w-full select-none">
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

      {/* Linha de Largada/Chegada (xadrez) — pulsa quando alguém cruza */}
      {[0, 1, 2, 3].map(i => (
        <rect key={i}
          x={SF_PT.x - 1.5} y={SF_PT.y - 8 + i * 4}
          width={3} height={4}
          fill={i % 2 === 0 ? '#000' : '#fff'}
          opacity={flagPulse ? 1 : 0.85} />
      ))}
      {flagPulse && (
        <circle cx={SF_PT.x} cy={SF_PT.y} r={14}
          fill="none" stroke="#facc15" strokeWidth={1.5}
          opacity={0.6}>
          <animate attributeName="r" from={6} to={20} dur="0.6s" repeatCount="1" />
          <animate attributeName="opacity" from={0.8} to={0} dur="0.6s" repeatCount="1" />
        </circle>
      )}
      <text x={SF_PT.x + 6} y={SF_PT.y - 4}
        fontSize={5.5} fill="#facc15" fontWeight="bold" opacity={0.95}>S/F</text>

      {/* Nome do circuito */}
      <text x={180} y={100} textAnchor="middle"
        fontSize={7.5} fill="#6b7280" fontWeight="bold" letterSpacing={1.5} opacity={0.6}>
        CIRCUITO · {totalLaps}V · {LAP_METERS * totalLaps / 1000}KM
      </text>

      {/* Total length info */}
      <text x={180} y={112} textAnchor="middle"
        fontSize={5.5} fill="#4b5563" opacity={0.5}>
        {Math.round(TRACK_TOTAL_LEN)}m SVG · F1-Style
      </text>

      {/* ── Trails (rastros de luz) — desenhados ANTES dos carros ─── */}
      {players.map(p => {
        const trail = trails[p.userId] ?? [];
        if (trail.length < 2) return null;
        const color = raceColor(p, players, myUserId);
        return (
          <g key={`trail_${p.userId}`} opacity={0.65}>
            {trail.map((pt, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1]!;
              // Quanto mais antigo (age próximo de 1), mais transparente e fino
              const opacity = (1 - pt.age) * 0.75;
              const width   = 2.4 * (1 - pt.age * 0.7);
              return (
                <line key={i}
                  x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y}
                  stroke={color} strokeWidth={width} strokeLinecap="round"
                  opacity={opacity}
                />
              );
            })}
          </g>
        );
      })}

      {/* ── Carros — z-ordenados por Y ────────────────────────────── */}
      {zSorted.map(p => {
        const prog        = lapProgs[p.userId] ?? 0;
        const pt          = trackPt(prog % 1);
        const isMe        = p.isMe || p.userId === myUserId;
        const color       = raceColor(p, players, myUserId);
        const lapNum      = Math.min(Math.floor(prog) + 1, totalLaps);
        const visPos      = posMaps[p.userId] ?? p.position;
        const tangent     = trackTangent(prog % 1);
        const angleDeg    = (tangent * 180) / Math.PI;
        const inBattle    = battlingIds.has(p.userId);
        const carRadius   = isMe ? 8.8 : 7.8;

        return (
          <g key={p.userId}>
            {/* Halo do jogador local */}
            {isMe && (
              <circle cx={pt.x} cy={pt.y} r={14} fill={color} opacity={0.16} />
            )}
            {/* Halo pulsante para batalhas próximas */}
            {inBattle && (
              <circle cx={pt.x} cy={pt.y} r={11}
                fill="none" stroke="#fb923c" strokeWidth={1.2} opacity={0.7}>
                <animate attributeName="r" values="9;14;9" dur="0.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.15;0.7" dur="0.6s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Sombra */}
            <circle cx={pt.x + 1} cy={pt.y + 1.5} r={carRadius}
              fill="black" opacity={0.4} />
            {/* Círculo do carro */}
            <circle cx={pt.x} cy={pt.y} r={carRadius}
              fill={color} opacity={0.96}
              stroke={isMe ? 'white' : '#111827'}
              strokeWidth={isMe ? 2 : 1.2}
            />
            {/* Emoji rotacionado pela tangente da pista */}
            <g transform={`rotate(${angleDeg}, ${pt.x}, ${pt.y})`}>
              <text x={pt.x} y={pt.y + 3.2} textAnchor="middle"
                fontSize={isMe ? 9.5 : 8.5} style={{ userSelect: 'none' }}>
                {p.carIcon}
              </text>
            </g>
            {/* Indicador de volta */}
            <text x={pt.x + (isMe ? 12 : 10)} y={pt.y - 9}
              fontSize={5.5} fill={color} fontWeight="bold" opacity={0.95}>
              V{lapNum}
            </text>
            {/* Posição */}
            <text x={pt.x - (isMe ? 12 : 10)} y={pt.y - 9}
              fontSize={5.5} fill="white" fontWeight="bold" opacity={0.78}>
              {positionMedal(visPos)}
            </text>
          </g>
        );
      })}

      {/* ── Overlays de eventos flutuantes ─────────────────────────── */}
      {liveEvents.map((ev, i) => {
        const player = players.find(p => p.userId === ev.userId);
        if (!player) return null;
        const prog = lapProgs[ev.userId] ?? 0;
        const pt   = trackPt(prog % 1);
        const fade = Math.min(1, ev.remaining / 1000);
        // Texto sobe enquanto desaparece
        const yOffset = -22 - (1 - fade) * 8;
        return (
          <g key={`ev_${i}`} opacity={fade}>
            <rect
              x={pt.x - 22} y={pt.y + yOffset - 5}
              width={44} height={10} rx={5}
              fill="rgba(15,15,20,0.85)"
              stroke="#fb923c" strokeWidth={0.6}
            />
            <text x={pt.x} y={pt.y + yOffset + 2}
              textAnchor="middle"
              fontSize={6} fill="#fff" fontWeight="bold">
              {ev.emoji} {ev.text}
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
  players:    RacePlayerAnim[];
  myUserId:   string | null;
  onFinish:   () => void;
  totalLaps:  number;
}

/** Mapeia tipos de evento para emoji + texto curto da overlay flutuante. */
function eventOverlayLabel(type: string): { emoji: string; text: string } | null {
  switch (type) {
    case 'great_start':       return { emoji: '🚀', text: 'LARGADA!' };
    case 'poor_start':        return { emoji: '😬', text: 'TRAVOU' };
    case 'pole_advantage':    return { emoji: '🏆', text: 'AR LIMPO' };
    case 'overtake':          return { emoji: '⚡', text: 'PASSOU!' };
    case 'big_slipstream':    return { emoji: '🌪️', text: 'VÁCUO!' };
    case 'slipstream_pass':   return { emoji: '💨', text: 'VÁCUO' };
    case 'defended_position': return { emoji: '🛡️', text: 'DEFESA!' };
    case 'side_by_side':      return { emoji: '🤝', text: 'LADO A LADO' };
    case 'late_brake':        return { emoji: '🎯', text: 'NA TRAVE!' };
    case 'last_lap_attack':   return { emoji: '🏁', text: 'ATAQUE!' };
    case 'hot_lap':           return { emoji: '🔥', text: 'HOT LAP' };
    case 'redemption':        return { emoji: '✨', text: 'RECUPEROU' };
    case 'cascading_error':   return { emoji: '😵', text: 'ERRO!' };
    case 'minor_mistake':     return { emoji: '⚠️', text: 'ERRO' };
    case 'lost_grip':         return { emoji: '💥', text: 'PERDEU!' };
    case 'tire_struggle':     return { emoji: '🛞', text: 'PNEUS' };
    case 'position_lost':     return { emoji: '⬇️', text: 'PERDEU POS' };
    case 'close_battle':      return { emoji: '🔥', text: 'BATALHA' };
    default: return null;
  }
}

function RacingView({ players, myUserId, onFinish, totalLaps }: RacingViewProps) {
  // ── Tempo de chegada por carro ────────────────────────────────────
  const BASE_LAP_MS = 6_000;
  const leaderMs    = BASE_LAP_MS * totalLaps;

  const maxScore   = Math.max(...players.map(p => p.score), 1);
  const minScore   = Math.min(...players.map(p => p.score));
  const scoreRange = Math.max(maxScore - minScore, 1);

  const carFinishMs = useRef<Record<string, number>>(
    Object.fromEntries(players.map(p => {
      const lag = ((maxScore - p.score) / scoreRange) * leaderMs * 0.20;
      return [p.userId, leaderMs + lag];
    }))
  );
  const totalDurationMs = Math.max(...Object.values(carFinishMs.current)) + 1_000;

  // ── Estado de animação ────────────────────────────────────────────
  /** Countdown de largada: 3 → 2 → 1 → 0 (GO!). Animação só começa quando 0. */
  const [countdown, setCountdown]     = useState(3);
  const [lapProgs, setLapProgs]       = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.userId, 0]))
  );
  const [posMaps, setPosMaps]         = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.userId, p.position]))
  );
  const [elapsedSec, setElapsedSec]   = useState(0);
  const [trails, setTrails]           = useState<Record<string, TrailPoint[]>>({});
  const [liveEvents, setLiveEvents]   = useState<LiveEvent[]>([]);
  const [flagPulse, setFlagPulse]     = useState(false);
  const [meSpeedKmh, setMeSpeedKmh]   = useState(0);

  const startRef    = useRef<number | null>(null);
  const rafRef      = useRef<number | null>(null);
  const finishedRef = useRef(false);
  /** Última volta processada por carro — controla disparo de eventos. */
  const lastProcessedLapRef = useRef<Record<string, number>>({});
  /** Se já cruzou a linha no SVG — controla pulso da bandeira xadrez. */
  const crossedFlagRef = useRef<Set<string>>(new Set());
  /** Trail interno mantido em ref para evitar re-render por frame. */
  const trailsRef       = useRef<Record<string, TrailPoint[]>>({});
  const lastSpeedSampleRef = useRef<{ prog: number; t: number }>({ prog: 0, t: 0 });

  // Refs estáveis
  const playersRef     = useRef(players);
  const onFinishRef    = useRef(onFinish);
  const totalLapsRef   = useRef(totalLaps);
  useEffect(() => { playersRef.current   = players; });
  useEffect(() => { onFinishRef.current  = onFinish; });
  useEffect(() => { totalLapsRef.current = totalLaps; });

  // ── Countdown 3-2-1-GO antes da animação ──────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ── Animação principal ────────────────────────────────────────────
  useEffect(() => {
    if (countdown > 0) return; // espera GO
    const snap      = playersRef.current;
    const finishMap = carFinishMs.current;
    const laps      = totalLapsRef.current;
    const totalMs   = totalDurationMs;

    /** Coleta eventos importantes que ocorrem na volta corrente de cada piloto. */
    const triggerEventsForLap = (userId: string, lap: number) => {
      const player = snap.find(p => p.userId === userId);
      if (!player?.events) return;
      const lapEvents = player.events.filter(ev => ev.lap === lap);
      if (lapEvents.length === 0) return;
      // Pega o evento de maior impacto narrativo
      const ranked = [...lapEvents].sort((a, b) => Math.abs(b.timeImpact) - Math.abs(a.timeImpact));
      const top = ranked[0]!;
      const label = eventOverlayLabel(top.type);
      if (!label) return;
      setLiveEvents(prev => [
        ...prev,
        { userId, emoji: label.emoji, text: label.text, remaining: 1500 },
      ]);
    };

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed  = now - startRef.current;
      const dtMs     = Math.max(8, now - (lastSpeedSampleRef.current.t || now));

      // 1) Progresso de cada carro (linear + ruído + modulação por setor)
      const newProgs: Record<string, number> = {};
      snap.forEach((p, idx) => {
        const finishTime = finishMap[p.userId] ?? leaderMs;
        const linearProg = Math.min(laps, laps * (elapsed / finishTime));
        const tNoise   = elapsed / totalMs;
        const envelope = Math.pow(Math.max(0, 1 - linearProg / laps), 1.5);
        const noise    = racingNoise(Math.min(tNoise, 0.95), idx * 7.3 + 1.1);
        // Modulação visual por setor: setor é a fração da volta atual
        const fraction = linearProg % 1;
        const speedMod = speedFactorAtFrac(fraction);
        // Aplica modulação como pequeno desvio em torno do progresso linear.
        // Isso faz o carro "respirar" na pista: rápido em retas, lento em curvas.
        const modulated = linearProg + (speedMod - 1) * 0.012;
        newProgs[p.userId] = Math.max(0, Math.min(laps, modulated + noise * 0.05 * envelope));
      });
      setLapProgs(newProgs);

      // 2) Atualiza trails (mantém últimas 12 posições com fading)
      snap.forEach(p => {
        const prog = newProgs[p.userId] ?? 0;
        const pt = trackPt(prog % 1);
        const arr = trailsRef.current[p.userId] ?? [];
        // Adiciona apenas se moveu o suficiente (evita flicker)
        const last = arr[arr.length - 1];
        const dist = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 999;
        let next = arr;
        if (dist > 1.5) {
          next = [...arr, { x: pt.x, y: pt.y, age: 0 }];
        }
        // Envelhece e descarta os antigos
        next = next
          .map(t => ({ ...t, age: Math.min(1, t.age + dtMs / 700) }))
          .filter(t => t.age < 1)
          .slice(-12);
        trailsRef.current[p.userId] = next;
      });
      setTrails({ ...trailsRef.current });

      // 3) Detecta cruzamento de volta para disparar eventos
      snap.forEach(p => {
        const prog = newProgs[p.userId] ?? 0;
        const currentLap = Math.min(laps, Math.floor(prog) + 1);
        const prevLap = lastProcessedLapRef.current[p.userId] ?? 0;
        if (currentLap > prevLap) {
          lastProcessedLapRef.current[p.userId] = currentLap;
          // Volta corrente acabou de começar — dispara evento da NOVA volta
          triggerEventsForLap(p.userId, currentLap);
        }
        // Detecta cruzamento da linha (volta inteira completada)
        if (currentLap === laps && prog >= laps - 0.05 && !crossedFlagRef.current.has(p.userId)) {
          crossedFlagRef.current.add(p.userId);
          setFlagPulse(true);
          setTimeout(() => setFlagPulse(false), 600);
        }
      });

      // 4) Velocidade instantânea do jogador (km/h)
      const me = snap.find(pp => pp.isMe || pp.userId === myUserId);
      if (me) {
        const meProg = newProgs[me.userId] ?? 0;
        const dProg  = meProg - lastSpeedSampleRef.current.prog;
        const dtSec  = dtMs / 1000;
        // Cada volta = LAP_METERS metros. Convertendo para km/h:
        // (dProg * LAP_METERS / dtSec) * 3.6
        const kmh = Math.max(0, Math.min(450, (dProg * LAP_METERS / Math.max(0.001, dtSec)) * 3.6));
        // Suaviza com fator 0.7 antigo + 0.3 novo
        setMeSpeedKmh(prev => prev * 0.7 + kmh * 0.3);
      }
      lastSpeedSampleRef.current = { prog: newProgs[me?.userId ?? '___'] ?? 0, t: now };

      // 5) Atualiza overlays de eventos (decremento)
      setLiveEvents(prev =>
        prev.map(e => ({ ...e, remaining: e.remaining - dtMs }))
            .filter(e => e.remaining > 0)
      );

      // 6) Posições em tempo real
      const sorted = [...snap].sort((a, b) =>
        (newProgs[b.userId] ?? 0) - (newProgs[a.userId] ?? 0)
      );
      const newPos: Record<string, number> = {};
      sorted.forEach((p, i) => { newPos[p.userId] = i + 1; });
      setPosMaps(newPos);
      setElapsedSec(elapsed / 1000);

      // 7) Continuar até TODOS os carros cruzarem a linha
      const allDone = snap.every(p => elapsed >= (finishMap[p.userId] ?? 0));
      if (!allDone) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        const finalProgs: Record<string, number> = {};
        const finalPos:   Record<string, number> = {};
        snap.forEach(p => {
          finalProgs[p.userId] = laps;
          finalPos[p.userId]   = p.position;
        });
        setLapProgs(finalProgs);
        setPosMaps(finalPos);
        setTimeout(() => onFinishRef.current(), 800);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Formatar cronômetro: mm:ss.d
  const dispMin  = Math.floor(elapsedSec / 60);
  const dispSec  = Math.floor(elapsedSec % 60);
  const dispDeci = Math.floor((elapsedSec % 1) * 10);
  const timerLabel = elapsedSec >= 60
    ? `${dispMin}:${String(dispSec).padStart(2, '0')}.${dispDeci}`
    : `${String(dispSec).padStart(2, '0')}.${dispDeci}s`;

  // Cor do speedometer baseada na velocidade
  const speedColor =
    meSpeedKmh > 240 ? 'text-red-400'
    : meSpeedKmh > 180 ? 'text-amber-400'
    : meSpeedKmh > 120 ? 'text-emerald-400'
    : 'text-muted-foreground';

  return (
    <div className="space-y-3 relative">
      {/* Header da corrida */}
      <div className="flex items-center justify-between px-1">
        <span className="font-game-title text-lg font-bold text-foreground flex items-center gap-2">
          🏎️ Corrida em andamento
        </span>
        <span className="text-[13px] font-mono text-primary font-bold">
          {finishedRef.current ? '🏁' : timerLabel}
        </span>
      </div>

      {/* Pista (com overlay de countdown) */}
      <div className="relative">
        <TrackSVG
          players={players}
          lapProgs={lapProgs}
          posMaps={posMaps}
          myUserId={myUserId}
          totalLaps={totalLaps}
          trails={trails}
          liveEvents={liveEvents}
          flagPulse={flagPulse}
        />
        {/* Countdown overlay 3-2-1-GO */}
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="font-game-title text-7xl font-black text-primary drop-shadow-[0_0_20px_rgba(250,204,21,0.7)] animate-pulse">
              {countdown}
            </div>
          </div>
        )}
        {countdown === 0 && elapsedSec < 0.5 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="font-game-title text-7xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.7)]">
              GO!
            </div>
          </div>
        )}
        {/* Speedometer do jogador (canto inferior direito da pista) */}
        {!finishedRef.current && countdown === 0 && (
          <div className="absolute bottom-2 right-2 ios-surface rounded-[10px] px-2.5 py-1.5 !shadow-md bg-black/40 border border-white/10">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
              Sua vel.
            </div>
            <div className={`text-[14px] font-mono font-black tabular-nums leading-tight ${speedColor}`}>
              {Math.round(meSpeedKmh)}
              <span className="text-[9px] font-normal text-muted-foreground ml-0.5">km/h</span>
            </div>
          </div>
        )}
      </div>

      {/* Classificação em tempo real */}
      <div className="space-y-1.5">
        {[...players]
          .sort((a, b) => (posMaps[a.userId] ?? a.position) - (posMaps[b.userId] ?? b.position))
          .map(p => {
            const pos      = posMaps[p.userId] ?? p.position;
            const laps     = lapProgs[p.userId] ?? 0;
            const isMe     = p.isMe || p.userId === myUserId;
            const color    = raceColor(p, players, myUserId);
            const finished = laps >= totalLaps;
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
                    {finished && <span className="text-[9px] font-bold text-amber-400 px-1 rounded bg-amber-400/10">🏁</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{p.carName}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold" style={{ color }}>
                    {finished ? `V${totalLaps}/${totalLaps}` : `V${Math.min(Math.floor(laps) + 1, totalLaps)}/${totalLaps}`}
                  </div>
                  {isMe && <div className="text-[10px] text-muted-foreground">IGP {p.igp}</div>}
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
  players:   RacePlayerAnim[];
  myUserId:  string | null;
  onBack:    () => void;
  totalLaps: number;
}

function ResultView({ players, myUserId, onBack, totalLaps }: ResultViewProps) {
  const sorted   = [...players].sort((a, b) => a.position - b.position);
  const me       = players.find(p => p.isMe || p.userId === myUserId);
  const myPos    = me?.position ?? 0;
  const won      = myPos === 1;
  const pot      = players.reduce((s, p) => s + p.payout, 0);
  const winner   = sorted[0];
  const totalDistanceKm = (totalLaps * LAP_METERS) / 1000;
  const totalRaceMeters = totalLaps * LAP_METERS;

  // ── Helpers de tempo e velocidade ───────────────────────────────
  // IMPORTANTE: p.totalTimeSec vem do servidor calibrado para um número
  // fixo de voltas (histórico: 3V). Como totalLaps é escolhido localmente
  // e NÃO é gravado no Supabase, o servidor nunca sabe quantas voltas foram
  // selecionadas. Usar p.totalTimeSec diretamente com totalRaceMeters dinâmico
  // produz velocidades absurdas (ex: 580 km/h para 10V).
  //
  // Solução: sempre derivar tempo de calcRaceTimeSec(score, totalLaps),
  // que escala corretamente. A velocidade é calculada POR VOLTA (independe
  // de totalLaps) e depois convertida para km/h — isso garante consistência.

  // Tempo total da corrida escalado para o totalLaps selecionado
  const getTimeSec = (p: typeof players[number]) =>
    calcRaceTimeSec(p.score, totalLaps);

  // Tempo por volta — independe de totalLaps (basePer3Laps / 3 é constante)
  const getLapTimeSec = (p: typeof players[number]) =>
    p.bestLapSec ?? calcRaceTimeSec(p.score, totalLaps) / totalLaps;

  // Velocidade média em km/h derivada do tempo por volta
  const getAvgSpeed = (p: typeof players[number]) =>
    Math.round((LAP_METERS / getLapTimeSec(p)) * 3.6);

  // Velocidade máxima estimada (~1.42× a média — picos em reta)
  const getTopSpeed = (p: typeof players[number]) =>
    Math.round(getAvgSpeed(p) * 1.42);

  // Tempo do líder (referência para cálculo de gaps)
  const leaderTime = winner ? getTimeSec(winner) : 0;
  // Volta mais rápida — usa bestLapSec real quando disponível
  const fastestLap = sorted.reduce(
    (best, p) => {
      const lap = getLapTimeSec(p);
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
            <span className="font-semibold text-foreground">{totalLaps}</span>
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
          const avgSpeed   = getAvgSpeed(p);
          const topSpeed   = getTopSpeed(p);
          const lapTime    = getLapTimeSec(p);
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
                    {/* IGP exibido apenas para o próprio jogador (privacidade competitiva) */}
                    {isMe && <span className="text-[10px] text-muted-foreground">· IGP {p.igp}</span>}
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
        // Pesos para priorizar eventos mais dramáticos no top da lista.
        // Quanto MENOR o número, mais para cima aparece.
        const eventPriority = (type: string): number => {
          switch (type) {
            // Largadas e pole — sempre o primeiro highlight
            case 'great_start':
            case 'poor_start':
            case 'pole_advantage':    return 0;
            // Comebacks — narrativas mais impactantes
            case 'late_comeback':     return 1;
            case 'comeback':          return 2;
            case 'underdog':          return 3;
            // Ultrapassagens
            case 'overtake':
            case 'big_slipstream':    return 4;
            case 'slipstream_pass':   return 5;
            // Defesas
            case 'defended_position': return 6;
            case 'side_by_side':      return 7;
            // Últimas voltas
            case 'last_lap_attack':
            case 'hot_lap':           return 8;
            // Perdas e quedas
            case 'position_lost':
            case 'lost_grip':
            case 'close_battle':      return 9;
            // Recuperações e jogadas
            case 'redemption':        return 10;
            case 'late_brake':        return 11;
            // Erros e problemas
            case 'cascading_error':   return 12;
            case 'minor_mistake':
            case 'tire_struggle':     return 13;
            // Pace neutro
            case 'consistent_pace':   return 14;
            default:                  return 15;
          }
        };
        // Limita a 8 highlights mais relevantes
        const ranked = [...highlights]
          .sort((a, b) => {
            const pDiff = eventPriority(a.type) - eventPriority(b.type);
            if (pDiff !== 0) return pDiff;
            const lapDiff = (a.lap ?? 99) - (b.lap ?? 99);
            if (lapDiff !== 0) return lapDiff;
            return Math.abs(b.timeImpact) - Math.abs(a.timeImpact);
          })
          .slice(0, 8);
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
                      {h.type === 'great_start'      ? '🚀' :
                       h.type === 'poor_start'       ? '😬' :
                       h.type === 'pole_advantage'   ? '🏆' :
                       h.type === 'consistent_pace'  ? '🎯' :
                       h.type === 'minor_mistake'    ? '⚠️' :
                       h.type === 'cascading_error'  ? '😵' :
                       h.type === 'redemption'      ? '✨' :
                       h.type === 'overtake'         ? '⚡' :
                       h.type === 'position_lost'    ? '⬇️' :
                       h.type === 'defended_position'? '🛡️' :
                       h.type === 'close_battle'     ? '🔥' :
                       h.type === 'side_by_side'     ? '🤝' :
                       h.type === 'late_brake'       ? '🎯' :
                       h.type === 'slipstream_pass'  ? '💨' :
                       h.type === 'big_slipstream'   ? '🌪️' :
                       h.type === 'tire_struggle'    ? '🛞' :
                       h.type === 'hot_lap'          ? '🔥' :
                       h.type === 'comeback'         ? '📈' :
                       h.type === 'late_comeback'    ? '🎬' :
                       h.type === 'underdog'         ? '🐺' :
                       h.type === 'lost_grip'        ? '💥' :
                       h.type === 'last_lap_attack'  ? '🏁' : '⏱️'}
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
            const myTopV    = getTopSpeed(me);
            const winTopV   = getTopSpeed(winner);
            const myAvgV    = getAvgSpeed(me);
            const winAvgV   = getAvgSpeed(winner);
            // IGP do vencedor é omitido por privacidade competitiva — só mostra
            // o seu para você não ter como deduzir o setup do adversário.
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
              const myBest = getLapTimeSec(me);
              return [
                { label: 'Posição',      value: `${me.position}º de ${players.length}` },
                { label: 'Tempo total',  value: fmtTimer(myTime) },
                { label: 'Vel. Máx',     value: `${getTopSpeed(me)} km/h` },
                { label: 'Vel. Média',   value: `${getAvgSpeed(me)} km/h` },
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
  onConfirm:    (car: OwnedCar, bet: number, maxPlayers: number, laps: number) => void;
  onBack:       () => void;
}

function CreateLobbyView({ carsInGarage, gameState, onConfirm, onBack }: CreateLobbyViewProps) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar | null>(carsInGarage[0] ?? null);
  const [bet,         setBet]         = useState(BET_PRESETS[1]);
  const [maxPlayers,  setMaxPlayers]  = useState(2);
  const [laps,        setLaps]        = useState(DEFAULT_LAPS);

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

      {/* Número de voltas */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Voltas
        </div>
        <div className="flex gap-1.5">
          {[5, 10, 15].map(n => (
            <button
              key={n}
              onClick={() => setLaps(n)}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-[10px] transition-all ${
                laps === n
                  ? 'bg-primary text-primary-foreground'
                  : 'ios-surface text-muted-foreground hover:text-foreground'
              }`}
            >
              {n}V
            </button>
          ))}
        </div>
        <div className="text-center text-[11px] text-muted-foreground">
          {laps * LAP_METERS / 1000} km totais
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
        onClick={() => selectedCar && onConfirm(selectedCar, bet, maxPlayers, laps)}
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
