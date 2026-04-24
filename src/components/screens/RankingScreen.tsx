import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GameState } from '@/types/game';
import { conditionValueFactor } from '@/data/cars';

interface RankingScreenProps {
  gameState: GameState;
}

interface PlayerRanking {
  id: string;
  user_id: string;
  display_name: string;
  total_patrimony: number;
  money: number;
  level: number;
  position?: number;
}

const RankingScreen = ({ gameState }: RankingScreenProps) => {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<PlayerRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1: return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 2: return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3: return 'bg-gradient-to-r from-amber-600/20 to-orange-500/20 border-amber-600/30';
      default: return 'bg-gradient-to-r from-muted/20 to-muted/10 border-muted/30';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2: return <Trophy className="h-6 w-6 text-gray-400" />;
      case 3: return <Medal className="h-6 w-6 text-amber-600" />;
      default: return <Star className="h-6 w-6 text-blue-400" />;
    }
  };

  const getSafeName = (name?: string | null) => {
    const base = (name || 'Jogador').toString();
    const noEmail = base.includes('@') ? base.split('@')[0] : base;
    return noEmail.length > 15 ? noEmail.slice(0, 15) : noEmail;
  };

  // Calcula patrimônio local para update do backend
  const calcLocalPatrimony = () => {
    const garage = gameState.garage ?? [];
    const carValue = garage
      .filter(s => s.car)
      .reduce((sum, s) => sum + s.car!.purchasePrice * conditionValueFactor(s.car!.condition), 0);
    return gameState.money + carValue;
  };

  const updateCurrentUserRanking = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const patrimony = calcLocalPatrimony();
      await (supabase as any)
        .from('player_profiles')
        .upsert({ user_id: user.id, total_patrimony: patrimony, level: gameState.reputation?.level ?? 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch {}
  };

  const fetchRankings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('player_profiles')
        .select('user_id, display_name, total_patrimony, level')
        .order('total_patrimony', { ascending: false })
        .limit(50);

      if (error) throw error;

      const rankedPlayers: PlayerRanking[] = (data || []).map((p: any, index: number) => ({
        id: p.user_id,
        user_id: p.user_id,
        display_name: getSafeName(p.display_name),
        total_patrimony: p.total_patrimony ?? 0,
        money: p.total_patrimony ?? 0,
        level: p.level ?? 1,
        position: index + 1,
      }));

      setRankings(rankedPlayers);
      setLastUpdate(new Date());

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserRank(rankedPlayers.find(p => p.user_id === user.id) || null);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateCurrentUserRanking().then(() => fetchRankings());
  }, [gameState.money, gameState.gameTime.day]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-400" /> Ranking de Revendedores
          </h1>
          <p className="text-muted-foreground">Carregando ranking...</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-400" /> Ranking de Revendedores
          </h1>
          <button
            onClick={() => { setLoading(true); updateCurrentUserRanking().then(() => fetchRankings()); }}
            disabled={loading}
            className="ml-4 px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            title="Atualizar ranking"
          >
            <TrendingUp className={`h-4 w-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-muted-foreground">Classificação por patrimônio total (saldo + carros)</p>
        {lastUpdate && (
          <p className="text-xs text-muted-foreground">Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</p>
        )}
      </div>

      {/* Sua posição */}
      {currentUserRank && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Sua Posição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPositionIcon(currentUserRank.position!)}
                <div>
                  <p className="font-bold">#{currentUserRank.position}</p>
                  <p className="text-sm text-muted-foreground">{currentUserRank.display_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{formatMoney(currentUserRank.total_patrimony)}</p>
                <Badge variant="outline">Nível {currentUserRank.level}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 50 */}
      <div className="space-y-2">
        {rankings.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <p>Nenhum jogador no ranking ainda.</p>
            <p className="text-sm mt-1">Seja o primeiro a aparecer aqui!</p>
          </Card>
        ) : (
          rankings.map((player) => (
            <Card key={player.user_id} className={`border ${getPositionStyle(player.position!)}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getPositionIcon(player.position!)}
                    <div>
                      <p className="font-semibold">{player.display_name}</p>
                      <p className="text-xs text-muted-foreground">#{player.position} • Nível {player.level}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(player.total_patrimony)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RankingScreen;
