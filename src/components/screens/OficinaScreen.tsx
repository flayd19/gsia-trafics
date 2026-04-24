// =====================================================================
// OficinaScreen — Diagnóstico + reparos por atributo
// =====================================================================
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Wrench, Stethoscope, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameState, OwnedCar, RepairType, DiagnosisResult, AttributeKey } from '@/types/game';
import { conditionLabel, conditionColor } from '@/data/cars';

// ── Props ────────────────────────────────────────────────────────
interface OficinaScreenProps {
  gameState:        GameState;
  repairTypes:      RepairType[];
  preSelectedCarId?: string | null;
  onStartRepair:    (carInstanceId: string, repairTypeId: string) => { success: boolean; message: string };
  onRunDiagnosis:   (carInstanceId: string) => { success: boolean; message: string; result?: DiagnosisResult };
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const ATTR_LABELS: Record<AttributeKey, string> = {
  body:       'Lataria',
  mechanical: 'Mecânica',
  electrical: 'Elétrica',
  interior:   'Interior',
};

const ATTR_ICONS: Record<AttributeKey, string> = {
  body:       '🎨',
  mechanical: '⚙️',
  electrical: '⚡',
  interior:   '🪑',
};

function calcRepairCost(baseCost: number, attrCondition: number): number {
  let m = 1.0;
  if      (attrCondition < 30) m = 1.25;
  else if (attrCondition < 45) m = 1.20;
  else if (attrCondition < 58) m = 1.05;
  else                         m = 0.85;
  return Math.round(baseCost * m);
}

function attrColor(v: number): string {
  if (v >= 60) return 'text-emerald-500';
  if (v >= 30) return 'text-amber-500';
  return 'text-red-500';
}

function attrBarBg(v: number): string {
  if (v >= 60) return 'linear-gradient(90deg, #10b981, #059669)';
  if (v >= 30) return 'linear-gradient(90deg, #f59e0b, #f97316)';
  return 'linear-gradient(90deg, #ef4444, #dc2626)';
}

// ── Subcomponentes ───────────────────────────────────────────────

/** 4 mini-dots de saúde dos atributos */
function AttributeDots({ car }: { car: OwnedCar }) {
  const a = car.attributes;
  if (!a) return null;
  return (
    <div className="flex gap-1">
      {([a.body, a.mechanical, a.electrical, a.interior] as number[]).map((v, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            v >= 60 ? 'bg-emerald-500' : v >= 30 ? 'bg-amber-500' : 'bg-red-500'
          }`}
        />
      ))}
    </div>
  );
}

/** Barra de um atributo */
function AttrBar({ label, icon, value }: { label: string; icon: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground flex items-center gap-1">
          <span>{icon}</span>
          {label}
        </span>
        <span className={`font-bold ${attrColor(value)}`}>{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: attrBarBg(value) }}
        />
      </div>
    </div>
  );
}

/** Contador regressivo do reparo */
function RepairTimer({ completesAt }: { completesAt: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((completesAt - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((completesAt - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [completesAt]);

  return (
    <div className="flex items-center gap-3 bg-primary/10 rounded-[14px] px-4 py-3">
      <Wrench size={18} className="text-primary animate-spin shrink-0" />
      <div>
        <div className="text-[13px] font-bold text-primary">Reparo em andamento…</div>
        <div className="text-[11px] text-muted-foreground">
          {remaining > 0 ? `Conclui em ${remaining}s` : 'Finalizando…'}
        </div>
      </div>
    </div>
  );
}

/** Lista completa de reparos retornados pelo diagnóstico, agrupados por atributo */
function DiagnosisRepairList({
  results, repairTypes, car, money, onStart, onDiagnoseAgain,
}: {
  results:     DiagnosisResult[];
  repairTypes: RepairType[];
  car:         OwnedCar;
  money:       number;
  onStart:     (id: string) => void;
}) {
  // Agrupa por atributo preservando a ordem body → mechanical → electrical → interior
  const attrOrder: AttributeKey[] = ['body', 'mechanical', 'electrical', 'interior'];
  const groups = attrOrder
    .map(attr => ({
      attr,
      items: results.filter(r => r.attribute === attr),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex items-center gap-2.5 bg-amber-500/10 rounded-[12px] px-4 py-3">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        <div>
          <div className="text-[12px] font-bold text-amber-600">
            {results.length} reparo(s) identificado(s)
          </div>
          <div className="text-[11px] text-muted-foreground">
            {groups.map(g => g.items[0].attributeLabel).join(' · ')}
          </div>
        </div>
      </div>

      {/* Um grupo por atributo */}
      {groups.map(({ attr, items }) => {
        const attrVal = car.attributes ? car.attributes[attr] : car.condition;
        return (
          <div key={attr} className="space-y-2">
            {/* Cabeçalho do atributo */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">{ATTR_ICONS[attr]}</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {ATTR_LABELS[attr]}
              </span>
              <span className="text-[11px] font-bold text-amber-500 ml-auto">{attrVal}%</span>
            </div>

            {/* Cards de reparo */}
            {items.map(diag => {
              const repair    = repairTypes.find(r => r.id === diag.repairTypeId);
              if (!repair) return null;
              const cost      = calcRepairCost(repair.baseCost, attrVal);
              const canAfford = money >= cost;
              const alreadyDone = (car.completedRepairs ?? []).includes(repair.id);
              return (
                <div key={repair.id} className={`ios-surface rounded-[14px] p-4 space-y-3 ${alreadyDone ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[11px] bg-primary/10 flex items-center justify-center text-lg">
                      {repair.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[13px] text-foreground">{repair.name}</div>
                      <div className="text-[10px] text-muted-foreground">{repair.description}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="ios-surface-elevated rounded-[10px] p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custo</div>
                      <div className="text-[12px] font-bold text-foreground">{fmt(cost)}</div>
                    </div>
                    <div className="ios-surface-elevated rounded-[10px] p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Ganho</div>
                      <div className="text-[12px] font-bold text-emerald-500">+5–28%</div>
                    </div>
                    <div className="ios-surface-elevated rounded-[10px] p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Tempo</div>
                      <div className="text-[12px] font-bold text-foreground">{repair.durationSec}s</div>
                    </div>
                  </div>
                  {alreadyDone ? (
                    <div className="text-center text-[11px] text-muted-foreground">Já realizado</div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-2 text-[13px]"
                      disabled={!canAfford}
                      onClick={() => onStart(repair.id)}
                    >
                      <Wrench size={14} />
                      {canAfford ? 'Iniciar Reparo' : 'Sem saldo'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

    </div>
  );
}

// ── Tela principal ───────────────────────────────────────────────
export function OficinaScreen({
  gameState, repairTypes, preSelectedCarId, onStartRepair, onRunDiagnosis,
}: OficinaScreenProps) {
  const carsInGarage = gameState.garage.filter(s => s.unlocked && s.car).map(s => s.car!);

  const [selectedCarId, setSelectedCarId] = useState<string | null>(
    preSelectedCarId ?? (carsInGarage.length > 0 ? carsInGarage[0].instanceId : null)
  );

  // ── Timer de diagnóstico (UI-only, 10 s) ──────────────────────
  const [diagnosingUntil, setDiagnosingUntil] = useState<number | null>(null);
  const [countdown, setCountdown]             = useState(0);

  // Reseta countdown ao trocar de carro
  useEffect(() => {
    setDiagnosingUntil(null);
    setCountdown(0);
  }, [selectedCarId]);

  // Tick do countdown
  useEffect(() => {
    if (diagnosingUntil === null) return;
    const tick = () => {
      const rem = Math.ceil((diagnosingUntil - Date.now()) / 1000);
      if (rem <= 0) { setDiagnosingUntil(null); setCountdown(0); }
      else            setCountdown(rem);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [diagnosingUntil]);

  const isDiagnosing = diagnosingUntil !== null;

  const selectedCar    = carsInGarage.find(c => c.instanceId === selectedCarId) ?? null;
  const cleaningRepair = repairTypes.find(r => r.isAlwaysAvailable) ?? null;
  // undefined = nunca diagnosticado | [] = diagnosticado, nada encontrado | [...] = reparos pendentes
  const diagnosis: DiagnosisResult[] | null | undefined = selectedCar?.diagnosisResult;
  const neverDiagnosed = diagnosis === undefined || diagnosis === null;

  const handleDiagnose = () => {
    if (!selectedCar) return;
    const res = onRunDiagnosis(selectedCar.instanceId);
    if (res.success) {
      setDiagnosingUntil(Date.now() + 10_000);
      setCountdown(10);
      toast.success('Diagnóstico iniciado — R$ 400 debitados.');
    } else {
      toast.error(res.message);
    }
  };

  const handleStartRepair = (repairTypeId: string) => {
    if (!selectedCar) return;
    const res = onStartRepair(selectedCar.instanceId, repairTypeId);
    if (res.success) toast.success(res.message);
    else             toast.error(res.message);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🔧 Oficina</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Diagnostique e repare os atributos do carro
        </p>
      </div>

      {carsInGarage.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">🔧</div>
          <div className="text-[15px] font-semibold text-muted-foreground">Garagem vazia</div>
          <div className="text-[12px] text-muted-foreground">
            Compre um carro no Marketplace para trazer à oficina
          </div>
        </div>
      ) : (
        <>
          {/* Seletor de carro */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
              Selecionar Carro
            </div>
            <div className="space-y-2">
              {carsInGarage.map(car => {
                const isSelected = car.instanceId === selectedCarId;
                return (
                  <button
                    key={car.instanceId}
                    onClick={() => setSelectedCarId(car.instanceId)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[14px] border transition-all text-left ${
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-2xl">{car.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-foreground truncate">
                        {car.brand} {car.model} {car.trim}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{car.year}</span>
                        <AttributeDots car={car} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {car.inRepair && (
                        <Wrench size={12} className="text-primary animate-spin" />
                      )}
                      <span className={`text-[11px] font-bold ${conditionColor(car.condition)}`}>
                        {car.condition}%
                      </span>
                      <ChevronRight
                        size={14}
                        className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel do carro selecionado */}
          {selectedCar && (
            <div className="space-y-4">
              {/* Card de atributos */}
              {selectedCar.attributes && (
                <div className="ios-surface rounded-[16px] p-4 space-y-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-3xl">{selectedCar.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-foreground">
                        {selectedCar.brand} {selectedCar.model}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedCar.trim} · {selectedCar.year}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-bold border-current ${conditionColor(selectedCar.condition)}`}
                    >
                      {conditionLabel(selectedCar.condition)} · {selectedCar.condition}%
                    </Badge>
                  </div>
                  <div className="space-y-2.5 pt-1">
                    <AttrBar
                      label={ATTR_LABELS.body}
                      icon={ATTR_ICONS.body}
                      value={selectedCar.attributes.body}
                    />
                    <AttrBar
                      label={ATTR_LABELS.mechanical}
                      icon={ATTR_ICONS.mechanical}
                      value={selectedCar.attributes.mechanical}
                    />
                    <AttrBar
                      label={ATTR_LABELS.electrical}
                      icon={ATTR_ICONS.electrical}
                      value={selectedCar.attributes.electrical}
                    />
                    <AttrBar
                      label={ATTR_LABELS.interior}
                      icon={ATTR_ICONS.interior}
                      value={selectedCar.attributes.interior}
                    />
                  </div>
                </div>
              )}

              {/* Timer de reparo */}
              {selectedCar.inRepair && selectedCar.repairCompletesAt && (
                <RepairTimer completesAt={selectedCar.repairCompletesAt} />
              )}

              {!selectedCar.inRepair && (
                <>
                  {/* Lavagem — sempre disponível */}
                  {cleaningRepair && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
                        Sempre Disponível
                      </div>
                      <div className="ios-surface rounded-[14px] p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-xl">
                            {cleaningRepair.icon}
                          </div>
                          <div>
                            <div className="font-bold text-[14px] text-foreground">{cleaningRepair.name}</div>
                            <div className="text-[11px] text-muted-foreground">{cleaningRepair.description}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="ios-surface-elevated rounded-[10px] p-2">
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custo</div>
                            <div className="text-[12px] font-bold text-foreground">{fmt(cleaningRepair.baseCost)}</div>
                          </div>
                          <div className="ios-surface-elevated rounded-[10px] p-2">
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Ganho</div>
                            <div className="text-[12px] font-bold text-emerald-500">+5–28%</div>
                          </div>
                          <div className="ios-surface-elevated rounded-[10px] p-2">
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Tempo</div>
                            <div className="text-[12px] font-bold text-foreground">{cleaningRepair.durationSec}s</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-2 text-[13px]"
                          disabled={gameState.money < cleaningRepair.baseCost}
                          onClick={() => handleStartRepair(cleaningRepair.id)}
                        >
                          <Wrench size={14} />
                          {gameState.money < cleaningRepair.baseCost ? 'Sem saldo' : 'Iniciar Lavagem'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Diagnóstico */}
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
                      Diagnóstico
                    </div>

                    {/* Nunca diagnosticado → mostra botão com custo */}
                    {neverDiagnosed && !isDiagnosing && (
                      <div className="ios-surface rounded-[14px] p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-[12px] bg-amber-500/10 flex items-center justify-center">
                            <Stethoscope size={20} className="text-amber-500" />
                          </div>
                          <div>
                            <div className="font-bold text-[14px] text-foreground">Diagnóstico Técnico</div>
                            <div className="text-[11px] text-muted-foreground">
                              Identifica todos os reparos necessários · Uma execução por veículo
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 text-[13px] border-amber-500/40 text-amber-600"
                          disabled={gameState.money < 400}
                          onClick={handleDiagnose}
                        >
                          <Stethoscope size={14} />
                          {gameState.money >= 400 ? 'Executar Diagnóstico — R$ 400' : 'Sem saldo (R$ 400)'}
                        </Button>
                      </div>
                    )}

                    {/* Diagnóstico em andamento — countdown 10 s */}
                    {isDiagnosing && (
                      <div className="ios-surface rounded-[14px] p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[12px] bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Loader2 size={20} className="text-amber-500 animate-spin" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[14px] text-foreground">Analisando veículo…</div>
                            <div className="text-[11px] text-muted-foreground">
                              Verificando lataria, mecânica, elétrica e interior
                            </div>
                          </div>
                          <div className="text-[22px] font-bold text-amber-500 tabular-nums leading-none">
                            {countdown}s
                          </div>
                        </div>
                        {/* Barra de progresso */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-250"
                            style={{ width: `${((10 - countdown) / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Diagnosticado, nenhum reparo necessário */}
                    {!neverDiagnosed && !isDiagnosing && diagnosis!.length === 0 && (
                      <div className="flex items-center gap-2.5 bg-emerald-500/10 rounded-[12px] px-4 py-3">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <div>
                          <div className="text-[12px] font-bold text-emerald-600">Carro em ótimas condições</div>
                          <div className="text-[11px] text-muted-foreground">Nenhum reparo necessário no diagnóstico</div>
                        </div>
                      </div>
                    )}

                    {/* Diagnosticado com reparos pendentes */}
                    {!neverDiagnosed && !isDiagnosing && diagnosis!.length > 0 && (
                      <DiagnosisRepairList
                        results={diagnosis!}
                        repairTypes={repairTypes}
                        car={selectedCar}
                        money={gameState.money}
                        onStart={handleStartRepair}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
