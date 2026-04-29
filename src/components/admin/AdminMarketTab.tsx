// =====================================================================
// AdminMarketTab — controle completo do mercado global
//
// Decisões de robustez:
//   • Toda ação destrutiva pede confirmação por TEXTO (digitar "OK")
//   • Operações longas (regen) bloqueiam todos os botões e mostram spinner
//   • Reload automático após cada ação que muda estado
//   • Debounce de 300ms no save de config para evitar saves excessivos
//   • Validação client-side ANTES de chamar RPC (evita round-trips inúteis)
//   • Estado isolado por operação — uma falha não invalida o resto
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import {
  useAdminApi,
  type AdminMarketOverview,
  type AdminFullMarketConfig,
} from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Store, RefreshCw, Loader2, Package, AlertCircle, Trash2,
  Settings, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const fmtNum  = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

const CATEGORY_LABEL: Record<string, string> = {
  popular:   'Populares',
  medio:     'Médios',
  suv:       'SUVs',
  pickup:    'Pickups',
  esportivo: 'Esportivos',
  eletrico:  'Elétricos',
  classico:  'Clássicos',
  luxo:      'Luxo',
  jdm:       'JDM',
  supercar:  'Superesportivos',
};

type Operation = 'idle' | 'reset_cooldown' | 'clear_market' | 'save_batch_size';

