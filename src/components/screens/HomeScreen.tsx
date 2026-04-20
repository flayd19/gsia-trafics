import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { GameState, Product } from '@/types/game';

interface HomeScreenProps {
  gameState: GameState;
  warehouseOccupation: number;
  products: Product[];
}

export const HomeScreen = ({ gameState, warehouseOccupation, products }: HomeScreenProps) => {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getOccupationColor = (occupation: number) => {
    if (occupation < 60) return 'text-success';
    if (occupation < 80) return 'text-warning';
    return 'text-danger';
  };

  // Calcular métricas para o resumo de operações
  const totalTrips = gameState.vehicles.reduce((sum: number, vehicle: any) => sum + (vehicle.tripsCompleted || 0), 0);
  const totalVehicles = gameState.vehicles.length;
  const totalDrivers = gameState.drivers.length;
  
  // Calcular lucro total real (baseado no histórico de vendas)
  const totalProfit = gameState.productSales?.reduce((sum, sale) => sum + sale.profit, 0) || 0;
  
  // Calcular lucro semanal
  const getWeeklyProfit = () => {
    const currentDay = gameState.gameTime.day;
    const currentWeek = Math.ceil(currentDay / 7);
    const weekStartDay = (currentWeek - 1) * 7 + 1;
    const weekEndDay = currentWeek * 7;
    
    const weeklyProfit = gameState.productSales?.filter(sale => 
      sale.gameDay >= weekStartDay && sale.gameDay <= weekEndDay
    ).reduce((sum, sale) => sum + sale.profit, 0) || 0;
    
    return {
      profit: weeklyProfit,
      weekNumber: currentWeek,
      weekRange: `Dia ${weekStartDay} - ${weekEndDay}`
    };
  };
  
  const weeklyData = getWeeklyProfit();
  
  // Encontrar produto mais vendido (simulado baseado no estoque atual - produtos com menos estoque foram mais vendidos)
  const getMostSoldProduct = () => {
    const stockEntries = Object.entries(gameState.stock as Record<string, number>);
    if (stockEntries.length === 0) return 'Nenhum';
    
    // Produto com menor estoque relativo à capacidade inicial (mais vendido)
    let mostSold = 'Nenhum';
    let maxSales = 0;
    
    stockEntries.forEach(([productId, currentStock]) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        // Estimar vendas baseado na diferença do estoque inicial
        const estimatedSales = Math.max(0, 100 - currentStock); // Assumindo estoque inicial de 100
        if (estimatedSales > maxSales) {
          maxSales = estimatedSales;
          mostSold = product.displayName;
        }
      }
    });
    
    return mostSold;
  };
  
  const mostSoldProduct = getMostSoldProduct();
  const activeVehicles = gameState.vehicles.filter((v: any) => v.active).length;
  const totalStock = Object.values(gameState.stock as Record<string, number>).reduce((sum: number, qty: number) => sum + qty, 0);

  return (
    <div className="space-y-6">
      {/* Aviso de galpão lotando */}
      {warehouseOccupation >= 80 && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="text-center">
            <div className="text-warning font-bold mb-2">📦 Galpão Lotando</div>
            <div className="text-sm text-muted-foreground">
              Galpão {warehouseOccupation}% ocupado. Considere fazer vendas.
            </div>
          </div>
        </Card>
      )}

      {/* Resumo da operação */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Resumo da Operação</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">🚛 Viagens Realizadas:</span>
            <span className="font-medium">{totalTrips}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">📦 Produto Mais Vendido:</span>
            <span className="font-medium">{mostSoldProduct}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">📊 Lucro Semanal ({weeklyData.weekRange}):</span>
            <span className="font-medium text-success">{formatMoney(weeklyData.profit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">💰 Lucro Total:</span>
            <span className="font-medium text-green-600">{formatMoney(totalProfit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">🚗 Carros:</span>
            <span className="font-medium">{totalVehicles}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">👨‍💼 Motoristas:</span>
            <span className="font-medium">{totalDrivers}</span>
          </div>
        </div>
      </Card>




    </div>
  );
};