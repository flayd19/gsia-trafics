// =====================================================================
// RachaScreen — Tela de rachas
// =====================================================================
import { useState, useEffect } from 'react';
import { Zap, X, Trophy, TrendingDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState, OwnedCar } from '@/types/game';
import type { TuneUpgrade, RaceRecord } from '@/types/performance';
import { getFullPerformance } from '@/lib/performanceEngine';
import { useRacing } from '@/hooks/useRacing';
import { supabase } from '@/integrations/supabase/client';

// ── Props ────────────────────────────────────────────────────────
interface RachaScreenProps {
  gameState:         GameState;
  onSpendMoney:      (amount: number) => boolean;
  onAddMoney:        (amount: number) => void;
  onUpdateCarTunes:  (carInstanceId: string, upgrades: TuneUpgrade[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const BET_PRESETS = [500, 1_000, 5_000, 10_000, 25_000];

function igpBadgeClass(igp: number): string {
  if (igp > 75) return 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30';
  if (igp > 50) return 'bg-amber-500/15 text-amber-500 border border-amber-500/30';
  return 'bg-red-500/15 text-red-500 border border-red-500/30';
}

// ── Componente principal ─────────────────────────────────────────
export function RachaScreen({ gameState, onSpendMoney, onAddMoney, onUpdateCarTunes }: RachaScreenProps) {
  const carsInGarage = gameState.garage
    .filter(s => s.unlocked && s.car)
    .map(s => s.car!);

  const [selectedCar, setSelectedCar] = useState<OwnedCar | null>(
    carsInGarage.length > 0 ? carsInGarage[0] : null
  );
  const [bet,         setBet]         = useState(1_000);
  const [betInput,    setBetInput]    = useState('');
  const [customBet,   setCustomBet]   = useState(false);
  const [playerName,  setPlayerName]  = useState('Jogador');

  // Tenta buscar nome do jogador
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      (supabase as any)
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }: { data: { display_name?: string } | null }) => {
          if (data?.display_name) setPlayerName(data.display_name);
        });
    });
  }, []);

  const {
    state, opponent, countdown, raceProgress, result, raceHistory,
    joinRace, cancelSearch, resetRace,
  } = useRacing();

  const handleUpdateHistory = (carInstanceId: string, record: RaceRecord) => {
    // Atualiza no OwnedCar via closure (gameState.garage)
    const slot = gameState.garage.find(s => s.car?.instanceId === carInstanceId);
    if (!slot?.car) return;
    // raceHistory é armazenado no OwnedCar mas não precisamos de prop específica
    // O useRacing já mantém histórico local
    void (record); void (carInstanceId);
  };

  const handleJoinRace = () => {
    if (!selectedCar) return;
    void joinRace(selectedCar, bet, playerName, onSpendMoney, onAddMoney, handleUpdateHistory);
  };

  // ── Tela: idle / seleção ─────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            Rachas
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Desafie outros jogadores com seu carro mais tunado
          </p>
        </div>

        {carsInGarage.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">🏁</div>
            <div className="text-[15px] font-semibold text-muted-foreground">Garagem vazia</div>
            <div className="text-[12px] text-muted-foreground">
              Compre um carro para participar de rachas
            </div>
          </div>
        ) : (
          <>
            {/* Seleção de carro */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
                Selecionar Carro
              </div>
              <div className="space-y-2">
                {carsInGarage.map(car => {
                  const perf = getFullPerformance(car);
                  const sel  = selectedCar?.instanceId === car.instanceId;
                  return (
                    <button
                      key={car.instanceId}
                      onClick={() => setSelectedCar(car)}
                      className={`w-full flex items-center gap-3 p-3 rounded-[14px] border transition-all text-left ${
                        sel ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <span className="text-2xl">{car.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] text-foreground truncate">
                          {car.fullName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{car.year}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${igpBadgeClass(perf.igp)}`}>
                        IGP {perf.igp}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aposta */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
                Aposta
              </div>
              <div className="ios-surface rounded-[16px] p-4 space-y-3">
                {/* Presets */}
                <div className="flex gap-2 flex-wrap">
                  {BET_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => { setBet(preset); setCustomBet(false); setBetInput(''); }}
                      className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                        !customBet && bet === preset
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {fmt(preset)}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomBet(v => !v)}
                    className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                      customBet ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>

                {/* Campo custom */}
                {customBet && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[13px] font-semibold">R$</span>
                    <input
                      type="number"
                      value={betInput}
                      onChange={e => {
                        setBetInput(e.target.value);
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) setBet(Math.round(v));
                      }}
                      placeholder="Valor da aposta"
                      className="flex-1 bg-muted rounded-[10px] px-3 py-2 text-[13px] text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                <div className="text-[12px] text-muted-foreground">
                  Aposta atual: <span className="font-bold text-foreground">{fmt(bet)}</span>
                  {' '}· Pot total: <span className="font-bold text-primary">{fmt(bet * 2)}</span>
                  {' '}· Prêmio (90%): <span className="font-bold text-emerald-500">{fmt(Math.round(bet * 2 * 0.9))}</span>
                </div>
              </div>
            </div>

            {/* Botão de racha */}
            <Button
              size="lg"
              className="w-full gap-2 font-bold text-[15px]"
              disabled={!selectedCar || bet > gameState.money || bet <= 0}
              onClick={handleJoinRace}
            >
              <Zap size={18} />
              Entrar na Fila — {fmt(bet)}
            </Button>
            {bet > gameState.money && (
              <p className="text-center text-[12px] text-red-500">Saldo insuficiente</p>
            )}

            {/* Histórico */}
            {raceHistory.length > 0 && (
              <HistorySection history={raceHistory.slice(0, 10)} />
            )}

            {/* Histórico do carro selecionado */}
            {selectedCar && (selectedCar.raceHistory ?? []).length > 0 && (
              <HistorySection history={(selectedCar.raceHistory ?? []).slice(0, 10)} title="Histórico do Carro" />
            )}
          </>
        )}
      </div>
    );
  }

  // ── Tela: buscando ────────────────────────────────────────────
  if (state === 'searching') {
    return (
      <SearchingScreen onCancel={cancelSearch} bet={bet} />
    );
  }

  // ── Tela: countdown ───────────────────────────────────────────
  if (state === 'countdown') {
    return (
      <CountdownScreen
        countdown={countdown}
        myCar={selectedCar}
        opponent={opponent}
      />
    );
  }

  // ── Tela: corrida ─────────────────────────────────────────────
  if (state === 'racing') {
    return (
      <RacingScreen
        myCar={selectedCar}
        opponent={opponent}
        progress={raceProgress}
      />
    );
  }

  // ── Tela: resultado ───────────────────────────────────────────
  if (state === 'result' && result) {
    return (
      <ResultScreen
        result={result}
        myCar={selectedCar}
        onRevanche={() => { resetRace(); handleJoinRace(); }}
        onBack={resetRace}
      />
    );
  }

  return null;
}

