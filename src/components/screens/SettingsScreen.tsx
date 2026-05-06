import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { GameState } from '@/types/game';
import { ensureReputation } from '@/lib/reputation';

interface SettingsScreenProps {
  gameState:    GameState;
  onSaveGame:   () => Promise<void>;
  onResetGame:  () => Promise<void>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ gameState, onSaveGame, onResetGame }) => {
  const { user } = useAuth();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const rep = ensureReputation(gameState.reputation);

  // Patrimônio = dinheiro + máquinas (50% revenda) + imóveis registrados no gameState
  const machineValue = gameState.machines.reduce((s, m) => s + Math.round(m.purchasePrice * 0.5), 0);
  const totalPatrimonio = gameState.money + machineValue;

  const handleSave = async () => {
    try { await onSaveGame(); }
    catch { toast.error('Não foi possível salvar o progresso.'); }
  };

  const handleReset = async () => {
    try { await onResetGame(); }
    catch { toast.error('Não foi possível resetar o progresso.'); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await Promise.all([
        supabase.from('game_progress').delete().eq('user_id', user.id),
        supabase.from('player_profiles').delete().eq('user_id', user.id),
        (supabase as any).from('player_ranking').delete().eq('user_id', user.id),
        (supabase as any).from('activity_logs').delete().eq('user_id', user.id),
      ]);
      toast.success('Dados deletados. Até logo!');
      await supabase.auth.signOut();
    } catch {
      toast.error('Erro ao deletar dados. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Configurações</h2>
        <p className="text-muted-foreground">Gerencie seu progresso e conta</p>
      </div>

      {/* Progresso */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Resumo da Empresa</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Caixa:</span>
              <span className="font-medium">{fmt(gameState.money)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Funcionários:</span>
              <span className="font-medium">{gameState.employees.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Máquinas:</span>
              <span className="font-medium">{gameState.machines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Obras concluídas:</span>
              <span className="font-medium">{gameState.completedContracts}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patrimônio:</span>
              <span className="font-medium text-green-600">{fmt(totalPatrimonio)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nível:</span>
              <span className="font-medium">Nível {rep.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receita total:</span>
              <span className="font-medium">{fmt(gameState.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dia no jogo:</span>
              <span className="font-medium">Dia {gameState.gameTime.day}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Controles */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🎮 Controles do Jogo</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Salvar Progresso</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Salva manualmente. O jogo também salva automaticamente a cada 30 segundos.
            </p>
            <Button onClick={handleSave} className="w-full">💾 Salvar Jogo Agora</Button>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2 text-destructive">Resetar Jogo</h4>
            <p className="text-sm text-muted-foreground mb-3">
              ⚠️ Apaga todo seu progresso (empresa, imóveis, funcionários) e recomeça. Não pode ser desfeito.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">🗑️ Resetar Jogo</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação apagará todo seu progresso, incluindo:
                    <br />• Caixa: {fmt(gameState.money)}
                    <br />• {gameState.employees.length} funcionário{gameState.employees.length !== 1 ? 's' : ''}
                    <br />• {gameState.machines.length} máquina{gameState.machines.length !== 1 ? 's' : ''}
                    <br />• {gameState.completedContracts} obra{gameState.completedContracts !== 1 ? 's' : ''} no histórico
                    <br />• Todos os imóveis
                    <br /><br />
                    <strong>Esta ação não pode ser desfeita!</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
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
                        <li>Caixa: {fmt(gameState.money)}</li>
                        <li>{gameState.employees.length} funcionários e {gameState.machines.length} máquinas</li>
                        <li>Posição no ranking e conta de usuário</li>
                      </ul>
                      <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium mb-2">Para confirmar, digite: <code className="bg-muted px-1 rounded">DELETAR CONTA</code></p>
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
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancelar</AlertDialogCancel>
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

      {/* Sobre */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🏗️ Sobre o App</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Nome:</span><span>GSIA Construtora</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Versão:</span><span>3.0.0</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Auto-Save:</span><span className="text-green-600">✓ A cada 30s</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Desenvolvido por:</span><span>HOTWHEELS FLAYD</span></div>
        </div>
      </Card>
    </div>
  );
};
