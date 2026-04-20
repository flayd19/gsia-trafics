import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Package, Warehouse, AlertTriangle } from 'lucide-react';
import { GameState, Product, ProductStats } from '@/types/game';
import { PRODUCT_CATEGORIES } from '@/data/gameData';
import { cn } from '@/lib/utils';

/**
 * Tira de analytics por produto: preço médio de compra/venda e últimos
 * preços. Calcula on-demand a partir de ProductStats acumuladas em
 * gameState.productStats. Estilo iOS/Apple: dense, tabular-nums, valores
 * destacados, rótulos em smallcaps cinza.
 */
const ProductStatsStrip: React.FC<{
  stats?: ProductStats;
  formatMoney: (n: number) => string;
}> = ({ stats, formatMoney }) => {
  const avgBuy =
    stats && stats.totalBought > 0 ? stats.totalSpent / stats.totalBought : 0;
  const avgSell =
    stats && stats.totalSold > 0 ? stats.totalRevenue / stats.totalSold : 0;
  const lastBuy = stats?.lastPurchasePrice ?? 0;
  const lastSell = stats?.lastSalePrice ?? 0;
  const marginPct =
    avgBuy > 0 && avgSell > 0
      ? ((avgSell - avgBuy) / avgBuy) * 100
      : null;

  const hasAny = lastBuy > 0 || lastSell > 0 || avgBuy > 0 || avgSell > 0;

  if (!hasAny) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5 bg-muted/40 rounded-[8px]">
        sem histórico — compre / venda para ver analytics
      </div>
    );
  }

  const Cell = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value: string;
    accent?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="flex-1 min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
        {label}
      </div>
      <div
        className={cn(
          'text-[12px] font-bold tabular-nums leading-tight truncate',
          accent === 'up' && 'text-success',
          accent === 'down' && 'text-danger',
          (!accent || accent === 'neutral') && 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="mt-3 grid grid-cols-4 gap-2 p-2 rounded-[10px] bg-muted/40 border border-border/50">
      <Cell
        label="Últ. compra"
        value={lastBuy > 0 ? formatMoney(lastBuy) : '—'}
      />
      <Cell
        label="Últ. venda"
        value={lastSell > 0 ? formatMoney(lastSell) : '—'}
      />
      <Cell
        label="Méd. compra"
        value={avgBuy > 0 ? formatMoney(avgBuy) : '—'}
      />
      <Cell
        label="Méd. venda"
        value={
          avgSell > 0
            ? `${formatMoney(avgSell)}${
                marginPct !== null ? ` · ${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(0)}%` : ''
              }`
            : '—'
        }
        accent={marginPct === null ? 'neutral' : marginPct >= 0 ? 'up' : 'down'}
      />
    </div>
  );
};

interface WarehouseScreenProps {
  gameState: any;
  products: any[];
  warehouseOccupation: number;
  warehouses: any[];
  upgradeWarehouse: (warehouseId: string) => boolean;
}

