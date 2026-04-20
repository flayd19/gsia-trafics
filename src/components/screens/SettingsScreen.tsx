import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { PRODUCTS } from '@/data/gameData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SettingsScreenProps {
  gameState: any;
  operationalCosts?: {
    warehouseCost: number;
    driverCosts: number;
    totalWeekly: number;
  };
  onSaveGame: () => Promise<void>;
  onResetGame: () => Promise<void>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  gameState,
  operationalCosts,
  onSaveGame,
  onResetGame,
}) => {
  const { user } = useAuth();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSaveGame = async () => {
    try {
      await onSaveGame();
      // Toast de sucesso removido
    } catch (error) {
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar o progresso.",
        variant: "destructive"
      });
    }
  };

  const handleResetGame = async () => {
    try {
      await onResetGame();
      // Toast de sucesso removido
    } catch (error) {
      toast({
        title: "Erro ao Resetar",
        description: "Não foi possível resetar o progresso.",
        variant: "destructive"
      });
    }
  };

  // Handlers legados de conserto manual removidos. As causas raiz foram
  // corrigidas com invariantes em useGameLogic (loja travada, motoristas
  // órfãos, drip de compradores atômico).





  const getTotalValue = () => {
    // Calcular valor do estoque baseado nos preços atuais dos produtos (MESMA LÓGICA DO RANKING)
    const stockValue = Object.entries(gameState.stock).reduce((total: number, [productId, quantity]) => {
      const product = PRODUCTS.find(p => p.id === productId);
      if (product && (quantity as number) > 0) {
        return total + (quantity as number) * product.currentPrice;
      }
      return total + (quantity as number) * 100; // Fallback se produto não encontrado
    }, 0);
    
    // Calcular valor dos veículos baseado nos preços do marketplace
    const vehicleValue = gameState.vehicles.reduce((total: number, vehicle: any) => {
      return total + (vehicle.price || 25000); // Usar preço do veículo ou fallback
    }, 0);
    
    // Calcular valor das lojas compradas
    const storeValue = (gameState as any).stores?.reduce((total: number, store: any) => {
      if (store.owned && store.purchasePrice) {
        return total + store.purchasePrice;
      }
      return total;
    }, 0) || 0;
    
    const total = gameState.money + vehicleValue + stockValue + storeValue;
    
    // Debug logs para comparar com ranking
    console.log('💰 [SETTINGS] Calculado:', {
      saldo: gameState.money,
      estoque: stockValue,
      veiculos: vehicleValue,
      lojas: storeValue,
      total: total
    });
    
    return total;
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      // Deletar todos os dados do usuário das tabelas
      await Promise.all([
        supabase.from('game_progress').delete().eq('user_id', user.id),
        supabase.from('player_profiles').delete().eq('user_id', user.id),
        supabase.from('player_ranking').delete().eq('user_id', user.id),
        supabase.from('game_backups').delete().eq('user_id', user.id),
        supabase.from('activity_logs').delete().eq('user_id', user.id),
        supabase.from('simple_game_progress').delete().eq('user_id', user.id),
        supabase.from('centralized_game_progress').delete().eq('user_id', user.id)
      ]);

      toast({
        title: "Dados Deletados",
        description: "Todos os seus dados foram removidos e você foi desconectado.",
      });

      // Fazer logout
      await supabase.auth.signOut();
      
    } catch (error) {
      console.error('Erro ao deletar dados:', error);
      toast({
        title: "Erro ao Deletar Dados",
        description: "Não foi possível deletar todos os dados. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Configurações do Jogo</h2>
        <p className="text-muted-foreground">
          Gerencie seu progresso e configurações
        </p>
      </div>

      {/* Resumo do Progresso */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Resumo do Progresso</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dinheiro:</span>
              <span className="font-medium">{formatMoney(gameState.money)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Veículos:</span>
              <span className="font-medium">{gameState.vehicles.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Motoristas:</span>
              <span className="font-medium">{gameState.drivers.length}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Total:</span>
              <span className="font-medium text-success">{formatMoney(getTotalValue())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Galpão:</span>
              <span className="font-medium">{gameState.warehouseCapacity} unidades</span>
            </div>
          </div>
        </div>
      </Card>



      {/* Controles do Jogo */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🎮 Controles do Jogo</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Salvar Progresso</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Salve manualmente seu progresso no banco de dados. O jogo salva automaticamente a cada 5 minutos quando você está logado.
            </p>
            <Button onClick={handleSaveGame} className="w-full">
              💾 Salvar Jogo Agora
            </Button>
          </div>

          <Separator />



          <div>
            <h4 className="font-medium mb-2 text-destructive">Resetar Jogo</h4>
            <p className="text-sm text-muted-foreground mb-3">
              ⚠️ Isso irá apagar todo seu progresso e recomeçar do zero. Esta ação não pode ser desfeita.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  🗑️ Resetar Jogo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá apagar permanentemente todo seu progresso, incluindo:
                    <br />• Dinheiro ({formatMoney(gameState.money)})
                    <br />• {gameState.vehicles.length} veículos
                    <br />• {gameState.drivers.length} motoristas
                    <br />• Todo o estoque
                    <br /><br />
                    <strong>Esta ação não pode ser desfeita!</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetGame}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, Resetar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2 text-destructive">Deletar Conta</h4>
            <p className="text-sm text-muted-foreground mb-3">
              ⚠️ Isso irá deletar permanentemente sua conta e TODOS os dados associados. Esta ação não pode ser desfeita.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  🗑️ Deletar Conta Permanentemente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ DELETAR CONTA PERMANENTEMENTE</AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="space-y-3">
                      <p className="text-destructive font-medium">
                        ATENÇÃO: Esta ação é IRREVERSÍVEL!
                      </p>
                      <p>
                        Ao deletar sua conta, você perderá permanentemente:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Todo seu progresso no jogo</li>
                        <li>Dinheiro ({formatMoney(gameState.money)})</li>
                        <li>{gameState.vehicles.length} veículos</li>
                        <li>{gameState.drivers.length} motoristas</li>
                        <li>Todo o estoque e lojas</li>
                        <li>Posição no ranking</li>
                        <li>Histórico e backups</li>
                        <li>Sua conta de usuário</li>
                      </ul>
                      <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium mb-2">
                          Para confirmar, digite: <code className="bg-muted px-1 rounded">DELETAR CONTA</code>
                        </p>
                        <Input
                          placeholder="Digite: DELETAR CONTA"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETAR CONTA'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    Sim, Deletar Conta Permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>

      {/* Informações do App */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📱 Sobre o App</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span>GSIA TRAFICS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Versão:</span>
            <span>1.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo:</span>
            <span>Jogo de Tycoon ILÍCITOS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-Save:</span>
            <span className="text-success">✓ Ativado</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Desenvolvido por:</span>
            <span>HOTWHEELS FLAYD</span>
          </div>
        </div>
      </Card>
    </div>
  );
};