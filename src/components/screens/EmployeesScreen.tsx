// =====================================================================
// EmployeesScreen — Aba Funcionários
// Catálogo + contratados + configuração do Vendedor
// =====================================================================
import { useMemo, useState } from 'react';
import { Users, Briefcase, CheckCircle2, X, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import type { GameState } from '@/types/game';
import {
  EMPLOYEES_CATALOG,
  totalDailyStaffCost,
  type EmployeeId,
  type EmployeeConfig,
  type HiredEmployee,
  type PricingMode,
} from '@/types/employees';

interface EmployeesScreenProps {
  gameState:               GameState;
  onHireEmployee:          (id: EmployeeId, config?: EmployeeConfig) => { success: boolean; message: string };
  onFireEmployee:          (id: EmployeeId) => { success: boolean; message: string };
  onUpdateEmployeeConfig:  (id: EmployeeId, config: EmployeeConfig) => { success: boolean; message: string };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function EmployeesScreen({
  gameState, onHireEmployee, onFireEmployee, onUpdateEmployeeConfig,
}: EmployeesScreenProps) {
  const employees = gameState.employees ?? [];
  const totalDaily = useMemo(() => totalDailyStaffCost(employees), [employees]);

  const allIds: EmployeeId[] = ['washer', 'seller'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold flex items-center gap-2">
            <Briefcase size={20} className="text-primary" />
            Funcionários
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Contrate equipe para automatizar parte do seu negócio.
          </p>
        </div>
        {employees.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Salário/dia</div>
            <div className="text-[14px] font-bold text-amber-400 tabular-nums">{fmt(totalDaily)}</div>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="ios-surface rounded-[14px] p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contratados</div>
          <div className="text-[14px] font-bold text-foreground">{employees.length}/{allIds.length}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo</div>
          <div className="text-[14px] font-bold text-emerald-400">{fmt(gameState.money)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo/dia</div>
          <div className={`text-[14px] font-bold ${totalDaily > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {fmt(totalDaily)}
          </div>
        </div>
      </div>

      {/* Lista de funcionários */}
      <div className="space-y-2.5">
        {allIds.map(id => {
          const meta = EMPLOYEES_CATALOG[id];
          const hired = employees.find(e => e.id === id);
          return (
            <EmployeeCard
              key={id}
              id={id}
              hired={hired}
              meta={meta}
              onHire={(cfg) => {
                const r = onHireEmployee(id, cfg);
                if (r.success) toast.success(r.message);
                else toast.error(r.message);
              }}
              onFire={() => {
                const r = onFireEmployee(id);
                if (r.success) toast.info(r.message);
                else toast.error(r.message);
              }}
              onUpdate={(cfg) => {
                const r = onUpdateEmployeeConfig(id, cfg);
                if (r.success) toast.success(r.message);
                else toast.error(r.message);
              }}
            />
          );
        })}
      </div>

      {/* Aviso */}
      <div className="text-[11px] text-muted-foreground px-1 italic">
        💡 Salários são cobrados automaticamente a cada novo dia in-game. Funcionários só agem
        quando há trabalho a fazer (carros sem lavagem para o lavador, compradores aguardando
        para o vendedor).
      </div>
    </div>
  );
}

// ── Card de funcionário ──────────────────────────────────────────────
interface EmployeeCardProps {
  id:       EmployeeId;
  meta:     typeof EMPLOYEES_CATALOG[EmployeeId];
  hired?:   HiredEmployee;
  onHire:   (cfg?: EmployeeConfig) => void;
  onFire:   () => void;
  onUpdate: (cfg: EmployeeConfig) => void;
}

function EmployeeCard({ id, meta, hired, onHire, onFire, onUpdate }: EmployeeCardProps) {
  const isHired = !!hired;

  return (
    <div className={`ios-surface rounded-[14px] p-4 space-y-3 ${
      isHired ? 'border border-emerald-500/30 bg-emerald-500/5' : ''
    }`}>
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl shrink-0 ${
          isHired ? 'bg-emerald-500/20' : 'bg-muted'
        }`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-bold text-foreground">{meta.name}</h3>
            {isHired && (
              <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 size={9} /> Ativo
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
            <DollarSign size={11} className="text-amber-400" />
            <span className="text-amber-400 font-semibold">{fmt(meta.dailyCost)}</span>
            <span className="text-muted-foreground">/ dia</span>
          </div>
        </div>
      </div>

      {/* Configuração específica do Vendedor */}
      {isHired && id === 'seller' && (
        <SellerConfig
          config={hired!.config}
          onUpdate={onUpdate}
        />
      )}

      {/* Ações */}
      <div className="flex gap-2">
        {isHired ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onFire}
            className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10 gap-1.5"
          >
            <Trash2 size={13} /> Demitir
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onHire(id === 'seller' ? { pricingMode: 'fipe', pricingPercent: 0 } : {})}
            className="flex-1 gap-1.5"
          >
            <Users size={13} /> Contratar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Configuração do Vendedor ────────────────────────────────────────
function SellerConfig({
  config, onUpdate,
}: {
  config:   EmployeeConfig;
  onUpdate: (cfg: EmployeeConfig) => void;
}) {
  const [mode, setMode]       = useState<PricingMode>(config.pricingMode ?? 'fipe');
  const [percent, setPercent] = useState<number>(config.pricingPercent ?? 0);

  const apply = (newMode?: PricingMode, newPct?: number) => {
    const m = newMode ?? mode;
    const p = newPct  ?? percent;
    setMode(m);
    setPercent(p);
    onUpdate({ pricingMode: m, pricingPercent: p });
  };

  const examplePrice = (fipe: number): string => {
    const sign = mode === 'below' ? -1 : mode === 'above' ? 1 : 0;
    const factor = 1 + sign * (percent / 100);
    return fmt(Math.round(fipe * factor));
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border/40">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Estratégia de preço
        </div>
        <div className="flex gap-1">
          {(['below', 'fipe', 'above'] as PricingMode[]).map(m => (
            <button
              key={m}
              onClick={() => apply(m)}
              className={`flex-1 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all ${
                mode === m
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'ios-surface text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'below' ? 'Abaixo FIPE' : m === 'fipe' ? 'Na FIPE' : 'Acima FIPE'}
            </button>
          ))}
        </div>
      </div>

      {mode !== 'fipe' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Margem
            </span>
            <span className={`text-[12px] font-bold tabular-nums ${
              mode === 'above' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {mode === 'below' ? '−' : '+'}{percent}%
            </span>
          </div>
          <Slider
            value={[percent]}
            onValueChange={([v]) => apply(undefined, v ?? 0)}
            min={0}
            max={50}
            step={1}
            className="w-full"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
          </div>
        </div>
      )}

      {/* Preview de preço para um carro de FIPE 100k */}
      <div className="bg-muted/30 rounded-[10px] p-2 text-[11px] flex items-center justify-between">
        <span className="text-muted-foreground">Exemplo: carro FIPE R$ 100.000</span>
        <span className={`font-mono font-bold ${
          mode === 'above' ? 'text-emerald-400' : mode === 'below' ? 'text-amber-400' : 'text-foreground'
        }`}>
          → {examplePrice(100_000)}
        </span>
      </div>
    </div>
  );
}
