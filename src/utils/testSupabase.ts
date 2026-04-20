import { supabase } from '@/integrations/supabase/client';

export const testSupabaseConnection = async () => {
  try {
    console.log('🔗 Testando conexão com Supabase...');
    
    // Teste básico de conexão - verificar se conseguimos acessar as tabelas
    const { data, error } = await supabase
      .from('player_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na conexão:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Conexão com Supabase estabelecida com sucesso!');
    console.log('📊 Dados retornados:', data);
    
    // Teste de autenticação
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Usuário atual:', user ? user.email : 'Não logado');
    
    return { success: true, user };
    
  } catch (err: any) {
    console.error('❌ Erro inesperado:', err.message);
    return { success: false, error: err.message };
  }
};

// Adicionar função global para teste no console
if (typeof window !== 'undefined') {
  (window as any).testSupabase = testSupabaseConnection;
}