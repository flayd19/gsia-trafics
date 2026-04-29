// =====================================================================
// AdminPage — painel administrativo com 5 abas (Mercado, Jogadores,
// Carros, Categorias, Erros). Acesso protegido por senha em
// sessionStorage; cada RPC valida server-side via _admin_pw_ok.
// =====================================================================
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasAdminPassword, clearAdminPassword } from '@/lib/adminAuth';
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
    if (!hasAdminPassword()) {
      navigate('/auth');
    }
  }, [navigate]);

  const handleLogout = () => {
    clearAdminPassword();
    navigate('/auth');
  };

  if (!hasAdminPassword()) {
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
              Sessão admin · expira em 8h ou ao fechar o navegador.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
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
