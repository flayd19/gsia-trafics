// =====================================================================
// LicitacoesScreen — Serviços Rápidos + Leilão de obras + obras em andamento
// =====================================================================
import { useState, useMemo, useEffect } from 'react';
import {
  Gavel, HardHat, RefreshCw, Clock, ChevronRight, CheckCircle2,
  Users, Truck, Package, ArrowLeft, AlertTriangle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  GameState,
  Licitacao,
  WorkType,
  AllocatedEmployee,
  AllocatedMachine,
  WorkRequirements,
  ActiveWork,
} from '@/types/game';
import type { MyWin } from '@/hooks/useLicitacoes';
import {
  fmt,
  getWorkTypeDef,
  EMPLOYEE_TYPES,
  MACHINE_CATALOG,
  generateServicosRapidos,
} from '@/data/construction';
import type { ServicoRapido } from '@/data/construction';
import {
  checkRequirements,
  calcProducaoPerMin,
  calcTempoEstimadoMin,
  calcWorkCost,
} from '@/lib/obraEngine';

// ── Props ──────────────────────────────────────────────────────────
interface LicitacoesScreenProps {
  gameState:      GameState;
  licitacoes:     Licitacao[];
  myWins:         MyWin[];
  myBids:         { licitacaoId: string; valor: number; placedAt: number }[];
  loading:        boolean;
  successMsg:     string | null;
  onIsLeading:    (id: string) => boolean;
  onMyBidFor:     (id: string) => number | null;
  onPlaceBid:     (id: string, valor: number) => Promise<{ ok: boolean; message: string }>;
  onClaimWin:     (id: string) => { ok: boolean; win?: MyWin };
  onStartWork:    (params: {
    licitacaoId:        string;
    nome:               string;
    tipo:               WorkType;
    tamanhoM2:          number;
    contractValue:      number;
    allocatedEmployees: AllocatedEmployee[];
    allocatedMachines:  AllocatedMachine[];
    materialQtys:       { materialId: string; quantity: number }[];
  }) => { ok: boolean; message: string };
  onConsumeWin:             (id: string) => void;
  onRefreshPool:            () => void;
  onAddEmployeeToWork:      (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveEmployeeFromWork: (workId: string, instanceId: string) => { ok: boolean; message: string };
  onAddMachineToWork:       (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveMachineFromWork:  (workId: string, instanceId: string) => { ok: boolean; message: string };
}

type MainTab = 'rapidas' | 'licitacoes' | 'obras';

function servicoToWin(s: ServicoRapido): MyWin {
  const fakeLic: Licitacao = {
    id:            s.id,
    nome:          s.nome,
    tipo:          s.tipo,
    tamanhoM2:     s.tamanhoM2,
    tempoBaseMin:  s.tempoBaseMin,
    custoEstimado: s.custoEstimado,
    valorBase:     s.valorContrato,
    requisitos:    s.requisitos,
    melhorLance:   s.valorContrato,
    liderNome:     'Você',
    liderId:       'local',
    expiresAt:     Date.now() - 1,
    status:        'won',
    batchId:       0,
    createdAt:     Date.now(),
  };
  return {
    licitacaoId:   s.id,
    nome:          s.nome,
    tipo:          s.tipo,
    tamanhoM2:     s.tamanhoM2,
    contractValue: s.valorContrato,
    wonAt:         Date.now(),
    prepDeadline:  Date.now() + 30 * 60_000,
    licitacao:     fakeLic,
  };
}

function fmtTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Encerrado';
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1_000);
  if (min > 60) return `${Math.floor(min / 60)}h ${min % 60}min`;
  if (min > 0) return `${min}min ${sec}s`;
  return `${sec}s`;
}

function workTypeColor(tipo: WorkType) {
  switch (tipo) {
    case 'pequena': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
    case 'media':   return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    case 'grande':  return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
    case 'mega':    return 'text-red-400 bg-red-500/10 border-red-500/25';
  }
}

