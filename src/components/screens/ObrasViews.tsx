// =====================================================================
// ObrasViews — Shared components: WorkPreparation + WorkDetailView
// =====================================================================
import { useState, useMemo } from 'react';
import {
  ArrowLeft, HardHat, AlertTriangle, CheckCircle2, Clock, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  GameState, WorkType, AllocatedEmployee, AllocatedMachine, ActiveWork,
} from '@/types/game';
import type { MyWin } from '@/hooks/useLicitacoes';
import { fmt, EMPLOYEE_TYPES, getWorkTypeDef } from '@/data/construction';
import {
  checkRequirements, calcProducaoPerMin, calcTempoEstimadoMin,
  calcWorkCost, calcEfficiencyPct,
} from '@/lib/obraEngine';

// ── Utilities ─────────────────────────────────────────────────────

export function fmtTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Encerrado';
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1_000);
  if (min > 60) return `${Math.floor(min / 60)}h ${min % 60}min`;
  if (min > 0) return `${min}min ${sec}s`;
  return `${sec}s`;
}

export function workTypeColor(tipo: WorkType): string {
  switch (tipo) {
    case 'pequena': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
    case 'media':   return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    case 'grande':  return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
    case 'mega':    return 'text-red-400 bg-red-500/10 border-red-500/25';
  }
}

export type StartWorkParams = {
  licitacaoId:        string;
  nome:               string;
  tipo:               WorkType;
  tamanhoM2:          number;
  tempoBaseMin:       number;
  contractValue:      number;
  allocatedEmployees: AllocatedEmployee[];
  allocatedMachines:  AllocatedMachine[];
  materialQtys:       { materialId: string; quantity: number }[];
  requisitos?:        import('@/types/game').WorkRequirements;
};

// ── Helper: format minutes as "Xh Ymin" or "Ymin" ─────────────────
function fmtMin(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  return `${Math.round(min)}min`;
}

// ── Efficiency color ──────────────────────────────────────────────
function efficiencyColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-400';
  if (pct >= 60)  return 'text-amber-400';
  return 'text-red-400';
}

