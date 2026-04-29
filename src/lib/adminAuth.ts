// =====================================================================
// adminAuth — gerenciamento do token de sessão admin (independente
// do auth.uid() do jogo).
//
// O token é um UUID retornado por admin_login(username, password) e
// validado server-side via header HTTP `x-admin-token` que o
// useAdminApi inclui em toda chamada.
// =====================================================================
export const ADMIN_TOKEN_KEY = 'gsia_admin_token_v2';

interface AdminTokenPayload {
  token:      string;
  expiresAt:  number;
}

export function getAdminToken(): AdminTokenPayload | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminTokenPayload>;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      return null;
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, expiresAtIso: string): void {
  const expiresAt = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt)) return;
  sessionStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify({ token, expiresAt }));
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return getAdminToken() !== null;
}

/** Retorna apenas a string do token, ou null se não houver/expirou. */
export function getAdminTokenString(): string | null {
  return getAdminToken()?.token ?? null;
}
