// =====================================================================
// RachaScreen — Sistema de Racha Assíncrono
// Lobby aberto, resultado calculado pelo servidor, coleta offline.
// =====================================================================
import { useState } from 'react';
import { Zap, Plus, Users, Clock, RefreshCw, ArrowLeft } from 'lucide-react';
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
  return pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '4º';
}

function positionColor(pos: number) {
  if (pos === 1) return 'text-yellow-400';
  if (pos === 2) return 'text-gray-300';
  if (pos === 3) return 'text-amber-600';
  return 'text-muted-foreground';
}

// ── Componente principal ─────────────────────────────────────────
export function RachaScreen({ gameState, onSpendMoney, onAddMoney }: RachaScreenProps) {
  const carsInGarage = gameState.garage
    .filter(s => s.unlocked && s.car)
    .map(s => s.car!);

  // Navegação interna — renderizados como views normais (sem overlay fixed)
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
    dismissResult,
    refetchLobbies,
  } = useRachaLobby({ onSpendMoney, onAddMoney });

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

  // ── resultado (coleta imediata ou pendente) ───────────────────
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

// ── Lista principal ───────────────────────────────────────────────
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
  // Lobbies onde já entrei (aguardando corrida)
  const myActiveLobbies = openLobbies.filter(
    l => l.players.some(p => p.userId === myUserId),
  );
  // Lobbies que posso entrar (não sou participante)
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
            PvP · Lobby aberto · Até 4 jogadores
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
          {carsInGarage.length > 0 && (
            <Button size="sm" className="gap-1.5 text-[12px]" onClick={onShowCreate}>
              <Plus size={14} />
              Criar Racha
            </Button>
          )}
        </div>
      </div>

      {/* Mensagem de sucesso */}
      {successMessage && (
        <div className="px-4 py-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[12px] font-medium">
          {successMessage}
        </div>
      )}

      {/* Mensagem de erro */}
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

      {carsInGarage.length > 0 && (
        <>
          {/* ── Resultados pendentes ─────────────────────────── */}
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

          {/* ── Meus rachas ativos ────────────────────────────── */}
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

          {/* ── Lobbies abertos ──────────────────────────────── */}
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

      {/* ── Histórico ─────────────────────────────────────────── */}
      {raceHistory.length > 0 && (
        <RaceHistorySection history={raceHistory.slice(0, 8)} />
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
        <Button size="sm" onClick={onCollect} className="text-[12px] px-4 shrink-0">
          Ver resultado
        </Button>
      </div>
    </div>
  );
}

// ── Card de lobby na lista ────────────────────────────────────────
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

      {/* Botão sair (meus lobbies) */}
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

// ── View: criar racha ─────────────────────────────────────────────
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
      {/* Mini-header */}
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
            Lobby fica aberto até lotar — resultado automático
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
            <span className="font-bold text-emerald-400">{fmt(Math.round(bet * maxPlayers * 0.9 * 0.7))}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">🥈 2º lugar recebe</span>
            <span className="font-bold text-gray-300">{fmt(Math.round(bet * maxPlayers * 0.9 * 0.2))}</span>
          </div>
          <div className="border-t border-border/40 pt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Taxa do sistema</span>
            <span>10%</span>
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

// ── View: entrar em lobby ─────────────────────────────────────────
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
      {/* Mini-header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 shrink-0"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="font-bold text-[17px] text-foreground flex-1">⚡ Entrar no Racha</h2>
      </div>

      {/* Resumo do lobby */}
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
          <span className="font-bold text-yellow-400">{fmt(Math.round(lobby.bet * lobby.maxPlayers * 0.9 * 0.7))}</span>
        </div>
        <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          Resultado calculado automaticamente quando lotar
        </div>
      </div>

      {/* Jogadores no lobby */}
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

      {/* Escolha de carro */}
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

// ── Resultado (estático, baseado em dados do servidor) ────────────
function ResultView({
  players, myUserId, onBack,
}: {
  players:  RacePlayerAnim[];
  myUserId: string | null;
  onBack:   () => void;
}) {
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const me     = sorted.find(p => p.isMe || p.userId === myUserId);

  return (
    <div className="space-y-4">
      {/* Meu resultado */}
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
              : <span className="text-muted-foreground">Nenhum prêmio</span>
            }
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            IGP {me.igp} · Score {me.score.toFixed(1)}
          </div>
        </div>
      )}

      {/* Classificação completa */}
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Classificação Final
        </div>
        {sorted.map(p => (
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
