import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Store, StoreProduct, Product, GameState, ProductCategory } from '@/types/game';
import { formatCurrency } from '@/utils/formatters';
import { useStores } from '@/hooks/useStores';
import { useState } from 'react';
import { PRODUCT_CATEGORIES } from '@/data/gameData';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Edit3, ShoppingCart, Lock, Unlock, Check, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface StoresScreenProps {
  gameState: GameState;
  products: Product[];
  stores: Store[];
  onBuyStore: (storeId: string) => boolean;
  onSellStore: (storeId: string) => boolean;
  onDepositProduct: (storeId: string, productId: string, quantity: number) => boolean;
  onDepositMultipleProducts?: (storeId: string, items: { productId: string; quantity: number }[]) => number;
  onStoreSaleComplete: (storeId: string, productId: string, quantity: number, profit: number) => void;
  onRenameStore: (storeId: string, newName: string) => boolean;
}

export const StoresScreen = ({ 
  gameState, 
  products, 
  stores, 
  onBuyStore, 
  onSellStore,
  onDepositProduct,
  onDepositMultipleProducts,
  onStoreSaleComplete,
  onRenameStore
}: StoresScreenProps) => {
  const [currentTab] = useState('stores'); // Indicar que estamos na aba stores
  const salesState = useStores({ 
    stores, 
    products, 
    onStoreSaleComplete,
    gameState: { currentTab } 
  });
  const [editingStoreName, setEditingStoreName] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [depositQuantities, setDepositQuantities] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.displayName || 'Produto';
  };

  const getStoreCapacityUsed = (store: Store) => {
    return store.products.reduce((total, product) => total + product.quantity, 0);
  };

  const getAvailableProductsForStore = (store: Store) => {
    // Filtrar produtos pela categoria da loja
    const storeProducts = products.filter(p => p.category === store.category);
    
    return Object.entries(gameState.stock as Record<string, number>)
      .filter(([productId, quantity]) => {
        const product = storeProducts.find(p => p.id === productId);
        return product && quantity > 0;
      })
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        name: getProductName(productId),
        product: products.find(p => p.id === productId)
      }));
  };

  const getCategoryInfo = (categoryId: string) => {
    return PRODUCT_CATEGORIES.find(cat => cat.id === categoryId) || {
      id: categoryId,
      name: 'Categoria',
      icon: '🏪',
      description: ''
    };
  };

  const handleDepositProduct = (storeId: string, productId: string, quantity: number = 1) => {
    const maxQuantity = Math.min(
      gameState.stock[productId] || 0,
      50 // Máximo 50 por vez
    );
    
    if (maxQuantity >= quantity) {
      return onDepositProduct(storeId, productId, quantity);
    }
    return false;
  };

  const handleBulkDeposit = (storeId: string, productId: string) => {
    const availableQuantity = gameState.stock[productId] || 0;
    const store = stores.find(s => s.id === storeId);
    if (!store) return;
    
    const currentCapacity = getStoreCapacityUsed(store);
    const remainingCapacity = store.maxCapacity - currentCapacity;
    const depositQuantity = Math.min(availableQuantity, remainingCapacity, 10);
    
    if (depositQuantity > 0) {
      handleDepositProduct(storeId, productId, depositQuantity);
    }
  };

  const handleStartRename = (storeId: string, currentName: string) => {
    setEditingStoreName(storeId);
    setNewStoreName(currentName);
  };

  const handleConfirmRename = (storeId: string) => {
    if (newStoreName.trim() && newStoreName.trim() !== '') {
      onRenameStore(storeId, newStoreName.trim());
    }
    setEditingStoreName(null);
    setNewStoreName('');
  };

  const handleCancelRename = () => {
    setEditingStoreName(null);
    setNewStoreName('');
  };

  const getStoreDisplayName = (store: Store) => {
    return store.customName || store.name;
  };

  const openProductSheet = (store: Store) => {
    setSelectedStore(store);
    setDepositQuantities({}); // Reset quantities when opening sheet
    setSelectedProducts(new Set()); // Reset selected products
    setIsProductSheetOpen(true);
  };

  const setProductQuantity = (productId: string, quantity: number) => {
    setDepositQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, quantity)
    }));
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
        // Remove quantity when deselecting
        setDepositQuantities(prevQty => ({
          ...prevQty,
          [productId]: 0
        }));
      } else {
        newSet.add(productId);
        // Set default quantity when selecting
        setDepositQuantities(prevQty => ({
          ...prevQty,
          [productId]: 1
        }));
      }
      return newSet;
    });
  };

  const confirmMultipleDeposits = (storeId: string) => {
    const items = Array.from(selectedProducts)
      .map(productId => ({ productId, quantity: depositQuantities[productId] || 0 }))
      .filter(item => item.quantity > 0);

    if (items.length === 0) return 0;

    if (onDepositMultipleProducts) {
      const added = onDepositMultipleProducts(storeId, items);
      if (added > 0) {
        setSelectedProducts(new Set());
        setDepositQuantities({});
      }
      return added;
    }

    // Fallback para método antigo (uma a uma)
    let successCount = 0;
    selectedProducts.forEach(productId => {
      const quantity = depositQuantities[productId] || 0;
      if (quantity > 0) {
        const success = handleDepositProduct(storeId, productId, quantity);
        if (success) {
          successCount++;
        }
      }
    });
    
    if (successCount > 0) {
      setSelectedProducts(new Set());
      setDepositQuantities({});
    }
    return successCount;
  };

  // Separar lojas compradas e não compradas
  const ownedStores = stores.filter(store => store.owned);
  const availableStores = stores.filter(store => !store.owned);
  
  // Agrupar lojas por categoria
  const groupStoresByCategory = (storeList: Store[]) => {
    const grouped: Record<string, Store[]> = {};
    storeList.forEach(store => {
      if (!grouped[store.category]) {
        grouped[store.category] = [];
      }
      grouped[store.category].push(store);
    });
    return grouped;
  };
  
  const groupedOwnedStores = groupStoresByCategory(ownedStores);
  const groupedAvailableStores = groupStoresByCategory(availableStores);

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-2">
        <div className="text-2xl sm:text-3xl">🏪</div>
        <h2 className="text-xl sm:text-2xl font-bold text-primary">Sistema de Lojas</h2>
      </div>

      {/* MINHAS LOJAS (Sempre no topo) */}
      {Object.keys(groupedOwnedStores).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 p-3 sm:p-4 rounded-lg border border-primary/20 mx-2">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h3 className="text-lg sm:text-xl font-semibold text-primary">Minhas Lojas ({ownedStores.length})</h3>
          </div>
          
          {Object.entries(groupedOwnedStores).map(([categoryId, categoryStores]) => {
            const categoryInfo = getCategoryInfo(categoryId);
            return (
              <div key={categoryId} className="space-y-3 mx-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg sm:text-xl">{categoryInfo.icon}</span>
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold">{categoryInfo.name}</h4>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {categoryStores.map(store => {
                    const capacityUsed = getStoreCapacityUsed(store);
                    const salesProgress = salesState[store.id]?.progress || 0;
                    const isActive = salesState[store.id]?.isActive || false;
                    const availableProducts = getAvailableProductsForStore(store);

                    return (
                      <Card key={store.id} className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                        <CardHeader className="pb-2 px-3 sm:px-4 py-2">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div className="flex-1 min-w-0">
                              {editingStoreName === store.id ? (
                                <div className="flex items-center gap-2 mb-1">
                                  <Input
                                    value={newStoreName}
                                    onChange={(e) => setNewStoreName(e.target.value)}
                                    className="flex-1 h-7"
                                    placeholder="Nome da loja"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmRename(store.id)}
                                    className="h-7 px-2"
                                  >
                                    ✓
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelRename}
                                    className="h-7 px-2"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div className="mb-1">
                                  <CardTitle 
                                    className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors text-sm mb-1"
                                    onClick={() => handleStartRename(store.id, getStoreDisplayName(store))}
                                  >
                                    <span className="truncate">🏪 {getStoreDisplayName(store)}</span>
                                    <Edit3 className="h-3 w-3 opacity-50 flex-shrink-0" />
                                  </CardTitle>
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="secondary" className="text-xs h-5">Nível {store.level}</Badge>
                                    {isActive && <Badge className="bg-green-600 text-xs h-5">Vendendo</Badge>}
                                    {store.isLocked && <Badge variant="destructive" className="text-xs h-5">Bloqueada</Badge>}
                                  </div>
                                </div>
                              )}
                              <p className="text-muted-foreground text-xs truncate">{store.location}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs text-muted-foreground">Capacidade</div>
                              <div className="text-sm font-semibold">{capacityUsed}/{store.maxCapacity}</div>
                            </div>
                          </div>

                          {/* Barra de Progresso de Vendas */}
                          {isActive && (
                            <div className="space-y-1 mt-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Próxima venda</span>
                                <span className="text-primary font-medium">{Math.round(salesProgress)}%</span>
                              </div>
                              <Progress value={salesProgress} className="h-1" />
                            </div>
                          )}
                        </CardHeader>

                        <CardContent className="space-y-2 px-3 sm:px-4 py-2">
                          {/* Produtos na Loja */}
                          {store.products.length > 0 ? (
                            <div className="space-y-1">
                              <h4 className="font-semibold text-xs">Produtos em Estoque:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {store.products.map(storeProduct => (
                                  <div 
                                    key={storeProduct.productId} 
                                    className="flex justify-between items-center p-1.5 bg-background/50 rounded border"
                                  >
                                    <span className="text-xs font-medium truncate flex-1 mr-2">{getProductName(storeProduct.productId)}</span>
                                    <Badge variant="outline" className="text-xs h-4 px-1">{storeProduct.quantity}x</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground py-2">
                              <Package className="h-5 w-5 mx-auto mb-1 opacity-50" />
                              <p className="text-xs">Nenhum produto depositado</p>
                              <p className="text-xs">Categoria: {categoryInfo.name}</p>
                            </div>
                          )}

                          {/* Botão Mobile para Adicionar Produtos - NOVA REGRA: Só se não estiver bloqueada */}
                          {!store.isLocked && capacityUsed < store.maxCapacity && availableProducts.length > 0 && (
                            <Sheet open={isProductSheetOpen && selectedStore?.id === store.id} onOpenChange={setIsProductSheetOpen}>
                              <SheetTrigger asChild>
                                <Button 
                                  className="w-full h-8" 
                                  variant="outline"
                                  onClick={() => openProductSheet(store)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Adicionar Produtos ({availableProducts.length})</span>
                                </Button>
                              </SheetTrigger>
                              <SheetContent side="bottom" className="h-[80vh]">
                                <SheetHeader>
                                  <SheetTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Adicionar a {getStoreDisplayName(store)}
                                  </SheetTitle>
                                  <p className="text-muted-foreground text-sm">
                                    Categoria: {categoryInfo.name} • Espaço: {capacityUsed}/{store.maxCapacity}
                                  </p>
                                </SheetHeader>
                                
                <div className="space-y-3 mt-6 max-h-[50vh] overflow-y-auto">
                  {availableProducts.map(({ productId, quantity, name, product }) => {
                    const selectedQuantity = depositQuantities[productId] || 0;
                    const maxQuantity = Math.min(quantity, store.maxCapacity - capacityUsed);
                    const isSelected = selectedProducts.has(productId);
                    
                    return (
                      <div key={productId} className={`border rounded-lg p-3 space-y-3 transition-colors ${
                        isSelected ? 'bg-primary/5 border-primary/30' : 'bg-background'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProductSelection(productId)}
                            />
                            <div className="text-lg sm:text-2xl">{product?.icon || '📦'}</div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm sm:text-base truncate">{name}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                Disponível: {quantity} | Máx: {maxQuantity}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Seletor de Quantidade - apenas se selecionado */}
                        {isSelected && (
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="text-xs sm:text-sm font-medium min-w-fit">Qtd:</span>
                              <div className="flex items-center gap-1 flex-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProductQuantity(productId, Math.max(0, selectedQuantity - 1))}
                                  disabled={selectedQuantity <= 0}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs"
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  max={maxQuantity}
                                  value={selectedQuantity}
                                  onChange={(e) => {
                                    const value = Math.min(maxQuantity, Math.max(0, parseInt(e.target.value) || 0));
                                    setProductQuantity(productId, value);
                                  }}
                                  className="text-center h-7 sm:h-8 flex-1 text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProductQuantity(productId, Math.min(maxQuantity, selectedQuantity + 1))}
                                  disabled={selectedQuantity >= maxQuantity}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs"
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            
                            {/* Botões de Quantidade Rápida */}
                            <div className="flex gap-1 sm:gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 text-xs py-1 h-7"
                                onClick={() => setProductQuantity(productId, Math.min(maxQuantity, 1))}
                                disabled={maxQuantity < 1}
                              >
                                1
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 text-xs py-1 h-7"
                                onClick={() => setProductQuantity(productId, Math.min(maxQuantity, 5))}
                                disabled={maxQuantity < 5}
                              >
                                5
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1 text-xs py-1 h-7"
                                onClick={() => setProductQuantity(productId, Math.min(maxQuantity, 10))}
                                disabled={maxQuantity < 10}
                              >
                                10
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1 text-xs py-1 h-7"
                                onClick={() => setProductQuantity(productId, maxQuantity)}
                                disabled={maxQuantity <= 0}
                              >
                                MAX
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Botão Principal para Adicionar Produtos Selecionados */}
                {selectedProducts.size > 0 && (
                  <div className="mt-4 p-4 bg-primary/5 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        {selectedProducts.size} produto{selectedProducts.size > 1 ? 's' : ''} selecionado{selectedProducts.size > 1 ? 's' : ''}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProducts(new Set());
                          setDepositQuantities({});
                        }}
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        console.log('🏪 [STORE] Iniciando depósito múltiplo:', {
                          storeId: store.id,
                          selectedProducts: Array.from(selectedProducts),
                          quantities: depositQuantities
                        });
                        const count = confirmMultipleDeposits(store.id);
                        console.log('🏪 [STORE] Produtos adicionados:', count);
                        if (count > 0) {
                          setIsProductSheetOpen(false);
                        }
                      }}
                      disabled={
                        Array.from(selectedProducts).length === 0 ||
                        !Array.from(selectedProducts).some(productId => 
                          (depositQuantities[productId] || 0) > 0
                        )
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar {selectedProducts.size > 1 ? 'Produtos' : 'Produto'} à Loja
                    </Button>
                  </div>
                )}
                              </SheetContent>
                            </Sheet>
                          )}



                          {capacityUsed < store.maxCapacity && availableProducts.length === 0 && !store.isLocked && (
                            <div className="text-center text-muted-foreground py-2 border-2 border-dashed border-muted rounded">
                              <p className="text-xs">
                                Nenhum produto da categoria {categoryInfo.name} no galpão
                              </p>
                            </div>
                          )}

                          {/* Informações da Loja */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                            <div className="text-center">
                              <span className="text-muted-foreground block text-xs">Intervalo</span>
                              <div className="font-semibold text-xs">{store.sellInterval / 1000}s</div>
                            </div>
                            <div className="text-center">
                              <span className="text-muted-foreground block text-xs">Multiplicador</span>
                              <div className="font-semibold text-primary text-xs">{store.profitMultiplier}x</div>
                            </div>
                            <div className="text-center">
                              <span className="text-muted-foreground block text-xs">Lucro</span>
                              <div className="font-semibold text-green-600 text-xs">+{((store.profitMultiplier - 1) * 100).toFixed(0)}%</div>
                            </div>
                          </div>

                          {/* Botão de Venda */}
                          <div className="pt-2 border-t mt-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="w-full"
                                  disabled={capacityUsed > 0}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Vender Loja
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Confirmar Venda da Loja</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-sm text-muted-foreground">
                                    Tem certeza que deseja vender <strong>{getStoreDisplayName(store)}</strong>?
                                  </p>
                                  <div className="bg-muted p-3 rounded-lg">
                                    <div className="text-sm">
                                      <div className="flex justify-between">
                                        <span>Valor pago:</span>
                                        <span className="font-semibold">{formatCurrency(store.purchasePrice)}</span>
                                      </div>
                                      <div className="flex justify-between text-green-600">
                                        <span>Você receberá:</span>
                                        <span className="font-semibold">{formatCurrency(Math.floor(store.purchasePrice / 4))}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {capacityUsed > 0 && (
                                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                      <p className="text-sm text-orange-700">
                                        ⚠️ Você deve remover todos os produtos da loja antes de vendê-la.
                                      </p>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <DialogTrigger asChild>
                                      <Button variant="outline" className="flex-1">
                                        Cancelar
                                      </Button>
                                    </DialogTrigger>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant="destructive" 
                                        className="flex-1"
                                        onClick={() => onSellStore(store.id)}
                                        disabled={capacityUsed > 0}
                                      >
                                        Confirmar Venda
                                      </Button>
                                    </DialogTrigger>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Separador */}
      {Object.keys(groupedOwnedStores).length > 0 && Object.keys(groupedAvailableStores).length > 0 && (
        <Separator />
      )}

      {/* LOJAS DISPONÍVEIS PARA COMPRA */}
      {Object.keys(groupedAvailableStores).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-gradient-to-r from-muted/50 to-muted/20 p-4 rounded-lg border border-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Lojas Disponíveis</h3>
          </div>
          
          {Object.entries(groupedAvailableStores).map(([categoryId, categoryStores]) => {
            const categoryInfo = getCategoryInfo(categoryId);
            return (
              <div key={categoryId} className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <span className="text-xl">{categoryInfo.icon}</span>
                  <div>
                    <h4 className="text-lg font-semibold">{categoryInfo.name}</h4>
                    <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
                  </div>
                </div>
                
                <div className="space-y-3 pl-2">
                  {categoryStores.map(store => (
                    <Card key={store.id} className="border-dashed border-2 border-muted-foreground/30">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-semibold flex items-center gap-2">
                              🏪 {store.name}
                              <Badge variant="outline">Nível {store.level}</Badge>
                            </h5>
                            <p className="text-muted-foreground text-sm">{store.location}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{formatCurrency(store.purchasePrice)}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div>
                            <span className="text-muted-foreground block">Capacidade</span>
                            <div className="font-semibold">{store.maxCapacity} produtos</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Venda a cada</span>
                            <div className="font-semibold">{store.sellInterval / 1000}s</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Multiplicador</span>
                            <div className="font-semibold text-primary">{store.profitMultiplier}x</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Lucro estimado</span>
                            <div className="font-semibold text-green-600">+{((store.profitMultiplier - 1) * 100).toFixed(0)}%</div>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full"
                          onClick={() => onBuyStore(store.id)}
                          disabled={gameState.money < store.purchasePrice}
                        >
                          {gameState.money < store.purchasePrice ? 
                            'Dinheiro insuficiente' : 
                            `Comprar por ${formatCurrency(store.purchasePrice)}`
                          }
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Estado vazio */}
      {stores.filter(store => store.owned).length === 0 && stores.filter(store => !store.owned).length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="text-lg font-semibold mb-2">Sistema de Lojas</h3>
            <p className="text-muted-foreground mb-4">
              Compre lojas especializadas por categoria para vender produtos automaticamente!
            </p>
            <p className="text-sm text-muted-foreground">
              Cada loja vende apenas produtos de sua categoria específica com multiplicadores únicos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};