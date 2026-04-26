import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { GameState } from '@/types/game';
import { conditionValueFactor } from '@/data/cars';

interface RankingScreenProps {
  gameState: GameState;
}

interface PlayerRanking {
  user_id: string;
  display_name: string;
  total_patrimony: number;
  level: number;
  position: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const getSafeName = (name?: string | null) => {
  const base = (name || 'Jogador').toString();
  const noEmail = base.includes('@') ? base.split('@')[0] : base;
  return noEmail.length > 18 ? noEmail.slice(0, 18) + '…' : noEmail;
};

const positionStyle = (pos: number) => {
  if (pos === 1) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
  if (pos === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
  if (pos === 3) return 'bg-gradient-to-r from-amber-600/20 to-orange-500/20 border-amber-600/30';
  return 'bg-muted/20 border-muted/30';
};

const positionIcon = (pos: number) => {
  if (pos === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
  if (pos === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
  if (pos === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <Star className="h-4 w-4 text-blue-400" />;
};

/** Calcula patrimônio completo: saldo + valor de mercado dos carros */
function calcPatrimony(gs: GameState): number {
  const carValue = (gs.garage ?? [])
    .filter(s => s.car)
    .reduce((sum, s) => sum + s.car!.fipePrice * conditionValueFactor(s.car!.condition), 0);
  return Math.round(gs.money + carValue);
}

const POLL_INTERVAL_MS = 30_000; // 30 s

const RankingScreen = ({ gameState }: RankingScreenProps) => {
  const [rankings, setRankings]         = useState<PlayerRanking[]>([]);
  const [myUserId, setMyUserId]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);
  const [secsAgo, setSecsAgo]           = useState(0);

  // ── buscar e salvar score do usuário atual ─────────────────────
  const pushMyScore = useCallback(async (gs: GameState) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Jogador';

    const patrimony = calcPatrimony(gs);

    await (supabase as any)
      .from('player_profiles')
      .upsert(
        {
          user_id:         user.id,
          display_name:    displayName,
          total_patrimony: patrimony,
          level:           gs.reputation?.level ?? 1,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  }, []);

  // ── buscar top 50 do banco ─────────────────────────────────────
  const fetchRankings = useCallback(async () => {
    // Tenta primeiro pela view v_ranking (garante display_name sempre preenchido)
    // com fallback para a tabela direta caso a view ainda não exista
    let data: any[] | null = null;

    const { data: viewData, error: viewError } = await (supabase as any)
      .from('v_ranking')
      .select('user_id, display_name, total_patrimony, level')
      .limit(50);

    if (!viewError) {
      data = viewData;
    } else {
      // fallback: tabela direta
      const { data: tableData, error: tableError } = await (supabase as any)
        .from('player_profiles')
        .select('user_id, display_name, total_patrimony, level')
        .order('total_patrimony', { ascending: false })
        .limit(50);
      if (!tableError) data = tableData;
    }

    if (!data) return;

    const list: PlayerRanking[] = data.map((p: any, i: number) => ({
      user_id:         p.user_id,
      display_name:    getSafeName(p.display_name),
      total_patrimony: p.total_patrimony ?? 0,
      level:           p.level ?? 1,
      position:        i + 1,
    }));

    setRankings(list);
    setLastUpdate(new Date());
    setSecsAgo(0);
  }, []);

  // ── atualização manual ─────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await pushMyScore(gameState);
    await fetchRankings();
    setRefreshing(false);
  };

  // ── mount: push score + fetch + Realtime + polling ─────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await pushMyScore(gameState);
      if (!mounted) return;
      await fetchRankings();
      if (!mounted) return;
      setLoading(false);
    };
    void init();

    // Supabase Realtime — atualiza lista quando qualquer jogador muda score
    const channel = (supabase as any)
      .channel('ranking-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_profiles' },
        () => { if (mounted) void fetchRankings(); }
      )
      .subscribe();

    // Polling de fallback a cada 30 s
    pollRef.current = setInterval(() => {
      if (mounted) void fetchRankings();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
      void (supabase as any).removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── push score sempre que patrimônio mudar ─────────────────────
  const patrimony = calcPatrimony(gameState);
  const lastPatrimonyRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastPatrimonyRef.current === patrimony) return;
    lastPatrimonyRef.current = patrimony;
    void pushMyScore(gameState);
  }, [patrimony]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── contador "X seg atrás" ─────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setSecsAgo(s => s + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = lastUpdate
    ? secsAgo < 5  ? 'agora mesmo'
    : secsAgo < 60 ? `${secsAgo}s atrás`
    : `${Math.floor(secsAgo / 60)}min atrás`
    : null;

  const myRank = rankings.find(p => p.user_id === myUserId);

  // ── render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-400" /> Ranking de Revendedores
          </h1>
          <p className="text-muted-foreground text-sm">Carregando ranking…</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-400" /> Ranking
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Patrimônio = saldo + valor dos carros</p>
          {timeLabel && (
            <p className="text-[10px] text-muted-foreground">⏱ Atualizado {timeLabel}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5 text-[12px]">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Sua posição (destaque) */}
      {myRank && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-primary uppercase tracking-wider">Sua posição</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {positionIcon(myRank.position)}
                <div>
                  <p className="font-bold text-[15px]">#{myRank.position}</p>
                  <p className="text-[12px] text-muted-foreground">{myRank.display_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary text-[15px]">{fmt(myRank.total_patrimony)}</p>
                <Badge variant="outline" className="text-[10px]">Nível {myRank.level}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 50 */}
      <div className="space-y-2">
        {rankings.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">🏆</div>
            <p className="text-[14px] font-semibold text-muted-foreground">Nenhum jogador ainda</p>
            <p className="text-[11px] text-muted-foreground">Seja o primeiro no ranking!</p>
          </div>
        ) : (
          rankings.map((player) => (
            <Card
              key={player.user_id}
              className={`border transition-all ${positionStyle(player.position)} ${player.user_id === myUserId ? 'ring-1 ring-primary/40' : ''}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Posição */}
                  <div className="w-7 flex justify-center shrink-0">
                    {positionIcon(player.position)}
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] truncate">
                      {player.display_name}
                      {player.user_id === myUserId && (
                        <span className="ml-1.5 text-[10px] text-primary font-normal">(você)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      #{player.position} · Nível {player.level}
                    </p>
                  </div>

                  {/* Patrimônio */}
                  <p className="font-bold text-[13px] tabular-nums shrink-0">
                    {fmt(player.total_patrimony)}
                  </p>
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
