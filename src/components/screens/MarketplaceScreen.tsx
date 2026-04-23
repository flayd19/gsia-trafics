import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DriverCard } from '@/components/DriverCard';
import { VehicleMarketCard } from '@/components/VehicleMarketCard';
import { GameState, MarketplaceItem } from '@/types/game';
import { ensureReputation, meetsLevelRequirement } from '@/lib/reputation';

interface MarketplaceScreenProps {
  gameState: GameState;
  marketplaceVehicles: MarketplaceItem[];
  marketplaceDrivers: MarketplaceItem[];
  onBuyVehicle: (item: MarketplaceItem) => boolean;
  onHireDriver: (item: MarketplaceItem) => boolean;
}

export const MarketplaceScreen = ({ 
  gameState, 
  marketplaceVehicles, 
  marketplaceDrivers, 
  onBuyVehicle, 
  onHireDriver
}: MarketplaceScreenProps) => {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const canAfford = (price: number) => {
    const newBalance = gameState.money - price;
    // Permitir cheque especial - verificar limite
    return newBalance >= gameState.overdraftLimit;
  };
  const isUnlocked = (requirement?: number) => true; // Todos os itens sempre disponíveis por dinheiro
  const alreadyOwned = (item: any) => {
    if (item.type === 'driver') {
      return gameState.drivers.some((d: any) => d.id === item.id);
    }
    return false;
  };

  // Nível de reputação atual do jogador (default 1 para saves antigos)
  const currentLevel = ensureReputation(gameState.reputation).level;
  const isLevelLocked = (item: MarketplaceItem) =>
    !meetsLevelRequirement(currentLevel, item.levelRequirement);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Marketplace</h2>
        <p className="text-muted-foreground">Compre veículos e contrate motoristas</p>
        <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-xs font-semibold text-primary">⭐ Seu nível: Nv {currentLevel}</span>
        </div>
      </div>

      <Tabs defaultValue="vehicles" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            🚗 Veículos
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            👨‍💼 Motoristas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="vehicles" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🚗 Veículos Disponíveis
              <span className="text-sm font-normal text-muted-foreground">• Paulo Vitor</span>
            </h3>
            <div className="grid gap-3">
              {marketplaceVehicles.filter(item => item.type === 'vehicle').map((item) => (
                <VehicleMarketCard
                  key={item.id}
                  vehicle={item}
                  onBuy={onBuyVehicle}
                  canAfford={canAfford(item.price)}
                  isUnlocked={isUnlocked(item.unlockRequirement)}
                  money={gameState.money}
                  levelLocked={isLevelLocked(item)}
                  currentLevel={currentLevel}
                />
              ))}
            </div>
          </div>
        </TabsContent>



        <TabsContent value="drivers" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              👨‍💼 Motoristas Disponíveis
            </h3>
            <div className="grid gap-3">
              {marketplaceDrivers.map((item) => (
                <DriverCard
                  key={item.id}
                  driver={item}
                  onHire={onHireDriver}
                  canAfford={canAfford(item.price)}
                  isUnlocked={isUnlocked(item.unlockRequirement)}
                  isOwned={alreadyOwned(item)}
                  money={gameState.money}
                  levelLocked={isLevelLocked(item)}
                  currentLevel={currentLevel}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>


    </div>
  );
};