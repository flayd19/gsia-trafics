import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketplaceItem } from '@/types/game';
import { getVehicleImage } from '@/utils/vehicleImages';

interface VehicleMarketCardProps {
  vehicle: MarketplaceItem;
  onBuy: (vehicle: MarketplaceItem) => void;
  canAfford: boolean;
  isUnlocked: boolean;
  money: number;
  /** Se está bloqueado por nível de reputação insuficiente. */
  levelLocked?: boolean;
  /** Nível atual do jogador (pra mostrar diferença no badge). */
  currentLevel?: number;
}

export const VehicleMarketCard: React.FC<VehicleMarketCardProps> = ({
  vehicle,
  onBuy,
  canAfford,
  isUnlocked,
  money,
  levelLocked = false,
  currentLevel = 1,
}) => {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getVehicleEmoji = (name: string) => {
    if (name.includes('Monza')) return '🚗';
    if (name.includes('Uno')) return '🚙';
    if (name.includes('Kombi')) return '🚐';
    if (name.includes('Courier')) return '🛻';
    if (name.includes('Van')) return '🚚';
    if (name.includes('Amarok')) return '🛻';
    return '🚗';
  };

  const vehicleImage = getVehicleImage(vehicle.name, 0);

  const requiredLevel = vehicle.levelRequirement ?? 1;
  const effectivelyLocked = levelLocked || !isUnlocked;

  return (
    <Card className={`transition-all duration-200 hover:shadow-md border-0 bg-white ${
      effectivelyLocked ? 'opacity-60' : ''
    }`}>
      <div className="p-0">
        {/* Vehicle Image */}
        <div className="w-full h-48 rounded-t-lg bg-gray-100 flex items-center justify-center overflow-hidden relative">
          {vehicleImage ? (
            <>
              <img 
                src={vehicleImage} 
                alt={vehicle.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  const fallback = img.parentElement?.querySelector('.fallback-emoji') as HTMLElement;
                  if (fallback) {
                    img.style.display = 'none';
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <div className="fallback-emoji absolute inset-0 w-full h-full items-center justify-center text-6xl bg-gray-100 hidden">
                <img 
                  src="/lovable-uploads/honda titan 160 vermelha.jpeg" 
                  alt="Honda Titan 160"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-6xl text-gray-400">${getVehicleEmoji(vehicle.name)}</span>`;
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <span className="text-6xl text-gray-400">{getVehicleEmoji(vehicle.name)}</span>
          )}
          
          {/* Price Badge */}
          <div className="absolute top-2 left-2 bg-white px-2 py-1 rounded shadow-sm">
            <span className="font-bold text-lg text-gray-900">{formatMoney(vehicle.price)}</span>
          </div>
          
          {levelLocked && (
            <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold shadow">
              🔒 Nível {requiredLevel}
            </div>
          )}
          {!levelLocked && !isUnlocked && vehicle.unlockRequirement && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
              💰 Saldo Insuficiente
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-3">
          {/* Title and Seller */}
          <div className="mb-2">
            <h3 className="font-semibold text-lg text-gray-900 leading-tight">{vehicle.name}</h3>
            <p className="text-sm text-gray-600">{vehicle.description}</p>
          </div>
          
          {/* Seller Info */}
          <div className="flex items-center gap-1 mb-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="text-sm text-gray-600">{vehicle.seller || 'Paulo Vitor'}</span>
          </div>
          
          {/* Specs */}
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              📦 {vehicle.specs.capacity} unidades
            </span>
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              ⛽ {formatMoney(vehicle.specs.fuelCost)}/viagem
            </span>
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              ⏱️ {vehicle.specs.tripDuration}s
            </span>
          </div>
          
          {vehicle.condition && (
            <p className="text-xs text-gray-500 mb-3">📋 {vehicle.condition}</p>
          )}
          
          {levelLocked && (
            <div className="text-xs text-orange-600 font-semibold mb-3">
              🔒 Desbloqueia no Nível {requiredLevel} (você está no Nv {currentLevel})
            </div>
          )}
          {!levelLocked && !isUnlocked && vehicle.unlockRequirement && (
            <div className="text-xs text-orange-600 mb-3">
              💰 Desbloqueado com {formatMoney(vehicle.unlockRequirement)}
            </div>
          )}

          {/* Action Button - Facebook style */}
          <Button
            onClick={() => onBuy(vehicle)}
            disabled={effectivelyLocked || !canAfford}
            className={`w-full text-sm font-medium py-2 rounded-md transition-colors ${
              canAfford && !effectivelyLocked
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            variant="ghost"
          >
            {levelLocked ? `🔒 Nível ${requiredLevel} necessário` :
             !isUnlocked ? '💰 Saldo Insuficiente' :
             !canAfford ? '💰 Sem grana' :
             'Comprar agora'}
          </Button>
        </div>
      </div>
    </Card>
  );
};