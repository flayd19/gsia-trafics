// =====================================================================
// AdminErrorsTab — visualização dos logs de erros RPC
//
// Mostra os últimos N erros capturados pelo logRpcError em qualquer parte
// do client. Filtros: por nome de função, janela de tempo. Botão de limpar
// logs antigos.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useAdminApi, type AdminErrorLog } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, RefreshCw, Loader2, Trash2, Filter, X } from 'lucide-react';
import { toast } from 'sonner';

const TIME_WINDOWS = [
  { label: 'Última hora',  hours: 1 },
  { label: 'Últimas 24h',  hours: 24 },
  { label: 'Última semana', hours: 24 * 7 },
  { label: 'Últimos 30 dias', hours: 24 * 30 },
  { label: 'Tudo',         hours: null },
] as const;

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleString('pt-BR');
};

export function AdminErrorsTab(): JSX.Element {
  const api = useAdminApi();
  const [logs,     setLogs]     = useState<AdminErrorLog[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [funcFilter, setFuncFilter] = useState('');
  const [windowH,  setWindowH]  = useState<number | null>(24);

  const reload = async () => {
    setLoading(true);
    const sinceIso = windowH != null ? new Date(Date.now() - windowH * 3_600_000).toISOString() : undefined;
    setLogs(await api.listErrorLogs({
      functionName: funcFilter.trim() || undefined,
      sinceIso,
      limit:        500,
    }));
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [windowH]);

  const handleClear = async (days: number) => {
    if (!confirm(`Apagar todos os logs com mais de ${days} dias?`)) return;
    const deleted = await api.clearErrorLogs(days);
    toast.success(`${deleted} logs removidos.`);
    await reload();
  };

  const grouped = useMemo(() => {
    const byFunc = new Map<string, number>();
    for (const l of logs) byFunc.set(l.function_name, (byFunc.get(l.function_name) ?? 0) + 1);
    return Array.from(byFunc.entries()).sort(([, a], [, b]) => b - a);
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" /> Logs de erros RPC
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {logs.length} eventos · capturados via logRpcError no client.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={reload} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Recarregar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleClear(30)}
            className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Trash2 size={13} /> Limpar &gt; 30d
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {TIME_WINDOWS.map(w => (
            <button
              key={w.label}
              onClick={() => setWindowH(w.hours)}
              className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold ${
                windowH === w.hours
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por função (ex: send_money_to_player)..."
            value={funcFilter}
            onChange={e => setFuncFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void reload(); }}
            className="pl-8 text-xs h-8"
          />
          {funcFilter && (
            <button
              onClick={() => { setFuncFilter(''); void reload(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Resumo por função */}
      {grouped.length > 0 && (
        <div className="ios-surface rounded-[12px] p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Top funções com erro
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {grouped.slice(0, 8).map(([fn, count]) => (
              <button
                key={fn}
                onClick={() => { setFuncFilter(fn); void reload(); }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground"
              >
                {fn} <span className="font-semibold ml-1">×{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de logs */}
      {loading && logs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          Carregando logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="ios-surface rounded-[12px] p-6 text-center text-sm text-muted-foreground">
          🎉 Nenhum erro registrado nesse período.
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(l => <LogRow key={l.id} log={l} />)}
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: AdminErrorLog }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="ios-surface rounded-[10px] p-2.5">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">
                {log.function_name}
              </code>
              {log.error_code && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                  {log.error_code}
                </span>
              )}
              {log.user_email && (
                <span className="text-[10px] text-muted-foreground">
                  {log.user_email}
                </span>
              )}
            </div>
            <div className="text-xs text-foreground mt-0.5 truncate">
              {log.error_message}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground shrink-0">
            {fmtTime(log.created_at)}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground font-semibold">Mensagem completa</div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words mt-0.5 p-2 rounded bg-muted/50">
              {log.error_message}
            </pre>
          </div>
          {log.payload != null && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">Payload</div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-words mt-0.5 p-2 rounded bg-muted/50">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">
            {new Date(log.created_at).toLocaleString('pt-BR')}
            {log.user_id && <> · uid: <code className="text-[9px]">{log.user_id}</code></>}
          </div>
        </div>
      )}
    </div>
  );
}
