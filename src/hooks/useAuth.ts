import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { safeCall, isLocalSession } from '@/lib/safeSync';

// =========================================================
// Usuário de teste local pré-configurado (não toca o Supabase)
// Credenciais: alife / 123
// =========================================================
export const LOCAL_TEST_USER = {
  email: 'alife',
  password: '123',
  displayName: 'Alife',
  userId: '00000000-0000-0000-0000-000000000a11',
};
const LOCAL_TEST_STORAGE_KEY = 'gsia_local_test_session';

const buildMockUser = (): User => ({
  id: LOCAL_TEST_USER.userId,
  email: LOCAL_TEST_USER.email,
  user_metadata: { display_name: LOCAL_TEST_USER.displayName },
  app_metadata: { provider: 'local-test' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User);

const buildMockSession = (): Session => ({
  access_token: 'local-test-token',
  refresh_token: 'local-test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: buildMockUser(),
} as unknown as Session);

export const isLocalTestActive = (): boolean => {
  try { return localStorage.getItem(LOCAL_TEST_STORAGE_KEY) === '1'; } catch { return false; }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  signInLocalTest: () => void;
  isLocalTest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocalTest, setIsLocalTest] = useState<boolean>(false);

  useEffect(() => {
    // 1) Restaurar sessão de teste local (se existir)
    if (isLocalTestActive()) {
      console.log('🧪 [AUTH] Sessão de teste local ativa — ignorando Supabase auth');
      const mockUser = buildMockUser();
      const mockSession = buildMockSession();
      setUser(mockUser);
      setSession(mockSession);
      setIsLocalTest(true);
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Create profile when user signs up (note: event is 'SIGNED_UP' but type might be different)
        if (session?.user && !user) {
          setTimeout(() => {
            createUserProfile(session.user);
          }, 0);
        }

        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            logActivity('login', { email: session.user!.email }, session.user!.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ativa o modo de teste local
  const signInLocalTest = () => {
    try { localStorage.setItem(LOCAL_TEST_STORAGE_KEY, '1'); } catch {}
    setUser(buildMockUser());
    setSession(buildMockSession());
    setIsLocalTest(true);
    setLoading(false);
    toast({
      title: '🧪 Modo Teste Local',
      description: `Entrou como ${LOCAL_TEST_USER.displayName} (sem Supabase, salva no navegador).`,
    });
  };

  const createUserProfile = async (user: User) => {
    if (isLocalSession()) return;
    void safeCall(
      'profile:create',
      async () => {
        const { error } = await supabase.from('player_profiles').insert({
          user_id: user.id,
          display_name: user.user_metadata?.display_name || 'Jogador',
        });
        // ignorar erro de duplicata (perfil já existe)
        if (error && !String(error.message).toLowerCase().includes('duplicate')) {
          throw error;
        }
        return true;
      },
      { timeoutMs: 5_000 }
    );
  };

  const logActivity = async (actionType: string, actionData?: any, explicitUserId?: string) => {
    // Modo teste local: pular totalmente
    if (isLocalSession()) return;

    // Fire-and-forget via safeCall (circuit breaker + timeout + dedup de log)
    void safeCall(
      `activity:${actionType}`,
      async () => {
        const { error } = await supabase.from('activity_logs').insert({
          user_id: explicitUserId || user?.id || undefined,
          action_type: actionType,
          action_data: actionData,
          session_id: session?.access_token?.substring(0, 10) || null,
        });
        if (error) throw error;
        return true;
      },
      { timeoutMs: 5_000 }
    );
  };

  const signIn = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let message = 'Erro desconhecido';
        switch (error.message) {
          case 'Invalid login credentials':
            message = 'Email ou senha incorretos';
            break;
          case 'Email not confirmed':
            message = 'Email não confirmado. Verifique sua caixa de entrada';
            break;
          default:
            message = error.message;
        }
        
        toast({
          title: "Erro no login",
          description: message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta ao Trafic Game",
        });
      }

      return { error };
    } catch (err) {
      console.error('❌ [AUTH] Erro inesperado no login:', err);
      return { error: err as AuthError };
    }
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error: AuthError | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        let message = 'Erro desconhecido';
        switch (error.message) {
          case 'User already registered':
            message = 'Email já cadastrado. Tente fazer login';
            break;
          case 'Password should be at least 6 characters':
            message = 'A senha deve ter pelo menos 6 caracteres';
            break;
          default:
            message = error.message;
        }
        
        toast({
          title: "Erro no cadastro",
          description: message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Bem-vindo ao Trafic Game! Seu progresso será salvo automaticamente.",
        });
      }

      return { error };
    } catch (err) {
      console.error('❌ [AUTH] Erro inesperado no cadastro:', err);
      return { error: err as AuthError };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Se estiver no modo de teste local, apenas limpa o estado local
      if (isLocalTest) {
        try { localStorage.removeItem(LOCAL_TEST_STORAGE_KEY); } catch {}
        setUser(null);
        setSession(null);
        setIsLocalTest(false);
        toast({
          title: "Logout (teste local)",
          description: "Sessão de teste encerrada.",
        });
        return;
      }

      if (user) {
        await logActivity('logout', undefined, user.id);
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        toast({
          title: "Erro ao sair",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Logout realizado",
          description: "Até logo! Seu progresso foi salvo.",
        });
      }
    } catch (err) {
      console.error('❌ [AUTH] Erro no logout:', err);
    }
  };

  const updateProfile = async (displayName: string): Promise<{ error: Error | null }> => {
    try {
      if (!user) return { error: new Error('Usuário não autenticado') };

      const { error } = await supabase
        .from('player_profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName,
        });

      if (error) {
        toast({
          title: "Erro ao atualizar perfil",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });

      return { error: null };
    } catch (err) {
      console.error('❌ [AUTH] Erro ao atualizar perfil:', err);
      return { error: err as Error };
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    signInLocalTest,
    isLocalTest,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  return React.createElement(AuthContext.Provider, { value: auth }, children);
};