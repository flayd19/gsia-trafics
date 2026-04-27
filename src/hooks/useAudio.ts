import { useCallback, useRef } from 'react';

interface AudioOptions {
  volume?: number;
  loop?: boolean;
}

export const useAudio = () => {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  const playSound = useCallback((soundPath: string, options: AudioOptions = {}) => {
    try {
      const { volume = 0.5, loop = false } = options;
      
      // Verificar se o áudio já está no cache
      let audio = audioCache.current.get(soundPath);
      
      if (!audio) {
        // Criar novo elemento de áudio
        audio = new Audio(soundPath);
        audio.preload = 'auto';
        audioCache.current.set(soundPath, audio);
      }
      
      // Configurar propriedades
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = loop;
      
      // Resetar o tempo para permitir reprodução múltipla
      audio.currentTime = 0;
      
      // Reproduzir o som
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // BUG FIX: silenciar warns em produção. Falha de reprodução de áudio
          // é comum (autoplay bloqueado, sem interação do usuário) e não deve
          // poluir o console.
        });
      }
    } catch {
      // Silencia falha de carregamento (asset 404, codec incompatível, etc).
    }
  }, []);

  const stopSound = useCallback((soundPath: string) => {
    const audio = audioCache.current.get(soundPath);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    audioCache.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  // Sons específicos do jogo
  const playClickSound = useCallback(() => {
    playSound('/sounds/click.mp3', { volume: 0.3 });
  }, [playSound]);

  const playMoneySound = useCallback(() => {
    playSound('/sounds/money.mp3', { volume: 0.4 });
  }, [playSound]);

  return {
    playSound,
    stopSound,
    stopAllSounds,
    playClickSound,
    playMoneySound
  };
};

export default useAudio;