// ── Sub-telas ────────────────────────────────────────────────────

function SearchingScreen({ onCancel, bet }: { onCancel: () => void; bet: number }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-5xl animate-bounce">🏎️</div>
      <div className="space-y-2 text-center">
        <div className="font-bold text-[18px] text-foreground">Procurando oponente...</div>
        <div className="text-[13px] text-muted-foreground">Aposta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(bet)}</div>
        <div className="text-[12px] text-muted-foreground">Se não encontrar adversário em 10s, um bot será criado</div>
      </div>
      {/* Spinner */}
      <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
        <X size={14} />
        Cancelar
      </Button>
    </div>
  );
}

function CountdownScreen({
  countdown,
  myCar,
  opponent,
}: {
  countdown: number;
  myCar: OwnedCar | null;
  opponent: { name: string; carName: string; igp: number } | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
      <div className="w-full ios-surface rounded-[16px] p-4 flex justify-between items-center gap-4">
        <div className="text-center flex-1">
          <div className="text-2xl">{myCar?.icon ?? '🚗'}</div>
          <div className="text-[12px] font-bold text-foreground truncate">{myCar?.brand}</div>
          <div className="text-[10px] text-muted-foreground truncate">{myCar?.model}</div>
        </div>
        <div className="text-2xl text-muted-foreground font-bold">VS</div>
        <div className="text-center flex-1">
          <div className="text-2xl">🏎️</div>
          <div className="text-[12px] font-bold text-foreground truncate">{opponent?.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{opponent?.carName}</div>
        </div>
      </div>
      <div
        className={`text-[80px] font-black tabular-nums leading-none transition-transform ${
          countdown > 0 ? 'scale-110 text-primary' : 'text-emerald-500 scale-125'
        }`}
      >
        {countdown > 0 ? countdown : 'GO!'}
      </div>
      <div className="text-[14px] text-muted-foreground">Prepare-se...</div>
    </div>
  );
}

function RacingScreen({
  myCar,
  opponent,
  progress,
}: {
  myCar: OwnedCar | null;
  opponent: { name: string; carName: string; igp: number } | null;
  progress: { me: number; opp: number };
}) {
  return (
    <div className="flex flex-col justify-center min-h-[70vh] space-y-6 px-2">
      <div className="text-center font-bold text-[16px] text-foreground animate-pulse">
        🏁 Corrida em andamento...
      </div>
      {/* Meu carro */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{myCar?.icon ?? '🚗'}</span>
          <span className="text-[13px] font-bold text-foreground flex-1 truncate">Você ({myCar?.model})</span>
          <span className="text-[12px] font-bold text-primary tabular-nums">{Math.round(progress.me)}%</span>
        </div>
        <div className="w-full h-5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${progress.me}%`, background: 'var(--gradient-primary)' }}
          />
        </div>
      </div>
      {/* Oponente */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏎️</span>
          <span className="text-[13px] font-bold text-foreground flex-1 truncate">{opponent?.name}</span>
          <span className="text-[12px] font-bold text-red-500 tabular-nums">{Math.round(progress.opp)}%</span>
        </div>
        <div className="w-full h-5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-none bg-red-500"
            style={{ width: `${progress.opp}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  myCar,
  onRevanche,
  onBack,
}: {
  result: {
    won: boolean;
    myIgp: number;
    opponentIgp: number;
    bet: number;
    payout: number;
    record: RaceRecord;
  };
  myCar: OwnedCar | null;
  onRevanche: () => void;
  onBack: () => void;
}) {
  const fmt2 = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-5">
      {/* Resultado */}
      <div className={`ios-surface rounded-[20px] p-6 text-center space-y-3 border-2 ${
        result.won ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'
      }`}>
        <div className="text-6xl">{result.won ? '🏆' : '💔'}</div>
        <div className={`font-black text-[28px] ${result.won ? 'text-emerald-500' : 'text-red-500'}`}>
          {result.won ? 'VITÓRIA!' : 'DERROTA'}
        </div>
        {result.won ? (
          <div className="text-[18px] font-bold text-foreground">
            +{fmt2(result.payout)}
          </div>
        ) : (
          <div className="text-[18px] font-bold text-red-500">
            -{fmt2(result.bet)}
          </div>
        )}
        <div className="text-[12px] text-muted-foreground">
          vs. {result.record.opponentName} ({result.record.opponentCar})
        </div>
      </div>

      {/* Comparativo IGP */}
      <div className="ios-surface rounded-[16px] p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Comparativo de Performance
        </div>
        <div className="flex justify-around text-center py-2">
          <div>
            <div className="text-[30px] font-black tabular-nums text-primary">{result.myIgp}</div>
            <div className="text-[11px] text-muted-foreground">{myCar?.model ?? 'Você'}</div>
          </div>
          <div className="flex items-center text-muted-foreground font-bold text-[16px]">VS</div>
          <div>
            <div className="text-[30px] font-black tabular-nums text-red-500">{result.opponentIgp}</div>
            <div className="text-[11px] text-muted-foreground">{result.record.opponentName}</div>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={onBack}>
          <X size={14} />
          Voltar
        </Button>
        <Button className="flex-1 gap-2" onClick={onRevanche}>
          <Zap size={14} />
          Revanche
        </Button>
      </div>
    </div>
  );
}

function HistorySection({ history, title = 'Histórico de Rachas' }: { history: RaceRecord[]; title?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
        {title}
      </div>
      {history.map(r => (
        <div key={r.id} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            r.won ? 'bg-emerald-500/15' : 'bg-red-500/15'
          }`}>
            {r.won ? <Trophy size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-foreground truncate">
              vs. {r.opponentName} ({r.opponentCar})
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock size={9} />
              {new Date(r.createdAt).toLocaleDateString('pt-BR')}
              {' · '}IGP {r.myIgp} vs {r.opponentIgp}
            </div>
          </div>
          <div className={`text-[12px] font-bold tabular-nums ${r.won ? 'text-emerald-500' : 'text-red-500'}`}>
            {r.won ? `+${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(r.payout)}` : `-${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(r.bet)}`}
          </div>
        </div>
      ))}
    </div>
  );
}
