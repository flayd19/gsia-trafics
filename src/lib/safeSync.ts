/**
 * safeSync — Utilitário central de rede para chamadas Supabase.
 *
 * Problemas que resolve:
 *  - Backend offline/indisponível → console floods com "Failed to fetch"
 *  - Múltiplos toasts destrutivos em sequência
 *  - Fetchs sem timeout travando por 30s
 *  - Retentar infinitamente quando o servidor morreu
 *
 * API principal:
 *  - safeCall(name, fn): executa fn() com timeout, circuit breaker e dedup de log
 *  - showOfflineToast(): mostra UM toast de "offline" por minuto, no máximo
 *  - isLocalSession(): detecta modo teste local (não deve tocar rede)
 */
import { toast } from '@/hooks/use-toast';

// =========================================================
// Configuração
// =========================================================
const DEFAULT_TIMEOUT_MS = 8_000;
const CIRCUIT_OPEN_MS = 60_000;          // 60s aberto após abrir
const CIRCUIT_FAILURE_THRESHOLD = 3;     // 3 falhas consecutivas → abre
const LOG_DEDUP_MS = 30_000;             // mesma msg não loga 2x em 30s
const TOAST_COOLDOWN_MS = 60_000;        // 1 toast por minuto por tipo

// =========================================================
// Estado (singleton por módulo)
// =========================================================
interface CircuitState {
  failures: number;
  openedAt: number;
  lastErrorMessage: string | null;
}

const circuits = new Map<string, CircuitState>();
const lastLogAt = new Map<string, number>();
const lastToastAt = new Map<string, number>();

const getCircuit = (key: string): CircuitState => {
  let c = circuits.get(key);
  if (!c) {
    c = { failures: 0, openedAt: 0, lastErrorMessage: null };
    circuits.set(key, c);
  }
  return c;
};

const isCircuitOpen = (key: string): boolean => {
  const c = getCircuit(key);
  if (c.failures < CIRCUIT_FAILURE_THRESHOLD) return false;
  if (Date.now() - c.openedAt < CIRCUIT_OPEN_MS) return true;
  // Meia-abertura: reseta falhas pra deixar 1 tentativa passar
  c.failures = 0;
  return false;
};

const recordSuccess = (key: string) => {
  const c = getCircuit(key);
  c.failures = 0;
  c.lastErrorMessage = null;
};

const recordFailure = (key: string, err: unknown) => {
  const c = getCircuit(key);
  c.failures += 1;
  c.lastErrorMessage = err instanceof Error ? err.message : String(err);
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    c.openedAt = Date.now();
  }
};

// =========================================================
// Log com dedup
// =========================================================
const logOnce = (key: string, ...args: unknown[]) => {
  const now = Date.now();
  const last = lastLogAt.get(key) || 0;
  if (now - last < LOG_DEDUP_MS) return;
  lastLogAt.set(key, now);
  console.warn(`[safeSync:${key}]`, ...args);
};

// =========================================================
// Toast com cooldown
// =========================================================
export const throttledToast = (
  key: string,
  opts: { title: string; description?: string; variant?: 'default' | 'destructive' }
) => {
  const now = Date.now();
  const last = lastToastAt.get(key) || 0;
  if (now - last < TOAST_COOLDOWN_MS) return;
  lastToastAt.set(key, now);
  toast(opts);
};

export const showOfflineToast = () =>
  throttledToast('offline', {
    title: 'Sem conexão',
    description: 'Progresso salvo apenas localmente até voltar online.',
  });

// =========================================================
// Detecção de modo teste local (DEPRECADO)
// -----------------------------------------------------------
// O modo "teste local" foi removido do fluxo de auth — todos os jogadores
// entram via Supabase real agora. Mantemos esta função apenas como
// retorno sempre-false para não quebrar chamadas legadas.
// =========================================================
export const isLocalSession = (): boolean => false;

// =========================================================
// Timeout helper (AbortController)
// =========================================================
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller: AbortController
): Promise<T> => {
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
};

// =========================================================
// safeCall — núcleo
// =========================================================
export interface SafeCallResult<T> {
  ok: boolean;
  data: T | null;
  skipped: boolean;   // true se circuit aberto ou offline (sem tentativa)
  error?: unknown;
}

export interface SafeCallOptions {
  timeoutMs?: number;
  skipInLocalSession?: boolean; // default true
}

/**
 * Executa `fn()` de forma segura. Nunca rejeita — retorna SafeCallResult.
 *
 * - Se estiver em modo teste local → skipa (ok: false, skipped: true)
 * - Se circuit aberto → skipa
 * - Se navigator.onLine === false → skipa
 * - Se der erro de rede 3x consecutivas → abre circuit por 60s
 * - Log de erro no máximo 1x a cada 30s por key
 */
export const safeCall = async <T>(
  key: string,
  fn: (signal: AbortSignal) => Promise<T>,
  opts: SafeCallOptions = {}
): Promise<SafeCallResult<T>> => {
  const skipInLocal = opts.skipInLocalSession !== false;

  if (skipInLocal && isLocalSession()) {
    return { ok: false, data: null, skipped: true };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, data: null, skipped: true };
  }

  if (isCircuitOpen(key)) {
    return { ok: false, data: null, skipped: true };
  }

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const data = await withTimeout(fn(controller.signal), timeoutMs, controller);
    recordSuccess(key);
    return { ok: true, data, skipped: false };
  } catch (err) {
    recordFailure(key, err);
    const c = getCircuit(key);
    logOnce(
      key,
      c.failures >= CIRCUIT_FAILURE_THRESHOLD
        ? `circuit opened after ${c.failures} failures — last error: ${c.lastErrorMessage}`
        : `call failed (${c.failures}/${CIRCUIT_FAILURE_THRESHOLD}): ${c.lastErrorMessage}`
    );
    return { ok: false, data: null, skipped: false, error: err };
  }
};

// =========================================================
// localStorage helpers (fallback em modo teste)
// =========================================================
const LOCAL_SAVE_PREFIX = 'gsia_local_save_';

export const readLocalSave = <T = unknown>(userId: string): T | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_PREFIX + userId);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeLocalSave = (userId: string, data: unknown): boolean => {
  try {
    localStorage.setItem(LOCAL_SAVE_PREFIX + userId, JSON.stringify(data));
    return true;
  } catch (err) {
    logOnce('localsave', 'Failed to write localStorage save:', err);
    return false;
  }
};

// =========================================================
// Debug/reset helpers (útil em DevTools)
// =========================================================
export const _resetCircuit = (key?: string) => {
  if (key) circuits.delete(key);
  else circuits.clear();
};

if (typeof window !== 'undefined') {
  // @ts-expect-error debug handle
  window.__gsiaSafeSync = { _resetCircuit, circuits, lastLogAt, lastToastAt };
}
