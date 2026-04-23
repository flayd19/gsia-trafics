import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Vehicle, Driver, Product } from '@/types/game';
import { cn } from '@/lib/utils';
import { getVehicleImage } from '@/utils/vehicleImages';
import { isFeatureEnabled } from '@/config/gameFeatures';

// Duração do conserto na oficina (em segundos) — sincronizado com useGameLogic
const REPAIR_DURATION_SEC = 30;


interface VehicleCardProps {
  vehicle: Vehicle;
  driver?: Driver;
  products: Product[];
  money: number;
  payLawyer?: (vehicleId: string) => boolean;
  payTowTruck?: (vehicleId: string) => boolean;
  payTowTruckForBreakdown?: (vehicleId: string) => boolean;
  onForceReset?: (vehicleId: string) => void;
  // Sistema de fornecedores / pickups
  pendingPickupsCount?: number; // total unidades pendentes no pool
  pickupCost?: number; // custo pra despachar este veículo pra retirada
  pickupUnits?: number; // quantas unidades ele vai pegar (até a capacidade)
  onDispatchPickup?: (vehicleId: string) => boolean;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  driver,
  products,
  money,
  payLawyer,
  payTowTruck,
  payTowTruckForBreakdown,
  onForceReset,
  pendingPickupsCount = 0,
  pickupCost = 0,
  pickupUnits = 0,
  onDispatchPickup,
}) => {
  const getVehicleEmoji = (name: string) => {
    if (name.includes('Monza')) return '🚗';
    if (name.includes('Uno')) return '🚙';
    if (name.includes('Kombi')) return '🚐';
    if (name.includes('Courier')) return '🛻';
    if (name.includes('Van')) return '🚚';
    if (name.includes('Amarok')) return '🛻';
    return '🚗';
  };
  const [progress, setProgress] = useState<number>(0);
  const [currentStatusMessage, setCurrentStatusMessage] = useState<string>('');
  const tripStatusMessagesRef = useRef<string[]>([
    "abastecendo no posto lage",
    "passando artulândia",
    "saindo de Goiás",
    "pegando a BR153",
    "parado no siga e pare",
    "desviando pela jalles",
    "cortando o pedágio",
    "despistando os guardas", 
    "relaxando com as do job",
    "trocando pneu",
    "desviando de blitz",
    "parando para almoçar",
    "checando a carga",
    "pegando atalho",
    "evitando radar",
    "ludibriando o praxedes",
    "fumando um paiero",
    "chegando no paraguai",
    "passando sinope",
    "lanchando no gaucho",
    "furando pedágio",
    "tomando dose de 51",
  ]);

  useEffect(() => {
    if (vehicle.active && vehicle.tripStartTime) {
      const updateProgress = () => {
        // Validação de estado: verificar se o veículo ainda está ativo
        if (!vehicle.active || !vehicle.tripStartTime) {
          setProgress(0);
          return;
        }
        
        const now = Date.now();
        const elapsed = (now - vehicle.tripStartTime!) / 1000; // seconds
        const progressPercent = Math.min((elapsed / vehicle.tripDuration) * 100, 100);
        
        // Validação adicional: se progresso >= 100%, parar atualizações
        if (progressPercent >= 100) {
          setProgress(100);
          return;
        }
        
        setProgress(progressPercent);
      };

      updateProgress();
      // Otimizado: reduzir frequência de atualização para 1000ms (1s) para melhor performance
      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [vehicle.active, vehicle.tripStartTime, vehicle.tripDuration]);

  // Update status message randomly during trip, only 4 messages max
  useEffect(() => {
    if (vehicle.active && vehicle.tripStartTime) {
      let shownCount = 0;

      const updateStatusMessage = () => {
        // Validação de estado: verificar se o veículo ainda está ativo
        if (!vehicle.active || !vehicle.tripStartTime) {
          setCurrentStatusMessage('');
          return;
        }
        
        const now = Date.now();
        const elapsed = (now - vehicle.tripStartTime!) / 1000;
        const remaining = vehicle.tripDuration - elapsed;
        
        // Validação: se viagem já terminou, não atualizar mais
        if (remaining <= 0) {
          return;
        }
        
        // Show "chegando em goianésia" in the last 10 seconds
        if (remaining <= 10 && remaining > 0) {
          setCurrentStatusMessage("chegando em goianésia");
          return;
        }
        
        if (shownCount < 4) {
          const msgs = tripStatusMessagesRef.current;
          const randomIndex = Math.floor(Math.random() * msgs.length);
          setCurrentStatusMessage(msgs[randomIndex]);
          shownCount += 1;
        }
        // After 4 messages, keep the last message until "chegando em goianésia"
      };

      updateStatusMessage(); // Set initial message
      const messageInterval = setInterval(updateStatusMessage, 6000); // Change every 6 seconds
      
      return () => clearInterval(messageInterval);
    } else {
      setCurrentStatusMessage('');
    }
  }, [vehicle.active, vehicle.tripStartTime, vehicle.tripDuration]);



  const currentProduct = vehicle.productId ? 
    products.find(p => p.id === vehicle.productId) : null;

  const vehicleImage = getVehicleImage(vehicle.name, 0);

  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Atualizar tempo restante de forma otimizada
  useEffect(() => {
    if (vehicle.active && vehicle.tripStartTime) {
      const updateRemainingTime = () => {
        const remaining = Math.max(0, vehicle.tripDuration - (Date.now() - vehicle.tripStartTime!) / 1000);
        setRemainingTime(remaining);
      };
      
      updateRemainingTime();
      const interval = setInterval(updateRemainingTime, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingTime(0);
    }
  }, [vehicle.active, vehicle.tripStartTime, vehicle.tripDuration]);

  // Limpar progresso quando veículo não está ativo
  useEffect(() => {
    if (!vehicle.active) {
      setProgress(0);
      setCurrentStatusMessage('');
      setRemainingTime(0);
    }
  }, [vehicle.active]);

  // ================================================================
  // Timer da oficina (veículo quebrado sendo consertado)
  // ================================================================
  const [repairRemaining, setRepairRemaining] = useState<number>(0);
  const [repairProgress, setRepairProgress] = useState<number>(0);

  useEffect(() => {
    const isRepairing =
      !!vehicle.broken &&
      !!vehicle.towTruckPaidForBreakdown &&
      !!vehicle.repairStartTime;

    if (!isRepairing) {
      setRepairRemaining(0);
      setRepairProgress(0);
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - (vehicle.repairStartTime as number)) / 1000;
      const remaining = Math.max(0, REPAIR_DURATION_SEC - elapsed);
      const pct = Math.min(100, (elapsed / REPAIR_DURATION_SEC) * 100);
      setRepairRemaining(remaining);
      setRepairProgress(pct);
    };

    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [vehicle.broken, vehicle.towTruckPaidForBreakdown, vehicle.repairStartTime]);

  const formatRepairTime = (sec: number) => {
    if (sec <= 0) return '0s';
    const s = Math.ceil(sec);
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${m}m ${rem.toString().padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  const canDispatchPickup =
    !vehicle.active &&
    !vehicle.seized &&
    !vehicle.broken &&
    pendingPickupsCount > 0 &&
    pickupUnits > 0 &&
    !!onDispatchPickup;

  return (
    <Card
      className={cn(
        "game-card p-4 transition-all duration-300 font-game-ui",
        vehicle.seized ? "border-destructive bg-destructive/5 glow-destructive" :
        vehicle.active ? "glow-primary border-primary" : ""
      )}
    >
          <div className="flex items-center gap-4">
            <div className="relative">
              {vehicle.active ? (
                <div className="relative w-20 h-20">
                  <CircularProgress 
                    progress={progress} 
                    size={80}
                    strokeWidth={6}
                    color="hsl(var(--success))"
                  />
                  <div className="absolute inset-2 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                    {vehicleImage ? (
                      <img 
                        src={vehicleImage} 
                        alt={vehicle.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-lg">{getVehicleEmoji(vehicle.name)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {vehicleImage ? (
                    <img 
                      src={vehicleImage} 
                      alt={vehicle.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-2xl">{getVehicleEmoji(vehicle.name)}</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-game-title text-lg font-bold text-primary">{vehicle.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground font-game-ui">
                  {driver ? driver.name : 'Sem motorista'}
                </p>
              </div>
              
              {vehicle.active ? (
                <div className="mt-2 space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Transportando:</span>{' '}
                    <span className="font-medium">
                      {vehicle.quantity} {currentProduct?.displayName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.ceil(remainingTime)}s restantes
                  </div>
                  {currentStatusMessage && (
                    <div className="text-xs text-success italic animate-fade-in p-1 rounded bg-success/10">
                      📍 {currentStatusMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  Capacidade: {vehicle.capacity} unidades
                </div>
              )}
            </div>
            
            <div className="text-right">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="text-sm text-muted-foreground font-game-ui text-center">Status</div>
                {vehicle.active && onForceReset && (
                  <button
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Tem certeza que deseja forçar o reset do veículo ${vehicle.name}?\n\nEsta ação irá:\n• Cancelar a viagem atual\n• Resetar o status do veículo\n• Torná-lo disponível novamente\n\nEsta ação não pode ser desfeita.`
                      );
                      if (confirmed) {
                        onForceReset(vehicle.id);
                      }
                    }}
                    className="text-orange-500 hover:text-orange-600 transition-colors p-1 rounded hover:bg-orange-50"
                    title="Forçar reset do veículo"
                  >
                    ⚠️
                  </button>
                )}
              </div>
              <div className={cn(
                "inline-flex items-center px-3 py-1 rounded-full border-2 font-game-title font-bold text-xs",
                (vehicle.seized && isFeatureEnabled('POLICE_SEIZURE_ENABLED')) ? "bg-red-500 border-red-600 text-white" : 
                (vehicle.broken && isFeatureEnabled('VEHICLE_BREAKDOWN_ENABLED')) ? "bg-orange-500 border-orange-600 text-white" : 
                vehicle.active ? "bg-yellow-500 border-yellow-600 text-black" : 
                "bg-green-500 border-green-600 text-white"
              )}>
                {(vehicle.seized && isFeatureEnabled('POLICE_SEIZURE_ENABLED')) ? '🚔 APREENDIDO' :
                 (vehicle.broken && isFeatureEnabled('VEHICLE_BREAKDOWN_ENABLED')) ? '🔧 ESTRAGADO' :
                 vehicle.active ? '🚛 VIAJANDO' : '✅ DISPONÍVEL'}
              </div>
            </div>
          </div>

          {/* Buscar Pendentes (fornecedores) */}
          {canDispatchPickup && (
            <div
              className="mt-3 pt-3 border-t border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Mercadoria pendente
                  </div>
                  <div className="text-[13px] font-semibold text-foreground tabular-nums">
                    {pickupUnits}/{vehicle.capacity} un · R${' '}
                    {pickupCost.toLocaleString('pt-BR')} de viagem
                  </div>
                  {pendingPickupsCount > pickupUnits && (
                    <div className="text-[11px] text-muted-foreground">
                      +{pendingPickupsCount - pickupUnits} sobrando no pool
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDispatchPickup?.(vehicle.id)}
                  disabled={money - pickupCost < -30000}
                  className="h-9 px-3 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-bold shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚛 Buscar
                </button>
              </div>
            </div>
          )}

          {!vehicle.active && pendingPickupsCount === 0 && !vehicle.seized && !vehicle.broken && (
            <div className="mt-3 pt-3 border-t border-border text-center">
              <div className="text-[11px] text-muted-foreground">
                Nenhuma mercadoria pendente. Compre nos Fornecedores.
              </div>
            </div>
          )}

          {/* Veículo apreendido: fluxo advogado → guincho */}
          {vehicle.seized && isFeatureEnabled('POLICE_SEIZURE_ENABLED') && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {!vehicle.lawyerPaid ? (
                <>
                  <div className="text-[11px] text-muted-foreground">
                    Pague <strong className="text-primary">R$ 4.000</strong> pro advogado liberar o veículo.
                  </div>
                  <button
                    onClick={() => payLawyer?.(vehicle.id)}
                    disabled={money - 4000 < -30000}
                    className="w-full h-9 px-3 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-bold shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💼 Pagar Advogado (R$ 4.000)
                  </button>
                </>
              ) : !vehicle.towTruckPaid ? (
                <>
                  <div className="text-[11px] text-muted-foreground">
                    Pague <strong className="text-primary">R$ 800</strong> pro guincho buscar o veículo.
                  </div>
                  <button
                    onClick={() => payTowTruck?.(vehicle.id)}
                    disabled={money - 800 < -30000}
                    className="w-full h-9 px-3 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-bold shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🚛 Pagar Guincho (R$ 800)
                  </button>
                </>
              ) : (
                <div className="text-[11px] text-muted-foreground text-center">
                  Guincho a caminho…
                </div>
              )}
            </div>
          )}

          {/* Veículo estragado: pagar guincho pra oficina */}
          {vehicle.broken && isFeatureEnabled('VEHICLE_BREAKDOWN_ENABLED') && !vehicle.seized && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {!vehicle.towTruckPaidForBreakdown ? (
                <>
                  <div className="text-[11px] text-muted-foreground">
                    Pague <strong className="text-primary">R$ 800</strong> pro guincho levar pra oficina.
                  </div>
                  <button
                    onClick={() => payTowTruckForBreakdown?.(vehicle.id)}
                    disabled={money - 800 < -30000}
                    className="w-full h-9 px-3 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-bold shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔧 Pagar Guincho (R$ 800)
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🔧</span>
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Oficina — Revisa Autocenter
                      </span>
                    </div>
                    <div className="tabular-nums font-game-title text-[13px] font-bold text-orange-500">
                      {formatRepairTime(repairRemaining)}
                    </div>
                  </div>

                  {/* Barra de progresso do conserto */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-[width] duration-500 ease-linear"
                      style={{ width: `${repairProgress}%` }}
                    />
                  </div>

                  <div className="text-[10px] text-muted-foreground text-center">
                    {repairRemaining > 0
                      ? 'Mecânico consertando o veículo…'
                      : 'Conserto concluído! Liberando veículo…'}
                  </div>
                </div>
              )}
            </div>
          )}
    </Card>
);
};