// ══════════════════════════════════════════════════════════════════
// Tela principal
// ══════════════════════════════════════════════════════════════════
export function LicitacoesScreen(props: LicitacoesScreenProps) {
  const {
    gameState, licitacoes, myWins, loading, successMsg,
    onIsLeading, onMyBidFor, onPlaceBid, onClaimWin, onStartWork,
    onConsumeWin, onRefreshPool,
    onAddEmployeeToWork, onRemoveEmployeeFromWork,
    onAddMachineToWork, onRemoveMachineFromWork,
  } = props;

  const [mainTab,         setMainTab]         = useState<MainTab>('rapidas');
  const [selectedLic,     setSelectedLic]     = useState<Licitacao | null>(null);
  const [preparingWin,    setPreparingWin]    = useState<MyWin | null>(null);
  const [bidValue,        setBidValue]        = useState('');
  const [message,         setMessage]         = useState<{ text: string; ok: boolean } | null>(null);
  const [bidLoading,      setBidLoading]      = useState(false);
  const [servicosRapidos, setServicosRapidos] = useState<ServicoRapido[]>(() =>
    generateServicosRapidos(Date.now() % 10_000)
  );
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  function flash(result: { ok: boolean; message: string }) {
    setMessage({ text: result.message, ok: result.ok });
    setTimeout(() => setMessage(null), 4_000);
  }

  if (selectedLic) {
    return (
      <LicitacaoDetail
        lic={selectedLic}
        gameState={gameState}
        myBid={onMyBidFor(selectedLic.id)}
        isLeading={onIsLeading(selectedLic.id)}
        bidValue={bidValue}
        onBidValueChange={setBidValue}
        bidLoading={bidLoading}
        message={message}
        onBack={() => { setSelectedLic(null); setMessage(null); setBidValue(''); }}
        onPlaceBid={async () => {
          const v = parseFloat(bidValue.replace(/\D/g, '.'));
          if (isNaN(v) || v <= 0) { flash({ ok: false, message: 'Lance inválido.' }); return; }
          setBidLoading(true);
          const r = await onPlaceBid(selectedLic.id, v);
          flash(r);
          setBidLoading(false);
        }}
        onClaimWin={() => {
          const r = onClaimWin(selectedLic.id);
          if (r.ok && r.win) {
            setSelectedLic(null);
            setPreparingWin(r.win);
            setMainTab('obras');
          } else {
            flash({ ok: false, message: 'Não é possível reivindicar esta vitória.' });
          }
        }}
      />
    );
  }

  if (preparingWin) {
    return (
      <WorkPreparation
        win={preparingWin}
        gameState={gameState}
        onBack={() => setPreparingWin(null)}
        onStart={(params) => {
          const r = onStartWork(params);
          flash(r);
          if (r.ok) {
            onConsumeWin(preparingWin.licitacaoId);
            setPreparingWin(null);
            setMainTab('obras');
          }
          return r;
        }}
      />
    );
  }

  const selectedWork = selectedWorkId
    ? gameState.activeWorks.find(w => w.id === selectedWorkId) ?? null
    : null;

  if (selectedWorkId && selectedWork) {
    return (
      <WorkDetailView
        work={selectedWork}
        gameState={gameState}
        onBack={() => setSelectedWorkId(null)}
        onAddEmployee={(id)    => onAddEmployeeToWork(selectedWork.id, id)}
        onRemoveEmployee={(id) => onRemoveEmployeeFromWork(selectedWork.id, id)}
        onAddMachine={(id)     => onAddMachineToWork(selectedWork.id, id)}
        onRemoveMachine={(id)  => onRemoveMachineFromWork(selectedWork.id, id)}
      />
    );
  }
  if (selectedWorkId && !selectedWork) {
    setSelectedWorkId(null);
  }

  const pendingWins = myWins.filter(w => w.prepDeadline > Date.now());

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground flex items-center gap-2">
            <Gavel size={20} className="text-primary" />
            Licitações
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Menor lance vence · 30min para iniciar após vitória
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefreshPool} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        {([
          { id: 'rapidas',    label: 'Rápidas', badge: servicosRapidos.length },
          { id: 'licitacoes', label: 'Leilões',  badge: licitacoes.length },
          { id: 'obras',      label: 'Obras',    badge: gameState.activeWorks.length + pendingWins.length },
        ] as { id: MainTab; label: string; badge: number }[]).map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
              mainTab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
                mainTab === id ? 'bg-white/20' : 'bg-primary/20 text-primary'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {(successMsg || message) && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${
          (message?.ok ?? true)
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {message?.text ?? successMsg}
        </div>
      )}

      {mainTab === 'rapidas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">Contratos diretos · clique e inicie imediatamente</p>
            <button
              onClick={() => setServicosRapidos(generateServicosRapidos(Date.now() % 10_000))}
              className="text-[11px] text-primary font-semibold flex items-center gap-1"
            >
              <RefreshCw size={11} />
              Novos
            </button>
          </div>

          {servicosRapidos.length === 0 && (
            <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
              <div className="text-4xl">🔨</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Sem serviços disponíveis</div>
              <Button size="sm" onClick={() => setServicosRapidos(generateServicosRapidos(Date.now() % 10_000))}>Atualizar</Button>
            </div>
          )}

          {servicosRapidos.map(s => {
            const check  = checkRequirements(s.requisitos, gameState.employees, gameState.machines, gameState.warehouse);
            const empReq = s.requisitos.employees[0];
            const empDef = empReq ? EMPLOYEE_TYPES.find(d => d.type === empReq.type) : null;
            return (
              <div key={s.id} className="ios-surface rounded-[14px] p-3.5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🔨</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">{s.nome}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/25">RÁPIDO</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{s.tamanhoM2} m²</span>
                      <span>~{s.tempoBaseMin} min</span>
                      {empDef && <span>{empDef.icon} {empReq!.quantity}× {empDef.label}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Contrato</div>
                    <div className="text-[16px] font-bold text-primary">{fmt(s.valorContrato)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Custo est.</div>
                    <div className="text-[13px] font-semibold text-foreground">{fmt(s.custoEstimado)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Lucro est.</div>
                    <div className={`text-[13px] font-bold ${s.valorContrato > s.custoEstimado ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.valorContrato > s.custoEstimado ? '+' : ''}{fmt(s.valorContrato - s.custoEstimado)}
                    </div>
                  </div>
                </div>
                {!check.ok && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 rounded-[8px] px-2.5 py-1.5">
                    <AlertTriangle size={11} />
                    <span>Recursos insuficientes para executar</span>
                  </div>
                )}
                <Button
                  className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    setServicosRapidos(prev => prev.filter(r => r.id !== s.id));
                    setPreparingWin(servicoToWin(s));
                    setMainTab('obras');
                  }}
                >
                  <Zap size={14} />
                  Aceitar Serviço · {fmt(s.valorContrato)}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {mainTab === 'licitacoes' && (
        <div className="space-y-2">
          {loading && <div className="text-center py-8 text-muted-foreground text-[13px]">Carregando licitações...</div>}
          {!loading && licitacoes.length === 0 && (
            <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
              <div className="text-4xl">🏗️</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Sem licitações abertas</div>
              <div className="text-[11px] text-muted-foreground">Novas obras surgem a cada 30 minutos</div>
              <Button size="sm" onClick={onRefreshPool} className="gap-1.5 mt-1"><RefreshCw size={12} />Atualizar</Button>
            </div>
          )}
          {licitacoes.map(lic => {
            const def     = getWorkTypeDef(lic.tipo);
            const myBid   = onMyBidFor(lic.id);
            const leading = onIsLeading(lic.id);
            return (
              <button
                key={lic.id}
                onClick={() => setSelectedLic(lic)}
                className="w-full ios-surface rounded-[14px] p-3.5 text-left space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground truncate">{lic.nome}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${workTypeColor(lic.tipo)}`}>{def.label.toUpperCase()}</span>
                      {leading && <span className="text-[9px] text-emerald-400 font-black bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">🏆 LIDERANDO</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{lic.tamanhoM2.toLocaleString('pt-BR')} m²</span>
                      <span>{fmt(lic.custoEstimado)} est.</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    {lic.melhorLance === null ? (
                      <span className="text-muted-foreground">Sem lances</span>
                    ) : (
                      <span>🏅 <span className="font-semibold text-emerald-400">{fmt(lic.melhorLance)}</span><span className="text-muted-foreground ml-1">— {lic.liderNome}</span></span>
                    )}
                    {myBid && <span className="ml-2 text-primary font-semibold">Seu lance: {fmt(myBid)}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock size={10} />
                    <span>{fmtTimeLeft(lic.expiresAt)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {mainTab === 'obras' && (
        <div className="space-y-3">
          {pendingWins.map(win => (
            <div key={win.licitacaoId} className="ios-surface rounded-[14px] p-3.5 border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🏆</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-emerald-400">Você venceu!</div>
                  <div className="text-[12px] font-semibold text-foreground">{win.nome}</div>
                  <div className="text-[10px] text-muted-foreground">Contrato: {fmt(win.contractValue)} · {win.tamanhoM2.toLocaleString('pt-BR')} m²</div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-400">
                    <Clock size={9} />
                    <span>Inicie em: {fmtTimeLeft(win.prepDeadline)}</span>
                  </div>
                </div>
              </div>
              <Button className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => setPreparingWin(win)}>
                <HardHat size={14} />
                Preparar e Iniciar Obra
              </Button>
            </div>
          ))}

          {gameState.activeWorks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Em Andamento</div>
              {gameState.activeWorks.map(work => (
                <button
                  key={work.id}
                  onClick={() => { setSelectedWorkId(work.id); setMainTab('obras'); }}
                  className="w-full ios-surface rounded-[14px] p-3.5 space-y-2 text-left hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getWorkTypeDef(work.tipo).icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">{work.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {work.currentM2Done.toFixed(0)} / {work.tamanhoM2.toLocaleString('pt-BR')} m²
                        · {work.producaoPerMin.toFixed(1)} m²/min
                        · {work.allocatedEmployees.length} func.
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-bold text-primary">{work.progressPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{fmtTimeLeft(work.estimatedCompletesAt)}</div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-1000 ease-linear"
                      style={{ width: `${work.progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Contrato: {fmt(work.contractValue)}</span>
                    <span className="text-[10px] text-primary/70 font-medium">Toque para gerenciar →</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {gameState.workHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Histórico ({gameState.workHistory.length})</div>
              {gameState.workHistory.slice(0, 10).map(rec => (
                <div key={rec.id} className={`ios-surface rounded-[12px] px-3 py-2.5 flex items-center gap-3 ${rec.succeeded ? '' : 'opacity-60'}`}>
                  <span className="text-xl">{rec.succeeded ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">{rec.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{rec.tamanhoM2.toLocaleString('pt-BR')} m² · {rec.timeTakenMin}min</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[12px] font-bold ${rec.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {rec.profit >= 0 ? '+' : ''}{fmt(rec.profit)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{rec.profitPct}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingWins.length === 0 && gameState.activeWorks.length === 0 && gameState.workHistory.length === 0 && (
            <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
              <div className="text-4xl">👷</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Nenhuma obra</div>
              <div className="text-[11px] text-muted-foreground">Participe de licitações para ganhar contratos!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detalhe da licitação + dar lance
// ══════════════════════════════════════════════════════════════════
function LicitacaoDetail({
  lic, gameState, myBid, isLeading, bidValue, onBidValueChange,
  bidLoading, message, onBack, onPlaceBid, onClaimWin,
}: {
  lic:              Licitacao;
  gameState:        GameState;
  myBid:            number | null;
  isLeading:        boolean;
  bidValue:         string;
  onBidValueChange: (v: string) => void;
  bidLoading:       boolean;
  message:          { text: string; ok: boolean } | null;
  onBack:           () => void;
  onPlaceBid:       () => void;
  onClaimWin:       () => void;
}) {
  const def        = getWorkTypeDef(lic.tipo);
  const timeLeft   = lic.expiresAt - Date.now();
  const expired    = timeLeft <= 0;
  const canWin     = expired && isLeading;
  const check      = checkRequirements(lic.requisitos, gameState.employees, gameState.machines, gameState.warehouse);
  const suggestBid = lic.melhorLance !== null
    ? Math.floor(lic.melhorLance * 0.97)
    : Math.floor(lic.valorBase * 0.90);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted/50">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <h2 className="font-game-title text-[15px] font-bold">{lic.nome}</h2>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-bold px-2 py-1 rounded border ${workTypeColor(lic.tipo)}`}>{def.icon} {def.label.toUpperCase()}</span>
        {isLeading && <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">🏆 Você está liderando!</span>}
        {!expired && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock size={10} />{fmtTimeLeft(lic.expiresAt)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        {[
          { label: 'Área', value: `${lic.tamanhoM2.toLocaleString('pt-BR')} m²` },
          { label: 'Tempo base', value: `${lic.tempoBaseMin} min` },
          { label: 'Custo estimado', value: fmt(lic.custoEstimado) },
          { label: 'Valor base', value: fmt(lic.valorBase) },
        ].map(({ label, value }) => (
          <div key={label} className="ios-surface rounded-[10px] p-2.5">
            <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
            <div className="font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="ios-surface rounded-[12px] p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Situação do Leilão</div>
        {lic.melhorLance === null ? (
          <div className="text-[13px] text-muted-foreground">Sem lances — seja o primeiro!</div>
        ) : (
          <div className="text-[15px] font-bold text-emerald-400">{fmt(lic.melhorLance)}<span className="text-[11px] font-normal text-muted-foreground ml-2">— {lic.liderNome}</span></div>
        )}
        {myBid && <div className="text-[11px] text-primary font-semibold mt-1">Seu lance: {fmt(myBid)}</div>}
      </div>

      <div className="ios-surface rounded-[12px] p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Requisitos mínimos</div>
        {lic.requisitos.employees.length > 0 && (
          <div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Users size={9} /> Equipe</div>
            {lic.requisitos.employees.map(er => {
              const empDef = EMPLOYEE_TYPES.find(d => d.type === er.type);
              const miss   = check.missingEmployees.find(m => m.type === er.type);
              return (
                <div key={er.type} className={`text-[12px] flex items-center gap-2 ${miss ? 'text-red-400' : 'text-foreground'}`}>
                  <span>{empDef?.icon ?? '👷'}</span>
                  <span>{empDef?.label ?? er.type}: {er.quantity}×</span>
                  {miss && <AlertTriangle size={10} className="text-red-400" />}
                </div>
              );
            })}
          </div>
        )}
        {lic.requisitos.machines.length > 0 && (
          <div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Truck size={9} /> Máquinas</div>
            {lic.requisitos.machines.map(mr => {
              const miss = check.missingMachines.find(m => m.typeId === mr.typeId);
              return (
                <div key={mr.typeId} className={`text-[12px] flex items-center gap-2 ${miss ? 'text-red-400' : 'text-foreground'}`}>
                  <span>🚜</span>
                  <span>{mr.name}: {mr.quantity}×</span>
                  {miss && <AlertTriangle size={10} className="text-red-400" />}
                </div>
              );
            })}
          </div>
        )}
        {lic.requisitos.materials.length > 0 && (
          <div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Package size={9} /> Materiais</div>
            {lic.requisitos.materials.map(mr => {
              const miss = check.missingMaterials.find(m => m.materialId === mr.materialId);
              return (
                <div key={mr.materialId} className={`text-[12px] flex items-center gap-2 ${miss ? 'text-red-400' : 'text-foreground'}`}>
                  <span>🧱</span>
                  <span>{mr.name}: {mr.quantity.toLocaleString('pt-BR')} {mr.unit}</span>
                  {miss && <span className="text-red-400 text-[9px]">(faltam {(mr.quantity - (check.missingMaterials.find(m => m.materialId === mr.materialId)?.have ?? 0)).toLocaleString('pt-BR')})</span>}
                </div>
              );
            })}
          </div>
        )}
        {check.ok ? (
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> Você tem todos os requisitos!</div>
        ) : (
          <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-1"><AlertTriangle size={11} /> Recursos insuficientes para executar</div>
        )}
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${message.ok ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {canWin ? (
        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" onClick={onClaimWin}>
          <CheckCircle2 size={14} />
          Reivindicar Vitória · {fmt(myBid ?? 0)}
        </Button>
      ) : !expired ? (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Dar lance (menor que o atual)</div>
          <div className="text-[10px] text-muted-foreground px-1">Sugestão: {fmt(suggestBid)} (−3% do atual)</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={bidValue}
              onChange={e => onBidValueChange(e.target.value)}
              placeholder={suggestBid.toString()}
              className="flex-1 ios-surface rounded-[10px] px-3 py-2 text-[14px] font-semibold text-foreground bg-transparent border border-border focus:border-primary outline-none"
            />
            <Button className="shrink-0 gap-1.5" disabled={!bidValue || bidLoading} onClick={onPlaceBid}>
              <Gavel size={14} />
              Dar Lance
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[suggestBid, Math.floor(suggestBid * 0.95), Math.floor(suggestBid * 0.90)].map((v, i) => (
              <button key={i} onClick={() => onBidValueChange(String(v))} className="ios-surface rounded-[8px] py-1.5 text-[11px] font-semibold text-primary text-center">{fmt(v)}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-[12px] text-muted-foreground py-3">
          Licitação encerrada.{' '}{isLeading ? 'Aguardando reivindicação.' : `Vencedor: ${lic.liderNome}`}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Preparação da obra (alocar recursos)
// ══════════════════════════════════════════════════════════════════
function WorkPreparation({ win, gameState, onBack, onStart }: {
  win:       MyWin;
  gameState: GameState;
  onBack:    () => void;
  onStart:   (params: Parameters<LicitacoesScreenProps['onStartWork']>[0]) => { ok: boolean; message: string };
}) {
  const req           = win.licitacao.requisitos;
  const idleEmployees = gameState.employees.filter(e => e.status === 'idle');
  const idleMachines  = gameState.machines.filter(m => m.status === 'idle');

  const [selEmployees, setSelEmployees] = useState<string[]>(() => {
    const sel: string[] = [];
    for (const er of req.employees) {
      const available = idleEmployees.filter(e => e.type === er.type);
      sel.push(...available.slice(0, er.quantity).map(e => e.instanceId));
    }
    return sel;
  });

  const [selMachines, setSelMachines] = useState<string[]>(() => {
    const sel: string[] = [];
    for (const mr of req.machines) {
      const available = idleMachines.filter(m => m.typeId === mr.typeId);
      sel.push(...available.slice(0, mr.quantity).map(m => m.instanceId));
    }
    return sel;
  });

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  function flash(result: { ok: boolean; message: string }) {
    setMessage({ text: result.message, ok: result.ok });
    setTimeout(() => setMessage(null), 4_000);
  }

  const allocatedEmployees: AllocatedEmployee[] = useMemo(() =>
    selEmployees.map(id => {
      const emp = gameState.employees.find(e => e.instanceId === id)!;
      return { instanceId: id, type: emp.type, name: emp.name, skill: emp.skill };
    }),
    [selEmployees, gameState.employees],
  );

  const allocatedMachines: AllocatedMachine[] = useMemo(() =>
    selMachines.map(id => {
      const m = gameState.machines.find(m => m.instanceId === id)!;
      return { instanceId: id, typeId: m.typeId, name: m.name, icon: m.icon, costPerMin: m.costPerMin };
    }),
    [selMachines, gameState.machines],
  );

  const producaoPerMin    = calcProducaoPerMin(allocatedEmployees);
  const tempoEstMin       = calcTempoEstimadoMin(win.tamanhoM2, producaoPerMin);
  const materialQtys      = req.materials.map(m => ({ materialId: m.materialId, quantity: m.quantity }));
  const consumedMaterials = req.materials.map(mr => {
    const wItem = gameState.warehouse.find(w => w.materialId === mr.materialId);
    return { materialId: mr.materialId, name: mr.name, quantity: mr.quantity, unitPrice: wItem?.unitPrice ?? 0 };
  });
  const cost     = calcWorkCost(allocatedEmployees, allocatedMachines, consumedMaterials, tempoEstMin);
  const profitEst = win.contractValue - cost.laborCost - cost.machineCost - cost.materialCost;
  const check    = checkRequirements(req, gameState.employees, gameState.machines, gameState.warehouse);

  function toggleEmployee(id: string) {
    setSelEmployees(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }
  function toggleMachine(id: string) {
    setSelMachines(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function handleStart() {
    if (producaoPerMin === 0) {
      flash({ ok: false, message: 'Adicione pelo menos um ajudante ou pedreiro para produzir.' });
      return;
    }
    if (!check.ok) {
      flash({ ok: false, message: 'Requisitos mínimos não atendidos.' });
      return;
    }
    const r = onStart({
      licitacaoId:        win.licitacaoId,
      nome:               win.nome,
      tipo:               win.tipo,
      tamanhoM2:          win.tamanhoM2,
      contractValue:      win.contractValue,
      allocatedEmployees,
      allocatedMachines,
      materialQtys,
    });
    flash(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted/50">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <div>
          <h2 className="font-game-title text-[15px] font-bold">Preparar Obra</h2>
          <div className="text-[11px] text-muted-foreground">{win.nome}</div>
        </div>
      </div>

      {producaoPerMin === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[10px] px-3 py-2 border border-red-500/25">
          <AlertTriangle size={12} />
          Equipe sem produção! Adicione ajudantes ou pedreiros.
        </div>
      )}

      <div className="ios-surface rounded-[14px] p-3 space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><div className="text-[9px] uppercase text-muted-foreground">Contrato</div><div className="font-bold text-foreground">{fmt(win.contractValue)}</div></div>
          <div><div className="text-[9px] uppercase text-muted-foreground">Produção</div><div className={`font-bold ${producaoPerMin === 0 ? 'text-red-400' : 'text-foreground'}`}>{producaoPerMin.toFixed(1)} m²/min</div></div>
          <div><div className="text-[9px] uppercase text-muted-foreground">Mão-de-obra est.</div><div className="font-bold text-foreground">{fmt(cost.laborCost)}</div></div>
          <div><div className="text-[9px] uppercase text-muted-foreground">Máquinas est.</div><div className="font-bold text-foreground">{fmt(cost.machineCost)}</div></div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Tempo est.</div>
            <div className={`font-bold ${producaoPerMin === 0 ? 'text-red-400' : 'text-foreground'}`}>
              {producaoPerMin === 0 ? '∞' : tempoEstMin < 60 ? `${Math.round(tempoEstMin)}min` : `${(tempoEstMin / 60).toFixed(1)}h`}
            </div>
          </div>
          <div><div className="text-[9px] uppercase text-muted-foreground">Materiais (já pagos)</div><div className="font-bold text-muted-foreground">{fmt(cost.materialCost)}</div></div>
        </div>
        <div className="pt-1.5 border-t border-border/30">
          <div className="text-[9px] uppercase text-muted-foreground">Lucro estimado</div>
          <div className={`font-bold text-[15px] ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitEst >= 0 ? '+' : ''}{fmt(profitEst)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">
            Receberá: {fmt(Math.max(0, win.contractValue - cost.laborCost - cost.machineCost))} (após custos operacionais)
          </div>
        </div>
      </div>

      <div className="ios-surface rounded-[12px] p-3 space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Materiais (consumo imediato)</div>
        {req.materials.map(mr => {
          const stock = gameState.warehouse.find(w => w.materialId === mr.materialId);
          const ok    = (stock?.quantity ?? 0) >= mr.quantity;
          return (
            <div key={mr.materialId} className={`flex items-center justify-between text-[12px] ${ok ? '' : 'text-red-400'}`}>
              <span>{mr.name}</span>
              <span>{mr.quantity.toLocaleString('pt-BR')} {mr.unit}{!ok && ` (estoque: ${(stock?.quantity ?? 0).toLocaleString('pt-BR')})`}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Equipe ({selEmployees.length} selecionados)</div>
        {idleEmployees.map(emp => {
          const def     = EMPLOYEE_TYPES.find(d => d.type === emp.type)!;
          const sel     = selEmployees.includes(emp.instanceId);
          const minReq  = req.employees.find(e => e.type === emp.type);
          const selOfType = selEmployees.filter(id => gameState.employees.find(e => e.instanceId === id)?.type === emp.type).length;
          const isRequired = !!minReq && selOfType <= minReq.quantity;
          return (
            <button
              key={emp.instanceId}
              onClick={() => toggleEmployee(emp.instanceId)}
              className={`w-full ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5 text-left transition-colors ${sel ? 'border border-primary/40 bg-primary/5' : 'border border-transparent'}`}
            >
              <span className="text-xl">{def.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{emp.name}</div>
                <div className="text-[10px] text-muted-foreground">{def.label} · Skill {emp.skill}{isRequired && sel && <span className="ml-1 text-amber-400 font-bold">· Obrigatório</span>}</div>
              </div>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                {sel && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Máquinas ({selMachines.length} selecionadas)</div>
        {idleMachines.map(mach => {
          const sel = selMachines.includes(mach.instanceId);
          return (
            <button
              key={mach.instanceId}
              onClick={() => toggleMachine(mach.instanceId)}
              className={`w-full ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5 text-left transition-colors ${sel ? 'border border-primary/40 bg-primary/5' : 'border border-transparent'}`}
            >
              <span className="text-xl">{mach.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{mach.name}</div>
                <div className="text-[10px] text-muted-foreground">{mach.category} · {fmt(mach.costPerMin)}/min</div>
              </div>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                {sel && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${message.ok ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <Button className="w-full gap-1.5" disabled={!check.ok} onClick={handleStart}>
        <HardHat size={14} />
        Iniciar Obra · {fmt(win.contractValue)}
      </Button>

      {!check.ok && (
        <div className="text-[10px] text-amber-400 text-center">Resolva os recursos em falta antes de iniciar</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detalhe e gestão de obra em andamento
// ══════════════════════════════════════════════════════════════════
function WorkDetailView({
  work, gameState, onBack,
  onAddEmployee, onRemoveEmployee, onAddMachine, onRemoveMachine,
}: {
  work:             ActiveWork;
  gameState:        GameState;
  onBack:           () => void;
  onAddEmployee:    (instanceId: string) => { ok: boolean; message: string };
  onRemoveEmployee: (instanceId: string) => { ok: boolean; message: string };
  onAddMachine:     (instanceId: string) => { ok: boolean; message: string };
  onRemoveMachine:  (instanceId: string) => { ok: boolean; message: string };
}) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  function flash(r: { ok: boolean; message: string }) {
    setMsg({ text: r.message, ok: r.ok });
    setTimeout(() => setMsg(null), 3_000);
  }

  const def       = getWorkTypeDef(work.tipo);
  const idleEmps  = gameState.employees.filter(e => e.status === 'idle');
  const idleMachs = gameState.machines.filter(m => m.status === 'idle');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted/50">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <div>
          <h2 className="font-game-title text-[15px] font-bold">{work.nome}</h2>
          <div className="text-[11px] text-muted-foreground">{def.icon} {def.label}</div>
        </div>
      </div>

      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Progresso</div>
            <div className="text-[28px] font-black text-primary leading-none">{work.progressPct}%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Conclui em</div>
            <div className="text-[15px] font-bold text-foreground">{fmtTimeLeft(work.estimatedCompletesAt)}</div>
          </div>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${work.progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Produção</div>
            <div className={`font-semibold ${work.producaoPerMin === 0 ? 'text-red-400' : 'text-foreground'}`}>{work.producaoPerMin.toFixed(1)} m²/min</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Concluído</div>
            <div className="font-semibold">{work.currentM2Done.toFixed(0)} / {work.tamanhoM2} m²</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Contrato</div>
            <div className="font-semibold">{fmt(work.contractValue)}</div>
          </div>
        </div>
        {work.producaoPerMin === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[8px] px-2.5 py-1.5">
            <AlertTriangle size={10} />
            Sem produção! Adicione ajudantes ou pedreiros.
          </div>
        )}
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${msg.ok ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Equipe na Obra ({work.allocatedEmployees.length})</div>
        {work.allocatedEmployees.length === 0 && <div className="text-center text-[12px] text-muted-foreground py-3">Nenhum funcionário alocado</div>}
        {work.allocatedEmployees.map(emp => {
          const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
          return (
            <div key={emp.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
              <span className="text-xl">{empDef?.icon ?? '👷'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{emp.name}</div>
                <div className="text-[10px] text-muted-foreground">{empDef?.label} · Skill {emp.skill}</div>
              </div>
              <button onClick={() => flash(onRemoveEmployee(emp.instanceId))} className="text-[11px] text-red-400 border border-red-500/30 rounded-[8px] px-2.5 py-1 hover:bg-red-500/10 transition-colors shrink-0">
                Remover
              </button>
            </div>
          );
        })}
      </div>

      {idleEmps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Disponíveis para Adicionar</div>
          {idleEmps.map(emp => {
            const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
            return (
              <div key={emp.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
                <span className="text-xl">{empDef?.icon ?? '👷'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-foreground">{emp.name}</div>
                  <div className="text-[10px] text-muted-foreground">{empDef?.label} · Skill {emp.skill}</div>
                </div>
                <button onClick={() => flash(onAddEmployee(emp.instanceId))} className="text-[11px] text-emerald-400 border border-emerald-500/30 rounded-[8px] px-2.5 py-1 hover:bg-emerald-500/10 transition-colors shrink-0">
                  + Adicionar
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Máquinas na Obra ({work.allocatedMachines.length})</div>
        {work.allocatedMachines.length === 0 && <div className="text-center text-[12px] text-muted-foreground py-3">Nenhuma máquina alocada</div>}
        {work.allocatedMachines.map(mach => (
          <div key={mach.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
            <span className="text-xl">{mach.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-foreground">{mach.name}</div>
              <div className="text-[10px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
            </div>
            <button onClick={() => flash(onRemoveMachine(mach.instanceId))} className="text-[11px] text-red-400 border border-red-500/30 rounded-[8px] px-2.5 py-1 hover:bg-red-500/10 transition-colors shrink-0">
              Remover
            </button>
          </div>
        ))}
      </div>

      {idleMachs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Máquinas Disponíveis</div>
          {idleMachs.map(mach => (
            <div key={mach.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
              <span className="text-xl">{mach.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{mach.name}</div>
                <div className="text-[10px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
              </div>
              <button onClick={() => flash(onAddMachine(mach.instanceId))} className="text-[11px] text-emerald-400 border border-emerald-500/30 rounded-[8px] px-2.5 py-1 hover:bg-emerald-500/10 transition-colors shrink-0">
                + Adicionar
              </button>
            </div>
          ))}
        </div>
      )}

      {idleEmps.length === 0 && idleMachs.length === 0 && (
        <div className="ios-surface rounded-[12px] p-4 text-center text-[12px] text-muted-foreground">
          Todos os funcionários e máquinas já estão alocados
        </div>
      )}
    </div>
  );
}
