// =====================================================================
// PropriedadesScreen — Imóveis: Obras · Construir · Meus · Aluguéis
// =====================================================================
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Hammer, Key, DollarSign, Tag, Clock, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Building2, Home, Factory,
  HardHat, ChevronRight,
} from 'lucide-react';
import type { GameState, PropertyType, PropertyCategory } from '@/types/game';
import type { PropriedadesAPI } from '@/hooks/usePropriedades';
import { BUILD_CATALOG, fmtBRL } from '@/hooks/usePropriedades';
import type { MyWin } from '@/hooks/useLicitacoes';
import { fmt, getWorkTypeDef } from '@/data/construction';
import {
  WorkPreparation,
  WorkDetailView,
  fmtTimeLeft,
  type StartWorkParams,
} from './ObrasViews';

// ── Props ─────────────────────────────────────────────────────────

interface PropriedadesScreenProps {
  gameState: GameState;
  api:       PropriedadesAPI;
  onSpend:   (amount: number) => { ok: boolean; message: string };
  onReceive: (amount: number) => void;
  // Obras props
  myWins:                   MyWin[];
  onConsumeWin:             (id: string) => void;
  onStartWork:              (params: StartWorkParams) => { ok: boolean; message: string };
  onAddEmployeeToWork:      (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveEmployeeFromWork: (workId: string, instanceId: string) => { ok: boolean; message: string };
  onAddMachineToWork:       (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveMachineFromWork:  (workId: string, instanceId: string) => { ok: boolean; message: string };
}

type Tab = 'obras' | 'meus' | 'construir' | 'alugueis';

// ── Status helpers ────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  construindo: 'Em Construção',
  pronto:      'Disponível',
  alugado:     'Alugado',
  a_venda:     'À Venda',
  vendido:     'Vendido',
};

const STATUS_COLOR: Record<string, string> = {
  construindo: 'text-amber-600  bg-amber-500/15  border-amber-400/40',
  pronto:      'text-blue-600   bg-blue-500/15   border-blue-400/40',
  alugado:     'text-green-600  bg-green-500/15  border-green-400/40',
  a_venda:     'text-purple-600 bg-purple-500/15 border-purple-400/40',
  vendido:     'text-muted-foreground bg-muted   border-border',
};

const CAT_LABEL: Record<PropertyCategory, string> = {
  residencial: 'Residencial',
  comercial:   'Comercial',
  industrial:  'Industrial',
};

const CAT_ICON: Record<PropertyCategory, React.ElementType> = {
  residencial: Home,
  comercial:   Building2,
  industrial:  Factory,
};

// ── Main Component ────────────────────────────────────────────────

export function PropriedadesScreen({
  gameState, api, onSpend, onReceive,
  myWins, onConsumeWin, onStartWork,
  onAddEmployeeToWork, onRemoveEmployeeFromWork,
  onAddMachineToWork, onRemoveMachineFromWork,
}: PropriedadesScreenProps) {
  const [tab,         setTab]         = useState<Tab>('obras');
  const [filterCat,   setFilterCat]   = useState<PropertyCategory | 'all'>('all');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [saleInputs,  setSaleInputs]  = useState<Record<string, string>>({});
  const [buildTypeId, setBuildTypeId] = useState<PropertyType | null>(null);

  // Obras state
  const [preparingWin,  setPreparingWin]  = useState<MyWin | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  // Clear selection if work was completed/removed
  useEffect(() => {
    if (!selectedWorkId) return;
    const still = gameState.activeWorks.some(w => w.id === selectedWorkId);
    if (!still) setSelectedWorkId(null);
  }, [selectedWorkId, gameState.activeWorks]);

  const currentDay = gameState.gameTime.day;
  const { properties, startBuild, listForRent, collectRent, evictTenant,
          listForSale, cancelSale, acceptBuyer, rejectBuyer, getBuildInfo } = api;

  const activeProps  = properties.filter(p => p.status !== 'vendido');
  const rentedProps  = properties.filter(p => p.status === 'alugado');
  const pendingAlert = properties.filter(p => p.status === 'a_venda' && p.pendingBuyerName);
  const buildingNow  = properties.filter(p => p.status === 'construindo');

  const totalInvested   = activeProps.reduce((s, p) => s + p.totalInvested, 0);
  const totalRentMonth  = rentedProps.reduce((s, p) => s + p.rentMonthly, 0);
  const totalRentEarned = properties.reduce((s, p) => s + p.rentCollected, 0);

  const pendingWins = myWins.filter(w => w.prepDeadline > Date.now());

  // ── Full-screen views override the whole screen ────────────────
  const selectedWork = selectedWorkId
    ? gameState.activeWorks.find(w => w.id === selectedWorkId) ?? null
    : null;

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
            setTab('obras');
          }
          return r;
        }}
      />
    );
  }

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

  // ── Handlers ──────────────────────────────────────────────────
  const handleBuild = () => {
    if (!buildTypeId) { toast.error('Selecione um tipo de construção.'); return; }
    const result = startBuild(buildTypeId, currentDay, gameState);
    if (!result.ok) { toast.error(result.message); return; }
    const spend = onSpend(result.cost!);
    if (!spend.ok) { toast.error(spend.message); return; }
    toast.success(result.message);
    setBuildTypeId(null);
    setTab('meus');
  };

  const handleRent = (id: string) => {
    const r = listForRent(id, currentDay);
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  const handleEvict = (id: string) => {
    const r = evictTenant(id);
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  const handleCollect = (id: string) => {
    const r = collectRent(id, currentDay);
    if (!r.ok) { toast.error(r.message); return; }
    if (r.amount) onReceive(r.amount);
    toast.success(r.message);
  };

  const handleListSale = (id: string) => {
    const priceStr = saleInputs[id] ?? '';
    const price    = parseInt(priceStr.replace(/\D/g, ''), 10);
    if (!price || price < 1_000) { toast.error('Informe um preço válido (mín. R$ 1.000).'); return; }
    const r = listForSale(id, price, currentDay);
    r.ok ? toast.success(r.message) : toast.error(r.message);
    setSaleInputs(p => ({ ...p, [id]: '' }));
  };

  const handleAccept = (id: string) => {
    const r = acceptBuyer(id);
    if (!r.ok) { toast.error(r.message); return; }
    if (r.amount) onReceive(r.amount);
    toast.success(r.message);
  };

  const handleReject = (id: string) => {
    const r = rejectBuyer(id);
    r.ok ? toast.info(r.message) : toast.error(r.message);
  };

  const buildInfo = useMemo(
    () => buildTypeId ? getBuildInfo(buildTypeId, gameState) : null,
    [buildTypeId, gameState, getBuildInfo]
  );

  const catalogFiltered = BUILD_CATALOG.filter(
    b => filterCat === 'all' || b.category === filterCat
  );

  // ── Obras badge ───────────────────────────────────────────────
  const obrasBadge = pendingWins.length + gameState.activeWorks.length;

  // ── Tab bar ────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; badge: number | null }[] = [
    { id: 'obras',     label: 'Obras',        badge: obrasBadge > 0 ? obrasBadge : null },
    { id: 'meus',      label: 'Meus Imóveis', badge: activeProps.length > 0 ? activeProps.length : null },
    { id: 'construir', label: 'Construir',    badge: null },
    { id: 'alugueis',  label: 'Aluguéis',     badge: rentedProps.length > 0 ? rentedProps.length : null },
  ];

  return (
    <div className="space-y-4">

      {/* KPI header */}
      <div className="ios-surface p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          🏠 Portfólio Imobiliário
        </div>
        <div className="grid grid-cols-3 gap-2">
          <KpiBox icon="🏗️" label="Imóveis"   value={String(activeProps.length)} />
          <KpiBox icon="💰" label="Investido"  value={fmtBRL(totalInvested)} />
          <KpiBox icon="📈" label="Renda/mês"  value={fmtBRL(totalRentMonth)} />
        </div>
        {pendingAlert.length > 0 && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-purple-600 shrink-0" />
            <span className="text-[12px] text-purple-700 font-semibold">
              {pendingAlert.length} proposta{pendingAlert.length > 1 ? 's' : ''} de compra aguardando!
            </span>
          </div>
        )}
        {buildingNow.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
            <Hammer size={13} className="text-amber-600 shrink-0" />
            <span className="text-[12px] text-amber-700 font-semibold">
              {buildingNow.length} construção{buildingNow.length > 1 ? 'ões' : ''} em andamento
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                active ? 'bg-background shadow text-primary' : 'text-muted-foreground'
              }`}
            >
              {t.label}
              {t.badge !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════ OBRAS ══════════════════════════════ */}
      {tab === 'obras' && (
        <div className="space-y-3">

          {/* Pending wins */}
          {pendingWins.map(win => (
            <div key={win.licitacaoId} className="ios-surface rounded-[14px] p-3.5 border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🏆</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-emerald-400">Você venceu!</div>
                  <div className="text-[12px] font-semibold text-foreground">{win.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Contrato: {fmt(win.contractValue)} · {win.tamanhoM2.toLocaleString('pt-BR')} m²
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-400">
                    <Clock size={9} />
                    <span>Inicie em: {fmtTimeLeft(win.prepDeadline)}</span>
                  </div>
                </div>
              </div>
              <Button
                className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setPreparingWin(win)}
              >
                <HardHat size={14} />
                Preparar e Iniciar Obra
              </Button>
            </div>
          ))}

          {/* Active works */}
          {gameState.activeWorks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Em Andamento</div>
              {gameState.activeWorks.map(work => (
                <button
                  key={work.id}
                  onClick={() => setSelectedWorkId(work.id)}
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

          {/* Work history */}
          {gameState.workHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                Histórico ({gameState.workHistory.length})
              </div>
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
            <EmptyState
              icon="👷"
              title="Nenhuma obra"
              subtitle="Aceite serviços rápidos ou ganhe licitações para iniciar obras."
              action="Ir para Licitações"
              onAction={() => { /* handled by parent tab */ }}
            />
          )}
        </div>
      )}

      {/* ═══════════════════ MEUS IMÓVEIS ══════════════════════ */}
      {tab === 'meus' && (
        <div className="space-y-3">
          {activeProps.length === 0 ? (
            <EmptyState
              icon="🏗️"
              title="Nenhum imóvel ainda"
              subtitle="Compre um terreno e inicie uma obra para começar seu portfólio."
              action="Ir para Construir"
              onAction={() => setTab('construir')}
            />
          ) : (
            activeProps.map(prop => {
              const isExp = expandedId === prop.instanceId;
              const buildPct = prop.status === 'construindo'
                ? Math.min(100, Math.round(
                    ((currentDay - prop.buildStartDay) / Math.max(1, prop.buildEndDay - prop.buildStartDay)) * 100
                  ))
                : 100;
              const daysLeft = prop.status === 'construindo'
                ? Math.max(0, prop.buildEndDay - currentDay)
                : 0;
              const lastDay     = prop.lastRentDay ?? prop.tenantSince ?? currentDay;
              const pendingRent = prop.status === 'alugado'
                ? Math.floor((prop.rentMonthly / 30) * (currentDay - lastDay))
                : 0;

              return (
                <div key={prop.instanceId} className="ios-surface overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/30 transition"
                    onClick={() => setExpandedId(isExp ? null : prop.instanceId)}
                  >
                    <div className="w-11 h-11 rounded-[12px] bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                      {prop.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-foreground truncate">{prop.name}</div>
                      <div className="text-[11px] text-muted-foreground">{prop.areaM2}m² · {prop.neighborhood}</div>
                      {prop.status === 'construindo' && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${buildPct}%` }} />
                          </div>
                          <span className="text-[10px] text-amber-600 font-bold">{daysLeft}d</span>
                        </div>
                      )}
                      {prop.status === 'alugado' && pendingRent > 0 && (
                        <div className="text-[11px] text-green-600 font-semibold mt-0.5">
                          💰 {fmtBRL(pendingRent)} para cobrar
                        </div>
                      )}
                      {prop.status === 'a_venda' && prop.pendingBuyerName && (
                        <div className="text-[11px] text-purple-600 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertCircle size={10} />
                          {prop.pendingBuyerName} ofereceu {fmtBRL(prop.pendingBuyerOffer!)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${STATUS_COLOR[prop.status]}`}>
                        {STATUS_LABEL[prop.status]}
                      </span>
                      {isExp ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t border-border px-3 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <MiniStat label="Valor mercado"  value={fmtBRL(prop.marketValue)} />
                        <MiniStat label="Investido"      value={fmtBRL(prop.totalInvested)} />
                        <MiniStat label="Aluguel/mês"    value={fmtBRL(prop.rentMonthly)} />
                      </div>

                      {prop.status === 'pronto' && (
                        <div className="space-y-2">
                          <Button size="sm" className="w-full" onClick={() => handleRent(prop.instanceId)}>
                            <Key size={13} className="mr-1.5" /> Alugar para Inquilino
                          </Button>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              placeholder={`Preço (sugerido ${fmtBRL(prop.marketValue)})`}
                              className="flex-1 h-9 rounded-xl border border-border bg-muted/50 px-3 text-[13px]"
                              value={saleInputs[prop.instanceId] ?? ''}
                              onChange={e => setSaleInputs(p => ({ ...p, [prop.instanceId]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" onClick={() => handleListSale(prop.instanceId)}>
                              <Tag size={13} /> Vender
                            </Button>
                          </div>
                        </div>
                      )}

                      {prop.status === 'alugado' && (
                        <div className="space-y-2">
                          <div className="bg-green-500/8 border border-green-400/30 rounded-xl px-3 py-2 space-y-0.5">
                            <div className="text-[12px]">Inquilino: <strong>{prop.tenantName}</strong> · desde o Dia {prop.tenantSince}</div>
                            <div className="text-[12px]">Total recebido: <span className="text-green-600 font-bold">{fmtBRL(prop.rentCollected)}</span></div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" disabled={pendingRent <= 0} onClick={() => handleCollect(prop.instanceId)}>
                              <DollarSign size={13} className="mr-1" />
                              Cobrar {pendingRent > 0 ? fmtBRL(pendingRent) : 'Aluguel'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEvict(prop.instanceId)}>
                              Despejar
                            </Button>
                          </div>
                          <div className="flex gap-2 items-center pt-1 border-t border-border">
                            <input
                              type="number"
                              placeholder={`Vender por (sugerido ${fmtBRL(prop.marketValue)})`}
                              className="flex-1 h-9 rounded-xl border border-border bg-muted/50 px-3 text-[12px]"
                              value={saleInputs[prop.instanceId] ?? ''}
                              onChange={e => setSaleInputs(p => ({ ...p, [prop.instanceId]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" onClick={() => handleListSale(prop.instanceId)}>
                              <Tag size={13} />
                            </Button>
                          </div>
                        </div>
                      )}

                      {prop.status === 'a_venda' && (
                        <div className="space-y-2">
                          <div className="text-[12px] text-muted-foreground">
                            Anunciado por <span className="font-semibold text-foreground">{fmtBRL(prop.salePrice!)}</span>
                            {' '}· listado no Dia {prop.listedForSaleDay}
                          </div>
                          {prop.pendingBuyerName ? (
                            <>
                              <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl px-3 py-2 space-y-0.5">
                                <div className="text-[12px] font-semibold text-purple-700">🏷️ {prop.pendingBuyerName}</div>
                                <div className="text-[13px] font-bold text-foreground">
                                  Oferta: {fmtBRL(prop.pendingBuyerOffer!)}
                                  {prop.pendingBuyerOffer! < prop.salePrice! && (
                                    <span className="text-[11px] text-muted-foreground font-normal ml-1">
                                      ({Math.round((prop.pendingBuyerOffer! / prop.salePrice!) * 100)}% do preço pedido)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => handleAccept(prop.instanceId)}>
                                  <CheckCircle2 size={13} className="mr-1" /> Aceitar Venda
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleReject(prop.instanceId)}>Recusar</Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                <Clock size={12} /> Aguardando comprador...
                              </div>
                              <Button size="sm" variant="outline" onClick={() => cancelSale(prop.instanceId)}>Cancelar</Button>
                            </div>
                          )}
                        </div>
                      )}

                      {prop.status === 'construindo' && (
                        <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-500/8 border border-amber-400/30 rounded-xl px-3 py-2">
                          <Hammer size={13} />
                          Conclusão no Dia {prop.buildEndDay} · {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════════════════ CONSTRUIR ═════════════════════════ */}
      {tab === 'construir' && (
        <div className="space-y-4">
          <div className="ios-surface p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              👷 Equipe disponível
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(() => {
                const idle    = gameState.employees.filter(e => e.status === 'idle');
                const skilled = idle.filter(e => ['pedreiro','mestre','engenheiro'].includes(e.type));
                const hasEng  = idle.some(e => e.type === 'engenheiro');
                return (
                  <>
                    <KpiBox icon="👷" label="Disponíveis"  value={String(idle.length)} />
                    <KpiBox icon="🪚" label="Qualificados" value={String(skilled.length)} />
                    <KpiBox icon="📐" label="Engenheiro"   value={hasEng ? 'Sim ✓' : 'Não'} />
                  </>
                );
              })()}
            </div>
            {gameState.employees.filter(e => e.status === 'idle').length === 0 && (
              <div className="mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                <AlertCircle size={13} className="text-amber-600" />
                <span className="text-[12px] text-amber-700">Contrate funcionários na aba Empresa para construir!</span>
              </div>
            )}
          </div>

          <div className="flex gap-1.5">
            {(['all','residencial','comercial','industrial'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                  filterCat === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border'
                }`}
              >
                {cat === 'all' ? 'Todos' : CAT_LABEL[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {catalogFiltered.map(build => {
              const info    = getBuildInfo(build.typeId, gameState);
              const sel     = buildTypeId === build.typeId;
              const CatIcon = CAT_ICON[build.category];
              return (
                <button
                  key={build.typeId}
                  onClick={() => setBuildTypeId(sel ? null : build.typeId)}
                  className={`w-full ios-surface text-left flex items-start gap-3 p-3 transition-all ${sel ? 'ring-2 ring-primary' : ''} ${!info.canBuild ? 'opacity-60' : ''}`}
                >
                  <div className="w-11 h-11 rounded-[12px] bg-primary/10 flex items-center justify-center text-2xl shrink-0 mt-0.5">
                    {build.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-foreground">{build.name}</span>
                      <CatIcon size={11} className="text-muted-foreground" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">{build.areaM2}m² · {info.days} dia{info.days !== 1 ? 's' : ''} de obra</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{build.description}</div>
                    {!info.canBuild && (
                      <div className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                        <AlertCircle size={10} /> {info.reason}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5 min-w-[80px]">
                    <div className="text-[13px] font-bold text-foreground">{fmtBRL(info.totalCost)}</div>
                    <div className="text-[10px] text-green-600 font-semibold">{fmtBRL(build.rentMonthly)}/mês</div>
                    <div className="text-[10px] text-blue-600">{fmtBRL(build.marketValue)}</div>
                    {sel && <CheckCircle2 size={14} className="text-primary ml-auto mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>

          {buildTypeId && buildInfo && (() => {
            const build     = BUILD_CATALOG.find(b => b.typeId === buildTypeId)!;
            const canAfford = gameState.money >= buildInfo.totalCost;
            return (
              <div className="ios-surface p-4 space-y-3">
                <div className="text-[12px] font-bold text-foreground uppercase tracking-wider">📋 Resumo da Obra</div>
                <div className="space-y-1.5 text-[13px]">
                  <CostRow label="Terreno + infraestrutura" value={fmtBRL(build.lotCostBase)} />
                  <CostRow label="Materiais e mão de obra"  value={fmtBRL(build.buildCost)} />
                  <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                    <span>Total</span>
                    <span className={canAfford ? 'text-foreground' : 'text-destructive'}>{fmtBRL(buildInfo.totalCost)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Prazo estimado" value={`${buildInfo.days} dia${buildInfo.days !== 1 ? 's' : ''}`} />
                  <MiniStat label="Aluguel mensal"  value={fmtBRL(build.rentMonthly)} />
                  <MiniStat label="Valor de venda"  value={fmtBRL(build.marketValue)} />
                  <MiniStat label="ROI aluguel"
                    value={`${Math.round((build.rentMonthly * 12 / buildInfo.totalCost) * 100)}% a.a.`} />
                </div>
                {!canAfford && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
                    <AlertCircle size={13} className="text-destructive" />
                    <span className="text-[12px] text-destructive">Falta {fmtBRL(buildInfo.totalCost - gameState.money)}</span>
                  </div>
                )}
                {!buildInfo.canBuild && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                    <AlertCircle size={13} className="text-amber-600" />
                    <span className="text-[12px] text-amber-700">{buildInfo.reason}</span>
                  </div>
                )}
                <Button className="w-full" disabled={!canAfford || !buildInfo.canBuild} onClick={handleBuild}>
                  <Hammer size={14} className="mr-1.5" />
                  Iniciar Obra — {fmtBRL(buildInfo.totalCost)}
                </Button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════════ ALUGUÉIS ══════════════════════════ */}
      {tab === 'alugueis' && (
        <div className="space-y-3">
          {rentedProps.length === 0 ? (
            <EmptyState
              icon="🔑"
              title="Nenhum imóvel alugado"
              subtitle="Conclua uma obra e alugue para ter renda passiva todo dia."
              action="Ver Meus Imóveis"
              onAction={() => setTab('meus')}
            />
          ) : (
            <>
              <div className="ios-surface p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Resumo</div>
                <div className="grid grid-cols-3 gap-2">
                  <KpiBox icon="📝" label="Contratos"      value={String(rentedProps.length)} />
                  <KpiBox icon="💵" label="Receita/mês"    value={fmtBRL(totalRentMonth)} />
                  <KpiBox icon="📊" label="Total recebido" value={fmtBRL(totalRentEarned)} />
                </div>
              </div>

              {rentedProps.map(prop => {
                const lastDay    = prop.lastRentDay ?? prop.tenantSince ?? currentDay;
                const daysPassed = currentDay - lastDay;
                const pending    = Math.floor((prop.rentMonthly / 30) * daysPassed);
                return (
                  <div key={prop.instanceId} className="ios-surface p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{prop.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] text-foreground truncate">{prop.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {prop.tenantName} · desde o Dia {prop.tenantSince}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-bold text-green-600">{fmtBRL(prop.rentMonthly)}/mês</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{daysPassed}d pendente</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-0.5">
                        <div className="text-[12px]">Pendente: <span className="font-bold text-foreground">{fmtBRL(pending)}</span></div>
                        <div className="text-[11px] text-muted-foreground">Total: <span className="text-green-600 font-semibold">{fmtBRL(prop.rentCollected)}</span></div>
                      </div>
                      <Button size="sm" disabled={pending <= 0} onClick={() => handleCollect(prop.instanceId)}>
                        <DollarSign size={13} className="mr-1" /> Cobrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────

function KpiBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-2 py-2 text-center">
      <div className="text-base leading-none">{icon}</div>
      <div className="text-[13px] font-bold text-foreground mt-0.5 tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[12px] font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, action, onAction }: {
  icon: string; title: string; subtitle: string; action: string; onAction: () => void;
}) {
  return (
    <div className="ios-surface p-8 flex flex-col items-center text-center gap-3">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="font-bold text-[15px] text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground mt-1">{subtitle}</div>
      </div>
      <Button size="sm" onClick={onAction}>{action}</Button>
    </div>
  );
}
