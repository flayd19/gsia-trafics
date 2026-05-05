// =====================================================================
// EmpresaScreen — Galpão · Funcionários · Máquinas
// =====================================================================
import { useState } from 'react';
import { Warehouse, Users, Truck, Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState } from '@/types/game';
import {
  EMPLOYEE_TYPES,
  MACHINE_CATALOG,
  MATERIALS,
  currentMaterialPrice,
  fmt,
  type EmployeeTypeDef,
  type MachineTypeDef,
} from '@/data/construction';
import { ensureReputation } from '@/lib/reputation';

interface EmpresaScreenProps {
  gameState:    GameState;
  onHireEmployee: (type: import('@/types/game').EmployeeType) => { ok: boolean; message: string };
  onFireEmployee: (instanceId: string) => { ok: boolean; message: string };
  onBuyMachine:   (typeId: string) => { ok: boolean; message: string };
  onSellMachine:  (instanceId: string) => { ok: boolean; message: string };
}

type Tab = 'galpao' | 'funcionarios' | 'maquinas';

export function EmpresaScreen({
  gameState,
  onHireEmployee,
  onFireEmployee,
  onBuyMachine,
  onSellMachine,
}: EmpresaScreenProps) {
  const [tab,     setTab]     = useState<Tab>('galpao');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const rep    = ensureReputation(gameState.reputation);
  const level  = rep.level;

  function flash(result: { ok: boolean; message: string }) {
    setMessage({ text: result.message, ok: result.ok });
    setTimeout(() => setMessage(null), 3_000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-game-title text-xl font-bold text-foreground flex items-center gap-2">
          🏗️ Minha Empresa
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Gerencie galpão, equipe e maquinário
        </p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        {([
          { id: 'galpao',        label: 'Galpão',       Icon: Warehouse },
          { id: 'funcionarios',  label: 'Equipe',        Icon: Users },
          { id: 'maquinas',      label: 'Máquinas',     Icon: Truck },
        ] as { id: Tab; label: string; Icon: typeof Warehouse }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${
              tab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {message && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${
          message.ok
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── GALPÃO ─────────────────────────────────────────── */}
      {tab === 'galpao' && (
        <div className="space-y-3">
          {gameState.warehouse.length === 0 ? (
            <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
              <div className="text-4xl">🏭</div>
              <div className="text-[14px] font-semibold text-muted-foreground">Galpão vazio</div>
              <div className="text-[11px] text-muted-foreground">
                Compre materiais no Mercado para estocar
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                Estoque atual
              </div>
              {gameState.warehouse.map(item => (
                <div key={item.materialId} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.category} · {item.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-foreground tabular-nums">
                      {item.quantity.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmt(item.unitPrice)}/un
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Catálogo de materiais com preços atuais */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mt-2">
              Preços hoje (NPC)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MATERIALS.map(mat => {
                const stock = gameState.warehouse.find(w => w.materialId === mat.materialId);
                return (
                  <div key={mat.materialId} className="ios-surface rounded-[10px] p-2 flex items-center gap-2">
                    <span className="text-xl">{mat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-foreground truncate">{mat.name}</div>
                      <div className="text-[10px] text-primary font-bold">
                        {fmt(mat.basePrice)}/{mat.unit}
                      </div>
                      {stock && (
                        <div className="text-[9px] text-emerald-400">
                          ✓ {stock.quantity.toLocaleString('pt-BR')} em estoque
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FUNCIONÁRIOS ──────────────────────────────────── */}
      {tab === 'funcionarios' && (
        <div className="space-y-3">
          {/* Equipe atual */}
          {gameState.employees.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                Equipe ({gameState.employees.length})
              </div>
              {gameState.employees.map(emp => {
                const def = EMPLOYEE_TYPES.find(d => d.type === emp.type)!;
                return (
                  <div key={emp.instanceId} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
                    <span className="text-2xl">{def.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground">{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{def.label}</span>
                        <span className="flex items-center gap-0.5">
                          <Star size={9} className="text-amber-400" />
                          {emp.skill}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        emp.status === 'working'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {emp.status === 'working' ? '⚙️ Em obra' : '✓ Disponível'}
                      </span>
                      {emp.status === 'idle' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => flash(onFireEmployee(emp.instanceId))}
                          className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Catálogo para contratar */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              Contratar
            </div>
            {EMPLOYEE_TYPES.map((def: EmployeeTypeDef) => {
              const locked = level < def.minLevel;
              return (
                <div
                  key={def.type}
                  className={`ios-surface rounded-[12px] p-3 flex items-center gap-3 ${locked ? 'opacity-50' : ''}`}
                >
                  <span className="text-2xl">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">{def.label}</span>
                      {locked && (
                        <span className="text-[9px] text-muted-foreground border border-border rounded px-1">
                          Nv {def.minLevel}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{def.description}</div>
                    <div className="text-[10px] text-primary font-semibold mt-0.5">
                      {fmt(def.hiringCost)} · {fmt(def.custoBase)}/min em obra
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={locked || gameState.money < def.hiringCost}
                    onClick={() => flash(onHireEmployee(def.type))}
                    className="shrink-0 gap-1 text-[12px]"
                  >
                    <Plus size={12} />
                    Contratar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MÁQUINAS ──────────────────────────────────────── */}
      {tab === 'maquinas' && (
        <div className="space-y-3">
          {/* Frota atual */}
          {gameState.machines.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                Meu Maquinário ({gameState.machines.length})
              </div>
              {gameState.machines.map(mach => (
                <div key={mach.instanceId} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
                  <span className="text-2xl">{mach.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground">{mach.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {mach.category} · {fmt(mach.costPerMin)}/min
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      mach.status === 'working'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {mach.status === 'working' ? '⚙️ Em obra' : '✓ Livre'}
                    </span>
                    {mach.status === 'idle' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => flash(onSellMachine(mach.instanceId))}
                        className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Catálogo para comprar */}
          {(['terraplanagem', 'estrutura', 'logistica', 'concretagem'] as const).map(cat => {
            const catMachines = MACHINE_CATALOG.filter(m => m.category === cat);
            const catLabel = { terraplanagem: '🚜 Terraplanagem', estrutura: '🏗️ Estrutura', logistica: '🚛 Logística', concretagem: '🪣 Concretagem' }[cat];
            return (
              <div key={cat} className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                  {catLabel}
                </div>
                {catMachines.map((def: MachineTypeDef) => {
                  const locked = level < def.minLevel;
                  return (
                    <div
                      key={def.typeId}
                      className={`ios-surface rounded-[12px] p-3 flex items-center gap-3 ${locked ? 'opacity-50' : ''}`}
                    >
                      <span className="text-2xl">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-foreground">{def.name}</span>
                          {locked && (
                            <span className="text-[9px] text-muted-foreground border border-border rounded px-1">
                              Nv {def.minLevel}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{def.description}</div>
                        <div className="text-[10px] text-primary font-semibold mt-0.5">
                          Compra {fmt(def.purchasePrice)} · Op. {fmt(def.costPerMin)}/min
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={locked || gameState.money < def.purchasePrice}
                        onClick={() => flash(onBuyMachine(def.typeId))}
                        className="shrink-0 gap-1 text-[12px]"
                      >
                        <Plus size={12} />
                        Comprar
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
