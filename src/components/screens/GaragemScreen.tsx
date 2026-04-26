// =====================================================================
// GaragemScreen — Garagem com slots progressivos
// =====================================================================
import { useState } from 'react';
import { Lock, Plus, Wrench, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { GameState, OwnedCar, GarageSlot } from '@/types/game';
import { GARAGE_SLOTS, conditionLabel, conditionColor, garageSlotDailyCost, fmtKm } from '@/data/cars';

interface GaragemScreenProps {
  gameState: GameState;
  onUnlockSlot: (slotId: number) => void;
  onGoToOficina: (carInstanceId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function CarCard({ car, slotId, onRepair }: { car: OwnedCar; slotId: number; onRepair: () => void }) {
  const label = conditionLabel(car.condition);
  const colorClass = conditionColor(car.condition);
  const totalCost = car.purchasePrice + (car.totalRepairCost ?? 0);

  return (
    <div className="ios-surface rounded-[16px] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{car.icon}</span>
          <div>
            <div className="font-bold text-foreground text-[15px] leading-tight">
              {car.brand} {car.model}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {car.trim} · {car.year}
              {car.mileage != null && (
                <span className="ml-1.5 text-muted-foreground/70">· {fmtKm(car.mileage)}</span>
              )}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] font-bold border-current ${colorClass}`}
        >
          {label}
        </Badge>
      </div>

      {/* Barra de condição */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-muted-foreground font-medium">Condição</span>
          <span className={`text-[12px] font-bold ${colorClass}`}>{car.condition}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${car.condition}%`,
              background: car.condition >= 60
                ? 'var(--gradient-primary)'
                : car.condition >= 35
                ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                : 'linear-gradient(90deg, #ef4444, #dc2626)',
            }}
          />
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center ios-surface-elevated rounded-[10px] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">FIPE</div>
          <div className="text-[12px] font-bold text-foreground tabular-nums">{fmt(car.fipePrice)}</div>
        </div>
        <div className="text-center ios-surface-elevated rounded-[10px] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Compra</div>
          <div className="text-[12px] font-bold text-foreground tabular-nums">{fmt(car.purchasePrice)}</div>
        </div>
        <div className="text-center ios-surface-elevated rounded-[10px] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custo</div>
          <div className="text-[12px] font-bold tabular-nums text-amber-500">
            {fmt(totalCost)}
          </div>
        </div>
      </div>

      {/* Rachas / aluguel */}
      <div className="flex items-center justify-between text-[11px] px-1">
        <span className="text-muted-foreground">Aluguel vaga {slotId}</span>
        <span className="font-bold text-amber-500">{fmt(garageSlotDailyCost(slotId))}/dia</span>
      </div>

      {/* Rachas vencidos com este carro */}
      {(() => {
        const total  = car.raceHistory?.length ?? 0;
        const wins   = car.raceHistory?.filter(r => r.won).length ?? 0;
        if (total === 0) return null;
        return (
          <div className="flex items-center justify-between bg-muted/30 rounded-[10px] px-3 py-1.5 text-[11px]">
            <span className="text-muted-foreground">🏁 Rachas</span>
            <span className="font-bold">
              <span className="text-emerald-400">{wins}V</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-red-400">{total - wins}D</span>
              <span className="text-muted-foreground ml-1 font-normal">({total} total)</span>
            </span>
          </div>
        );
      })()}

      {/* Status de reparo */}
      {car.inRepair && car.repairCompletesAt && (
        <div className="flex items-center gap-2 bg-primary/10 rounded-[10px] px-3 py-2">
          <Wrench size={13} className="text-primary animate-spin" />
          <span className="text-[12px] font-medium text-primary">
            Em reparo… Pronto em {Math.max(0, Math.ceil((car.repairCompletesAt - Date.now()) / 1000))}s
          </span>
        </div>
      )}

      {/* Botão */}
      {!car.inRepair && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-[13px]"
          onClick={onRepair}
        >
          <Wrench size={14} />
          Levar à Oficina
        </Button>
      )}
    </div>
  );
}

