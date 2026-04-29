// =====================================================================
// adminAuth — armazenamento simples da senha admin no sessionStorage.
//
// O servidor valida a senha em cada chamada de RPC admin_*. Aqui só
// guardamos a senha pra não pedir ao admin a cada clique. A senha
// expira ao fechar o navegador (sessionStorage), e tem TTL de 8h.
// =====================================================================
const ADMIN_KEY = 'gsia_admin_pw_v3';
const TTL_MS    = 8 * 60 * 60 * 1000;

interface StoredAdminPw {
  pw:        string;
  savedAt:   number;
}

export function setAdminPassword(pw: string): void {
  if (!pw) return;
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ pw, savedAt: Date.now() }));
}

export function getAdminPassword(): string | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAdminPw>;
    if (typeof parsed.pw !== 'string' || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(ADMIN_KEY);
      return null;
    }
    return parsed.pw;
  } catch {
    return null;
  }
}

export function clearAdminPassword(): void {
  sessionStorage.removeItem(ADMIN_KEY);
}

export function hasAdminPassword(): boolean {
  return getAdminPassword() !== null;
}
