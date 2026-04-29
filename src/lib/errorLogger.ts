// =====================================================================
// errorLogger — captura falhas de RPC/Supabase e envia para admin_error_logs
//
// Uso típico:
//   import { logRpcError } from '@/lib/errorLogger';
//
//   const { data, error } = await supabase.rpc('foo', { ... });
//   if (error) {
//     logRpcError('foo', error, { args });
//     return;
//   }
//
// O log é fire-and-forget: nunca bloqueia o fluxo normal da app, e falhas
// no próprio log são silenciadas (não geram loop).
// =====================================================================
import { supabase } from '@/integrations/supabase/client';

export interface RpcErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const PENDING_TIMEOUT_MS = 5_000;

/**
 * Loga um erro de RPC/Supabase. Não retorna nada e nunca lança — é
 * intencionalmente assíncrono e tolerante a falhas.
 */
export function logRpcError(
  functionName: string,
  error: unknown,
  payload?: Record<string, unknown>
): void {
  // Extrai mensagem/código de forma defensiva
  let message = 'unknown_error';
  let code: string | undefined;

  if (error instanceof Error) {
    message = error.message ?? message;
  } else if (error && typeof error === 'object') {
    const e = error as RpcErrorLike;
    message = e.message ?? e.details ?? message;
    code    = e.code;
  } else if (typeof error === 'string') {
    message = error;
  }

  // Truncamento defensivo
  if (message.length > 1000) message = message.slice(0, 1000);

  // Disparo fire-and-forget — não awaita
  void Promise.race([
    supabaseRpcLogError(functionName, message, code, payload),
    new Promise(resolve => setTimeout(resolve, PENDING_TIMEOUT_MS)),
  ]).catch(() => { /* silencioso por design */ });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function supabaseRpcLogError(
  functionName: string,
  message: string,
  code: string | undefined,
  payload: Record<string, unknown> | undefined
): Promise<void> {
  try {
    await (supabase as any).rpc('admin_log_error', {
      p_function_name: functionName,
      p_error_message: message,
      p_error_code:    code ?? null,
      p_payload:       payload ?? null,
    });
  } catch {
    /* silencioso */
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