function EmptySlot({ slot, canAfford, onUnlock }: {
  slot: GarageSlot;
  canAfford: boolean;
  onUnlock: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-muted/20 p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]">
      <div className="w-12 h-12 rounded-[14px] bg-muted flex items-center justify-center">
        <Car size={22} className="text-muted-foreground" />
      </div>
      <div className="text-center space-y-0.5">
        <div className="text-[13px] font-semibold text-muted-foreground">Vaga {slot.id}</div>
        <div className="text-[11px] text-muted-foreground">Disponível</div>
      </div>
    </div>
  );
}

function LockedSlot({ slot, canAfford, onUnlock }: {
  slot: { id: number; unlockCost: number };
  canAfford: boolean;
  onUnlock: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-border/50 bg-muted/10 p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]">
      <div className="w-12 h-12 rounded-[14px] bg-muted/50 flex items-center justify-center">
        <Lock size={20} className="text-muted-foreground/60" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-[13px] font-semibold text-muted-foreground">Vaga {slot.id} bloqueada</div>
        <div className="text-[12px] text-muted-foreground">Desbloquear: {fmt(slot.unlockCost)}</div>
        <div className="text-[11px] text-amber-500 font-medium">
          Aluguel: {fmt(garageSlotDailyCost(slot.id))}/dia
        </div>
      </div>
      <Button
        size="sm"
        variant={canAfford ? 'default' : 'outline'}
        disabled={!canAfford}
        className="w-full gap-1.5 text-[12px]"
        onClick={onUnlock}
      >
        <Plus size={13} />
        {canAfford ? 'Desbloquear' : 'Sem saldo'}
      </Button>
    </div>
  );
}

export function GaragemScreen({ gameState, onUnlockSlot, onGoToOficina }: GaragemScreenProps) {
  const [selectedCar, setSelectedCar] = useState<string | null>(null);

  const unlockedSlots = gameState.garage.filter(s => s.unlocked);
  const carsInGarage = unlockedSlots.filter(s => s.car).length;
  const totalValue = unlockedSlots.reduce((sum, s) => {
    if (!s.car) return sum;
    return sum + s.car.purchasePrice + (s.car.totalRepairCost ?? 0);
  }, 0);
  const dailyRentTotal = unlockedSlots
    .filter(s => s.car)
    .reduce((sum, s) => sum + garageSlotDailyCost(s.id), 0);

  // Próximos slots a desbloquear (até 3 a mais)
  const lockedSlots = GARAGE_SLOTS.filter(def =>
    !gameState.garage.some(s => s.id === def.id && s.unlocked)
  ).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-game-title text-xl font-bold text-foreground tracking-tight">🚗 Garagem</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {carsInGarage} de {unlockedSlots.length} vagas ocupadas
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="ios-surface rounded-[14px] p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Carros</div>
          <div className="font-game-title text-xl font-bold text-foreground">{carsInGarage}</div>
        </div>
        <div className="ios-surface rounded-[14px] p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Valor em estoque</div>
          <div className="font-game-title text-[15px] font-bold text-emerald-500 tabular-nums">{fmt(totalValue)}</div>
        </div>
      </div>

      {/* Custo diário de aluguel */}
      {dailyRentTotal > 0 && (
        <div className="ios-surface rounded-[14px] p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-foreground">Aluguel diário total</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Cobrado a cada dia do jogo por vaga ocupada
            </div>
          </div>
          <div className="font-bold text-amber-500 tabular-nums text-[14px]">
            {fmt(dailyRentTotal)}/dia
          </div>
        </div>
      )}

      {/* Slots ocupados */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-3">
          Seus Carros
        </div>
        <div className="space-y-3">
          {unlockedSlots.map(slot => {
            if (slot.car) {
              return (
                <CarCard
                  key={slot.id}
                  car={slot.car}
                  slotId={slot.id}
                  onRepair={() => onGoToOficina(slot.car!.instanceId)}
                />
              );
            }
            return (
              <EmptySlot
                key={slot.id}
                slot={slot}
                canAfford={false}
                onUnlock={() => {}}
              />
            );
          })}
        </div>
      </div>

      {/* Slots bloqueados */}
      {lockedSlots.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-3">
            Expandir Garagem
          </div>
          <div className="space-y-3">
            {lockedSlots.map(def => (
              <LockedSlot
                key={def.id}
                slot={def}
                canAfford={gameState.money >= def.unlockCost}
                onUnlock={() => onUnlockSlot(def.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
