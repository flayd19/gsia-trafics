// =====================================================================
// OficinaScreen — Oficina de reparos
// =====================================================================
import { useState } from 'react';
import { Wrench, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameState, OwnedCar } from '@/types/game';
import type { RepairType } from '@/types/game';
import { conditionLabel, conditionColor, conditionValueFactor } from '@/data/cars';

interface OficinaScreenProps {
  gameState: GameState;
  repairTypes: RepairType[];
  preSelectedCarId?: string | null;
  onStartRepair: (carInstanceId: string, repairTypeId: string) => { success: boolean; message: string };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function TrendingUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function RepairCard({
  repair,
  car,
  canAfford,
  onStart,
}: {
  repair: RepairType;
  car: OwnedCar;
  canAfford: boolean;
  onStart: () => void;
}) {
  const alreadyDone = (car.completedRepairs ?? []).includes(repair.id);

  const applicable =
    !alreadyDone &&
    (repair.maxCondition === undefined || car.condition < repair.maxCondition) &&
    (repair.minCondition === undefined || car.condition >= repair.minCondition);

  const newCondition = Math.min(100, car.condition + repair.conditionGain);
  const currentValue = car.fipePrice * conditionValueFactor(car.condition);
  const newValue = car.fipePrice * conditionValueFactor(newCondition);
  const valueGain = newValue - currentValue;

  const buttonLabel = () => {
    if (alreadyDone) return 'Já realizado';
    if (car.inRepair) return 'Carro em reparo';
    if (!applicable) return 'Não aplicável';
    if (!canAfford) return 'Sem saldo';
    return 'Iniciar Reparo';
  };

  const isDisabled = alreadyDone || !applicable || !canAfford || car.inRepair;

  return (
    <div className={`ios-surface rounded-[14px] p-4 space-y-3 ${(alreadyDone || !applicable) ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-xl">
            {repair.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[14px] text-foreground">{repair.name}</span>
              {alreadyDone && (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">{repair.description}</div>
          </div>
        </div>
      </div>

      {alreadyDone ? (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded-[10px] px-3 py-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span className="text-[12px] font-semibold text-emerald-600">
            Serviço já realizado neste carro
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="ios-surface-elevated rounded-[10px] p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custo</div>
            <div className="text-[12px] font-bold text-foreground">{fmt(repair.baseCost)}</div>
          </div>
          <div className="ios-surface-elevated rounded-[10px] p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">+Condição</div>
            <div className="text-[12px] font-bold text-emerald-500">+{repair.conditionGain}%</div>
          </div>
          <div className="ios-surface-elevated rounded-[10px] p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Tempo</div>
            <div className="text-[12px] font-bold text-foreground">{repair.durationSec}s</div>
          </div>
        </div>
      )}

      {applicable && !alreadyDone && (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded-[10px] px-3 py-1.5">
          <TrendingUp />
          <span className="text-[12px] font-semibold text-emerald-500">
            +{fmt(valueGain)} no valor de mercado
          </span>
        </div>
      )}

      <Button
        size="sm"
        className="w-full gap-2 text-[13px]"
        disabled={isDisabled}
        onClick={onStart}
        variant={applicable && canAfford && !alreadyDone ? 'default' : 'outline'}
      >
        {alreadyDone ? (
          <>
            <CheckCircle2 size={14} />
            Já realizado
          </>
        ) : (
          <>
            <Wrench size={14} />
            {buttonLabel()}
          </>
        )}
      </Button>
    </div>
  );
}

export function OficinaScreen({ gameState, repairTypes, preSelectedCarId, onStartRepair }: OficinaScreenProps) {
  const carsInGarage = gameState.garage
    .filter(s => s.unlocked && s.car)
    .map(s => s.car!);

  const [selectedCarId, setSelectedCarId] = useState<string | null>(
    preSelectedCarId ?? (carsInGarage.length > 0 ? carsInGarage[0].instanceId : null)
  );

  const selectedCar = carsInGarage.find(c => c.instanceId === selectedCarId);

  const handleStartRepair = (repairTypeId: string) => {
    if (!selectedCar) return;
    onStartRepair(selectedCar.instanceId, repairTypeId);
  };

  // Conta reparos disponíveis para o carro selecionado
  const availableRepairs = selectedCar
    ? repairTypes.filter(r => !(selectedCar.completedRepairs ?? []).includes(r.id)).length
    : 0;
  const totalRepairs = repairTypes.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🔧 Oficina</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Faça reparos para valorizar seus carros
        </p>
      </div>

      {carsInGarage.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">🔧</div>
          <div className="text-[15px] font-semibold text-muted-foreground">Garagem vazia</div>
          <div className="text-[12px] text-muted-foreground">Compre um carro no Marketplace para trazer à oficina</div>
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
                const label = conditionLabel(car.condition);
                const colorClass = conditionColor(car.condition);
                const isSelected = car.instanceId === selectedCarId;
                const done = (car.completedRepairs ?? []).length;

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
                      <div className="text-[11px] text-muted-foreground">
                        {car.year} · {done}/{totalRepairs} reparos feitos
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {car.inRepair && (
                        <Wrench size={12} className="text-primary animate-spin" />
                      )}
                      <span className={`text-[11px] font-bold ${colorClass}`}>{label}</span>
                      <ChevronRight size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel do carro selecionado */}
          {selectedCar && (
            <div className="space-y-4">
              {/* Info do carro */}
              <div className="ios-surface rounded-[16px] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedCar.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{selectedCar.brand} {selectedCar.model}</div>
                    <div className="text-[12px] text-muted-foreground">{selectedCar.trim} · {selectedCar.year}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[11px] font-bold border-current ${conditionColor(selectedCar.condition)}`}
                  >
                    {conditionLabel(selectedCar.condition)} · {selectedCar.condition}%
                  </Badge>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selectedCar.condition}%`,
                      background: selectedCar.condition >= 60
                        ? 'var(--gradient-primary)'
                        : selectedCar.condition >= 35
                        ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }}
                  />
                </div>

                {/* Progresso de reparos */}
         
                <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>Reparos concluídos</span>
                  <span className="font-bold text-foreground">
                    {(selectedCar.completedRepairs ?? []).length}/{totalRepairs}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(((selectedCar.completedRepairs ?? []).length / Math.max(totalRepairs, 1)) * 100)}%`,
                      background: 'var(--gradient-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Reparos disponíveis */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">
                  Reparos disponíveis ({availableRepairs})
                </div>
                <div className="space-y-3">
                  {repairTypes.map(repair => (
                    <RepairCard
                      key={repair.id}
                      repair={repair}
                      car={selectedCar}
                      canAfford={gameState.money >= repair.baseCost}
                      onStart={() => handleStartRepair(repair.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
