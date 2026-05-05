// =====================================================================
// EmpresasScreen — Ranking de Construtoras + perfil do jogador
// Reutiliza a tabela player_profiles do Supabase.
// Patrimônio = saldo atual + receita total de obras.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { GameState } from '@/types/game';
import { ensureReputation } from '@/lib/reputation';
import { fmt } from '@/data/construction';

interface EmpresasScreenProps {
  gameState:   GameState;
  gameLoaded:  boolean;
}

interface CompanyRanking {
  user_id:          string;
  display_name:     string;
  total_patrimony:  number;
  level:            number;
  completed_works:  number;
  position:         number;
}

const getSafeName = (name?: string | null) => {
  const base = (name || 'Construtora').toString();
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

const POLL_INTERVAL_MS = 30_000;

export function EmpresasScreen({ gameState, gameLoaded }: EmpresasScreenProps) {
  const [rankings,    setRankings]    = useState<CompanyRanking[]>([]);
  const [myUserId,    setMyUserId]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState<Date | null>(null);
  const [secsAgo,     setSecsAgo]     = useState(0);

  const rep = ensureReputation(gameState.reputation);

  // ── Push score do jogador ────────────────────────────────────────
  const pushMyScore = useCallback(async (gs: GameState, loaded: boolean) => {
    if (!loaded) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Construtora';

    const patrimony = Math.round(gs.money + (gs.totalRevenue ?? 0));

    await (supabase as any)
      .from('player_profiles')
      .upsert(
        {
          user_id:         user.id,
          display_name:    displayName,
          total_patrimony: patrimony,
          level:           gs.reputation?.level ?? 1,
          races_won:       gs.completedContracts ?? 0,   // reusa campo pra obras
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  }, []);

  // ── Fetch ranking ────────────────────────────────────────────────
  const fetchRankings = useCallback(async () => {
    let data: Record<string, unknown>[] | null = null;

    // Tenta view v_ranking primeiro
    const { data: viewData, error: viewErr } = await (supabase as any)
      .from('v_ranking')
      .select('user_id, display_name, total_patrimony, level, races_won')
      .order('total_patrimony', { ascending: false })
      .limit(50);

    if (!viewErr) {
      data = viewData;
    } else {
      const { data: tableData, error: tableErr } = await (supabase as any)
        .from('player_profiles')
        .select('user_id, display_name, total_patrimony, level, races_won')
        .order('total_patrimony', { ascending: false })
        .limit(50);
      if (!tableErr) data = tableData;
    }

    if (!data) return;

    const list: CompanyRanking[] = (data as Record<string, unknown>[]).map((p, i) => ({
      user_id:          p['user_id'] as string,
      display_name:     getSafeName(p['display_name'] as string | null),
      total_patrimony:  (p['total_patrimony'] as number) ?? 0,
      level:            (p['level'] as number) ?? 1,
      completed_works:  (p['races_won'] as number) ?? 0,
      position:         i + 1,
    }));

    setRankings(list);
    setLastUpdate(new Date());
    setSecsAgo(0);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pushMyScore(gameState, gameLoaded);
    await fetchRankings();
    setRefreshing(false);
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await pushMyScore(gameState, gameLoaded);
      if (!mounted) return;
      await fetchRankings();
      if (!mounted) return;
      setLoading(false);
    };
    void init();

    // Realtime — atualiza quando qualquer jogador muda
    const channel = (supabase as any)
      .channel('empresas-ranking-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_profiles' },
        () => { if (mounted) void fetchRankings(); }
      )
      .subscribe();

    pollRef.current = setInterval(() => {
      if (mounted) void fetchRankings();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
      void (supabase as any).removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push score quando dinheiro mudar e jogo estiver carregado
  const patrimony = Math.round(gameState.money + (gameState.totalRevenue ?? 0));
  const lastPatrimonyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!gameLoaded) return;
    if (lastPatrimonyRef.current === patrimony) return;
    lastPatrimonyRef.current = patrimony;
    void pushMyScore(gameState, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patrimony, gameLoaded]);

  // Contador "X seg atrás"
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

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Ranking de Construtoras
          </h1>
          <p className="text-muted-foreground text-sm">Carregando ranking…</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold text-foreground flex items-center gap-2">
            🏆 Empresas
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Patrimônio = saldo + receita total de obras
          </p>
          {timeLabel && (
            <p className="text-[10px] text-muted-foreground">⏱ Atualizado {timeLabel}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-1.5 text-[12px]"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Minha empresa — card de destaque */}
      {myRank && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Minha Empresa
            </CardTitle>
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
              <div className="text-right space-y-0.5">
                <p className="font-bold text-primary text-[15px]">{fmt(myRank.total_patrimony)}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <Badge variant="outline" className="text-[10px]">Nível {rep.level}</Badge>
                  {myRank.completed_works > 0 && (
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/40">
                      🏗️ {myRank.completed_works} obras
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Estatísticas locais */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Saldo',    value: fmt(gameState.money) },
                { label: 'Contratos', value: String(gameState.completedContracts ?? 0) },
                { label: 'Em andamento', value: String(gameState.activeWorks?.length ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} className="ios-surface rounded-[10px] p-2 text-center !shadow-none bg-muted/20">
                  <div className="text-[11px] font-bold text-foreground tabular-nums">{value}</div>
                  <div className="text-[9px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 50 */}
      <div className="space-y-2">
        {rankings.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">🏗️</div>
            <p className="text-[14px] font-semibold text-muted-foreground">Nenhuma construtora ainda</p>
            <p className="text-[11px] text-muted-foreground">Complete sua primeira obra para aparecer aqui!</p>
          </div>
        ) : (
          rankings.map((company) => (
            <Card
              key={company.user_id}
              className={`border transition-all ${positionStyle(company.position)} ${
                company.user_id === myUserId ? 'ring-1 ring-primary/40' : ''
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Posição */}
                  <div className="w-7 flex justify-center shrink-0">
                    {positionIcon(company.position)}
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] truncate">
                      {company.display_name}
                      {company.user_id === myUserId && (
                        <span className="ml-1.5 text-[10px] text-primary font-normal">(você)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      #{company.position} · Nível {company.level}
                      {company.completed_works > 0 && (
                        <span className="ml-1.5 text-emerald-400 font-semibold">
                          · 🏗️ {company.completed_works} obras
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Patrimônio */}
                  <p className="font-bold text-[13px] tabular-nums shrink-0">
                    {fmt(company.total_patrimony)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
