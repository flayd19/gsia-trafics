import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { GameState } from '@/types/game';
import { conditionValueFactor } from '@/data/cars';
import { ensureReputation } from '@/lib/reputation';

interface SettingsScreenProps {
  gameState: GameState;
  operationalCosts?: { warehouseCost: number; driverCosts: number; totalWeekly: number };
  onSaveGame: () => Promise<void>;
  onResetGame: () => Promise<void>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ gameState, onSaveGame, onResetGame }) => {
  const { user } = useAuth();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleSaveGame = async () => {
    try { await onSaveGame(); }
    catch { toast({ title: 'Erro ao Salvar', description: 'Não foi possível salvar o progresso.', variant: 'destructive' }); }
  };

  const handleResetGame = async () => {
    try { await onResetGame(); }
    catch { toast({ title: 'Erro ao Resetar', description: 'Não foi possível resetar o progresso.', variant: 'destructive' }); }
  };

  const getTotalValue = () => {
    const garage = gameState.garage ?? [];
    const carValue = garage
      .filter(s => s.car)
      .reduce((sum, s) => sum + (s.car!.purchasePrice * conditionValueFactor(s.car!.condition)), 0);
    return gameState.money + carValue;
  };

  const rep = ensureReputation(gameState.reputation);
  const carsInGarage = (gameState.garage ?? []).filter(s => s.car).length;

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await Promise.all([
        supabase.from('game_progress').delete().eq('user_id', user.id),
        supabase.from('player_profiles').delete().eq('user_id', user.id),
        (supabase as any).from('player_ranking').delete().eq('user_id', user.id),
        (supabase as any).from('activity_logs').delete().eq('user_id', user.id),
      ]);
      toast({ title: 'Dados Deletados', description: 'Todos os seus dados foram removidos.' });
      await supabase.auth.signOut();
    } catch {
      toast({ title: 'Erro ao Deletar Dados', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Configurações</h2>
        <p className="text-muted-foreground">Gerencie seu progresso e conta</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Resumo do Progresso</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo:</span>
              <span className="font-medium">{formatMoney(gameState.money)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carros na garagem:</span>
              <span className="font-medium">{carsInGarage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendas realizadas:</span>
              <span className="font-medium">{gameState.salesHistory?.length ?? 0}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patrimônio total:</span>
              <span className="font-medium text-green-600">{formatMoney(getTotalValue())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nível:</span>
              <span className="font-medium">Nível {rep.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dia no jogo:</span>
              <span className="font-medium">Dia {gameState.gameTime.day}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🎮 Controles do Jogo</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Salvar Progresso</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Salva manualmente. O jogo também salva automaticamente a cada 30 segundos.
            </p>
            <Button onClick={handleSaveGame} className="w-full">💾 Salvar Jogo Agora</Button>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2 text-destructive">Resetar Jogo</h4>
            <p className="text-sm text-muted-foreground mb-3">
              ⚠️ Apaga todo seu progresso e recomeça do zero. Não pode ser desfeito.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">🗑️ Resetar Jogo</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá apagar todo seu progresso, incluindo:
                    <br />• Saldo: {formatMoney(gameState.money)}
                    <br />• {carsInGarage} carros na garagem
                    <br />• {gameState.salesHistory?.length ?? 0} vendas no histórico
                    <br /><br />
                    <strong>Esta ação não pode ser desfeita!</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetGame} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, Resetar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2 text-destructive">Deletar Conta</h4>
            <p className="text-sm text-muted-foreground mb-3">⚠️ Deleta permanentemente sua conta e todos os dados. Irreversível.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">🗑️ Deletar Conta Permanentemente</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ DELETAR CONTA PERMANENTEMENTE</AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="space-y-3">
                      <p className="text-destructive font-medium">ATENÇÃO: Esta ação é IRREVERSÍVEL!</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Todo progresso no jogo</li>
                        <li>Saldo: {formatMoney(gameState.money)}</li>
                        <li>{carsInGarage} carros na garagem</li>
                        <li>Posição no ranking e conta de usuário</li>
                      </ul>
                      <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium mb-2">Para confirmar, digite: <code className="bg-muted px-1 rounded">DELETAR CONTA</code></p>
                        <Input placeholder="Digite: DELETAR CONTA" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="mt-2" />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETAR CONTA'} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                    Sim, Deletar Conta Permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🚗 Sobre o App</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Nome:</span><span>GSIA — Compra e Venda de Carros</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Versão:</span><span>2.0.0</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Auto-Save:</span><span className="text-green-600">✓ A cada 30s</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Desenvolvido por:</span><span>HOTWHEELS FLAYD</span></div>
        </div>
      </Card>
    </div>
  );
};
