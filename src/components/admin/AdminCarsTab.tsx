// =====================================================================
// AdminCarsTab — criar e listar carros do catálogo
//
// Mostra:
//   • Carros estáticos (CAR_MODELS de cars.ts)        — somente leitura
//   • Carros customizados (admin_custom_cars)         — editar / desativar
//
// Criação:
//   • Form com id (slug), brand, model, icon, category, variants[]
//   • wiki_pt e wiki_en para o serviço de fotos buscar automaticamente
//   • Image URLs manuais (opcional, override quando a API falha)
//
// Validação client-side ANTES de chamar RPC:
//   • id: slug único (não pode colidir com CAR_MODELS estáticos)
//   • brand/model/icon: obrigatórios
//   • variants: pelo menos 1 com year+fipePrice válidos
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useAdminApi, type AdminCustomCar } from '@/hooks/useAdminApi';
import { CAR_MODELS, type CarCategory } from '@/data/cars';
import { getCachedUrls } from '@/data/carImageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Car as CarIcon, Plus, Trash2, ImageOff, X, Search, Loader2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface DraftVariant {
  id:        string;
  trim:      string;
  year:      string;
  fipePrice: string;
}

interface CarDraft {
  id:        string;
  brand:     string;
  model:     string;
  icon:      string;
  category:  CarCategory;
  variants:  DraftVariant[];
  wikiPt:    string;
  wikiEn:    string;
  imageUrls: string;
}

const EMPTY_DRAFT: CarDraft = {
  id: '', brand: '', model: '', icon: '🚗',
  category: 'popular',
  variants: [{ id: '', trim: '', year: String(new Date().getFullYear()), fipePrice: '' }],
  wikiPt: '', wikiEn: '', imageUrls: '',
};

