// =====================================================================
// RachaScreen — PvP Lobby Aberto (2-4 jogadores)
// =====================================================================
import { useState } from 'react';
import { Zap, Plus, Users, Trophy, Clock, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState, OwnedCar } from '@/types/game';
import type { TuneUpgrade, RaceRecord } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';
import { useRachaLobby, type OpenLobby, type RacePlayerAnim } from '@/hooks/useRachaLobby';

// ── Props ────────────────────────────────────────────────────────
interface RachaScreenProps {
  gameState:        GameState;
  onSpendMoney:     (amount: number) => boolean;
  onAddMoney:       (amount: number) => void;
  onUpdateCarTunes: (carInstanceId: string, upgrades: TuneUpgrade[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const BET_PRESETS = [500, 1_000, 5_000, 10_000, 25_000];

function igpClass(igp: number) {
  if (igp > 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  if (igp > 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  return 'text-red-400 bg-red-500/10 border-red-500/25';
}

function positionMedal(pos: number) {
  return pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '4º';
}

function positionColor(pos: number) {
  if (pos === 1) return 'text-yellow-400';
  if (pos === 2) return 'text-gray-300';
  if (pos === 3) return 'text-amber-600';
  return 'text-muted-foreground';
}

function barColor(pos: number) {
  if (pos === 1) return 'linear-gradient(90deg, #fbbf24, #f59e0b)';
  if (pos === 2) return 'linear-gradient(90deg, #9ca3af, #6b7280)';
  if (pos === 3) return 'linear-gradient(90deg, #d97706, #b45309)';
  return 'linear-gradient(90deg, #6366f1, #4f46e5)';
}

// ── Componente principal ─────────────────────────────────────────
export function RachaScreen({ gameState, onSpendMoney, onAddMoney }: RachaScreenProps) {
  const carsInGarage = gameState.garage
    .filter(s => s.unlocked && s.car)
    .map(s => s.car!);

  const {
    state, openLobbies, currentLobby, countdown,
    racePlayers, raceHistory, myUserId, myName,
    isLoading, error,
    createLobby, joinLobby, leaveLobby, resetRace, refetchLobbies,
  } = useRachaLobby({ onSpendMoney, onAddMoney });

  // ── idle ──────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <LobbyListView
        openLobbies={openLobbies}
        carsInGarage={carsInGarage}
        gameState={gameState}
        myUserId={myUserId}
        myName={myName}
        isLoading={isLoading}
        error={error}
        raceHistory={raceHistory}
        onCreateLobby={createLobby}
        onJoinLobby={joinLobby}
        onRefresh={refetchLobbies}
      />
    );
  }

  // ── in_lobby ──────────────────────────────────────────────────
  if (state === 'in_lobby' && currentLobby) {
    return (
      <WaitingRoomView
        lobby={currentLobby}
        myUserId={myUserId}
        onLeave={leaveLobby}
      />
    );
  }

  // ── countdown ─────────────────────────────────────────────────
  if (state === 'countdown' && currentLobby) {
    return <CountdownView lobby={currentLobby} countdown={countdown} />;
  }

  // ── racing ────────────────────────────────────────────────────
  if (state === 'racing') {
    return <RaceView players={racePlayers} />;
  }

  // ── result ────────────────────────────────────────────────────
  if (state === 'result') {
    return (
      <ResultView
        players={racePlayers}
        myUserId={myUserId}
        onBack={resetRace}
      />
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════
// Sub-views
// ══════════════════════════════════════════════════════════════════

// ── Lista de lobbies ─────────────────────────────────────────────
interface LobbyListViewProps {
  openLobbies:   OpenLobby[];
  carsInGarage:  OwnedCar[];
  gameState:     GameState;
  myUserId:      string | null;
  myName:        string;
  isLoading:     boolean;
  error:         string | null;
  raceHistory:   RaceRecord[];
  onCreateLobby: (car: OwnedCar, bet: number, maxPlayers: number) => Promise<void>;
  onJoinLobby:   (lobby: OpenLobby, car: OwnedCar) => Promise<void>;
  onRefresh:     () => void;
}

function LobbyListView({
  openLobbies, carsInGarage, gameState, myUserId, myName,
  isLoading, error, raceHistory,
  onCreateLobby, onJoinLobby, onRefresh,
}: LobbyListViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [joinLobbyTarget, setJoinLobbyTarget] = useState<OpenLobby | null>(null);

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
            PvP · Lobby aberto · Até 4 jogadores
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5 text-[12px]">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          {carsInGarage.length > 0 && (
            <Button size="sm" className="gap-1.5 text-[12px]" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Criar Racha
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-[12px] bg-red-500/10 border border-red-500/25 text-red-400 text-[12px]">
          {error}
        </div>
      )}

      {/* Sem carros */}
      {carsInGarage.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <div className="text-5xl">🏁</div>
          <div className="text-[14px] font-semibold text-muted-foreground">Garagem vazia</div>
          <div className="text-[11px] text-muted-foreground">Compre um carro para participar</div>
        </div>
      )}

      {/* Lobbies abertos */}
      {carsInGarage.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Lobbies Abertos
          </div>

          {openLobbies.filter(l => l.status === 'waiting').length === 0 ? (
            <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
              <div className="text-3xl">🕹️</div>
              <div className="text-[13px] text-muted-foreground">Nenhum lobby aberto</div>
              <div className="text-[11px] text-muted-foreground">Crie um racha para começar!</div>
            </div>
          ) : (
            openLobbies
              .filter(l => l.status === 'waiting' && l.hostId !== myUserId)
              .map(lobby => (
                <LobbyCard
                  key={lobby.id}
                  lobby={lobby}
                  canJoin={gameState.money >= lobby.bet && carsInGarage.length > 0}
                  onJoin={() => setJoinLobbyTarget(lobby)}
                />
              ))
          )}

          {/* Meus lobbies (criados por mim) */}
          {openLobbies.filter(l => l.hostId === myUserId).map(lobby => (
            <LobbyCard
              key={lobby.id}
              lobby={lobby}
              canJoin={false}
              isOwn={true}
              onJoin={() => {}}
            />
          ))}
        </div>
      )}

      {/* Histórico */}
      {raceHistory.length > 0 && (
        <RaceHistorySection history={raceHistory.slice(0, 8)} />
      )}

      {/* Modal: criar racha */}
      {showCreate && (
        <CreateLobbyModal
          carsInGarage={carsInGarage}
          gameState={gameState}
          onConfirm={(car, bet, maxPlayers) => {
            setShowCreate(false);
            void onCreateLobby(car, bet, maxPlayers);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Modal: entrar em lobby */}
      {joinLobbyTarget && (
        <JoinLobbyModal
          lobby={joinLobbyTarget}
          carsInGarage={carsInGarage}
          gameState={gameState}
          onConfirm={(car) => {
            const target = joinLobbyTarget;
            setJoinLobbyTarget(null);
            void onJoinLobby(target, car);
          }}
          onClose={() => setJoinLobbyTarget(null)}
        />
      )}
    </div>
  );
}

// ── Card de lobby na lista ────────────────────────────────────────
function LobbyCard({
  lobby, canJoin, isOwn = false, onJoin,
}: {
  lobby: OpenLobby;
  canJoin: boolean;
  isOwn?: boolean;
  onJoin: () => void;
}) {
  const currentPlayers = lobby.players.length;
  const spotsFilled    = `${currentPlayers}/${lobby.maxPlayers}`;

  return (
    <div className={`ios-surface rounded-[14px] p-3.5 flex items-center gap-3 ${
      isOwn ? 'border border-primary/20 bg-primary/3' : ''
    }`}>
      {/* Info */}
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
            {spotsFilled}
          </span>
          {/* Vagas visuais */}
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

      {/* Botão entrar */}
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
    </div>
  );
}

// ── Modal: criar racha (bottom sheet) ────────────────────────────
function CreateLobbyModal({
  carsInGarage, gameState, onConfirm, onClose,
}: {
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  onConfirm:    (car: OwnedCar, bet: number, maxPlayers: number) => void;
  onClose:      () => void;
}) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar>(carsInGarage[0]!);
  const [bet,         setBet]         = useState(1_000);
  const [customBet,   setCustomBet]   = useState(false);
  const [betInput,    setBetInput]    = useState('');
  const [maxPlayers,  setMaxPlayers]  = useState(2);

  const canCreate = selectedCar && bet > 0 && bet <= gameState.money;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 ios-surface rounded-t-[24px] shadow-2xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border/40">
          <h3 className="font-bold text-[16px] text-foreground">🏁 Criar Racha</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Carro */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Carro</div>
            <div className="space-y-2">
              {carsInGarage.map(car => {
                const perf = getFullPerformance(car);
                const sel  = selectedCar?.instanceId === car.instanceId;
                return (
                  <button
                    key={car.instanceId}
                    onClick={() => setSelectedCar(car)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[14px] text-left transition-all active:scale-[0.98] ${
                      sel
                        ? 'bg-primary/10 border border-primary/40'
                        : 'bg-muted/30 border border-transparent'
                    }`}
                  >
                    <span className="text-2xl">{car.icon}</span>
                    <span className="flex-1 text-[13px] font-semibold text-foreground truncate">{car.fullName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${igpClass(perf.igp)}`}>
                      IGP {perf.igp}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vagas */}
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
                    maxPlayers === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Aposta */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Aposta</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {BET_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => { setBet(p); setCustomBet(false); setBetInput(''); }}
                  className={`px-3 py-2 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                    !customBet && bet === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {fmt(p)}
                </button>
              ))}
              <button
                onClick={() => setCustomBet(v => !v)}
                className={`px-3 py-2 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                  customBet ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
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
                className="w-full bg-muted rounded-[12px] px-4 py-3 text-[14px] text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              />
            )}
            <div className="ios-surface-elevated rounded-[14px] p-3.5 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Pot total</span>
                <span className="font-bold text-foreground">{fmt(bet * maxPlayers)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">🥇 1º lugar</span>
                <span className="font-bold text-emerald-400">{fmt(Math.round(bet * maxPlayers * 0.9 * 0.7))}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">🥈 2º lugar</span>
                <span className="font-bold text-gray-300">{fmt(Math.round(bet * maxPlayers * 0.9 * 0.2))}</span>
              </div>
            </div>
            {bet > gameState.money && (
              <p className="text-[12px] text-red-400 mt-2 font-semibold">⚠️ Saldo insuficiente</p>
            )}
          </div>
        </div>

        {/* Botão fixo + safe area */}
        <div
          className="px-5 pt-3 shrink-0 border-t border-border/40"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            className="w-full h-13 text-[15px] font-bold gap-2"
            disabled={!canCreate}
            onClick={() => onConfirm(selectedCar!, bet, maxPlayers)}
          >
            <Zap size={16} />
            Criar Racha · {fmt(bet)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: entrar em lobby (bottom sheet) ────────────────────────
function JoinLobbyModal({
  lobby, carsInGarage, gameState, onConfirm, onClose,
}: {
  lobby:        OpenLobby;
  carsInGarage: OwnedCar[];
  gameState:    GameState;
  onConfirm:    (car: OwnedCar) => void;
  onClose:      () => void;
}) {
  const [selectedCar, setSelectedCar] = useState<OwnedCar>(carsInGarage[0]!);
  const canJoin = gameState.money >= lobby.bet;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 ios-surface rounded-t-[24px] shadow-2xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border/40">
          <h3 className="font-bold text-[16px] text-foreground">⚡ Entrar no Racha</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Info do lobby */}
          <div className="ios-surface-elevated rounded-[14px] p-4 space-y-2.5">
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
              <span className="font-bold text-yellow-400">{fmt(Math.round(lobby.bet * lobby.maxPlayers * 0.9 * 0.7))}</span>
            </div>
          </div>

          {/* Jogadores já no lobby */}
          {lobby.players.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                No lobby
              </div>
              <div className="space-y-1.5">
                {lobby.players.map(p => (
                  <div key={p.userId} className="flex items-center gap-2.5 bg-muted/30 rounded-[12px] px-3 py-2">
                    <span className="text-lg">{p.carIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.carName}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${igpClass(p.igp)}`}>
                      {p.igp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seleção de carro */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Seu Carro</div>
            <div className="space-y-2">
              {carsInGarage.map(car => {
                const perf = getFullPerformance(car);
                const sel  = selectedCar?.instanceId === car.instanceId;
                return (
                  <button
                    key={car.instanceId}
                    onClick={() => setSelectedCar(car)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[14px] text-left transition-all active:scale-[0.98] ${
                      sel
                        ? 'bg-primary/10 border border-primary/40'
                        : 'bg-muted/30 border border-transparent'
                    }`}
                  >
                    <span className="text-2xl">{car.icon}</span>
                    <span className="flex-1 text-[13px] font-semibold text-foreground truncate">{car.fullName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${igpClass(perf.igp)}`}>
                      IGP {perf.igp}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!canJoin && (
            <p className="text-[12px] text-red-400 font-semibold">⚠️ Saldo insuficiente para esta aposta</p>
          )}
        </div>

        {/* Botão fixo + safe area */}
        <div
          className="px-5 pt-3 shrink-0 border-t border-border/40"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            className="w-full h-13 text-[15px] font-bold gap-2"
            disabled={!canJoin || !selectedCar}
            onClick={() => onConfirm(selectedCar!)}
          >
            <Zap size={16} />
            Confirmar · {fmt(lobby.bet)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sala de espera ────────────────────────────────────────────────
function WaitingRoomView({
  lobby, myUserId, onLeave,
}: {
  lobby:    OpenLobby;
  myUserId: string | null;
  onLeave:  () => void;
}) {
  const currentPlayers = lobby.players.length;
  const waitingFor     = lobby.maxPlayers - currentPlayers;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onLeave} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-bold text-[16px] text-foreground">Sala de Espera</h2>
          <p className="text-[11px] text-muted-foreground">Aguardando jogadores...</p>
        </div>
      </div>

      {/* Status */}
      <div className="ios-surface rounded-[16px] p-4 text-center space-y-2">
        <div className="text-[48px]">
          {waitingFor > 0 ? '⏳' : '🏁'}
        </div>
        <div className="font-bold text-[16px] text-foreground">
          {waitingFor > 0
            ? `Aguardando ${waitingFor} jogador${waitingFor > 1 ? 'es' : ''}...`
            : 'Lobby completo! Iniciando...'}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[12px] text-muted-foreground">Aposta: </span>
          <span className="text-[13px] font-bold text-emerald-400">{fmt(lobby.bet)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-[12px] text-muted-foreground">{currentPlayers}/{lobby.maxPlayers} jogadores</span>
        </div>
        {/* Vagas visuais */}
        <div className="flex justify-center gap-2 mt-1">
          {Array.from({ length: lobby.maxPlayers }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors duration-300 ${
                i < currentPlayers ? 'bg-primary scale-110' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Lista de jogadores */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Participantes ({currentPlayers}/{lobby.maxPlayers})
        </div>
        {lobby.players.map((p, i) => (
          <div key={p.userId} className={`ios-surface rounded-[12px] p-3 flex items-center gap-3 ${
            p.userId === myUserId ? 'border border-primary/30 bg-primary/3' : ''
          }`}>
            <span className="text-xl">{p.carIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                {p.name}
                {p.userId === myUserId && (
                  <span className="text-[10px] text-primary font-normal">(você)</span>
                )}
                {i === 0 && <span className="text-[10px] text-amber-400">👑 Host</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{p.carName}</div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${igpClass(p.igp)}`}>
              IGP {p.igp}
            </span>
          </div>
        ))}
        {/* Slots vazios */}
        {Array.from({ length: lobby.maxPlayers - currentPlayers }, (_, i) => (
          <div key={`empty-${i}`} className="ios-surface rounded-[12px] p-3 flex items-center gap-3 opacity-40 border border-dashed border-border">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">?</div>
            <div className="text-[12px] text-muted-foreground">Aguardando jogador...</div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={onLeave} className="gap-2 w-full text-[12px]">
        <X size={13} />
        Sair do Lobby (recebe aposta de volta)
      </Button>
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────
function CountdownView({ lobby, countdown }: { lobby: OpenLobby; countdown: number }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
      {/* Jogadores */}
      <div className="w-full ios-surface rounded-[16px] p-4 space-y-2">
        {lobby.players.map(p => (
          <div key={p.userId} className="flex items-center gap-2 text-[12px]">
            <span className="text-lg">{p.carIcon}</span>
            <span className="font-semibold text-foreground flex-1 truncate">{p.name}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black border ${igpClass(p.igp)}`}>
              IGP {p.igp}
            </span>
          </div>
        ))}
      </div>
      {/* Número */}
      <div className={`text-[96px] font-black tabular-nums leading-none transition-all duration-300 ${
        countdown > 0 ? 'text-primary scale-110' : 'text-emerald-400 scale-125'
      }`}>
        {countdown > 0 ? countdown : 'GO!'}
      </div>
      <div className="text-[15px] text-muted-foreground animate-pulse">Prepare-se...</div>
    </div>
  );
}

// ── Corrida animada ───────────────────────────────────────────────
function RaceView({ players }: { players: RacePlayerAnim[] }) {
  // Calcula posição atual de cada barra em tempo real
  const sorted = [...players].sort((a, b) => b.barProgress - a.barProgress);
  const posMap  = new Map(sorted.map((p, i) => [p.userId, i + 1]));

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="font-bold text-[17px] text-foreground animate-pulse">🏁 Corrida em andamento...</div>
      </div>

      <div className="space-y-3">
        {players.map(p => {
          const livePos = posMap.get(p.userId) ?? 1;
          return (
            <div key={p.userId} className={`space-y-1.5 ${p.isMe ? 'ring-1 ring-primary/40 rounded-[14px] p-2' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-bold w-6 shrink-0 ${positionColor(livePos)}`}>
                  {livePos}º
                </span>
                <span className="text-lg">{p.carIcon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold text-foreground truncate block">
                    {p.name}
                    {p.isMe && <span className="ml-1 text-[10px] text-primary font-normal">(você)</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block">{p.carName}</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-muted-foreground shrink-0">
                  {Math.round(p.barProgress)}%
                </span>
              </div>
              <div className="w-full h-5 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-none"
                  style={{
                    width:      `${p.barProgress}%`,
                    background: barColor(livePos),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Resultado ─────────────────────────────────────────────────────
function ResultView({
  players, myUserId, onBack,
}: {
  players:  RacePlayerAnim[];
  myUserId: string | null;
  onBack:   () => void;
}) {
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const me     = sorted.find(p => p.isMe);

  return (
    <div className="space-y-4">
      {/* Resultado do jogador */}
      {me && (
        <div className={`ios-surface rounded-[20px] p-5 text-center border-2 ${
          me.position === 1
            ? 'border-yellow-400/50 bg-yellow-400/5'
            : me.position === 2
            ? 'border-gray-400/50 bg-gray-400/5'
            : me.position === 3
            ? 'border-amber-600/50 bg-amber-600/5'
            : 'border-border bg-muted/20'
        }`}>
          <div className="text-6xl mb-2">{positionMedal(me.position)}</div>
          <div className={`font-black text-[28px] ${positionColor(me.position)}`}>
            {me.position === 1 ? 'VITÓRIA!'
             : me.position === 2 ? '2º LUGAR'
             : me.position === 3 ? '3º LUGAR'
             : '4º LUGAR'}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-foreground">
            {me.payout > 0
              ? <span className="text-emerald-400">+{fmt(me.payout)}</span>
              : <span className="text-red-400">Nenhum prêmio</span>
            }
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            IGP {me.igp} · Score {me.score.toFixed(1)}
          </div>
        </div>
      )}

      {/* Pódio completo */}
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Classificação Final
        </div>
        {sorted.map(p => (
          <div
            key={p.userId}
            className={`flex items-center gap-3 p-2.5 rounded-[12px] transition-colors ${
              p.isMe ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20'
            }`}
          >
            <span className="text-[18px] w-8 text-center shrink-0">
              {positionMedal(p.position)}
            </span>
            <span className="text-xl">{p.carIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-foreground truncate">
                {p.name}
                {p.isMe && <span className="ml-1.5 text-[10px] text-primary font-normal">(você)</span>}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {p.carName} · IGP {p.igp}
              </div>
            </div>
            <div className="text-right shrink-0">
              {p.payout > 0
                ? <div className="text-[12px] font-bold text-emerald-400">+{fmt(p.payout)}</div>
                : <div className="text-[12px] text-muted-foreground">—</div>
              }
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {p.score.toFixed(1)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full gap-2" onClick={onBack}>
        <ArrowLeft size={14} />
        Voltar aos Lobbies
      </Button>
    </div>
  );
}

// ── Histórico ─────────────────────────────────────────────────────
function RaceHistorySection({ history }: { history: RaceRecord[] }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
        Histórico
      </div>
      {history.map(r => {
        const pos = r.myPosition ?? (r.won ? 1 : 2);
        return (
          <div key={r.id} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
            <span className="text-[20px]">{positionMedal(pos)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-foreground truncate">
                {r.participants
                  ? `${r.totalPlayers ?? '?'} jogadores · ${pos}º lugar`
                  : `vs. ${r.opponentName}`}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock size={9} />
                {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                {' · '}Aposta {fmt(r.bet)}
              </div>
            </div>
            <div className={`text-[12px] font-bold tabular-nums ${r.payout > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.payout > 0 ? `+${fmt(r.payout)}` : `-${fmt(r.bet)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
