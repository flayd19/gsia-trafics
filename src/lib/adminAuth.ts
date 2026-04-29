// =====================================================================
// adminAuth — utilitários para validar acesso ao painel admin no client.
//
// O token é GRAVADO em sessionStorage após verify_admin_password retornar
// true. Ele é apenas um "selo" client-side — toda RPC sensível ainda
// chama is_admin() server-side via SECURITY DEFINER, então mesmo que
// alguém forge o token, não consegue executar ações privilegiadas.
// =====================================================================
export const ADMIN_TOKEN_KEY = 'gsia_admin_token_v1';

/** Validade do token em ms (8h). */
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

interface AdminTokenPayload {
  uid: string;
  ts:  number;
}

export function getAdminToken(): AdminTokenPayload | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminTokenPayload>;
    if (typeof parsed.uid !== 'string' || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > ADMIN_TOKEN_TTL_MS) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      return null;
    }
    return { uid: parsed.uid, ts: parsed.ts };
  } catch {
    return null;
  }
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return getAdminToken() !== null;
}
