import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, TrendingUp, DollarSign, Car, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCTS, MARKETPLACE_VEHICLES } from '@/data/gameData';

interface RankingScreenProps {
  gameState: {
    money: number;
    vehicles: any[];
    stock: Record<string, number>;
    gameTime: { day: number };
  };
}

interface PlayerRanking {
  id: string;
  user_id: string;
  display_name: string;
  total_patrimony: number;
  money: number;
  total_vehicles: number;
  total_stores: number;
  game_day: number;
  level: number;
  position?: number;
}

const RankingScreen = ({ gameState }: RankingScreenProps) => {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<PlayerRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Helper functions defined first
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-500/20 border-amber-600/30';
      default:
        return 'bg-gradient-to-r from-muted/20 to-muted/10 border-muted/30';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <Trophy className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-6 w-6 text-blue-400" />;
    }
  };

  const getSafeName = (name?: string | null) => {
    const base = (name || 'Jogador').toString();
    const noEmail = base.includes('@') ? base.split('@')[0] : base;
    return noEmail.length > 15 ? noEmail.slice(0, 15) : noEmail;
  };

  const totalStock = Object.values(gameState.stock).reduce((sum, qty) => sum + qty, 0);

  // Função para calcular valor do estoque baseado nos preços atuais dos produtos
  const calculateStockValue = () => {
    return Object.entries(gameState.stock).reduce((total: number, [productId, quantity]) => {
      const product = PRODUCTS.find(p => p.id === productId);
      if (product && quantity > 0) {
        // Usar currentPrice se disponível, senão baseStreetPrice, senão baseCost * 1.35
        const price = product.currentPrice || product.baseStreetPrice || (product.baseCost * 1.35);
        return total + (quantity as number) * price;
      }
      return total + (quantity as number) * 100; // Fallback se produto não encontrado
    }, 0);
  };

  // Função para calcular valor dos veículos baseado nos preços do marketplace
  const calculateVehicleValue = () => {
    return gameState.vehicles.reduce((total: number, vehicle: any) => {
      // Primeiro tentar usar o preço salvo no veículo
      if (vehicle.price) {
        return total + vehicle.price;
      }
      
      // Se não tiver preço, buscar no marketplace pelo nome ou ID
      const marketplaceVehicle = MARKETPLACE_VEHICLES.find(mv => 
        mv.name.toLowerCase().includes(vehicle.name?.toLowerCase() || '') ||
        mv.id === vehicle.id
      );
      
      if (marketplaceVehicle) {
        return total + marketplaceVehicle.price;
      }
      
      // Fallback baseado no nome do veículo
      const vehicleName = vehicle.name?.toLowerCase() || '';
      if (vehicleName.includes('monza')) return total + 15000;
      if (vehicleName.includes('uno')) return total + 8000;
      if (vehicleName.includes('kombi')) return total + 22000;
      if (vehicleName.includes('courier')) return total + 28000;
      if (vehicleName.includes('van') || vehicleName.includes('mercedes')) return total + 45000;
      if (vehicleName.includes('escort')) return total + 110000;
      if (vehicleName.includes('fiat 500') || vehicleName.includes('500')) return total + 45000;
      if (vehicleName.includes('jetta')) return total + 60000;
      if (vehicleName.includes('bmw') || vehicleName.includes('320i')) return total + 100000;
      if (vehicleName.includes('amarok')) return total + 70000;
      if (vehicleName.includes('bell') || vehicleName.includes('helicoptero')) return total + 1800000;
      if (vehicleName.includes('fh540') || vehicleName.includes('rodotrem')) return total + 1200000;
      if (vehicleName.includes('scania')) return total + 700000;
      
      // Fallback geral
      return total + 25000;
    }, 0);
  };

  // Função para calcular valor das lojas compradas
  const calculateStoreValue = () => {
    if (!(gameState as any).stores) return 0;
    return (gameState as any).stores.reduce((total: number, store: any) => {
      if (store.owned && store.purchasePrice) {
        return total + store.purchasePrice;
      }
      return total;
    }, 0);
  };

  // Patrimônio agora é calculado apenas pelo backend via função SQL
  // Removido cálculo local para garantir consistência entre todas as contas

  // Função para atualizar ranking do usuário atual usando função SQL do backend
  const updateCurrentUserRanking = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Usar a função SQL do backend para calcular patrimônio de forma consistente
      const { error } = await supabase.rpc('update_player_ranking_complete', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Erro ao atualizar ranking via SQL:', error);
        throw error;
      }

      console.log('✅ [RANKING] Ranking atualizado via função SQL do backend');
    } catch (error) {
      console.error('Erro ao atualizar ranking:', error);
    }
  };

  // Função para buscar ranking dos jogadores
  const fetchRankings = async () => {
    try {
      const { data, error } = await supabase
        .from('player_ranking')
        .select('*')
        .order('total_patrimony', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Buscar perfis para todos os usuários do ranking
      const userIds = (data || []).map((p) => p.user_id).filter(Boolean);
      let profilesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('player_profiles')
          .select('user_id, display_name')
          .in('user_id', userIds as string[]);
        profiles?.forEach((p: any) => {
          if (p.display_name) profilesMap.set(p.user_id, p.display_name);
        });
      }

      // Adicionar posições e aplicar nome seguro imediatamente
      const rankedPlayers = (data || []).map((player, index) => ({
        ...player,
        display_name: getSafeName(profilesMap.get(player.user_id) || player.display_name),
        position: index + 1,
      }));

      setRankings(rankedPlayers);
      setLastUpdate(new Date());

      // Encontrar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const currentUser = rankedPlayers.find(p => p.user_id === user.id);
        setCurrentUserRank(currentUser || null);
      }
      
      console.log('🏆 [RANKING] Rankings atualizados:', rankedPlayers.length, 'jogadores');
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  // Atualização inicial e quando o estado muda
  useEffect(() => {
    updateCurrentUserRanking().then(() => {
      fetchRankings();
    });
  }, [gameState.money, gameState.vehicles.length, gameState.gameTime.day, JSON.stringify(gameState.stock)]);
  
  // Atualização automática a cada 1 hora
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('🔄 [RANKING] Atualização automática do ranking...');
      updateCurrentUserRanking().then(() => {
        fetchRankings();
      });
    }, 3600000); // 1 hora (3600 segundos)
    
    return () => clearInterval(interval);
  }, [autoRefresh]);
  
  // Função para forçar atualização manual
  const forceUpdate = () => {
    setLoading(true);
    console.log('🔄 [RANKING] Forçando atualização completa do ranking via backend...');
    updateCurrentUserRanking().then(() => {
      fetchRankings();
    });
  };
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-400" />
            Ranking de Empresários
          </h1>
          <p className="text-muted-foreground">Carregando dados dos jogadores...</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-400" />
            Ranking de Empresários
          </h1>
          <button 
            onClick={forceUpdate}
            disabled={loading}
            className="ml-4 px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            title="Atualizar ranking manualmente"
          >
            <TrendingUp className={`h-4 w-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-muted-foreground">
          Classificação por patrimônio total (saldo + estoque)
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          {lastUpdate && (
            <span>Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
          )}
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            ⏰ Próxima atualização automática em: {Math.ceil((3600000 - (Date.now() - (lastUpdate?.getTime() || Date.now()))) / 60000)}min
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Atualização automática (1h)</span>
          </label>
        </div>
      </div>

      {/* Your Stats Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-primary" />
            <span>Suas Estatísticas</span>
            {currentUserRank && (
              <Badge variant="outline" className="w-fit">
                #{currentUserRank.position} no Ranking
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="text-center space-y-1 p-2 rounded-lg bg-background/50">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Saldo</p>
              <p className="font-bold text-sm sm:text-lg leading-tight">{formatMoney(gameState.money)}</p>
            </div>
            <div className="text-center space-y-1 p-2 rounded-lg bg-background/50">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Valor Estoque</p>
              <p className="font-bold text-sm sm:text-lg leading-tight">{formatMoney(calculateStockValue())}</p>
            </div>
            <div className="text-center space-y-1 p-2 rounded-lg bg-background/50">
              <Car className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Valor Veículos</p>
              <p className="font-bold text-sm sm:text-lg leading-tight">{formatMoney(calculateVehicleValue())}</p>
            </div>
            <div className="text-center space-y-1 p-2 rounded-lg bg-background/50">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Qtd. Estoque</p>
              <p className="font-bold text-sm sm:text-lg">{totalStock}</p>
            </div>
            <div className="text-center space-y-1 p-2 rounded-lg bg-background/50">
              <Car className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Qtd. Veículos</p>
              <p className="font-bold text-sm sm:text-lg">{gameState.vehicles.length}</p>
            </div>
            <div className="text-center space-y-1 p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Patrimônio Total</p>
              <p className="font-bold text-sm sm:text-lg leading-tight text-yellow-600">
                {formatMoney(gameState.money + calculateStockValue() + calculateVehicleValue() + calculateStoreValue())}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking List */}
      <Card>
        <CardHeader>
          <CardTitle>Top 50 Empresários</CardTitle>
          <CardDescription>
            {rankings.length > 0 
              ? `Classificação dos ${rankings.length} melhores jogadores`
              : 'Nenhum jogador encontrado no ranking'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {rankings.length > 0 ? (
            rankings.map((player, index) => (
              <div
                key={player.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border space-y-2 sm:space-y-0 ${getPositionStyle(player.position || index + 1)}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-2xl font-bold text-muted-foreground">
                      #{player.position}
                    </span>
                    <span className="flex-shrink-0">
                      {getPositionIcon(player.position || index + 1)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base sm:text-lg truncate">
                      {player.display_name}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="truncate">{formatMoney(player.total_patrimony)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{player.total_vehicles} veículos</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Dia {player.game_day}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 justify-end sm:justify-start">
                  {(player.position || index + 1) <= 3 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        (player.position || index + 1) === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        (player.position || index + 1) === 2 ? 'bg-gray-400/20 text-gray-300' :
                        'bg-amber-600/20 text-amber-500'
                      }`}
                    >
                      {(player.position || index + 1) === 1 ? 'Ouro' : (player.position || index + 1) === 2 ? 'Prata' : 'Bronze'}
                    </Badge>
                  )}
                  
                  {currentUserRank && player.user_id === currentUserRank.user_id && (
                    <Badge variant="outline" className="border-primary text-primary text-xs">
                      Você
                    </Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-base sm:text-lg font-medium text-muted-foreground">Nenhum jogador no ranking ainda</p>
              <p className="text-sm text-muted-foreground">Seja o primeiro a aparecer!</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default RankingScreen;