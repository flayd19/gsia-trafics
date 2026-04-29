// =====================================================================
// AdminPage — painel administrativo com 5 abas:
//   • Mercado     — overview + force refresh
//   • Jogadores   — busca + ajustar saldo
//   • Carros      — criar + listar custom cars
//   • Categorias  — pesos % do mercado
//   • Erros       — logs de RPC
//
// Acesso protegido por hasAdminToken() (sessão validada via verify_admin_password
// + RLS server-side em todas as RPCs admin_*).
// =====================================================================
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hasAdminToken, clearAdminToken, getAdminTokenString,
} from '@/lib/adminAuth';
import {
  getAdminClient, resetAdminClient,
} from '@/integrations/supabase/admin-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldAlert } from 'lucide-react';
import { AdminMarketTab }     from '@/components/admin/AdminMarketTab';
import { AdminPlayersTab }    from '@/components/admin/AdminPlayersTab';
import { AdminCarsTab }       from '@/components/admin/AdminCarsTab';
import { AdminCategoriesTab } from '@/components/admin/AdminCategoriesTab';
import { AdminErrorsTab }     from '@/components/admin/AdminErrorsTab';

export default function AdminPage(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    // Acesso INDEPENDENTE do login do jogo — só precisa do admin token
    if (!hasAdminToken()) {
      navigate('/auth');
    }
  }, [navigate]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleLogout = async () => {
    const token = getAdminTokenString();
    if (token) {
      try {
        await (getAdminClient() as any).rpc('admin_logout', { p_token: token });
      } catch { /* silencioso */ }
    }
    clearAdminToken();
    resetAdminClient();
    navigate('/auth');
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!hasAdminToken()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground text-sm">Verificando acesso...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-amber-500" />
              Painel administrativo
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sessão admin independente — token expira em 8h.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleLogout()} className="gap-1.5">
            <LogOut size={13} /> Sair do painel
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="market" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="market">Mercado</TabsTrigger>
            <TabsTrigger value="players">Jogadores</TabsTrigger>
            <TabsTrigger value="cars">Carros</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
          </TabsList>

          <TabsContent value="market"     className="mt-4"><AdminMarketTab /></TabsContent>
          <TabsContent value="players"    className="mt-4"><AdminPlayersTab /></TabsContent>
          <TabsContent value="cars"       className="mt-4"><AdminCarsTab /></TabsContent>
          <TabsContent value="categories" className="mt-4"><AdminCategoriesTab /></TabsContent>
          <TabsContent value="errors"     className="mt-4"><AdminErrorsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