// ══════════════════════════════════════════════════════════════════
// Preparação da obra (alocar recursos antes de iniciar)
// ══════════════════════════════════════════════════════════════════
export function WorkPreparation({ win, gameState, onBack, onStart }: {
  win:       MyWin;
  gameState: GameState;
  onBack:    () => void;
  onStart:   (params: StartWorkParams) => { ok: boolean; message: string };
}) {
  const req           = win.licitacao.requisitos;
  const tempoBaseMin  = win.licitacao.tempoBaseMin;
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
      return { instanceId: id, type: emp.type, name: emp.name, skill: emp.skill, level: emp.level ?? 1 };
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

  const producaoPerMin    = calcProducaoPerMin(allocatedEmployees, allocatedMachines);
  const tempoEstMin       = calcTempoEstimadoMin(win.tamanhoM2, producaoPerMin);
  const deadlineMin       = tempoBaseMin * 2.5;         // prazo = 2.5× tempo ideal
  const efficiencyPct     = calcEfficiencyPct(producaoPerMin, win.tamanhoM2, tempoBaseMin);
  const willFinishOnTime  = producaoPerMin > 0 && tempoEstMin <= deadlineMin;

  // Materiais serão consumidos do galpão gradualmente pelo tick; custo estimado para exibição
  const consumedMaterials = req.materials.map(mr => {
    const wItem = gameState.warehouse.find(w => w.materialId === mr.materialId);
    return { materialId: mr.materialId, name: mr.name, quantity: mr.quantity, unitPrice: wItem?.unitPrice ?? 0 };
  });
  // Verifica se há materiais suficientes no galpão para a obra completa
  const matSufficient = req.materials.every(mr => {
    const stock = gameState.warehouse.find(w => w.materialId === mr.materialId);
    return (stock?.quantity ?? 0) >= mr.quantity;
  });
  const cost      = calcWorkCost(allocatedEmployees, allocatedMachines, consumedMaterials, tempoEstMin);
  const profitEst = win.contractValue - cost.laborCost - cost.machineCost - cost.materialCost;
  const check     = checkRequirements(req, gameState.employees, gameState.machines, gameState.warehouse);

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
    const r = onStart({
      licitacaoId:        win.licitacaoId,
      nome:               win.nome,
      tipo:               win.tipo,
      tamanhoM2:          win.tamanhoM2,
      tempoBaseMin,
      contractValue:      win.contractValue,
      allocatedEmployees,
      allocatedMachines,
      requisitos:         req,
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

      {/* Stats card */}
      <div className="ios-surface rounded-[14px] p-3 space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Contrato</div>
            <div className="font-bold text-foreground">{fmt(win.contractValue)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Produção atual</div>
            <div className={`font-bold ${producaoPerMin === 0 ? 'text-red-400' : 'text-foreground'}`}>{producaoPerMin.toFixed(1)} m²/min</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><Zap size={9} />Eficiência</div>
            <div className={`font-bold ${efficiencyColor(efficiencyPct)}`}>
              {producaoPerMin === 0 ? '0' : efficiencyPct}%
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><Clock size={9} />Tempo est.</div>
            <div className={`font-bold ${producaoPerMin === 0 ? 'text-red-400' : willFinishOnTime ? 'text-foreground' : 'text-red-400'}`}>
              {producaoPerMin === 0 ? '∞' : fmtMin(tempoEstMin)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Prazo máximo</div>
            <div className="font-bold text-amber-400">{fmtMin(deadlineMin)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Mão-de-obra est.</div>
            <div className="font-bold text-foreground">{fmt(cost.laborCost)}</div>
          </div>
        </div>
        <div className="pt-1.5 border-t border-border/30">
          <div className="text-[9px] uppercase text-muted-foreground">Lucro estimado</div>
          <div className={`font-bold text-[15px] ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitEst >= 0 ? '+' : ''}{fmt(profitEst)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">
            Recebe: {fmt(Math.max(0, win.contractValue - cost.laborCost - cost.machineCost))} (após custos operacionais)
          </div>
        </div>
      </div>

      {/* Deadline warning */}
      {producaoPerMin > 0 && !willFinishOnTime && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[10px] px-3 py-2 border border-red-500/25">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>Equipe fraca! Estimativa ({fmtMin(tempoEstMin)}) ultrapassa o prazo ({fmtMin(deadlineMin)}). Você pagará multa de 25% se não concluir a tempo.</span>
        </div>
      )}

      {/* Missing requirements warning (non-blocking) */}
      {!check.ok && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 rounded-[10px] px-3 py-2 border border-amber-500/25">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold mb-0.5">Recursos insuficientes — você pode iniciar mesmo assim (maior risco)</div>
            {check.missingEmployees.map(m => (
              <div key={m.type}>· {m.label}: precisa {m.needed}, tem {m.have}</div>
            ))}
            {check.missingMachines.map(m => (
              <div key={m.typeId}>· {m.name}: precisa {m.needed}, tem {m.have}</div>
            ))}
            {check.missingMaterials.map(m => (
              <div key={m.materialId}>· {m.name}: precisa {m.needed.toLocaleString('pt-BR')}, tem {m.have.toLocaleString('pt-BR')}</div>
            ))}
          </div>
        </div>
      )}

      {/* No workers warning */}
      {producaoPerMin === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[10px] px-3 py-2 border border-red-500/25">
          <AlertTriangle size={12} />
          Equipe sem produção! Adicione ajudantes ou pedreiros.
        </div>
      )}

      {/* Materials */}
      {req.materials.length > 0 && (
        <div className={`rounded-[12px] p-3 space-y-2 border ${matSufficient ? 'ios-surface border-transparent' : 'bg-amber-500/8 border-amber-500/35'}`}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">🧱 Materiais</div>
            {matSufficient
              ? <span className="text-[9px] text-emerald-400 font-semibold">✓ Estoque OK</span>
              : <span className="text-[9px] text-amber-400 font-semibold">⚠ Estoque insuficiente</span>
            }
          </div>
          <div className="text-[9px] text-muted-foreground">
            Consumidos do galpão gradualmente durante a execução.
            {!matSufficient && ' Compre o que falta no Mercado antes ou durante a obra.'}
          </div>
          {req.materials.map(mr => {
            const stock    = gameState.warehouse.find(w => w.materialId === mr.materialId);
            const have     = stock?.quantity ?? 0;
            const ok       = have >= mr.quantity;
            const pct      = Math.min(100, Math.round((have / mr.quantity) * 100));
            return (
              <div key={mr.materialId} className="space-y-0.5">
                <div className={`flex items-center justify-between text-[11px] ${ok ? 'text-foreground' : 'text-amber-400'}`}>
                  <span>{mr.name}</span>
                  <span>{have.toFixed(0)}/{mr.quantity} {mr.unit}</span>
                </div>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Employees */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Equipe ({selEmployees.length} selecionados)
        </div>
        {idleEmployees.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-3">Nenhum funcionário disponível</div>
        )}
        {idleEmployees.map(emp => {
          const def        = EMPLOYEE_TYPES.find(d => d.type === emp.type)!;
          const sel        = selEmployees.includes(emp.instanceId);
          const minReq     = req.employees.find(e => e.type === emp.type);
          const selOfType  = selEmployees.filter(id => gameState.employees.find(e => e.instanceId === id)?.type === emp.type).length;
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
                <div className="text-[10px] text-muted-foreground">
                  {def.label} · Lv {emp.level ?? 1} · Skill {emp.skill}
                  {isRequired && sel && <span className="ml-1 text-amber-400 font-bold">· Obrigatório</span>}
                </div>
              </div>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                {sel && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Machines */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Máquinas ({selMachines.length} selecionadas)
        </div>
        {idleMachines.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-3">Nenhuma máquina disponível</div>
        )}
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

      {/* Start button — disabled only if no production at all */}
      <Button
        className="w-full gap-1.5"
        disabled={producaoPerMin === 0}
        onClick={handleStart}
      >
        <HardHat size={14} />
        {!check.ok ? '⚠️ Iniciar Mesmo Assim' : 'Iniciar Obra'} · {fmt(win.contractValue)}
      </Button>

      {producaoPerMin === 0 && (
        <div className="text-[10px] text-red-400 text-center">Adicione funcionários com capacidade de produção</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detalhe e gestão de obra em andamento
// ══════════════════════════════════════════════════════════════════
export function WorkDetailView({
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

  const def            = getWorkTypeDef(work.tipo);
  const idleEmps       = gameState.employees.filter(e => e.status === 'idle');
  const idleMachs      = gameState.machines.filter(m => m.status === 'idle');
  const msToDeadline   = work.deadline - Date.now();
  const deadlineUrgent = msToDeadline < 5 * 60_000 && msToDeadline > 0; // < 5min

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

      {/* Progress card */}
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

        {/* Deadline bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={`text-[9px] uppercase font-semibold flex items-center gap-1 ${deadlineUrgent ? 'text-red-400' : 'text-muted-foreground'}`}>
              <Clock size={9} />
              Prazo restante
            </div>
            <div className={`text-[11px] font-bold ${deadlineUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {fmtTimeLeft(work.deadline)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Produção</div>
            <div className={`font-semibold ${work.producaoPerMin === 0 ? 'text-red-400' : 'text-foreground'}`}>
              {work.producaoPerMin.toFixed(1)} m²/min
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-0.5"><Zap size={8} />Eficiência</div>
            <div className={`font-semibold ${efficiencyColor(work.efficiencyPct)}`}>
              {work.efficiencyPct}%
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Contrato</div>
            <div className="font-semibold">{fmt(work.contractValue)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-muted-foreground">Concluído</div>
            <div className="font-semibold">{work.currentM2Done.toFixed(0)} / {work.tamanhoM2} m²</div>
          </div>
        </div>

        {work.producaoPerMin === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[8px] px-2.5 py-1.5">
            <AlertTriangle size={10} />
            Sem produção! Adicione ajudantes ou pedreiros.
          </div>
        )}
        {deadlineUrgent && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-[8px] px-2.5 py-1.5">
            <AlertTriangle size={10} />
            Prazo crítico! Reforce a equipe agora para evitar multa.
          </div>
        )}
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${msg.ok ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Allocated employees */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Equipe na Obra ({work.allocatedEmployees.length})
        </div>
        {work.allocatedEmployees.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-3">Nenhum funcionário alocado</div>
        )}
        {work.allocatedEmployees.map(emp => {
          const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
          return (
            <div key={emp.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
              <span className="text-xl">{empDef?.icon ?? '👷'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{emp.name}</div>
                <div className="text-[10px] text-muted-foreground">{empDef?.label} · Lv {emp.level ?? 1} · Skill {emp.skill}</div>
              </div>
              <button
                onClick={() => flash(onRemoveEmployee(emp.instanceId))}
                className="text-[11px] text-red-400 border border-red-500/30 rounded-[8px] px-2.5 py-1 hover:bg-red-500/10 transition-colors shrink-0"
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>

      {/* Add employees */}
      {idleEmps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Disponíveis para Adicionar
          </div>
          {idleEmps.map(emp => {
            const empDef = EMPLOYEE_TYPES.find(d => d.type === emp.type);
            return (
              <div key={emp.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
                <span className="text-xl">{empDef?.icon ?? '👷'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-foreground">{emp.name}</div>
                  <div className="text-[10px] text-muted-foreground">{empDef?.label} · Lv {emp.level ?? 1} · Skill {emp.skill}</div>
                </div>
                <button
                  onClick={() => flash(onAddEmployee(emp.instanceId))}
                  className="text-[11px] text-emerald-400 border border-emerald-500/30 rounded-[8px] px-2.5 py-1 hover:bg-emerald-500/10 transition-colors shrink-0"
                >
                  + Adicionar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocated machines */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Máquinas na Obra ({work.allocatedMachines.length})
        </div>
        {work.allocatedMachines.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-3">Nenhuma máquina alocada</div>
        )}
        {work.allocatedMachines.map(mach => (
          <div key={mach.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
            <span className="text-xl">{mach.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-foreground">{mach.name}</div>
              <div className="text-[10px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
            </div>
            <button
              onClick={() => flash(onRemoveMachine(mach.instanceId))}
              className="text-[11px] text-red-400 border border-red-500/30 rounded-[8px] px-2.5 py-1 hover:bg-red-500/10 transition-colors shrink-0"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      {/* Add machines */}
      {idleMachs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Máquinas Disponíveis
          </div>
          {idleMachs.map(mach => (
            <div key={mach.instanceId} className="ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5">
              <span className="text-xl">{mach.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{mach.name}</div>
                <div className="text-[10px] text-muted-foreground">{fmt(mach.costPerMin)}/min</div>
              </div>
              <button
                onClick={() => flash(onAddMachine(mach.instanceId))}
                className="text-[11px] text-emerald-400 border border-emerald-500/30 rounded-[8px] px-2.5 py-1 hover:bg-emerald-500/10 transition-colors shrink-0"
              >
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