const CATEGORY_OPTIONS: { value: CarCategory; label: string }[] = [
  { value: 'popular',   label: 'Popular' },
  { value: 'medio',     label: 'Médio' },
  { value: 'suv',       label: 'SUV' },
  { value: 'pickup',    label: 'Pickup' },
  { value: 'esportivo', label: 'Esportivo' },
  { value: 'eletrico',  label: 'Elétrico' },
  { value: 'classico',  label: 'Clássico' },
  { value: 'luxo',      label: 'Luxo' },
  { value: 'jdm',       label: 'JDM' },
  { value: 'supercar',  label: 'Superesportivo' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

const slugify = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function AdminCarsTab(): JSX.Element {
  const api = useAdminApi();
  const [customCars, setCustomCars] = useState<AdminCustomCar[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft,      setDraft]      = useState<CarDraft>(EMPTY_DRAFT);
  const [saving,     setSaving]     = useState(false);

  const reload = async () => {
    setLoading(true);
    setCustomCars(await api.listCustomCars());
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  // ── Combina carros estáticos + custom para listagem ─────────────
  type CombinedCar = {
    id:        string;
    source:    'static' | 'custom';
    brand:     string;
    model:     string;
    icon:      string;
    category:  string;
    variantCount: number;
    sample:    string; // primeiro trim
    fipeMin:   number;
    fipeMax:   number;
    photoUrl?: string;
    active:    boolean;
  };

  const combined: CombinedCar[] = useMemo(() => {
    const fromStatic: CombinedCar[] = CAR_MODELS.map(m => {
      const fipes = m.variants.map(v => v.fipePrice);
      const photos = getCachedUrls(m.id);
      return {
        id:           m.id,
        source:       'static',
        brand:        m.brand,
        model:        m.model,
        icon:         m.icon,
        category:     m.category,
        variantCount: m.variants.length,
        sample:       m.variants[0]?.trim ?? '',
        fipeMin:      Math.min(...fipes),
        fipeMax:      Math.max(...fipes),
        photoUrl:     photos[0],
        active:       true,
      };
    });
    const fromCustom: CombinedCar[] = customCars.map(c => {
      const variants = (c.variants ?? []) as Array<{ trim: string; fipePrice: number }>;
      const fipes = variants.map(v => Number(v.fipePrice ?? 0)).filter(n => Number.isFinite(n) && n > 0);
      const photos = getCachedUrls(c.id);
      return {
        id:           c.id,
        source:       'custom',
        brand:        c.brand,
        model:        c.model,
        icon:         c.icon,
        category:     c.category,
        variantCount: variants.length,
        sample:       variants[0]?.trim ?? '',
        fipeMin:      fipes.length > 0 ? Math.min(...fipes) : 0,
        fipeMax:      fipes.length > 0 ? Math.max(...fipes) : 0,
        photoUrl:     photos[0] ?? c.image_urls?.[0],
        active:       c.active,
      };
    });
    return [...fromCustom, ...fromStatic];
  }, [customCars]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combined.filter(c => {
      if (!showInactive && !c.active) return false;
      if (!q) return true;
      return (
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [combined, search, showInactive]);

  // ── Handlers ────────────────────────────────────────────────────
  const startCreate = () => {
    setDraft(EMPTY_DRAFT);
    setCreateOpen(true);
  };

  const handleAutoSlug = (brand: string, model: string) => {
    if (!draft.id) {
      const slug = slugify(`${brand}_${model}`);
      setDraft(d => ({ ...d, id: slug }));
    }
  };

  const updateVariant = (index: number, patch: Partial<DraftVariant>) => {
    setDraft(d => ({
      ...d,
      variants: d.variants.map((v, i) => i === index ? { ...v, ...patch } : v),
    }));
  };

  const addVariant = () => {
    setDraft(d => ({
      ...d,
      variants: [...d.variants, { id: '', trim: '', year: String(new Date().getFullYear()), fipePrice: '' }],
    }));
  };

  const removeVariant = (index: number) => {
    setDraft(d => ({ ...d, variants: d.variants.filter((_, i) => i !== index) }));
  };

  const validate = (): string | null => {
    if (!draft.id.trim())    return 'ID (slug) é obrigatório.';
    if (!/^[a-z0-9_]+$/.test(draft.id)) return 'ID deve ser slug (a-z, 0-9, _).';
    if (CAR_MODELS.some(m => m.id === draft.id)) {
      return 'ID já existe no catálogo estático. Use outro slug.';
    }
    if (!draft.brand.trim()) return 'Marca é obrigatória.';
    if (!draft.model.trim()) return 'Modelo é obrigatório.';
    if (!draft.icon.trim())  return 'Ícone (emoji) é obrigatório.';
    if (draft.variants.length === 0) return 'Adicione ao menos uma variante.';
    for (let i = 0; i < draft.variants.length; i++) {
      const v = draft.variants[i];
      if (!v.trim.trim())     return `Variante ${i + 1}: trim obrigatório.`;
      const year = parseInt(v.year, 10);
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return `Variante ${i + 1}: ano inválido.`;
      }
      const fipe = parseFloat(v.fipePrice.replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(fipe) || fipe <= 0) {
        return `Variante ${i + 1}: preço FIPE inválido.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const variants = draft.variants.map((v, i) => {
        const cleanId = v.id.trim() || slugify(`${draft.id}_${v.trim}_${i}`);
        return {
          id:        cleanId,
          trim:      v.trim.trim(),
          year:      parseInt(v.year, 10),
          fipePrice: Math.round(parseFloat(v.fipePrice.replace(/\./g, '').replace(',', '.'))),
        };
      });

      const imageUrls = draft.imageUrls
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => /^https?:\/\//.test(s));

      await api.createCar({
        id:        draft.id.trim(),
        brand:     draft.brand.trim(),
        model:     draft.model.trim(),
        icon:      draft.icon.trim(),
        category:  draft.category,
        variants,
        wikiPt:    draft.wikiPt.trim() || undefined,
        wikiEn:    draft.wikiEn.trim() || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      });
      toast.success(`Carro "${draft.brand} ${draft.model}" criado.`);
      setCreateOpen(false);
      setDraft(EMPTY_DRAFT);
      await reload();
    } catch {
      toast.error('Falha ao salvar carro — veja a aba Erros.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Desativar o carro "${name}"? Ele para de aparecer no mercado, mas mantém histórico.`)) return;
    const ok = await api.deleteCar(id);
    if (ok) {
      toast.success('Carro desativado.');
      await reload();
    } else {
      toast.error('Falha ao desativar.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <CarIcon size={18} className="text-primary" /> Catálogo de carros
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {CAR_MODELS.length} estáticos + {customCars.filter(c => c.active).length} customizados ativos.
          </p>
        </div>
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus size={13} /> Novo carro
        </Button>
      </div>

      {/* Busca + filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, id, categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant={showInactive ? 'default' : 'outline'}
          onClick={() => setShowInactive(v => !v)}
          className="text-xs"
        >
          {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
        </Button>
      </div>

      {/* Lista */}
      {loading && customCars.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          Carregando catálogo...
        </div>
      ) : filtered.length === 0 ? (
        <div className="ios-surface rounded-[12px] p-6 text-center text-sm text-muted-foreground">
          Nenhum carro encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map(c => (
            <div
              key={`${c.source}_${c.id}`}
              className={`ios-surface rounded-[12px] p-3 flex items-center gap-3 ${
                !c.active ? 'opacity-50' : ''
              }`}
            >
              {/* Thumb */}
              <div className="w-16 h-12 rounded-[8px] bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.model}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <ImageOff size={18} className="text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-sm font-bold text-foreground truncate">
                    {c.brand} {c.model}
                  </span>
                  {c.source === 'custom' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      CUSTOM
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      ESTÁTICO
                    </span>
                  )}
                  {!c.active && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                      INATIVO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  <code className="text-[10px]">{c.id}</code> · {c.category} · {c.variantCount} variante{c.variantCount > 1 ? 's' : ''}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.sample && <>{c.sample} · </>}
                  {c.fipeMin > 0 && (
                    c.fipeMin === c.fipeMax ? fmt(c.fipeMin) : `${fmt(c.fipeMin)} – ${fmt(c.fipeMax)}`
                  )}
                </div>
              </div>

              {/* Ações (só pra custom) */}
              {c.source === 'custom' && c.active && (
                <button
                  onClick={() => handleDelete(c.id, `${c.brand} ${c.model}`)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                  aria-label="Desativar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog: criar carro */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={16} /> Novo carro
            </DialogTitle>
            <DialogDescription className="text-xs">
              Será adicionado ao pool do mercado global no próximo refresh.
              Fotos vêm da Wikipedia automaticamente se você preencher o título do artigo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca *">
                <Input
                  placeholder="Honda"
                  value={draft.brand}
                  onChange={e => {
                    const v = e.target.value;
                    setDraft(d => ({ ...d, brand: v }));
                    handleAutoSlug(v, draft.model);
                  }}
                />
              </Field>
              <Field label="Modelo *">
                <Input
                  placeholder="Civic"
                  value={draft.model}
                  onChange={e => {
                    const v = e.target.value;
                    setDraft(d => ({ ...d, model: v }));
                    handleAutoSlug(draft.brand, v);
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="ID (slug) *">
                <Input
                  placeholder="honda_civic"
                  value={draft.id}
                  onChange={e => setDraft(d => ({ ...d, id: e.target.value.toLowerCase() }))}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Ícone (emoji) *">
                <Input
                  placeholder="🚗"
                  value={draft.icon}
                  onChange={e => setDraft(d => ({ ...d, icon: e.target.value.slice(0, 4) }))}
                  className="text-center text-base"
                />
              </Field>
              <Field label="Categoria *">
                <select
                  value={draft.category}
                  onChange={e => setDraft(d => ({ ...d, category: e.target.value as CarCategory }))}
                  className="w-full rounded-[8px] border border-input bg-background px-3 py-2 text-sm h-10"
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Wikipedia PT (título)"
                hint="Ex: 'Honda Civic'. Usado para buscar foto da Wikipedia PT."
              >
                <Input
                  placeholder="Honda Civic"
                  value={draft.wikiPt}
                  onChange={e => setDraft(d => ({ ...d, wikiPt: e.target.value }))}
                />
              </Field>
              <Field
                label="Wikipedia EN (título)"
                hint="Fallback se PT não tiver artigo."
              >
                <Input
                  placeholder="Honda Civic"
                  value={draft.wikiEn}
                  onChange={e => setDraft(d => ({ ...d, wikiEn: e.target.value }))}
                />
              </Field>
            </div>

            <Field
              label="URLs de imagem manuais (opcional)"
              hint="Uma por linha ou separadas por vírgula. Override quando a API falha."
            >
              <textarea
                placeholder="https://exemplo.com/civic1.jpg&#10;https://exemplo.com/civic2.jpg"
                value={draft.imageUrls}
                onChange={e => setDraft(d => ({ ...d, imageUrls: e.target.value }))}
                rows={2}
                className="w-full rounded-[8px] border border-input bg-background px-3 py-2 text-xs font-mono"
              />
            </Field>

            {/* Variantes */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Variantes (trims) *
                </span>
                <Button size="sm" variant="ghost" onClick={addVariant} className="text-xs gap-1">
                  <Plus size={11} /> Adicionar
                </Button>
              </div>
              {draft.variants.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <div className="text-[10px] text-muted-foreground">Trim *</div>
                    <Input
                      placeholder="EXL 2.0 CVT"
                      value={v.trim}
                      onChange={e => updateVariant(i, { trim: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground">Ano *</div>
                    <Input
                      placeholder="2024"
                      value={v.year}
                      onChange={e => updateVariant(i, { year: e.target.value.replace(/\D/g, '') })}
                      className="text-xs"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="col-span-4">
                    <div className="text-[10px] text-muted-foreground">FIPE (R$) *</div>
                    <Input
                      placeholder="155000"
                      value={v.fipePrice}
                      onChange={e => updateVariant(i, { fipePrice: e.target.value })}
                      className="text-xs"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="col-span-1 flex">
                    <button
                      onClick={() => removeVariant(i)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-30"
                      disabled={draft.variants.length === 1}
                      aria-label="Remover variante"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {saving ? 'Salvando...' : 'Salvar carro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground italic">{hint}</p>}
    </div>
  );
}

// Suprime warning do TS sobre AlertCircle nunca usado em alguns paths
void AlertCircle;