export const WarehouseScreen = ({ gameState, products, warehouseOccupation, warehouses, upgradeWarehouse }: WarehouseScreenProps) => {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'up': return '🔼';
      case 'down': return '🔽';
      default: return '▶️';
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'up': return 'text-success';
      case 'down': return 'text-danger';
      default: return 'text-muted-foreground';
    }
  };

  const stockedProducts = products.filter(product => 
    (gameState.stock[product.id] || 0) > 0
  );

  const totalValue = stockedProducts.reduce((sum, product) => {
    const quantity = gameState.stock[product.id] || 0;
    return sum + (quantity * product.currentPrice);
  }, 0);

  const totalItems = stockedProducts.reduce((sum, product) => {
    return sum + (gameState.stock[product.id] || 0);
  }, 0);

  const availableUpgrades = warehouses.filter(warehouse => 
    !warehouse.owned && gameState.money >= warehouse.unlockRequirement
  );

  const handleUpgrade = (warehouseId: string) => {
    return upgradeWarehouse(warehouseId);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-2">
        <div className="text-2xl sm:text-3xl">📦</div>
        <h2 className="text-xl sm:text-2xl font-bold text-primary">Galpão</h2>
      </div>

      {/* Status do Galpão */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-xl mb-1">📊</div>
            <div className="text-xs text-muted-foreground">Ocupação</div>
            <div className="text-base font-bold">{warehouseOccupation.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xl mb-1">📦</div>
            <div className="text-xs text-muted-foreground">Total de Itens</div>
            <div className="text-base font-bold">{totalItems}</div>
          </div>
          <div className="text-center">
            <div className="text-xl mb-1">🏠</div>
            <div className="text-xs text-muted-foreground">Capacidade</div>
            <div className="text-base font-bold">{gameState.warehouseCapacity}</div>
          </div>
        </div>
      </Card>

      {/* Valor total do estoque */}
      <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="text-2xl">💰</div>
          <div>
            <h3 className="text-lg font-semibold text-green-600">Valor Total do Estoque</h3>
            <p className="text-2xl font-bold">{formatMoney(totalValue)}</p>
          </div>
        </div>
      </div>

      {/* Abas de Categorias */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5 grid-rows-2 h-20 gap-1">
          <TabsTrigger value="all" className="flex items-center justify-center text-sm h-8 px-2">
            📦
          </TabsTrigger>
          {PRODUCT_CATEGORIES.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="flex items-center justify-center text-sm h-8 px-2">
              {category.icon}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Conteúdo das Abas */}
        <TabsContent value="all" className="space-y-3">
          {stockedProducts.length > 0 ? (
            <div className="space-y-3">
              {stockedProducts.map((product) => {
                const quantity = gameState.stock[product.id] || 0;
                const totalProductValue = quantity * product.currentPrice;
                const priceChange = ((product.currentPrice - product.baseStreetPrice) / product.baseStreetPrice) * 100;
                const stats = gameState.productStats?.[product.id] as ProductStats | undefined;

                return (
                  <Card key={product.id} className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Product Icon */}
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">
                        {product.icon || '📦'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{product.displayName}</h4>
                          <span className={`text-lg ${getDirectionColor(product.priceDirection)}`}>
                            {getDirectionIcon(product.priceDirection)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {quantity} unidades • {product.space} espaço/unidade
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Preço: {formatMoney(product.currentPrice)}
                          <span className={priceChange >= 0 ? 'text-success' : 'text-danger'}>
                            {' '}({priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-lg">{formatMoney(totalProductValue)}</div>
                        <div className="text-sm text-muted-foreground">
                          Valor Total
                        </div>
                      </div>
                    </div>
                    <ProductStatsStrip stats={stats} formatMoney={formatMoney} />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <div className="text-4xl mb-4">📦</div>
                <div className="text-lg font-medium mb-2">Galpão Vazio</div>
                <div className="text-sm">Faça viagens para importar produtos</div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Abas por Categoria */}
        {PRODUCT_CATEGORIES.map((category) => {
          const categoryProducts = stockedProducts.filter(product => product.category === category.id);
          
          return (
            <TabsContent key={category.id} value={category.id} className="space-y-3">
              {categoryProducts.length > 0 ? (
                <div className="space-y-3">
                  {categoryProducts.map((product) => {
                    const quantity = gameState.stock[product.id] || 0;
                    const totalProductValue = quantity * product.currentPrice;
                    const priceChange = ((product.currentPrice - product.baseStreetPrice) / product.baseStreetPrice) * 100;
                    const stats = gameState.productStats?.[product.id] as ProductStats | undefined;

                    return (
                      <Card key={product.id} className="p-4">
                        <div className="flex items-center gap-3">
                          {/* Product Icon */}
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">
                            {product.icon || '📦'}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{product.displayName}</h4>
                              <span className={`text-lg ${getDirectionColor(product.priceDirection)}`}>
                                {getDirectionIcon(product.priceDirection)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {quantity} unidades • {product.space} espaço/unidade
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Preço: {formatMoney(product.currentPrice)}
                              <span className={priceChange >= 0 ? 'text-success' : 'text-danger'}>
                                {' '}({priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-lg">{formatMoney(totalProductValue)}</div>
                            <div className="text-sm text-muted-foreground">
                              Valor Total
                            </div>
                          </div>
                        </div>
                        <ProductStatsStrip stats={stats} formatMoney={formatMoney} />
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8">
                  <div className="text-center text-muted-foreground">
                    <div className="text-4xl mb-4">{category.icon}</div>
                    <div className="text-lg font-medium mb-2">Nenhum produto de {category.name}</div>
                    <div className="text-sm">Você não possui produtos da categoria {category.name} em estoque.</div>
                  </div>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Avisos */}
      {warehouseOccupation >= 80 && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="text-center">
            <div className="text-warning font-bold mb-2">⚠️ Galpão Lotando!</div>
            <div className="text-sm text-muted-foreground">
              {warehouseOccupation >= 100 
                ? 'Galpão cheio! Risco de invasão a qualquer momento!'
                : `${warehouseOccupation}% ocupado. Invasão aos 100%.`
              }
            </div>
          </div>
        </Card>
      )}

      {/* Capacidade do Galpão */}
      <Card className="p-4 bg-muted/30">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-2">Capacidade do Galpão</div>
          <div className="w-full bg-border rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                warehouseOccupation >= 100 ? 'bg-danger' :
                warehouseOccupation >= 80 ? 'bg-warning' : 'bg-success'
              }`}
              style={{ width: `${Math.min(warehouseOccupation, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {gameState.warehouseCapacity} unidades máximo
          </div>
        </div>
      </Card>

      {/* Upgrades de Galpão */}
      {availableUpgrades.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Melhorar Galpão</h3>
          <div className="space-y-3">
            {availableUpgrades.map((warehouse) => (
              <Card key={warehouse.id} className="p-4 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{warehouse.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{warehouse.description}</p>
                    <div className="text-xs text-muted-foreground mt-2">
                      Capacidade: {warehouse.capacity} unidades • Custo semanal: {formatMoney(warehouse.weeklyCost)}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold text-foreground mb-2">
                      {formatMoney(warehouse.unlockRequirement)}
                    </div>
                    <Button 
                      onClick={() => handleUpgrade(warehouse.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={gameState.money < warehouse.unlockRequirement}
                    >
                      {gameState.money < warehouse.unlockRequirement ? 'Dinheiro insuficiente' : 'Melhorar Galpão'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};