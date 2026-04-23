import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// -----------------------------------------------------------------
// Credenciais do Supabase
// -----------------------------------------------------------------
// Prioridade:
//   1) Variáveis de ambiente VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//      (defina em um arquivo .env.local na raiz do projeto)
//   2) Fallback hardcoded abaixo (modo compatibilidade)
//
// Pra trocar de projeto no futuro, crie (ou edite) um arquivo .env.local
// na raiz do repo com:
//
//   VITE_SUPABASE_URL=https://seuprojetonovo.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//
// e reinicie o dev server (npm run dev). No deploy (Vercel/Netlify),
// configure essas mesmas variáveis no painel do provedor.
// -----------------------------------------------------------------

const FALLBACK_URL = 'https://ebudhqndkxiorisnyjoh.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidWRocW5ka3hpb3Jpc255am9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjEwMTksImV4cCI6MjA5MjUzNzAxOX0.s7I9xoa2rtRfklCBcyCppzSzmI5e-pjq_PlyOEMOuro';

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_KEY;

// Aviso no console se está usando o fallback em prod — ajuda a debugar
// o "por que meu backend não responde" depois de trocar de projeto.
if (typeof window !== 'undefined' && SUPABASE_URL === FALLBACK_URL) {
  const isProd = import.meta.env?.PROD;
  if (isProd) {
    console.warn(
      '[supabase] Usando URL de fallback. Configure VITE_SUPABASE_URL em variáveis de ambiente.'
    );
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
