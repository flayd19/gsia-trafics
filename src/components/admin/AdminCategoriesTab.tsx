// =====================================================================
// AdminCategoriesTab — pesos % por categoria do mercado
//
// Edição:
//   • Slider 0-100 por categoria (10 categorias)
//   • Soma SEMPRE deve fechar 100% (validação client + server)
//   • Botão "Distribuir igualmente" para reset rápido
//   • Indicador visual de soma e diferença
//
// Persistência:
//   • Salva via admin_update_full_market_config (preserva min/max batch)
//   • Toast de sucesso/erro
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useAdminApi, type AdminFullMarketConfig } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PieChart, Loader2, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  popular:   { label: 'Popular',          emoji: '🚘' },
  medio:     { label: 'Médio',            emoji: '🚙' },
  suv:       { label: 'SUV',              emoji: '🚐' },
  pickup:    { label: 'Pickup',           emoji: '🛻' },
  esportivo: { label: 'Esportivo',        emoji: '🏎️' },
  eletrico:  { label: 'Elétrico',         emoji: '🔌' },
  classico:  { label: 'Clássico',         emoji: '🚖' },
  luxo:      { label: 'Luxo',             emoji: '🚗' },
  jdm:       { label: 'JDM',              emoji: '🏯' },
  supercar:  { label: 'Superesportivo',   emoji: '🏁' },
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export function AdminCategoriesTab(): JSX.Element {
  const api = useAdminApi();
  const [config,  setConfig]  = useState<AdminFullMarketConfig | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const reload = async () => {
    setLoading(true);
    const cfg = await api.getFullMarketConfig();
    setConfig(cfg);
    if (cfg) {
      // Garante que TODAS as 10 categorias tenham um valor (default 0 se faltar)
      const filled: Record<string, number> = {};
      for (const cat of CATEGORIES) {
        filled[cat] = Math.max(0, Math.round(Number(cfg.category_weights[cat] ?? 0)));
      }
      setWeights(filled);
    }
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const total = useMemo(
    () => Object.values(weights).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
    [weights],
  );

  const dirty = useMemo(() => {
    if (!config) return false;
    for (const cat of CATEGORIES) {
      const original = Math.round(Number(config.category_weights[cat] ?? 0));
      if ((weights[cat] ?? 0) !== original) return true;
    }
    return false;
  }, [config, weights]);

  const isValid = total === 100;

  const updateWeight = (cat: string, value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setWeights(w => ({ ...w, [cat]: v }));
  };

  const distributeEqually = () => {
    const equal = Math.floor(100 / CATEGORIES.length);
    const remainder = 100 - equal * CATEGORIES.length;
    const next: Record<string, number> = {};
    CATEGORIES.forEach((cat, i) => {
      next[cat] = equal + (i < remainder ? 1 : 0);
    });
    setWeights(next);
  };

  const resetToServer = () => {
    if (!config) return;
    const filled: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      filled[cat] = Math.round(Number(config.category_weights[cat] ?? 0));
    }
    setWeights(filled);
  };

  const handleSave = async () => {
    if (!isValid) {
      toast.error(`Soma deve ser exatamente 100% (atual: ${total}%).`);
      return;
    }
    if (!config) return;
    setSaving(true);
    try {
      await api.updateFullMarketConfig({
        weights,
        minBatch: config.min_batch,
        maxBatch: config.max_batch,
      });
      toast.success('Distribuição salva. Próxima geração de batch usa esses pesos.');
      await reload();
    } catch {
      toast.error('Falha ao salvar — veja a aba Erros.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ios-surface rounded-[16px] p-6 text-center text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Carregando configuração...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
        <AlertCircle size={28} className="mx-auto text-red-400" />
        <div className="text-sm font-semibold">Falha ao carregar configuração.</div>
        <Button size="sm" variant="outline" onClick={reload}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <PieChart size={18} className="text-primary" /> Distribuição por categoria
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            % de cada categoria no batch gerado. Soma deve fechar 100%.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={distributeEqually} className="gap-1.5 text-xs">
            Distribuir igual
          </Button>
          <Button size="sm" variant="outline" onClick={resetToServer} disabled={!dirty} className="gap-1.5 text-xs">
            <RotateCcw size={11} /> Descartar
          </Button>
        </div>
      </div>

      {/* Indicador de soma */}
      <div className={`ios-surface rounded-[12px] p-3 flex items-center justify-between ${
        isValid ? 'border border-emerald-500/30' : 'border border-amber-500/40'
      }`}>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Total
          </div>
          <div className={`text-2xl font-bold tabular-nums ${
            isValid ? 'text-emerald-500' : 'text-amber-500'
          }`}>
            {total}%
          </div>
        </div>
        <div className="text-right">
          {isValid ? (
            <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-semibold">
              <CheckCircle2 size={14} /> Pronto para salvar
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-500 text-xs font-semibold">
              <AlertCircle size={14} />
              {total > 100 ? `Excesso de ${total - 100}%` : `Faltam ${100 - total}%`}
            </div>
          )}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2">
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_LABELS[cat];
          const v = weights[cat] ?? 0;
          return (
            <div key={cat} className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
              <div className="text-2xl shrink-0">{meta.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={v}
                      onChange={e => updateWeight(cat, parseInt(e.target.value || '0', 10))}
                      className="w-16 text-xs text-right tabular-nums h-7 px-2"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={v}
                  onChange={e => updateWeight(cat, parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={!isValid || !dirty || saving}
        className="w-full gap-1.5"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        {saving ? 'Salvando...' : 'Salvar distribuição'}
      </Button>

      <div className="text-xs text-muted-foreground italic">
        A nova distribuição entra em vigor no <strong>próximo batch</strong> gerado. Para aplicar
        agora, use <strong>Limpar e regenerar</strong> na aba Mercado.
      </div>
    </div>
  );
}
