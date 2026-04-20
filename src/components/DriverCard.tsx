import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketplaceItem } from '@/types/game';
import { cn } from '@/lib/utils';

interface DriverCardProps {
  driver: MarketplaceItem;
  onHire: (driver: MarketplaceItem) => void;
  canAfford: boolean;
  isUnlocked: boolean;
  isOwned: boolean;
  money: number;
}

export const DriverCard: React.FC<DriverCardProps> = ({
  driver,
  onHire,
  canAfford,
  isUnlocked,
  isOwned,
  money
}) => {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className={cn(
      "game-card p-4 transition-all duration-300 hover:scale-105 font-game-ui",
      !isUnlocked ? 'opacity-50' : '',
      isOwned ? 'glow-primary border-primary' : 'hover:glow-secondary'
    )}>
      <div className="flex gap-4">
        {/* Photo */}
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
          {driver.photo && driver.photo.startsWith('/') ? (
            <img 
              src={driver.photo} 
              alt={driver.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            driver.photo || '👤'
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-game-title text-lg font-bold text-secondary">{driver.name}</h3>
              <div className="text-sm text-muted-foreground font-game-ui">
                {formatMoney(driver.specs.dailyWage)}/dia
              </div>
            </div>
            <div className="text-right ml-2">
              <div className="font-game-title font-bold text-lg text-green-500">{formatMoney(driver.price)}</div>
              {!isUnlocked && driver.unlockRequirement && (
                <div className="text-xs text-warning">
                  Desbloqueado com {formatMoney(driver.unlockRequirement)}
                </div>
              )}
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            {driver.description}
          </p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {driver.vehicles && (
              <Badge variant="outline" className="text-xs">
                🚗 {driver.vehicles.join(', ')}
              </Badge>
            )}
            {driver.trait && (
              <Badge variant="secondary" className="text-xs">
                ⭐ {driver.trait}
              </Badge>
            )}
            {driver.specs.repairDiscount > 0 && (
              <Badge variant="outline" className="text-xs text-success">
                🔧 {(driver.specs.repairDiscount * 100)}% desconto
              </Badge>
            )}
            {driver.specs.repairDiscount < 0 && (
              <Badge variant="outline" className="text-xs text-destructive">
                ⚠️ {Math.abs(driver.specs.repairDiscount * 100)}% prejuízo
              </Badge>
            )}
          </div>
          
          {/* Action Button */}
          <Button 
            onClick={() => onHire(driver)}
            disabled={!isUnlocked || !canAfford || isOwned}
            variant={canAfford && isUnlocked && !isOwned ? "default" : "outline"}
            className="w-full text-sm"
            size="sm"
          >
            {isOwned ? '✓ Contratado' : 
             !isUnlocked ? '💰 Saldo Insuficiente' :
             !canAfford ? '💰 Sem grana' : 
             'Contratar'}
          </Button>
        </div>
      </div>
    </Card>
  );
};