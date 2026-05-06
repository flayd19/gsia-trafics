// =====================================================================
// LicitacoesScreen — Serviços Rápidos + Leilão de obras
// =====================================================================
import { useState, useEffect } from 'react';
import {
  Gavel, RefreshCw, Clock, ChevronRight, CheckCircle2,
  Users, Truck, Package, ArrowLeft, AlertTriangle, Zap, HardHat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  GameState,
  Licitacao,
  WorkType,
  AllocatedEmployee,
  AllocatedMachine,
} from '@/types/game';
import type { MyWin } from '@/hooks/useLicitacoes';
import {
  fmt,
  getWorkTypeDef,
  EMPLOYEE_TYPES,
  generateServicosRapidos,
} from '@/data/construction';
import type { ServicoRapido } from '@/data/construction';
import { checkRequirements } from '@/lib/obraEngine';
import {
  fmtTimeLeft,
  workTypeColor,
  WorkPreparation,
  type StartWorkParams,
} from './ObrasViews';

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
  onStartWork:    (params: StartWorkParams) => { ok: boolean; message: string };
  onConsumeWin:   (id: string) => void;
  onRefreshPool:  () => void;
  onWorkStarted:  () => void;   // navega para Imóveis/Obras após iniciar
}

type MainTab = 'rapidas' | 'licitacoes';

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

// ══════════════════════════════════════════════════════════════════
// Tela principal
// ══════════════════════════════════════════════════════════════════
export function LicitacoesScreen(props: LicitacoesScreenProps) {
  const {
    gameState, licitacoes, myWins, loading, successMsg,
    onIsLeading, onMyBidFor, onPlaceBid, onClaimWin, onStartWork,
    onConsumeWin, onRefreshPool, onWorkStarted,
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

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  function flash(result: { ok: boolean; message: string }) {
    setMessage({ text: result.message, ok: result.ok });
    setTimeout(() => setMessage(null), 4_000);
  }

  // ── Full-screen: detalhe de licitação ──────────────────────────
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
          } else {
            flash({ ok: false, message: 'Não é possível reivindicar esta vitória.' });
          }
        }}
      />
    );
  }

  // ── Full-screen: preparação de obra ───────────────────────────
  if (preparingWin) {
    return (
      <WorkPreparation
        win={preparingWin}
        gameState={gameState}
        onBack={() => setPreparingWin(null)}
        onStart={(params) => {
          const r = onStartWork(params);
          if (r.ok) {
            onConsumeWin(preparingWin.licitacaoId);
            setPreparingWin(null);
            onWorkStarted();
          } else {
            flash(r);
          }
          return r;
        }}
      />
    );
  }

  const pendingWins = myWins.filter(w => w.prepDeadline > Date.now());

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Pending wins banner */}
      {pendingWins.length > 0 && (
        <div className="flex items-center gap-3 ios-surface rounded-[12px] px-3 py-2.5 border border-emerald-500/30 bg-emerald-500/5">
          <span className="text-xl shrink-0">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-emerald-400">
              {pendingWins.length} vitória{pendingWins.length > 1 ? 's' : ''} aguardando início
            </div>
            <div className="text-[10px] text-muted-foreground">Acesse Imóveis → Obras para preparar</div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[11px] h-7 px-2.5"
            onClick={onWorkStarted}
          >
            <HardHat size={12} />
            Ver Obras
          </Button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        {([
          { id: 'rapidas' as MainTab,    label: 'Rápidas', badge: servicosRapidos.length },
          { id: 'licitacoes' as MainTab, label: 'Leilões',  badge: licitacoes.length },
        ]).map(({ id, label, badge }) => (
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

      {/* Flash message */}
      {(successMsg || message) && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${
          (message?.ok ?? true)
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {message?.text ?? successMsg}
        </div>
      )}

      {/* ── Serviços Rápidos ── */}
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
                    <span>Recursos insuficientes — você poderá iniciar assim mesmo</span>
                  </div>
                )}
                <Button
                  className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    setServicosRapidos(prev => prev.filter(r => r.id !== s.id));
                    setPreparingWin(servicoToWin(s));
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

      {/* ── Leilões ── */}
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
          { label: 'Área',          value: `${lic.tamanhoM2.toLocaleString('pt-BR')} m²` },
          { label: 'Tempo base',    value: `${lic.tempoBaseMin} min` },
          { label: 'Custo estimado',value: fmt(lic.custoEstimado) },
          { label: 'Valor base',    value: fmt(lic.valorBase) },
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
                  {miss && <span className="text-red-400 text-[9px]">(faltam {(mr.quantity - (miss.have ?? 0)).toLocaleString('pt-BR')})</span>}
                </div>
              );
            })}
          </div>
        )}
        {check.ok ? (
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> Você tem todos os requisitos!</div>
        ) : (
          <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-1"><AlertTriangle size={11} /> Recursos insuficientes — poderá iniciar assim mesmo</div>
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
