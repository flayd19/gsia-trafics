/**
 * ImageCycler — exibe uma lista de imagens em modo carrossel automático.
 *
 * - Troca de foto a cada `intervalMs` (padrão 4s)
 * - Mostra pontinhos de navegação quando há mais de 1 imagem
 * - Faz fade suave entre imagens
 * - Exibe fallback (emoji/placeholder) se não houver imagens
 */

import { useState, useEffect, useCallback } from 'react';

interface ImageCyclerProps {
  /** URLs das imagens a exibir */
  urls: string[];
  /** Fallback exibido quando não há imagens ou todas falharam */
  fallback: React.ReactNode;
  /** Altura do container (default 140) */
  height?: number;
  /** Intervalo de troca em ms (default 4000) */
  intervalMs?: number;
  /** Alt text para acessibilidade */
  alt?: string;
  /** Classes extras para o container externo */
  className?: string;
}

export function ImageCycler({
  urls,
  fallback,
  height = 140,
  intervalMs = 4000,
  alt = 'car',
  className = '',
}: ImageCyclerProps) {
  const [index, setIndex]       = useState(0);
  const [fading, setFading]     = useState(false);
  const [failed, setFailed]     = useState<Set<number>>(new Set());

  // Reset quando a lista de URLs muda (novo batch carregado)
  useEffect(() => {
    setIndex(0);
    setFailed(new Set());
  }, [urls.length]);

  const advanceTo = useCallback((next: number) => {
    setFading(true);
    setTimeout(() => {
      setIndex(next);
      setFading(false);
    }, 200);
  }, []);

  // Ciclo automático
  useEffect(() => {
    const valid = urls.filter((_, i) => !failed.has(i));
    if (valid.length <= 1) return;

    const timer = setInterval(() => {
      setIndex(prev => {
        let next = (prev + 1) % urls.length;
        // Pula imagens com falha
        let attempts = 0;
        while (failed.has(next) && attempts < urls.length) {
          next = (next + 1) % urls.length;
          attempts++;
        }
        advanceTo(next);
        return prev; // advanceTo cuidará do update real
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [urls, failed, intervalMs, advanceTo]);

  const validUrls = urls.filter((_, i) => !failed.has(i));
  const currentUrl = urls[index];
  const hasFailed  = failed.has(index);

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      {currentUrl && !hasFailed ? (
        <>
          <img
            key={currentUrl}
            src={currentUrl}
            alt={alt}
            className="w-full h-full object-cover"
            style={{
              opacity: fading ? 0 : 1,
              transition: 'opacity 0.2s ease',
            }}
            onError={() => {
              setFailed(prev => {
                const next = new Set(prev);
                next.add(index);
                return next;
              });
            }}
          />

          {/* Pontinhos de navegação */}
          {validUrls.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
              {urls.map((_, i) =>
                failed.has(i) ? null : (
                  <span
                    key={i}
                    className="inline-block rounded-full"
                    style={{
                      width: i === index ? 12 : 5,
                      height: 5,
                      background: i === index
                        ? 'rgba(255,255,255,0.95)'
                        : 'rgba(255,255,255,0.45)',
                      transition: 'all 0.25s ease',
                    }}
                  />
                )
              )}
            </div>
          )}

          {/* Badge de contagem */}
          {validUrls.length > 1 && (
            <div
              className="absolute top-2 left-2 rounded-full px-1.5 py-0.5"
              style={{
                background: 'rgba(0,0,0,0.45)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: '14px',
              }}
            >
              {validUrls.indexOf(urls[index]) + 1}/{validUrls.length}
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  );
}
