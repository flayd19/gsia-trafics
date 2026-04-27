/**
 * useCarImages — hook que re-renderiza quando novos batches de imagens chegam.
 *
 * Retorna:
 *   getImg(modelId)                    → primeira URL (string | undefined)
 *   getImgs(modelId)                   → todas as URLs (string[])
 *   getImgForInstance(modelId, instId) → foto determinística por instância
 *     └─ Carros do mesmo modelo (ex: 3 Gols) exibem fotos diferentes.
 *        O mesmo instId sempre retorna a mesma foto (estável entre renders).
 */

import { useReducer, useEffect } from 'react';
import {
  prefetchAllCarImages,
  getCachedUrl,
  getCachedUrls,
  getImageForInstance,
  subscribeToImageUpdates,
} from '@/data/carImageService';

interface UseCarImagesResult {
  getImg: (modelId: string) => string | undefined;
  getImgs: (modelId: string) => string[];
  getImgForInstance: (modelId: string, instanceId: string) => string | undefined;
}

export function useCarImages(): UseCarImagesResult {
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = subscribeToImageUpdates(bump);
    void prefetchAllCarImages();
    return unsub;
  }, []);

  return { getImg: getCachedUrl, getImgs: getCachedUrls, getImgForInstance: getImageForInstance };
}
