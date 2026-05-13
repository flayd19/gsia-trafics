// =====================================================================
// usePWAInstall.ts — Detecta se pode/deve mostrar prompt de instalação PWA
// iOS: instruções manuais (Safari Add to Home Screen)
// Android/Chrome: BeforeInstallPromptEvent nativo
// =====================================================================

import { useState, useEffect } from 'react';

type InstallState =
  | 'not-applicable'   // já instalado como PWA, ou não suportado
  | 'ios-safari'       // iOS Safari — precisa de instrução manual
  | 'android-chrome';  // Chrome/Edge — prompt nativo disponível

interface UsePWAInstallReturn {
  installState: InstallState;
  triggerInstall: () => Promise<void>;
  dismissInstall: () => void;
}

const DISMISS_KEY = 'cadeia_pwa_install_dismissed';

export function usePWAInstall(): UsePWAInstallReturn {
  const [installState, setInstallState] = useState<InstallState>('not-applicable');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Se já está rodando como standalone (instalado), não mostra
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Se usuário já dismissou
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIOS && isSafari) {
      setInstallState('ios-safari');
      return;
    }

    // Chrome/Edge com BeforeInstallPromptEvent
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallState('android-chrome');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function triggerInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallState('not-applicable');
        setDeferredPrompt(null);
      }
    }
  }

  function dismissInstall() {
    localStorage.setItem(DISMISS_KEY, '1');
    setInstallState('not-applicable');
  }

  return { installState, triggerInstall, dismissInstall };
}
