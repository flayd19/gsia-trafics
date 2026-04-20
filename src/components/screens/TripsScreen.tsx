import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VehicleCard } from '@/components/VehicleCard';
import { GameState, Product } from '@/types/game';

interface TripsScreenProps {
  gameState: GameState;
  products: Product[];
  payLawyer: (vehicleId: string) => boolean;
  payTowTruck: (vehicleId: string) => boolean;
  payTowTruckForBreakdown: (vehicleId: string) => boolean;
  onAssignDriver: (vehicleId: string, driverId: string) => void;
  onUnassignDriver: (vehicleId: string) => void;
  onSellVehicle: (vehicleId: string) => boolean;
  availableDrivers: any[];
  onForceReset?: (vehicleId: string) => boolean;
  // Sistema de pickups (fornecedores)
  onDispatchPickup?: (vehicleId: string) => boolean;
  calculatePickupCost?: (vehicleId: string) => number;
  computePickupLoadForVehicle?: (vehicleId: string) => {
    totalQty: number;
    maxDistance: number;
  } | null;
}

export const TripsScreen = ({
  gameState,
  products,
  payLawyer,
  payTowTruck,
  payTowTruckForBreakdown,
  onAssignDriver,
  onUnassignDriver,
  onSellVehicle,
  availableDrivers,
  onForceReset,
  onDispatchPickup,
  calculatePickupCost,
  computePickupLoadForVehicle,
}: TripsScreenProps) => {
  const totalPending = (gameState.pendingPickups || []).reduce(
    (s, p) => s + p.quantity,
    0
  );

  const ownedVehicles = gameState.vehicles.filter((v: any) => v.id && !v.sold); // Filtrar veículos válidos e não vendidos

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">🚛 Viagens</h2>
        <p className="text-muted-foreground">
          Gerencie suas viagens e transporte produtos
        </p>
      </div>

      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips">Fazer Viagens</TabsTrigger>
          <TabsTrigger value="fleet">Gerenciar Frota</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trips" className="space-y-4">
          <div className="grid gap-4">
            {/* Banner de pool de pendências */}
            {totalPending > 0 && (
              <Card className="p-3 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📦</div>
                  <div className="flex-1">
                    <div className="font-semibold text-[14px] text-foreground">
                      {totalPending} un. aguardando retirada
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      Despache um veículo pra buscar no fornecedor. Os custos de
                      motorista e gasolina são cobrados na hora do despacho.
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Renderizar veículos */}
            {gameState.vehicles.map((vehicle) => {
              const assignedDriver = gameState.drivers.find((d) => d.id === vehicle.driverId);

              // Calcular dados de pickup pra este veículo
              const pickupLoad = computePickupLoadForVehicle?.(vehicle.id);
              const pickupUnits = pickupLoad?.totalQty ?? 0;
              const pickupCost = calculatePickupCost?.(vehicle.id) ?? 0;

              return (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    driver={assignedDriver}
                    products={products}
                    money={gameState.money}
                    payLawyer={(vehicleId) => payLawyer(vehicleId)}
                    payTowTruck={(vehicleId) => payTowTruck(vehicleId)}
                    payTowTruckForBreakdown={(vehicleId) => payTowTruckForBreakdown(vehicleId)}
                    onForceReset={onForceReset ? (vehicleId) => { onForceReset(vehicleId); } : undefined}
                    pendingPickupsCount={totalPending}
                    pickupCost={pickupCost}
                    pickupUnits={pickupUnits}
                    onDispatchPickup={onDispatchPickup}
                  />
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="fleet" className="space-y-4">
          {ownedVehicles.length > 0 ? (
            <div className="space-y-4">
              {ownedVehicles.map((vehicle) => {
                const assignedDriver = gameState.drivers.find((d) => d.id === vehicle.driverId);
                
                return (
                  <Card key={vehicle.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{vehicle.name}</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Capacidade: {vehicle.capacity} unidades</div>
                            <div className="flex gap-4">
                              <span>🚗 Viagens: {vehicle.tripsCompleted || 0}</span>
                              <span>🚔 Apreensões: {vehicle.seizuresCount || 0}</span>
                              <span>🔧 Estragos: {vehicle.breakdownsCount || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          {assignedDriver ? (
                            <div className="text-success">
                              ✓ {assignedDriver.name}
                            </div>
                          ) : (
                            <div className="text-warning">
                              ⚠️ Sem motorista
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Driver Assignment */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select 
                            value={vehicle.driverId || ''} 
                            onValueChange={(driverId) => {
                              if (driverId) {
                                onAssignDriver(vehicle.id, driverId);
                              }
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Atribuir motorista" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDrivers.map((driver: any) => (
                                <SelectItem key={driver.id} value={driver.id}>
                                  {driver.name} ({driver.experience})
                                </SelectItem>
                              ))}
                              {assignedDriver && (
                                <SelectItem value={assignedDriver.id}>
                                  {assignedDriver.name} (atual)
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {assignedDriver && (
                          <Button
                            onClick={() => onUnassignDriver(vehicle.id)}
                            variant="outline"
                            size="sm"
                          >
                            Remover
                          </Button>
                        )}
                      </div>

                      {/* Botão de Venda */}
                      <div className="flex justify-end">
                        <Button
                          onClick={() => {
                            if (vehicle.active) {
                              alert('Não é possível vender um veículo que está em viagem!');
                              return;
                            }
                            onSellVehicle(vehicle.id);
                          }}
                          variant="destructive"
                          size="sm"
                          disabled={vehicle.active}
                        >
                          💰 Vender Veículo
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                Você ainda não possui veículos.
                <br />
                Vá ao marketplace para comprar seu primeiro veículo!
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};