// =====================================================================
// OficinaScreen — Diagnóstico + reparos por atributo
// =====================================================================
import { useState, useEffect } from 'react';
import { Wrench, Stethoscope, ChevronRight, AlertTriangle } from 'lucide-react';
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

/** Card do reparo recomendado após diagnóstico */
function DiagnosisRepairCard({
  diagnosis, repairTypes, car, money, onStart, onDiagnoseAgain,
}: {
  diagnosis:      DiagnosisResult;
  repairTypes:    RepairType[];
  car:            OwnedCar;
  money:          number;
  onStart:        (id: string) => void;
  onDiagnoseAgain: () => void;
}) {
  const repair  = repairTypes.find(r => r.id === diagnosis.repairTypeId);
  const attrVal = car.attributes ? car.attributes[diagnosis.attribute] : car.condition;
  const cost    = repair ? calcRepairCost(repair.baseCost, attrVal) : 0;
  const canAfford = money >= cost;

  return (
    <div className="space-y-3">
      {/* Alerta de diagnóstico */}
      <div className="flex items-center gap-2.5 bg-amber-500/10 rounded-[12px] px-4 py-3">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        <div>
          <div className="text-[12px] font-bold text-amber-600">
            {diagnosis.attributeLabel} crítica — {attrVal}%
          </div>
          <div className="text-[11px] text-muted-foreground">
            Reparo recomendado: {diagnosis.repairIcon} {diagnosis.repairName}
          </div>
        </div>
      </div>

      {/* Card do reparo */}
      {repair && (
        <div className="ios-surface rounded-[14px] p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-xl">
              {repair.icon}
            </div>
            <div>
              <div className="font-bold text-[14px] text-foreground">{repair.name}</div>
              <div className="text-[11px] text-muted-foreground">{repair.description}</div>
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
          <Button
            size="sm"
            className="w-full gap-2 text-[13px]"
            disabled={!canAfford}
            onClick={() => onStart(repair.id)}
          >
            <Wrench size={14} />
            {canAfford ? 'Iniciar Reparo' : 'Sem saldo'}
          </Button>
        </div>
      )}

      {/* Novo diagnóstico */}
      <Button
        size="sm"
        variant="ghost"
        className="w-full text-[12px] text-muted-foreground"
        onClick={onDiagnoseAgain}
      >
        <Stethoscope size={12} className="mr-1.5" />
        Diagnosticar novamente
      </Button>
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
  const [toast, setToast] = useState<string | null>(null);

  const selectedCar = carsInGarage.find(c => c.instanceId === selectedCarId) ?? null;
  const cleaningRepair = repairTypes.find(r => r.isAlwaysAvailable) ?? null;
  const diagnosis: DiagnosisResult | null | undefined = selectedCar?.diagnosisResult;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDiagnose = () => {
    if (!selectedCar) return;
    const res = onRunDiagnosis(selectedCar.instanceId);
    showToast(res.message);
  };

  const handleStartRepair = (repairTypeId: string) => {
    if (!selectedCar) return;
    const res = onStartRepair(selectedCar.instanceId, repairTypeId);
    showToast(res.message);
  };

  return (
    <div className="space-y-5 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-[13px] font-semibold px-4 py-2 rounded-[20px] shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

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

                    {!diagnosis ? (
                      <div className="ios-surface rounded-[14px] p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-[12px] bg-amber-500/10 flex items-center justify-center">
                            <Stethoscope size={20} className="text-amber-500" />
                          </div>
                          <div>
                            <div className="font-bold text-[14px] text-foreground">Diagnóstico Técnico</div>
                            <div className="text-[11px] text-muted-foreground">
                              Identifica o atributo crítico e sugere o reparo ideal
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 text-[13px] border-amber-500/40 text-amber-600"
                          onClick={handleDiagnose}
                        >
                          <Stethoscope size={14} />
                          Executar Diagnóstico
                        </Button>
                      </div>
                    ) : (
                      <DiagnosisRepairCard
                        diagnosis={diagnosis}
                        repairTypes={repairTypes}
                        car={selectedCar}
                        money={gameState.money}
                        onStart={handleStartRepair}
                        onDiagnoseAgain={handleDiagnose}
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
