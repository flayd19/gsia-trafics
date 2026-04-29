// =====================================================================
// useCustomCars — carrega carros customizados do servidor (admin_custom_cars)
// e expõe um catálogo combinado (estáticos + custom) + pesos de categoria.
//
// O hook é usado pelo `useGlobalMarketplace` e `useCarGameLogic` para
// gerar o batch do mercado considerando as adições dinâmicas.
// =====================================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logRpcError } from '@/lib/errorLogger';
import { registerCustomCarImages } from '@/data/carImageService';
import type { CarModel, CarCategory } from '@/data/cars';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface MarketConfigSnapshot {
  weights:           Partial<Record<CarCategory, number>>;
  minBatch:          number;
  maxBatch:          number;
  popularMinRatio:   number;
  maxSameModel:      number;
}

export interface CustomCarsState {
  customCars:    CarModel[];
  marketConfig:  MarketConfigSnapshot | null;
  loaded:        boolean;
  error:         string | null;
}

const POLL_MS = 5 * 60 * 1000;

export function useCustomCars(): CustomCarsState & { reload: () => Promise<void> } {
  const [customCars,    setCustomCars]   = useState<CarModel[]>([]);
  const [marketConfig,  setMarketConfig] = useState<MarketConfigSnapshot | null>(null);
  const [loaded,        setLoaded]       = useState(false);
  const [error,         setError]        = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // Carros customizados ativos
      const { data: carRows, error: carErr } = await db()
        .from('admin_custom_cars')
        .select('*')
        .eq('active', true);

      if (carErr) {
        logRpcError('admin_custom_cars.select', carErr);
        setError('Falha ao carregar carros custom.');
      } else {
        const rows = (carRows ?? []) as RawCustomCarRow[];
        setCustomCars(rowsToCarModels(rows));
        // Dispara fetch de fotos da Wikipedia (assíncrono, não bloqueia)
        void registerCustomCarImages(rows.map(r => ({
          id:         r.id,
          wiki_pt:    r.wiki_pt,
          wiki_en:    r.wiki_en,
          image_urls: r.image_urls,
        })));
      }

      // Configuração do mercado
      const { data: cfg, error: cfgErr } = await db().rpc('get_full_market_config');
      if (cfgErr) {
        logRpcError('get_full_market_config', cfgErr);
        setMarketConfig(null);
      } else if (cfg) {
        const c = cfg as Record<string, unknown>;
        const weights = (c['category_weights'] ?? {}) as Record<string, number>;
        const minBatch = Number(c['min_batch'] ?? 1000);
        const maxBatch = Number(c['max_batch'] ?? 1200);
        const popularMinRatio = Number(c['popular_min_ratio'] ?? 0.40);
        const maxSameModel    = Number(c['max_same_model']    ?? 4);

        setMarketConfig({
          weights:         normalizeWeights(weights),
          minBatch:        Number.isFinite(minBatch) && minBatch > 0 ? minBatch : 1000,
          maxBatch:        Number.isFinite(maxBatch) && maxBatch >= minBatch ? maxBatch : 1200,
          popularMinRatio: Number.isFinite(popularMinRatio) ? popularMinRatio : 0.40,
          maxSameModel:    Number.isFinite(maxSameModel) && maxSameModel > 0 ? maxSameModel : 4,
        });
      }

      setError(null);
    } finally {
      inFlightRef.current = false;
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  return { customCars, marketConfig, loaded, error, reload };
}

// ── Helpers ─────────────────────────────────────────────────────────

interface RawCustomCarRow {
  id:         string;
  brand:      string;
  model:      string;
  icon:       string;
  category:   string;
  variants:   unknown;
  wiki_pt:    string | null;
  wiki_en:    string | null;
  image_urls: string[] | null;
  active:     boolean;
}

function rowsToCarModels(rows: RawCustomCarRow[]): CarModel[] {
  const valid: CarModel[] = [];
  for (const r of rows) {
    const variants = Array.isArray(r.variants) ? r.variants : [];
    const cleanVariants = variants
      .filter((v): v is { id: string; trim: string; year: number; fipePrice: number } => {
        if (!v || typeof v !== 'object') return false;
        const o = v as Record<string, unknown>;
        return (
          typeof o.id === 'string' &&
          typeof o.trim === 'string' &&
          typeof o.year === 'number' &&
          typeof o.fipePrice === 'number' &&
          o.fipePrice > 0
        );
      });
    if (cleanVariants.length === 0) continue;
    if (!isValidCategory(r.category)) continue;
    valid.push({
      id:       r.id,
      brand:    r.brand,
      model:    r.model,
      icon:     r.icon,
      category: r.category,
      variants: cleanVariants,
    });
  }
  return valid;
}

const VALID_CATEGORIES: CarCategory[] = [
  'popular', 'medio', 'suv', 'pickup', 'esportivo',
  'eletrico', 'classico', 'luxo', 'jdm', 'supercar',
];

function isValidCategory(c: string): c is CarCategory {
  return (VALID_CATEGORIES as string[]).includes(c);
}

function normalizeWeights(raw: Record<string, number>): Partial<Record<CarCategory, number>> {
  const out: Partial<Record<CarCategory, number>> = {};
  for (const cat of VALID_CATEGORIES) {
    const v = Number(raw[cat] ?? 0);
    if (Number.isFinite(v) && v >= 0) out[cat] = v;
  }
  return out;
}
