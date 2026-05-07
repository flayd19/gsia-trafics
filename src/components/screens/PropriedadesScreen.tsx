// =====================================================================
// PropriedadesScreen — 🏗️ OBRAS  (hub principal)
// Cards expandíveis com gestão inline + sistema de colaboração
// =====================================================================
import { useState, useCallback } from 'react';
import {
  HardHat, Clock, CheckCircle2, XCircle, ChevronRight,
  AlertTriangle, Zap, Trophy, Users, Plus, Minus,
  ChevronDown, ChevronUp, X, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState, ActiveWork } from '@/types/game';
import type { MyWin } from '@/hooks/useLicitacoes';
import {
  useWorkInvites, detectMissingResources,
  type NeededResources, type WorkInvite,
} from '@/hooks/useWorkInvites';
import { fmt, getWorkTypeDef, EMPLOYEE_TYPES, MACHINE_CATALOG } from '@/data/construction';
import { calcProducaoPerMin, calcTempoEstimadoMin, calcMaterialShortages } from '@/lib/obraEngine';
import {
  WorkPreparation,
  WorkDetailView,
  fmtTimeLeft,
  workTypeColor,
  type StartWorkParams,
} from './ObrasViews';

// ── Props ─────────────────────────────────────────────────────────

interface PropriedadesScreenProps {
  gameState:                GameState;
  playerName:               string;
  myWins:                   MyWin[];
  onConsumeWin:             (id: string) => void;
  onStartWork:              (params: StartWorkParams) => { ok: boolean; message: string };
  onAddEmployeeToWork:      (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveEmployeeFromWork: (workId: string, instanceId: string) => { ok: boolean; message: string };
  onAddMachineToWork:       (workId: string, instanceId: string) => { ok: boolean; message: string };
  onRemoveMachineFromWork:  (workId: string, instanceId: string) => { ok: boolean; message: string };
  onPayCollaborator?:       (amount: number) => boolean;
}

// ── Helper: tempo estimado com equipe atual ────────────────────────
function fmtEstimatedTime(work: ActiveWork): string {
  if (work.producaoPerMin <= 0) return '∞';
  const remaining = Math.max(0, work.tamanhoM2 - work.currentM2Done);
  const min = remaining / work.producaoPerMin;
  if (min > 60) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  return `${Math.round(min)}min`;
}

function effColor(pct: number) {
  if (pct >= 100) return 'text-emerald-400';
  if (pct >= 60)  return 'text-amber-400';
  return 'text-red-400';
}

// ── InviteSheet — bottom sheet para criar convite ─────────────────
function InviteSheet({ work, playerName, onClose, onCreateInvite }: {
  work:            ActiveWork;
  playerName:      string;
  onClose:         () => void;
  onCreateInvite:  (needed: NeededResources, payment: number) => Promise<{ ok: boolean; message: string }>;
}) {
  const missing = detectMissingResources(work);
  const [payment, setPayment]   = useState(Math.round(work.contractValue * 0.10));
  const [result,  setResult]    = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const noMissing = missing.employees.length === 0 && missing.machines.length === 0;

  async function handleCreate() {
    setLoading(true);
    const r = await onCreateInvite(missing, payment);
    setResult(r.message);
    setLoading(false);
    if (r.ok) setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full bg-background border-t border-border rounded-t-[20px] p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-game-title text-[15px] font-bold">Buscar Colaborador</h3>
            <div className="text-[11px] text-muted-foreground">{work.nome}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted/50">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* O que falta */}
        <div className="ios-surface rounded-[12px] p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Recursos faltando na obra
          </div>
          {noMissing ? (
            <div className="text-[12px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Obra totalmente equipada! Mesmo assim, pode convidar alguém para acelerar.
            </div>
          ) : (
            <>
              {missing.employees.map(e => (
                <div key={e.type} className="flex items-center gap-2 text-[12px]">
                  <span>{e.icon}</span>
                  <span className="text-foreground">{e.label}</span>
                  <span className="ml-auto text-amber-400 font-bold">×{e.quantity} faltando</span>
                </div>
              ))}
              {missing.machines.map(m => (
                <div key={m.typeId} className="flex items-center gap-2 text-[12px]">
                  <span>{m.icon}</span>
                  <span className="text-foreground">{m.name}</span>
                  <span className="ml-auto text-amber-400 font-bold">×{m.quantity} faltando</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Pagamento fixo */}
        <div className="ios-surface rounded-[12px] p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Pagamento fixo ao colaborador
          </div>
          <div className="text-[10px] text-muted-foreground">
            Valor que você pagará quando a obra for concluída. Contrato: {fmt(work.contractValue)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPayment(p => Math.max(1_000, p - 5_000))}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
            >
              <Minus size={14} />
            </button>
            <div className="flex-1 text-center">
              <div className="text-[20px] font-black text-primary">{fmt(payment)}</div>
              <div className="text-[9px] text-muted-foreground">
                {Math.round((payment / work.contractValue) * 100)}% do contrato
              </div>
            </div>
            <button
              onClick={() => setPayment(p => Math.min(work.contractValue * 0.5, p + 5_000))}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {result && (
          <div className="px-3 py-2 rounded-[10px] text-[12px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            {result}
          </div>
        )}

        <Button className="w-full gap-1.5" onClick={handleCreate} disabled={loading}>
          <Users size={14} />
          {loading ? 'Publicando...' : 'Publicar Convite'}
        </Button>
      </div>
    </div>
  );
}

// ── OpenInviteCard — convite de outro jogador ─────────────────────
function OpenInviteCard({ invite, idleEmployees, idleMachines, onAccept }: {
  invite:         WorkInvite;
  idleEmployees:  GameState['employees'];
  idleMachines:   GameState['machines'];
  onAccept:       (id: string, contributed: NeededResources) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const snap = invite.work_snapshot;
  const needed = invite.needed_resources;

  // Verificar se o jogador tem o que é necessário
  const canContribute =
    needed.employees.every(ne =>
      idleEmployees.filter(e => e.type === ne.type).length >= ne.quantity
    ) &&
    needed.machines.every(nm =>
      idleMachines.filter(m => m.typeId === nm.typeId).length >= nm.quantity
    );

  async function handleAccept() {
    setLoading(true);
    // Contribute what's needed from idle pool
    const contributed: NeededResources = { employees: needed.employees, machines: needed.machines };
    await onAccept(invite.id, contributed);
    setLoading(false);
  }

  return (
    <div className="ios-surface rounded-[14px] border border-primary/20 overflow-hidden">
      <button
        className="w-full p-3 text-left flex items-center gap-2.5"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-xl">🤝</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-foreground truncate">{snap.nome}</div>
          <div className="text-[10px] text-muted-foreground">
            {invite.owner_name} · {fmt(snap.contractValue)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-black text-emerald-400">{fmt(invite.payment_amount)}</div>
          <div className="text-[9px] text-muted-foreground">pagamento</div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2.5">
          <div className="text-[10px] text-muted-foreground">Recursos solicitados:</div>
          {needed.employees.map(ne => {
            const have = idleEmployees.filter(e => e.type === ne.type).length;
            return (
              <div key={ne.type} className={`flex items-center gap-2 text-[11px] ${have >= ne.quantity ? 'text-foreground' : 'text-red-400'}`}>
                <span>{ne.icon}</span>
                <span>{ne.label} ×{ne.quantity}</span>
                <span className="ml-auto text-muted-foreground">tenho: {have}</span>
              </div>
            );
          })}
          {needed.machines.map(nm => {
            const have = idleMachines.filter(m => m.typeId === nm.typeId).length;
            return (
              <div key={nm.typeId} className={`flex items-center gap-2 text-[11px] ${have >= nm.quantity ? 'text-foreground' : 'text-red-400'}`}>
                <span>{nm.icon}</span>
                <span>{nm.name} ×{nm.quantity}</span>
                <span className="ml-auto text-muted-foreground">tenho: {have}</span>
              </div>
            );
          })}
          <div className="pt-1">
            {!canContribute && (
              <div className="text-[10px] text-amber-400 mb-2">⚠️ Você não tem todos os recursos necessários disponíveis</div>
            )}
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={loading}
              onClick={handleAccept}
            >
              <Users size={12} />
              {loading ? 'Aceitando...' : `Colaborar · ${fmt(invite.payment_amount)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ActiveWorkCard — card principal com inline quick actions ───────
function ActiveWorkCard({
  work, gameState,
  onAddEmployee, onRemoveEmployee,
  onAddMachine,  onRemoveMachine,
  onInvite,
  myInviteForWork,
  onCancelInvite,
}: {
  work:              ActiveWork;
  gameState:         GameState;
  onAddEmployee:     (id: string) => { ok: boolean; message: string };
  onRemoveEmployee:  (id: string) => { ok: boolean; message: string };
  onAddMachine:      (id: string) => { ok: boolean; message: string };
  onRemoveMachine:   (id: string) => { ok: boolean; message: string };
  onInvite:          () => void;
  myInviteForWork:   WorkInvite | undefined;
  onCancelInvite:    () => void;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [flashMsg,  setFlashMsg]  = useState<string | null>(null);

  const def           = getWorkTypeDef(work.tipo);
  const req           = work.requisitos;
  const idleEmps      = gameState.employees.filter(e => e.status === 'idle');
  const idleMachs     = gameState.machines.filter(m => m.status === 'idle');
  const msToDeadline  = work.deadline - Date.now();
  const deadlineUrgent = msToDeadline < 5 * 60_000 && msToDeadline > 0;

  function flash(r: { ok: boolean; message: string }) {
    setFlashMsg(r.message);
    setTimeout(() => setFlashMsg(null), 2_500);
  }

  // Slots display: current vs recommended
  const empTypes = req ? req.employees : [];
  const machTypes = req ? req.machines : [];

  return (
    <div className={`ios-surface rounded-[16px] overflow-hidden border ${deadlineUrgent ? 'border-red-500/40' : 'border-border/40'}`}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <span className="text-[22px] mt-0.5">{def.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-[13px] font-bold text-foreground truncate">{work.nome}</div>
              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${workTypeColor(work.tipo)}`}>{def.label}</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-bold mt-0.5">{fmt(work.contractValue)}</div>
          </div>
        </div>

        {/* ── Alerta de falta de material ──────────────────────── */}
        {work.materialStarved && (() => {
          const shortages = calcMaterialShortages(work.requisitos, work.consumedMaterials, gameState.warehouse);
          return (
            <div className="rounded-[10px] bg-amber-500/10 border border-amber-500/40 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle size={13} />
                <span className="text-[11px] font-bold">Progresso pausado — falta de material</span>
              </div>
              {shortages.length > 0 && (
                <div className="space-y-0.5">
                  {shortages.map(s => (
                    <div key={s.materialId} className="text-[10px] text-amber-300/80 flex justify-between">
                      <span>• {s.name}</span>
                      <span>faltam {s.missing} {s.unit}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[9px] text-amber-300/60">
                Compre os materiais no Mercado para retomar a obra.
              </div>
            </div>
          );
        })()}

        {/* Progress */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
            <span>{work.progressPct}% · {work.currentM2Done.toFixed(0)}/{work.tamanhoM2} m²</span>
            <span>
              {work.materialStarved
                ? <span className="text-amber-400">⏸ pausado</span>
                : <span>{work.producaoPerMin.toFixed(1)} m²/min</span>
              }
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${work.materialStarved ? 'bg-amber-500/60' : 'bg-primary'}`}
              style={{ width: `${work.progressPct}%` }}
            />
          </div>
        </div>

        {/* Time + Efficiency row */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="ios-surface rounded-[8px] p-1.5 text-center">
            <div className="text-[8px] uppercase text-muted-foreground">Conclui em</div>
            <div className="font-bold text-foreground">{fmtEstimatedTime(work)}</div>
          </div>
          <div className={`ios-surface rounded-[8px] p-1.5 text-center ${deadlineUrgent ? 'bg-red-500/10 border border-red-500/30' : ''}`}>
            <div className={`text-[8px] uppercase ${deadlineUrgent ? 'text-red-400' : 'text-muted-foreground'}`}>Prazo</div>
            <div className={`font-bold ${deadlineUrgent ? 'text-red-400' : 'text-amber-400'}`}>{fmtTimeLeft(work.deadline)}</div>
          </div>
          <div className="ios-surface rounded-[8px] p-1.5 text-center">
            <div className="text-[8px] uppercase text-muted-foreground"><Zap size={7} className="inline" /> Efic.</div>
            <div className={`font-bold ${effColor(work.efficiencyPct)}`}>{work.efficiencyPct}%</div>
          </div>
        </div>

        {/* Employee + Machine slots */}
        <div className="flex gap-2">
          {/* Employee slots */}
          <div className="flex-1 ios-surface rounded-[10px] p-2">
            <div className="text-[9px] uppercase text-muted-foreground mb-1.5">👷 Equipe</div>
            {empTypes.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">{work.allocatedEmployees.length} alocados</div>
            ) : (
              empTypes.map(er => {
                const have = work.allocatedEmployees.filter(e => e.type === er.type).length;
                const ok   = have >= er.quantity;
                const def  = EMPLOYEE_TYPES.find(d => d.type === er.type);
                return (
                  <div key={er.type} className="flex items-center gap-1 text-[11px]">
                    <span className="text-base">{def?.icon ?? '👷'}</span>
                    <span className={ok ? 'text-foreground' : 'text-amber-400'}>
                      {have}/{er.quantity}
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate">{def?.label}</span>
                    {!ok && <AlertTriangle size={9} className="text-amber-400 ml-auto shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
          {/* Machine slots */}
          <div className="flex-1 ios-surface rounded-[10px] p-2">
            <div className="text-[9px] uppercase text-muted-foreground mb-1.5">🚜 Máquinas</div>
            {machTypes.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">{work.allocatedMachines.length} alocadas</div>
            ) : (
              machTypes.map(mr => {
                const have = work.allocatedMachines.filter(m => m.typeId === mr.typeId).length;
                const ok   = have >= mr.quantity;
                const def  = MACHINE_CATALOG.find(d => d.typeId === mr.typeId);
                return (
                  <div key={mr.typeId} className="flex items-center gap-1 text-[11px]">
                    <span className="text-base">{def?.icon ?? '🚜'}</span>
                    <span className={ok ? 'text-foreground' : 'text-amber-400'}>
                      {have}/{mr.quantity}
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate">{mr.name}</span>
                    {!ok && <AlertTriangle size={9} className="text-amber-400 ml-auto shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Materials summary */}
        {work.consumedMaterials.length > 0 && (
          <div className="ios-surface rounded-[10px] p-2">
            <div className="text-[9px] uppercase text-muted-foreground mb-1">📦 Materiais consumidos</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {work.consumedMaterials.map(m => (
                <span key={m.materialId} className="text-[10px] text-muted-foreground">
                  {m.name}: {m.quantity.toLocaleString('pt-BR')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Flash message */}
        {flashMsg && (
          <div className="px-2.5 py-1.5 rounded-[8px] text-[11px] bg-primary/10 border border-primary/25 text-primary">
            {flashMsg}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-primary/10 border border-primary/25 text-[11px] font-semibold text-primary"
          >
            {expanded ? <ChevronUp size={12} /> : <Plus size={12} />}
            {expanded ? 'Fechar' : 'Recursos'}
          </button>

          {myInviteForWork ? (
            <button
              onClick={onCancelInvite}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-400"
            >
              <Users size={12} />
              Cancelar Convite
            </button>
          ) : (
            <button
              onClick={onInvite}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-blue-500/10 border border-blue-500/25 text-[11px] font-semibold text-blue-400"
            >
              <Users size={12} />
              Colaborador
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded: quick resource management ─────────────────── */}
      {expanded && (
        <div className="border-t border-border/30 p-3 space-y-3 bg-muted/10">

          {/* Add employees */}
          {idleEmps.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">+ Adicionar Funcionários</div>
              {idleEmps.map(emp => {
                const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
                return (
                  <div key={emp.instanceId} className="flex items-center gap-2">
                    <span className="text-base">{empDef?.icon ?? '👷'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold truncate">{emp.name}</div>
                      <div className="text-[9px] text-muted-foreground">{empDef?.label} · Lv {emp.level ?? 1} · Skill {emp.skill}</div>
                    </div>
                    <button
                      onClick={() => flash(onAddEmployee(emp.instanceId))}
                      className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
                    >
                      <Plus size={12} className="text-emerald-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remove employees */}
          {work.allocatedEmployees.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">− Remover da Obra</div>
              {work.allocatedEmployees.map(emp => {
                const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
                return (
                  <div key={emp.instanceId} className="flex items-center gap-2">
                    <span className="text-base">{empDef?.icon ?? '👷'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold truncate">{emp.name}</div>
                      <div className="text-[9px] text-muted-foreground">{empDef?.label} · Lv {emp.level ?? 1}</div>
                    </div>
                    <button
                      onClick={() => flash(onRemoveEmployee(emp.instanceId))}
                      className="shrink-0 w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center"
                    >
                      <Minus size={12} className="text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add machines */}
          {idleMachs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">+ Adicionar Máquinas</div>
              {idleMachs.map(mach => (
                <div key={mach.instanceId} className="flex items-center gap-2">
                  <span className="text-base">{mach.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">{mach.name}</div>
                    <div className="text-[9px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
                  </div>
                  <button
                    onClick={() => flash(onAddMachine(mach.instanceId))}
                    className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
                  >
                    <Plus size={12} className="text-emerald-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Remove machines */}
          {work.allocatedMachines.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">− Máquinas na Obra</div>
              {work.allocatedMachines.map(mach => (
                <div key={mach.instanceId} className="flex items-center gap-2">
                  <span className="text-base">{mach.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">{mach.name}</div>
                    <div className="text-[9px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
                  </div>
                  <button
                    onClick={() => flash(onRemoveMachine(mach.instanceId))}
                    className="shrink-0 w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center"
                  >
                    <Minus size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {idleEmps.length === 0 && idleMachs.length === 0 && (
            <div className="text-center text-[11px] text-muted-foreground py-2">
              Todos os recursos já estão alocados
            </div>
          )}
        </div>
      )}

      {/* Accepted collaborator badge */}
      {myInviteForWork?.status === 'accepted' && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 rounded-[8px] px-2.5 py-1.5">
            <Users size={10} />
            Colaborador: {myInviteForWork.collaborator_name} · Pagar {fmt(myInviteForWork.payment_amount)} na conclusão
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════════════

export function PropriedadesScreen({
  gameState, playerName, myWins, onConsumeWin, onStartWork,
  onAddEmployeeToWork, onRemoveEmployeeFromWork,
  onAddMachineToWork, onRemoveMachineFromWork,
  onPayCollaborator,
}: PropriedadesScreenProps) {
  const [preparingWin,  setPreparingWin]  = useState<MyWin | null>(null);
  const [invitingWork,  setInvitingWork]  = useState<ActiveWork | null>(null);

  const {
    openInvites,
    myInvites,
    loading: invLoading,
    createInvite,
    acceptInvite,
    cancelInvite,
    completeInvite,
  } = useWorkInvites(playerName);

  const { activeWorks, workHistory } = gameState;

  // ── WorkPreparation ────────────────────────────────────────────
  if (preparingWin) {
    return (
      <div className="px-4 py-4">
        <WorkPreparation
          win={preparingWin}
          gameState={gameState}
          onBack={() => setPreparingWin(null)}
          onStart={params => {
            const result = onStartWork(params);
            if (result.ok) {
              onConsumeWin(preparingWin.licitacaoId);
              setPreparingWin(null);
            }
            return result;
          }}
        />
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 space-y-5 pb-24">

      {/* ── Contratos prontos para iniciar ─────────────────────── */}
      {myWins.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <HardHat size={13} className="text-amber-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              Iniciar Obra ({myWins.length})
            </h3>
          </div>
          <div className="space-y-2">
            {myWins.map(win => {
              const def = getWorkTypeDef(win.tipo);
              return (
                <button
                  key={win.licitacaoId}
                  onClick={() => setPreparingWin(win)}
                  className="w-full ios-surface rounded-[14px] p-3 text-left flex items-center gap-3 border border-amber-500/25 hover:border-amber-400/50 transition-colors"
                >
                  <span className="text-2xl">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{win.nome}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${workTypeColor(win.tipo)}`}>{def.label}</span>
                      <span className="text-[10px] text-muted-foreground">{win.tamanhoM2.toLocaleString('pt-BR')} m²</span>
                      <span className="text-[10px] text-emerald-400 font-bold">{fmt(win.contractValue)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400">
                      <Clock size={9} />
                      Prazo para iniciar: {fmtTimeLeft(win.prepDeadline ?? Date.now() + 999_999_000)}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Obras ativas ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={13} className="text-primary" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Em Andamento ({activeWorks.filter(w => w.status === 'running').length})
          </h3>
        </div>
        {activeWorks.filter(w => w.status === 'running').length === 0 ? (
          <div className="ios-surface rounded-[14px] p-6 text-center">
            <HardHat size={28} className="mx-auto mb-2 text-muted-foreground/30" />
            <div className="text-[12px] text-muted-foreground">Nenhuma obra em andamento</div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeWorks.filter(w => w.status === 'running').map(work => {
              const myInvite = myInvites.find(i =>
                (i.work_snapshot as { workId?: string }).workId === work.id && i.status !== 'cancelled',
              );
              return (
                <ActiveWorkCard
                  key={work.id}
                  work={work}
                  gameState={gameState}
                  onAddEmployee={id => onAddEmployeeToWork(work.id, id)}
                  onRemoveEmployee={id => onRemoveEmployeeFromWork(work.id, id)}
                  onAddMachine={id => onAddMachineToWork(work.id, id)}
                  onRemoveMachine={id => onRemoveMachineFromWork(work.id, id)}
                  onInvite={() => setInvitingWork(work)}
                  myInviteForWork={myInvite}
                  onCancelInvite={() => myInvite && cancelInvite(myInvite.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Convites de outros jogadores ───────────────────────── */}
      {openInvites.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} className="text-blue-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
              Oportunidades de Colaborar ({openInvites.length})
            </h3>
          </div>
          <div className="space-y-2">
            {openInvites.map(invite => (
              <OpenInviteCard
                key={invite.id}
                invite={invite}
                idleEmployees={gameState.employees.filter(e => e.status === 'idle')}
                idleMachines={gameState.machines.filter(m => m.status === 'idle')}
                onAccept={async (id, contributed) => {
                  await acceptInvite(id, contributed);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Colaborações aceitas (como colaborador) ─────────────── */}

      {/* ── Histórico ──────────────────────────────────────────── */}
      {workHistory.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={13} className="text-muted-foreground" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico ({workHistory.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {workHistory.slice(0, 20).map(record => {
              const def = getWorkTypeDef(record.tipo);
              return (
                <div key={record.id} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2">
                  <span className="text-lg">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-foreground truncate">{record.nome}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {new Date(record.completedAt).toLocaleDateString('pt-BR')} · {record.timeTakenMin}min
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {record.succeeded ? (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={9} />
                        <span className="text-[11px] font-bold">{fmt(record.profit)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle size={9} />
                        <span className="text-[11px] font-bold">{fmt(record.profit)}</span>
                      </div>
                    )}
                    {(record.xpDelta ?? 0) !== 0 && (
                      <div className={`text-[9px] ${(record.xpDelta ?? 0) > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(record.xpDelta ?? 0) > 0 ? '+' : ''}{record.xpDelta} XP
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {myWins.length === 0 && activeWorks.length === 0 && workHistory.length === 0 && openInvites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <HardHat size={48} className="text-muted-foreground/20" />
          <div className="text-[14px] font-semibold text-muted-foreground">Nenhuma obra ainda</div>
          <div className="text-[12px] text-muted-foreground/60 text-center max-w-[220px]">
            Ganhe licitações na aba Contratos para iniciar obras
          </div>
        </div>
      )}

      {/* ── Invite bottom sheet ────────────────────────────────── */}
      {invitingWork && (
        <InviteSheet
          work={invitingWork}
          playerName={playerName}
          onClose={() => setInvitingWork(null)}
          onCreateInvite={async (needed, payment) => {
            const r = await createInvite({
              work: invitingWork,
              neededResources: needed,
              paymentAmount: payment,
            });
            return r;
          }}
        />
      )}
    </div>
  );
}
