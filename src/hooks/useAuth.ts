import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { safeCall } from '@/lib/safeSync';

// =========================================================
// Chave legada de "modo teste local" — removida do fluxo, mas
// limpamos aqui pra destravar usuários que ficaram com a flag
// antiga presa no navegador.
// =========================================================
const LEGACY_LOCAL_TEST_KEY = 'gsia_local_test_session';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
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

  useEffect(() => {
    // Remove qualquer resquício do antigo modo "teste local"
    try { localStorage.removeItem(LEGACY_LOCAL_TEST_KEY); } catch {}

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        // Garante que profile + game_progress existem (defensivo — o trigger
        // server-side já faz isso no cadastro, mas isso cobre contas antigas
        // ou casos em que o trigger ainda não tinha rodado).
        if (newSession?.user) {
          setTimeout(() => {
            ensureUserBootstrap(newSession.user);
          }, 0);
        }

        if (event === 'SIGNED_IN' && newSession?.user) {
          setTimeout(() => {
            logActivity('login', { email: newSession.user!.email }, newSession.user!.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureUserBootstrap = async (u: User) => {
    // Tenta via RPC (idempotente no servidor)
    const rpcRes = await safeCall(
      'bootstrap:rpc',
      async () => {
        const displayName =
          (u.user_metadata?.display_name as string | undefined) ||
          (u.user_metadata?.full_name as string | undefined) ||
          u.email?.split('@')[0] ||
          'Jogador';
        const { error } = await supabase.rpc('ensure_user_bootstrap', {
          p_display_name: displayName,
        });
        if (error) throw error;
        return true;
      },
      { timeoutMs: 5_000 }
    );

    // Fallback: se a RPC não existir ainda (migration não aplicada), insere direto.
    if (!rpcRes.ok && !rpcRes.skipped) {
      void safeCall(
        'bootstrap:insert',
        async () => {
          const { error } = await supabase.from('player_profiles').insert({
            user_id: u.id,
            display_name:
              (u.user_metadata?.display_name as string | undefined) ||
              u.email?.split('@')[0] ||
              'Jogador',
          });
          if (error && !String(error.message).toLowerCase().includes('duplicate')) {
            throw error;
          }
          return true;
        },
        { timeoutMs: 5_000 }
      );
    }
  };

  const logActivity = async (actionType: string, actionData?: any, explicitUserId?: string) => {
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
        email: email.trim(),
        password,
      });

      if (error) {
        let message = 'Erro desconhecido';
        switch (error.message) {
          case 'Invalid login credentials':
            message = 'Email ou senha incorretos';
            break;
          case 'Email not confirmed':
            message = 'Email não confirmado. Verifique sua caixa de entrada (incluindo spam)';
            break;
          default:
            message = error.message;
        }

        toast({
          title: 'Erro no login',
          description: message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Login realizado!',
          description: 'Bem-vindo de volta ao GSIA TRAFICS',
        });
      }

      return { error };
    } catch (err) {
      console.error('[AUTH] Erro inesperado no login:', err);
      toast({
        title: 'Erro no login',
        description: 'Falha ao conectar com o servidor. Tente novamente.',
        variant: 'destructive',
      });
      return { error: err as AuthError };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        let message = 'Erro desconhecido';
        switch (error.message) {
          case 'User already registered':
            message = 'Email já cadastrado. Tente fazer login.';
            break;
          case 'Password should be at least 6 characters':
            message = 'A senha deve ter pelo menos 6 caracteres.';
            break;
          case 'Unable to validate email address: invalid format':
            message = 'Email em formato inválido.';
            break;
          case 'Signup requires a valid password':
            message = 'Informe uma senha válida.';
            break;
          default:
            message = error.message;
        }

        toast({
          title: 'Erro no cadastro',
          description: message,
          variant: 'destructive',
        });
        return { error };
      }

      // Se Supabase retornou user mas SEM session, é porque "Confirm email"
      // está ligado no projeto. Avisa o jogador pra confirmar o email.
      const needsEmailConfirmation = !!data?.user && !data?.session;

      if (needsEmailConfirmation) {
        toast({
          title: 'Confirme seu email',
          description:
            'Enviamos um link de confirmação para ' +
            email +
            '. Clique nele pra ativar sua conta.',
        });
      } else {
        toast({
          title: 'Cadastro realizado!',
          description: 'Bem-vindo ao GSIA TRAFICS! Seu progresso será salvo automaticamente.',
        });
      }

      return { error: null, needsEmailConfirmation };
    } catch (err) {
      console.error('[AUTH] Erro inesperado no cadastro:', err);
      toast({
        title: 'Erro no cadastro',
        description: 'Falha ao conectar com o servidor. Tente novamente.',
        variant: 'destructive',
      });
      return { error: err as AuthError };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (user) {
        await logActivity('logout', undefined, user.id);
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        toast({
          title: 'Erro ao sair',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Logout realizado',
          description: 'Até logo! Seu progresso foi salvo.',
        });
      }
    } catch (err) {
      console.error('[AUTH] Erro no logout:', err);
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
          title: 'Erro ao atualizar perfil',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });

      return { error: null };
    } catch (err) {
      console.error('[AUTH] Erro ao atualizar perfil:', err);
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
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  return React.createElement(AuthContext.Provider, { value: auth }, children);
};
