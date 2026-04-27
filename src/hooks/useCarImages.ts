/**
 * useCarImages — hook que retorna uma função getImg(modelId) com URLs reais
 * buscadas da Wikipedia. Re-renderiza o componente quando novos batches chegam.
 *
 * Exemplo:
 *   const getImg = useCarImages();
 *   <img src={getImg('civic')} />
 */

import { useReducer, useEffect } from 'react';
import {
  prefetchAllCarImages,
  getCachedUrl,
  subscribeToImageUpdates,
} from '@/data/carImageService';

export function useCarImages(): (modelId: string) => string | undefined {
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = subscribeToImageUpdates(bump);
    void prefetchAllCarImages();
    return unsub;
  }, []);

  return getCachedUrl;
}