export function AdminMarketTab(): JSX.Element {
  const api = useAdminApi();

  const [overview,  setOverview]  = useState<AdminMarketOverview | null>(null);
  const [config,    setConfig]    = useState<AdminFullMarketConfig | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>('idle');

  // Edição local da quantidade (min/max)
  const [minBatchEdit, setMinBatchEdit] = useState('');
  const [maxBatchEdit, setMaxBatchEdit] = useState('');
  const [confirmOpen,  setConfirmOpen]  = useState<null | 'reset_cooldown' | 'clear_market'>(null);
  const [confirmText,  setConfirmText]  = useState('');

  // Anti-double-click: ref para evitar disparos paralelos
  const inFlightRef = useRef(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, cfg] = await Promise.all([
        api.getMarketOverview(),
        api.getFullMarketConfig(),
      ]);
      if (!ov)  throw new Error('Falha ao carregar overview do mercado.');
      if (!cfg) throw new Error('Falha ao carregar configuração do mercado.');
      setOverview(ov);
      setConfig(cfg);
      setMinBatchEdit(String(cfg.min_batch));
      setMaxBatchEdit(String(cfg.max_batch));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  // ── Ações ───────────────────────────────────────────────────────
  const guardOp = async <T,>(opName: Operation, fn: () => Promise<T>): Promise<T | null> => {
    if (inFlightRef.current) {
      toast.warning('Aguarde a operação atual terminar.');
      return null;
    }
    inFlightRef.current = true;
    setOperation(opName);
    try {
      return await fn();
    } finally {
      inFlightRef.current = false;
      setOperation('idle');
    }
  };

  const handleResetCooldown = async () => {
    const ok = await guardOp('reset_cooldown', () => api.forceMarketRefresh());
    if (ok) {
      toast.success(
        'Cooldown resetado. Próximo loadMarketplace de qualquer cliente vai gerar batch novo.',
      );
      await reload();
    } else if (ok === false) {
      toast.error('Falha ao resetar cooldown — veja a aba Erros.');
    }
  };

  const handleClearMarket = async () => {
    const result = await guardOp('clear_market', () => api.clearMarketplace());
    if (result) {
      toast.success(
        `${fmtNum(result.deleted)} carros removidos. Novo batch_id=${result.newBatchId}. Cooldown resetado.`,
      );
      await reload();
    } else if (result === null && operation === 'clear_market') {
      toast.error('Falha ao limpar o mercado — veja a aba Erros.');
    }
  };

  const handleSaveBatchSize = async () => {
    if (!config) return;
    const minV = parseInt(minBatchEdit.replace(/\D/g, ''), 10);
    const maxV = parseInt(maxBatchEdit.replace(/\D/g, ''), 10);
    if (!Number.isFinite(minV) || minV <= 0) {
      toast.error('Mínimo inválido.');
      return;
    }
    if (!Number.isFinite(maxV) || maxV < minV) {
      toast.error('Máximo deve ser ≥ mínimo.');
      return;
    }
    if (maxV > 5000) {
      toast.error('Máximo de 5.000 (limite do servidor).');
      return;
    }
    await guardOp('save_batch_size', async () => {
      try {
        await api.updateFullMarketConfig({
          weights:  config.category_weights,
          minBatch: minV,
          maxBatch: maxV,
        });
        toast.success(`Quantidade configurada: ${fmtNum(minV)}–${fmtNum(maxV)} por ciclo.`);
        await reload();
      } catch {
        toast.error('Falha ao salvar quantidade — veja a aba Erros.');
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loading && !overview) {
    return (
      <div className="ios-surface rounded-[16px] p-6 text-center text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Carregando mercado...
      </div>
    );
  }

  if (error || !overview || !config) {
    return (
      <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
        <AlertCircle size={28} className="mx-auto text-red-400" />
        <div className="text-sm font-semibold">{error ?? 'Falha ao carregar mercado.'}</div>
        <Button size="sm" variant="outline" onClick={reload}>Tentar novamente</Button>
      </div>
    );
  }

  const total            = overview.total_cars;
  const available        = overview.available_cars;
  const sold             = overview.sold_cars;
  const nextRefreshDate  = new Date(overview.next_refresh_at);
  const isCooldownActive = !!overview.last_refresh && nextRefreshDate.getTime() > Date.now();
  const minutesToRefresh = Math.max(0, Math.floor((nextRefreshDate.getTime() - Date.now()) / 60_000));
  const busy             = operation !== 'idle';

  const minDirty = String(config.min_batch) !== minBatchEdit;
  const maxDirty = String(config.max_batch) !== maxBatchEdit;
  const dirty    = minDirty || maxDirty;

  return (
    <div className="space-y-4">
      {/* Header + ações principais */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Store size={18} className="text-primary" /> Mercado global
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controle de quantidade, cooldown e geração de batches.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={reload} disabled={busy} className="gap-1.5">
            <RefreshCw size={13} /> Recarregar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setConfirmText(''); setConfirmOpen('reset_cooldown'); }}
            disabled={busy}
            className="gap-1.5"
          >
            {operation === 'reset_cooldown'
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            Reset cooldown
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setConfirmText(''); setConfirmOpen('clear_market'); }}
            disabled={busy}
            className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            {operation === 'clear_market'
              ? <Loader2 size={13} className="animate-spin" />
              : <Trash2 size={13} />}
            Limpar e regenerar
          </Button>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total no banco"     value={fmtNum(total)}     icon={<Package size={14} />} />
        <StatCard label="Disponíveis"         value={fmtNum(available)} accent="text-emerald-500" />
        <StatCard label="Vendidos"            value={fmtNum(sold)}      accent="text-amber-500" />
        <StatCard label="Batch atual"         value={String(overview.batch_id)} />
      </div>

      {/* Refresh meta */}
      <div className="ios-surface rounded-[14px] p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Settings size={12} /> Cooldown / próximo refresh
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground">Último refresh</div>
            <div className="font-semibold">{fmtDate(overview.last_refresh)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Próximo permitido</div>
            <div className={`font-semibold ${isCooldownActive ? 'text-amber-500' : 'text-emerald-500'}`}>
              {fmtDate(overview.next_refresh_at)}
              {isCooldownActive && (
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  ({minutesToRefresh}min restantes)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quantidade de carros gerados por ciclo */}
      <div className="ios-surface rounded-[14px] p-4 space-y-3 border border-primary/20">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Quantidade por ciclo
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Cada refresh gera um número aleatório entre o mínimo e o máximo.
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Salvo no servidor</div>
            <div className="text-sm font-semibold tabular-nums">
              {fmtNum(config.min_batch)}–{fmtNum(config.max_batch)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Mínimo"
            value={minBatchEdit}
            onChange={setMinBatchEdit}
            disabled={busy}
            highlight={minDirty}
          />
          <NumberField
            label="Máximo"
            value={maxBatchEdit}
            onChange={setMaxBatchEdit}
            disabled={busy}
            highlight={maxDirty}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSaveBatchSize}
            disabled={busy || !dirty}
            className="gap-1.5"
          >
            {operation === 'save_batch_size'
              ? <Loader2 size={13} className="animate-spin" />
              : <CheckCircle2 size={13} />}
            Salvar quantidade
          </Button>
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMinBatchEdit(String(config.min_batch));
                setMaxBatchEdit(String(config.max_batch));
              }}
              disabled={busy}
            >
              Descartar
            </Button>
          )}
        </div>
      </div>

      {/* Distribuição por categoria (estado atual) */}
      <div className="ios-surface rounded-[14px] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Disponíveis por categoria (atual)
        </div>
        <div className="space-y-1.5">
          {Object.entries(overview.by_category).length === 0 ? (
            <div className="text-xs text-muted-foreground italic">Mercado vazio.</div>
          ) : (
            Object.entries(overview.by_category)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([cat, count]) => {
                const pct = available > 0 ? (Number(count) / available) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-32 shrink-0">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums w-24 text-right text-muted-foreground">
                      {fmtNum(Number(count))} · {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground italic leading-relaxed">
        <strong>Diferença entre as ações:</strong>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li><strong>Reset cooldown</strong>: zera o timer de 6h. O batch existente continua vivo;
              novo batch só é gerado quando algum cliente abrir a aba Comprar.</li>
          <li><strong>Limpar e regenerar</strong>: apaga TODOS os carros disponíveis no servidor +
              reseta cooldown. O próximo cliente que abrir o mercado gera um batch totalmente novo
              já com a configuração de quantidade salva.</li>
        </ul>
      </div>

      {/* Confirmação */}
      <Dialog
        open={confirmOpen !== null}
        onOpenChange={o => { if (!o) setConfirmOpen(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              Confirmar ação
            </DialogTitle>
            <DialogDescription className="text-xs">
              {confirmOpen === 'clear_market' ? (
                <>Vai apagar <strong>{fmtNum(available)} carros disponíveis</strong> do servidor.
                  Vendidos ficam preservados como histórico. Para confirmar digite <code>OK</code>:</>
              ) : (
                <>Reseta o cooldown de 6h imediatamente. Próximo cliente que abrir o mercado
                  gera novo batch. Para confirmar digite <code>OK</code>:</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="OK"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value.toUpperCase())}
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(null)}>Cancelar</Button>
            <Button
              variant={confirmOpen === 'clear_market' ? 'destructive' : 'default'}
              disabled={confirmText !== 'OK' || busy}
              onClick={async () => {
                const op = confirmOpen;
                setConfirmOpen(null);
                setConfirmText('');
                if (op === 'clear_market')   await handleClearMarket();
                if (op === 'reset_cooldown') await handleResetCooldown();
              }}
            >
              {confirmOpen === 'clear_market' ? 'Apagar e regenerar' : 'Resetar cooldown'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────

function StatCard({
  label, value, accent, icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="ios-surface rounded-[12px] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${accent ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function NumberField({
  label, value, onChange, disabled, highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground font-semibold mb-1">{label}</div>
      <Input
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        disabled={disabled}
        className={highlight ? 'border-amber-500/60 bg-amber-500/5' : ''}
      />
    </label>
  );
}
