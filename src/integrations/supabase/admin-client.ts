// =====================================================================
// admin-client — cliente Supabase derivado que injeta o header
// `x-admin-token` em toda requisição. Usado pelas chamadas admin_*
// para autenticar a sessão admin INDEPENDENTE da auth.uid() do jogo.
//
// Quando o token muda (login/logout), o cliente é recriado.
// =====================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getAdminTokenString } from '@/lib/adminAuth';

const FALLBACK_URL = 'https://ebudhqndkxiorisnyjoh.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidWRocW5ka3hpb3Jpc255am9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjEwMTksImV4cCI6MjA5MjUzNzAxOX0.s7I9xoa2rtRfklCBcyCppzSzmI5e-pjq_PlyOEMOuro';

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_KEY;

let cachedClient: SupabaseClient<Database> | null = null;
let cachedToken:  string | null                   = null;

/**
 * Retorna um cliente Supabase com o header `x-admin-token` configurado
 * com o token atual da sessão admin. Recria o cliente apenas quando o
 * token muda. Se não houver token, retorna um cliente sem header (que
 * vai falhar nas RPCs admin_* — é responsabilidade do caller verificar
 * `hasAdminToken()` antes).
 */
export function getAdminClient(): SupabaseClient<Database> {
  const token = getAdminTokenString();
  if (cachedClient && cachedToken === token) {
    return cachedClient;
  }
  cachedToken = token;
  cachedClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Não persistimos sessão Supabase aqui — admin é sessão própria
      persistSession:   false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? { 'x-admin-token': token } : {},
    },
  });
  return cachedClient;
}

/**
 * Invalida o cache para forçar reconstrução na próxima chamada.
 * Use após login/logout admin.
 */
export function resetAdminClient(): void {
  cachedClient = null;
  cachedToken  = null;
}
