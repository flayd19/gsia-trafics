import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ADMIN_TOKEN_KEY } from '@/lib/adminAuth';

const AuthPage = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signupNotice, setSignupNotice] = useState<string | null>(null);

  // Admin gate (cadeado oculto)
  const [adminOpen, setAdminOpen]         = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading]   = useState(false);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Faça login na sua conta antes de acessar o painel admin.');
      return;
    }
    if (!adminPassword) return;
    setAdminLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('verify_admin_password', {
        p_password: adminPassword,
      });
      if (error || data !== true) {
        toast.error('Senha incorreta ou usuário sem permissão.');
        setAdminPassword('');
        return;
      }
      sessionStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify({ uid: user.id, ts: Date.now() }));
      toast.success('Acesso concedido — entrando no painel.');
      navigate('/admin');
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setAdminLoading(false);
    }
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Redirect authenticated users to home
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);

    if (!error) {
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !displayName) return;

    setIsLoading(true);
    setSignupNotice(null);
    const { error, needsEmailConfirmation } = await signUp(
      signupEmail,
      signupPassword,
      displayName
    );

    if (!error) {
      if (needsEmailConfirmation) {
        // Não navega: mantém o usuário na tela pra ver o aviso
        setSignupNotice(
          'Enviamos um link de confirmação para ' +
            signupEmail +
            '. Confirme seu email e depois volte aqui pra fazer login.'
        );
        // Pré-preenche o email na aba de login pra facilitar
        setLoginEmail(signupEmail);
        setActiveTab('login');
      } else {
        navigate('/');
      }
    }
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            GSIA TRAFICS
          </CardTitle>
          <CardDescription>
            Entre ou crie sua conta para começar a jogar
          </CardDescription>
          <div className="flex justify-center gap-2 mt-2">
            <Badge variant="secondary">🚗 Veículos</Badge>
            <Badge variant="secondary">💰 Negócios</Badge>
            <Badge variant="secondary">🏪 Lojas</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {signupNotice && (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
              ✉️ {signupNotice}
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !loginEmail || !loginPassword}
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome de exibição</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome no jogo"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="nickname"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !signupEmail || !signupPassword || !displayName}
                >
                  {isLoading ? 'Cadastrando...' : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              🎮 Seu progresso será salvo automaticamente na nuvem
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cadeado oculto — clique abre modal de admin */}
      <button
        type="button"
        aria-label="Painel administrativo"
        onClick={() => setAdminOpen(true)}
        className="fixed bottom-3 right-3 w-7 h-7 rounded-full opacity-25 hover:opacity-100 transition-opacity flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground"
        tabIndex={-1}
      >
        <Lock size={12} />
      </button>

      <Dialog open={adminOpen} onOpenChange={(o) => { setAdminOpen(o); if (!o) setAdminPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={16} /> Painel administrativo
            </DialogTitle>
            <DialogDescription className="text-xs">
              {user
                ? <>Logado como <strong>{user.email}</strong>. Informe a senha de admin.</>
                : 'Faça login na sua conta primeiro.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Senha admin"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoFocus
              autoComplete="off"
              disabled={!user || adminLoading}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAdminOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!user || !adminPassword || adminLoading}>
                {adminLoading ? 'Verificando...' : 'Acessar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;
